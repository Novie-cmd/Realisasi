import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  User, 
  onAuthStateChanged, 
  signInWithPopup, 
  signOut 
} from 'firebase/auth';
import { 
  collection, 
  onSnapshot, 
  doc, 
  setDoc, 
  deleteDoc, 
  query, 
  orderBy,
  writeBatch,
  getDocFromServer
} from 'firebase/firestore';
import { auth, db, googleProvider, handleFirestoreError } from '../lib/firebase';
import { SKPD, Anggaran, Realisasi } from '../lib/types';

interface FirebaseContextType {
  user: User | null;
  loading: boolean;
  syncError: string | null;
  dataLoading: { skpds: boolean; anggarans: boolean; realisasis: boolean };
  skpds: SKPD[];
  anggarans: Anggaran[];
  realisasis: Realisasi[];
  quotaExceeded: boolean;
  isSyncing: boolean;
  syncProgress: number; // 0 to 100
  login: () => Promise<void>;
  logout: () => Promise<void>;
  saveSKPD: (data: SKPD) => Promise<void>;
  saveSKPDsBulk: (data: SKPD[]) => Promise<void>;
  deleteSKPD: (id: string) => Promise<void>;
  saveAnggaran: (data: Anggaran) => Promise<void>;
  saveAnggaransBulk: (data: Anggaran[]) => Promise<void>;
  deleteAnggaran: (id: string) => Promise<void>;
  saveRealisasi: (data: Realisasi) => Promise<void>;
  saveRealisasisBulk: (data: Realisasi[]) => Promise<void>;
  deleteRealisasi: (id: string) => Promise<void>;
  deleteAllRealisasi: () => Promise<void>;
  deleteAllSKPDs: () => Promise<void>;
  deleteAllAnggarans: () => Promise<void>;
  clearAllData: () => Promise<void>;
  resetQuotaStatus: () => void;
  setSyncError: (error: string | null) => void;
}

const FirebaseContext = createContext<FirebaseContextType | undefined>(undefined);

export function FirebaseProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [skpds, setSkpds] = useState<SKPD[]>(() => {
    try {
      const cached = localStorage.getItem('backup_skpds');
      if (cached) {
        const parsed = JSON.parse(cached);
        return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
      }
    } catch {}
    return [];
  });
  const [anggarans, setAnggarans] = useState<Anggaran[]>(() => {
    try {
      const cached = localStorage.getItem('backup_anggarans');
      if (cached) {
        const parsed = JSON.parse(cached);
        return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
      }
    } catch {}
    return [];
  });
  const [realisasis, setRealisasis] = useState<Realisasi[]>(() => {
    try {
      const cached = localStorage.getItem('backup_realisasis');
      if (cached) {
        const parsed = JSON.parse(cached);
        return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
      }
    } catch {}
    return [];
  });
  
  const [syncError, setSyncError] = useState<string | null>(null);
  const [dataLoading, setDataLoading] = useState({ skpds: true, anggarans: true, realisasis: true });
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [quotaExceeded, setQuotaExceeded] = useState(() => {
    try {
      const stored = localStorage.getItem('quota_exceeded');
      if (stored) {
        const { exceeded, timestamp } = JSON.parse(stored);
        // Reset after 24 hours
        if (exceeded && Date.now() - timestamp < 24 * 60 * 60 * 1000) {
          return true;
        }
      }
    } catch (e) {
      console.warn("Failed to load quota status:", e);
    }
    return false;
  });

  const [isSyncing, setIsSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState(0);

  // Prevent accidental close/refresh during sync
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isSyncing) {
        e.preventDefault();
        e.returnValue = ''; // Standard browser prompt
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isSyncing]);

  // Persist quota status
  useEffect(() => {
    if (quotaExceeded) {
      localStorage.setItem('quota_exceeded', JSON.stringify({
        exceeded: true,
        timestamp: Date.now()
      }));
    } else {
      localStorage.removeItem('quota_exceeded');
    }
  }, [quotaExceeded]);

  // Save backups on change (including empty states) with shorter debounce for better persistence
  // Skip during sync to avoid blocking main thread with heavy JSON stringify
  useEffect(() => {
    if (isSyncing) return;
    const timer = setTimeout(() => {
      try {
        localStorage.setItem('backup_skpds', JSON.stringify(skpds));
      } catch (e) {
        console.warn("Storage error for SKPD:", e);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [skpds, isSyncing]);

  useEffect(() => {
    if (isSyncing) return;
    const timer = setTimeout(() => {
      try {
        localStorage.setItem('backup_anggarans', JSON.stringify(anggarans));
      } catch (e) {
        console.warn("Storage error for Anggaran:", e);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [anggarans, isSyncing]);

  useEffect(() => {
    if (isSyncing) return;
    const timer = setTimeout(() => {
      try {
        localStorage.setItem('backup_realisasis', JSON.stringify(realisasis));
      } catch (e) {
        console.warn("Storage error for Realisasi:", e);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [realisasis, isSyncing]);

  const handleAsyncError = (err: any) => {
    try {
      handleFirestoreError(err, 'list');
    } catch (e: any) {
      if (e.message === 'QUOTA_EXCEEDED') {
        if (!quotaExceeded) {
          setQuotaExceeded(true);
          setSyncError("Peringatan: Kuota database hari ini habis. Aplikasi beralih ke Mode Offline (Menggunakan data cadangan).");
        }
        return;
      }
      
      if (!syncError) {
        try {
          const errorDetail = JSON.parse(e.message);
          setSyncError(`Sinkronisasi Gagal: ${errorDetail.error}`);
        } catch {
          setSyncError(`Koneksi Bermasalah: ${err.code || 'Error'}`);
        }
      }
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
      
      if (u && !quotaExceeded) {
        // Only update profile if we haven't hit quota
        // and only periodically (using session storage to track)
        const lastSync = sessionStorage.getItem(`user_sync_${u.uid}`);
        const now = Date.now();
        
        if (!lastSync || (now - parseInt(lastSync)) > 3600000) { // 1 hour
          setDoc(doc(db, 'users', u.uid), {
            email: u.email,
            name: u.displayName,
            lastLogin: new Date().toISOString()
          }, { merge: true }).then(() => {
            sessionStorage.setItem(`user_sync_${u.uid}`, now.toString());
          }).catch(err => {
            if (err.code === 'resource-exhausted') {
               setQuotaExceeded(true);
            }
          });
        }
      }
    });

    return unsubscribe;
  }, [quotaExceeded]);

  // Real-time listeners
  useEffect(() => {
    if (!user || quotaExceeded) {
      if (!user) {
        setSkpds([]);
        setAnggarans([]);
        setRealisasis([]);
      }
      // If we're not syncing with cloud, mark as loaded immediately to stop spinners
      setDataLoading({ skpds: false, anggarans: false, realisasis: false });
      return;
    }

    const unsubSkpd = onSnapshot(collection(db, 'skpds'), (snapshot) => {
      setDataLoading(prev => ({ ...prev, skpds: false }));
      
      // Don't overwrite local state if we have pending writes (e.g. bulk import in progress)
      if (snapshot.metadata.hasPendingWrites) return;
      
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SKPD));
      setSkpds(data);
    }, (err) => {
      if (err.code === 'resource-exhausted') {
        handleAsyncError(err);
      } else {
        console.error("SKPD Sync Error:", err.code, err.message);
        handleAsyncError(err);
      }
      setDataLoading(prev => ({ ...prev, skpds: false }));
    });

    const unsubAnggaran = onSnapshot(collection(db, 'anggarans'), (snapshot) => {
      setDataLoading(prev => ({ ...prev, anggarans: false }));

      // Don't overwrite local state if we have pending writes
      if (snapshot.metadata.hasPendingWrites) return;

      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Anggaran));
      setAnggarans(data);
    }, (err) => {
      if (err.code === 'resource-exhausted') {
        handleAsyncError(err);
      } else {
        console.error("Anggaran Sync Error:", err.code, err.message);
        handleAsyncError(err);
      }
      setDataLoading(prev => ({ ...prev, anggarans: false }));
    });

    const unsubRealisasi = onSnapshot(query(collection(db, 'realisasis'), orderBy('tanggal', 'desc')), (snapshot) => {
      setDataLoading(prev => ({ ...prev, realisasis: false }));

      // Don't overwrite local state if we have pending writes
      if (snapshot.metadata.hasPendingWrites) return;

      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Realisasi));
      setRealisasis(data);
    }, (err) => {
      if (err.code === 'resource-exhausted') {
        handleAsyncError(err);
      } else {
        console.error("Realisasi Sync Error:", err.code, err.message);
        handleAsyncError(err);
      }
      setDataLoading(prev => ({ ...prev, realisasis: false }));
    });

    return () => {
      unsubSkpd();
      unsubAnggaran();
      unsubRealisasi();
    };
  }, [user, quotaExceeded]);

  const login = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      console.error("Login Error", err);
    }
  };

  const logout = () => signOut(auth);

  const saveSKPD = async (data: SKPD) => {
    // Optimistic local update
    setSkpds(prev => {
      const filtered = prev.filter(i => i.id !== data.id);
      return [...filtered, data];
    });

    if (quotaExceeded) return;

    try {
      await setDoc(doc(db, 'skpds', data.id), data);
    } catch (err) { 
      handleAsyncError(err);
      // Don't re-throw 'QUOTA_EXCEEDED' as fatal, we handled it optimistically
      try {
        handleFirestoreError(err, 'create', `skpds/${data.id}`);
      } catch (e: any) {
        if (e.message !== 'QUOTA_EXCEEDED') throw e;
      }
    }
  };

  const saveSKPDsBulk = async (data: SKPD[]) => {
    // Optimistic local update
    setSkpds(prev => {
      const map = new Map<string, SKPD>(prev.map(i => [i.id, i]));
      data.forEach(item => map.set(item.id, item));
      return Array.from(map.values());
    });

    if (quotaExceeded) {
      setSyncError("Peringatan: Kuota database habis. Data hanya disimpan secara lokal.");
      return;
    }

    setIsSyncing(true);
    setSyncProgress(0.5); 

    const batchSize = 100; // Smaller size for more frequent UI updates
    const chunks = [];
    for (let i = 0; i < data.length; i += batchSize) {
      chunks.push(data.slice(i, i + batchSize));
    }

    try {
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const batch = writeBatch(db);
        chunk.forEach(item => {
          batch.set(doc(db, 'skpds', item.id), item);
        });
        
        await batch.commit();
        // Use more granular progress with decimal
        const currentProgress = Number(((i + 1) / chunks.length * 100).toFixed(1));
        setSyncProgress(currentProgress);
      }
    } catch (err) {
      console.error("Bulk SKPD Sync Error:", err);
      handleAsyncError(err);
    } finally {
      setIsSyncing(false);
      setSyncProgress(100);
    }
  };

  const deleteSKPD = async (id: string) => {
    // Optimistic local delete
    setSkpds(prev => prev.filter(i => i.id !== id));

    if (quotaExceeded) return;

    try {
      await deleteDoc(doc(db, 'skpds', id));
    } catch (err) { 
      handleAsyncError(err);
      try {
        handleFirestoreError(err, 'delete', `skpds/${id}`);
      } catch (e: any) {
        if (e.message !== 'QUOTA_EXCEEDED') throw e;
      }
    }
  };

  const deleteAllSKPDs = async () => {
    const listToDelete = [...skpds];
    // Optimistic local clear
    setSkpds([]);

    if (quotaExceeded) {
      setSyncError("Peringatan: Kuota database habis. Penghapusan di server ditunda.");
      return;
    }

    setIsSyncing(true);
    setSyncProgress(0.5);

    const batchSize = 100;
    const chunks = [];
    for (let i = 0; i < listToDelete.length; i += batchSize) {
      chunks.push(listToDelete.slice(i, i + batchSize));
    }

    try {
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const batch = writeBatch(db);
        chunk.forEach(item => {
          batch.delete(doc(db, 'skpds', item.id));
        });
        await batch.commit();
        const currentProgress = Number(((i + 1) / chunks.length * 100).toFixed(1));
        setSyncProgress(currentProgress);
      }
    } catch (err) {
      console.error("Bulk Delete SKPD Error:", err);
      handleAsyncError(err);
    } finally {
      setIsSyncing(false);
      setSyncProgress(100);
    }
  };

  const saveAnggaran = async (data: Anggaran) => {
    // Optimistic local update
    setAnggarans(prev => {
      const filtered = prev.filter(i => i.id !== data.id);
      return [...filtered, data];
    });

    if (quotaExceeded) return;

    try {
      await setDoc(doc(db, 'anggarans', data.id), data);
    } catch (err) { 
      handleAsyncError(err);
      try {
        handleFirestoreError(err, 'create', `anggarans/${data.id}`);
      } catch (e: any) {
        if (e.message !== 'QUOTA_EXCEEDED') throw e;
      }
    }
  };

  const saveAnggaransBulk = async (data: Anggaran[]) => {
    // Optimistic local update
    setAnggarans(prev => {
      const map = new Map<string, Anggaran>(prev.map(i => [i.id, i]));
      data.forEach(item => map.set(item.id, item));
      return Array.from(map.values());
    });

    if (quotaExceeded) {
       setSyncError("Peringatan: Kuota database habis. Data hanya disimpan secara lokal.");
       return;
    }

    setIsSyncing(true);
    setSyncProgress(0.5);

    const batchSize = 100;
    const chunks = [];
    for (let i = 0; i < data.length; i += batchSize) {
      chunks.push(data.slice(i, i + batchSize));
    }

    try {
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const batch = writeBatch(db);
        chunk.forEach(item => {
          batch.set(doc(db, 'anggarans', item.id), item);
        });
        
        await batch.commit();
        const currentProgress = Number(((i + 1) / chunks.length * 100).toFixed(1));
        setSyncProgress(currentProgress);
      }
    } catch (err) {
      console.error("Bulk Anggaran Sync Error:", err);
      handleAsyncError(err);
    } finally {
      setIsSyncing(false);
      setSyncProgress(100);
    }
  };

  const deleteAnggaran = async (id: string) => {
    // Optimistic local delete
    setAnggarans(prev => prev.filter(i => i.id !== id));

    if (quotaExceeded) return;

    try {
      await deleteDoc(doc(db, 'anggarans', id));
    } catch (err) { 
      handleAsyncError(err);
      try {
        handleFirestoreError(err, 'delete', `anggarans/${id}`);
      } catch (e: any) {
        if (e.message !== 'QUOTA_EXCEEDED') throw e;
      }
    }
  };

  const deleteAllAnggarans = async () => {
    const listToDelete = [...anggarans];
    // Optimistic local clear
    setAnggarans([]);

    if (quotaExceeded) {
       setSyncError("Peringatan: Kuota database habis. Penghapusan di server ditunda.");
       return;
    }

    setIsSyncing(true);
    setSyncProgress(0.5);

    const batchSize = 100;
    const chunks = [];
    for (let i = 0; i < listToDelete.length; i += batchSize) {
      chunks.push(listToDelete.slice(i, i + batchSize));
    }

    try {
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const batch = writeBatch(db);
        chunk.forEach(item => {
          batch.delete(doc(db, 'anggarans', item.id));
        });
        await batch.commit();
        const currentProgress = Number(((i + 1) / chunks.length * 100).toFixed(1));
        setSyncProgress(currentProgress);
      }
    } catch (err) {
      console.error("Bulk Delete Anggaran Error:", err);
      handleAsyncError(err);
    } finally {
      setIsSyncing(false);
      setSyncProgress(100);
    }
  };

  const saveRealisasi = async (data: Realisasi) => {
    // Optimistic local update
    setRealisasis(prev => {
      const filtered = prev.filter(i => i.id !== data.id);
      const updated = [...filtered, data];
      return updated.sort((a, b) => b.tanggal.localeCompare(a.tanggal));
    });

    if (quotaExceeded) return;

    try {
      await setDoc(doc(db, 'realisasis', data.id), data);
    } catch (err) { 
      handleAsyncError(err);
      try {
        handleFirestoreError(err, 'create', `realisasis/${data.id}`);
      } catch (e: any) {
        if (e.message !== 'QUOTA_EXCEEDED') throw e;
      }
    }
  };

  const saveRealisasisBulk = async (data: Realisasi[]) => {
    // Optimistic local update
    setRealisasis(prev => {
      const map = new Map<string, Realisasi>(prev.map(i => [i.id, i]));
      data.forEach(item => map.set(item.id, item));
      return Array.from(map.values()).sort((a, b) => (b?.tanggal || '').localeCompare(a?.tanggal || ''));
    });

    if (quotaExceeded) {
       setSyncError("Peringatan: Kuota database habis. Data hanya disimpan secara lokal.");
       return;
    }

    setIsSyncing(true);
    setSyncProgress(0.5);

    const batchSize = 100;
    const chunks = [];
    for (let i = 0; i < data.length; i += batchSize) {
      chunks.push(data.slice(i, i + batchSize));
    }

    try {
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const batch = writeBatch(db);
        chunk.forEach(item => {
          batch.set(doc(db, 'realisasis', item.id), item);
        });
        
        await batch.commit();
        const currentProgress = Number(((i + 1) / chunks.length * 100).toFixed(1));
        setSyncProgress(currentProgress);
      }
    } catch (err) {
      console.error("Bulk Realisasi Sync Error:", err);
      handleAsyncError(err);
    } finally {
      setIsSyncing(false);
      setSyncProgress(100);
    }
  };

  const deleteRealisasi = async (id: string) => {
    // Optimistic local delete
    setRealisasis(prev => prev.filter(i => i.id !== id));

    if (quotaExceeded) return;

    try {
      await deleteDoc(doc(db, 'realisasis', id));
    } catch (err) { 
      handleAsyncError(err);
      try {
        handleFirestoreError(err, 'delete', `realisasis/${id}`);
      } catch (e: any) {
        if (e.message !== 'QUOTA_EXCEEDED') throw e;
      }
    }
  };

  const deleteAllRealisasi = async () => {
    const listToDelete = [...realisasis];
    // Optimistic local clear
    setRealisasis([]);

    if (quotaExceeded) {
       setSyncError("Peringatan: Kuota database habis. Penghapusan di server ditunda.");
       return;
    }

    setIsSyncing(true);
    setSyncProgress(0.5);

    const batchSize = 100;
    const chunks = [];
    for (let i = 0; i < listToDelete.length; i += batchSize) {
      chunks.push(listToDelete.slice(i, i + batchSize));
    }

    try {
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const batch = writeBatch(db);
        chunk.forEach(item => {
          batch.delete(doc(db, 'realisasis', item.id));
        });
        await batch.commit();
        const currentProgress = Number(((i + 1) / chunks.length * 100).toFixed(1));
        setSyncProgress(currentProgress);
      }
    } catch (err) {
      console.error("Bulk Delete Realisasi Error:", err);
      handleAsyncError(err);
    } finally {
      setIsSyncing(false);
      setSyncProgress(100);
    }
  };

  const clearAllData = async () => {
    // 1. Clear Local State immediately for responsiveness
    setSkpds([]);
    setAnggarans([]);
    setRealisasis([]);
    
    // Clear backups
    localStorage.removeItem('backup_skpds');
    localStorage.removeItem('backup_anggarans');
    localStorage.removeItem('backup_realisasis');

    if (quotaExceeded) {
      setSyncError("Peringatan: Kuota database habis. Penghapusan di server ditunda.");
      return;
    }

    setIsSyncing(true);
    setSyncProgress(0.5);

    const batchSize = 100;

    try {
      // 2. Perform deletions in Firestore sequentially to handle progress
      // Deleting Realisasi
      const rlCopy = [...realisasis];
      if (rlCopy.length > 0) {
        const chunks = [];
        for (let i = 0; i < rlCopy.length; i += batchSize) chunks.push(rlCopy.slice(i, i + batchSize));
        for (let i = 0; i < chunks.length; i++) {
          const batch = writeBatch(db);
          chunks[i].forEach(item => batch.delete(doc(db, 'realisasis', item.id)));
          await batch.commit();
          const prog = Number(((i + 1) / chunks.length * 33).toFixed(1));
          setSyncProgress(prog); // First 33%
        }
      }

      // Deleting Anggaran
      const agCopy = [...anggarans];
      if (agCopy.length > 0) {
        const chunks = [];
        for (let i = 0; i < agCopy.length; i += batchSize) chunks.push(agCopy.slice(i, i + batchSize));
        for (let i = 0; i < chunks.length; i++) {
          const batch = writeBatch(db);
          chunks[i].forEach(item => batch.delete(doc(db, 'anggarans', item.id)));
          await batch.commit();
          const prog = Number((33 + (i + 1) / chunks.length * 33).toFixed(1));
          setSyncProgress(prog); // Up to 66%
        }
      }

      // Deleting SKPD
      const skCopy = [...skpds];
      if (skCopy.length > 0) {
        const chunks = [];
        for (let i = 0; i < skCopy.length; i += batchSize) chunks.push(skCopy.slice(i, i + batchSize));
        for (let i = 0; i < chunks.length; i++) {
          const batch = writeBatch(db);
          chunks[i].forEach(item => batch.delete(doc(db, 'skpds', item.id)));
          await batch.commit();
          const prog = Number((66 + (i + 1) / chunks.length * 34).toFixed(1));
          setSyncProgress(prog); // Up to 100%
        }
      }
    } catch (err) {
      console.error("Clear All Data Sync Error:", err);
      handleAsyncError(err);
    } finally {
      setIsSyncing(false);
      setSyncProgress(100);
    }
  };

  const resetQuotaStatus = () => {
    localStorage.removeItem('quota_exceeded');
    setQuotaExceeded(false);
    setSyncError(null);
  };

  return (
    <FirebaseContext.Provider value={{ 
      user, loading, syncError, dataLoading, skpds, anggarans, realisasis, quotaExceeded,
      isSyncing, syncProgress,
      login, logout, 
      saveSKPD, saveSKPDsBulk, deleteSKPD, deleteAllSKPDs,
      saveAnggaran, saveAnggaransBulk, deleteAnggaran, deleteAllAnggarans,
      saveRealisasi, saveRealisasisBulk, deleteRealisasi, deleteAllRealisasi,
      clearAllData,
      resetQuotaStatus,
      setSyncError
    }}>
      {children}
    </FirebaseContext.Provider>
  );
}

export function useFirebase() {
  const context = useContext(FirebaseContext);
  if (context === undefined) {
    throw new Error('useFirebase must be used within a FirebaseProvider');
  }
  return context;
}
