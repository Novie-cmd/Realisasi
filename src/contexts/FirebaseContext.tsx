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
  resetQuotaStatus: () => void;
  setSyncError: (error: string | null) => void;
}

const FirebaseContext = createContext<FirebaseContextType | undefined>(undefined);

export function FirebaseProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [skpds, setSkpds] = useState<SKPD[]>([]);
  const [anggarans, setAnggarans] = useState<Anggaran[]>([]);
  const [realisasis, setRealisasis] = useState<Realisasi[]>([]);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [dataLoading, setDataLoading] = useState({ skpds: true, anggarans: true, realisasis: true });
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

  // Load backups on mount
  useEffect(() => {
    try {
      const cachedSkpds = localStorage.getItem('backup_skpds');
      const cachedAnggarans = localStorage.getItem('backup_anggarans');
      const cachedRealisasis = localStorage.getItem('backup_realisasis');
      
      if (cachedSkpds) setSkpds(JSON.parse(cachedSkpds));
      if (cachedAnggarans) setAnggarans(JSON.parse(cachedAnggarans));
      if (cachedRealisasis) setRealisasis(JSON.parse(cachedRealisasis));
    } catch (e) {
      console.warn("Failed to load local backup:", e);
    }
  }, []);

  // Save backups on change (including empty states)
  useEffect(() => {
    localStorage.setItem('backup_skpds', JSON.stringify(skpds));
  }, [skpds]);

  useEffect(() => {
    localStorage.setItem('backup_anggarans', JSON.stringify(anggarans));
  }, [anggarans]);

  useEffect(() => {
    localStorage.setItem('backup_realisasis', JSON.stringify(realisasis));
  }, [realisasis]);

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
      return;
    }

    const unsubSkpd = onSnapshot(collection(db, 'skpds'), (snapshot) => {
      // If snapshot is empty and we had data, we should clear it (unless quota hit)
      if (snapshot.empty) {
        setSkpds([]);
        setDataLoading(prev => ({ ...prev, skpds: false }));
        return;
      }

      setSkpds(prev => {
        const map = new Map<string, SKPD>(prev.map(i => [i.id, i]));
        let changed = false;
        snapshot.docChanges().forEach((change) => {
          const data = { id: change.doc.id, ...change.doc.data() } as SKPD;
          if (change.type === 'removed') {
            if (map.delete(data.id)) changed = true;
          } else {
            map.set(data.id, data);
            changed = true;
          }
        });
        return changed ? Array.from(map.values()) : prev;
      });
      setDataLoading(prev => ({ ...prev, skpds: false }));
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
      if (snapshot.empty) {
        setAnggarans([]);
        setDataLoading(prev => ({ ...prev, anggarans: false }));
        return;
      }

      setAnggarans(prev => {
        const map = new Map<string, Anggaran>(prev.map(i => [i.id, i]));
        let changed = false;
        snapshot.docChanges().forEach((change) => {
          const data = { id: change.doc.id, ...change.doc.data() } as Anggaran;
          if (change.type === 'removed') {
            if (map.delete(data.id)) changed = true;
          } else {
            map.set(data.id, data);
            changed = true;
          }
        });
        return changed ? Array.from(map.values()) : prev;
      });
      setDataLoading(prev => ({ ...prev, anggarans: false }));
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
      if (snapshot.empty) {
        setRealisasis([]);
        setDataLoading(prev => ({ ...prev, realisasis: false }));
        return;
      }

      setRealisasis(prev => {
        const map = new Map<string, Realisasi>(prev.map(i => [i.id, i]));
        let changed = false;
        snapshot.docChanges().forEach((change) => {
          const data = { id: change.doc.id, ...change.doc.data() } as Realisasi;
          if (change.type === 'removed') {
            if (map.delete(data.id)) changed = true;
          } else {
            map.set(data.id, data);
            changed = true;
          }
        });
        // Realisasis should maintain sort order from query
        if (changed) {
          return Array.from(map.values()).sort((a, b) => b.tanggal.localeCompare(a.tanggal));
        }
        return prev;
      });
      setDataLoading(prev => ({ ...prev, realisasis: false }));
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

    if (quotaExceeded) return;

    const chunks = [];
    for (let i = 0; i < data.length; i += 500) {
      chunks.push(data.slice(i, i + 500));
    }

    for (const chunk of chunks) {
      const batch = writeBatch(db);
      chunk.forEach(item => {
        batch.set(doc(db, 'skpds', item.id), item);
      });
      try {
        await batch.commit();
      } catch (err) {
        handleAsyncError(err);
        try {
          handleFirestoreError(err, 'write', 'skpds/bulk');
        } catch (e: any) {
          if (e.message === 'QUOTA_EXCEEDED') break; // Stop trying if quota hit
          throw e;
        }
      }
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

    if (quotaExceeded) return;

    const chunks = [];
    for (let i = 0; i < listToDelete.length; i += 500) {
      chunks.push(listToDelete.slice(i, i + 500));
    }

    for (const chunk of chunks) {
      const batch = writeBatch(db);
      chunk.forEach(item => {
        batch.delete(doc(db, 'skpds', item.id));
      });
      try {
        await batch.commit();
      } catch (err) {
        handleAsyncError(err);
        try {
          handleFirestoreError(err, 'delete', 'skpds/bulk');
        } catch (e: any) {
          if (e.message === 'QUOTA_EXCEEDED') break;
          throw e;
        }
      }
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

    if (quotaExceeded) return;

    // Firestore batches are limited to 500 ops
    const chunks = [];
    for (let i = 0; i < data.length; i += 500) {
      chunks.push(data.slice(i, i + 500));
    }

    for (const chunk of chunks) {
      const batch = writeBatch(db);
      chunk.forEach(item => {
        batch.set(doc(db, 'anggarans', item.id), item);
      });
      try {
        await batch.commit();
      } catch (err) {
        handleAsyncError(err);
        try {
          handleFirestoreError(err, 'write', 'anggarans/bulk');
        } catch (e: any) {
          if (e.message === 'QUOTA_EXCEEDED') break;
          throw e;
        }
      }
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

    if (quotaExceeded) return;

    const chunks = [];
    for (let i = 0; i < listToDelete.length; i += 500) {
      chunks.push(listToDelete.slice(i, i + 500));
    }

    for (const chunk of chunks) {
      const batch = writeBatch(db);
      chunk.forEach(item => {
        batch.delete(doc(db, 'anggarans', item.id));
      });
      try {
        await batch.commit();
      } catch (err) {
        handleAsyncError(err);
        try {
          handleFirestoreError(err, 'delete', 'anggarans/bulk');
        } catch (e: any) {
          if (e.message === 'QUOTA_EXCEEDED') break;
          throw e;
        }
      }
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
      return Array.from(map.values()).sort((a, b) => b.tanggal.localeCompare(a.tanggal));
    });

    if (quotaExceeded) return;

    const chunks = [];
    for (let i = 0; i < data.length; i += 500) {
      chunks.push(data.slice(i, i + 500));
    }

    for (const chunk of chunks) {
      const batch = writeBatch(db);
      chunk.forEach(item => {
        batch.set(doc(db, 'realisasis', item.id), item);
      });
      try {
        await batch.commit();
      } catch (err) {
        handleAsyncError(err);
        try {
          handleFirestoreError(err, 'write', 'realisasis/bulk');
        } catch (e: any) {
          if (e.message === 'QUOTA_EXCEEDED') break;
          throw e;
        }
      }
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

    if (quotaExceeded) return;

    const chunks = [];
    for (let i = 0; i < listToDelete.length; i += 500) {
      chunks.push(listToDelete.slice(i, i + 500));
    }

    for (const chunk of chunks) {
      const batch = writeBatch(db);
      chunk.forEach(item => {
        batch.delete(doc(db, 'realisasis', item.id));
      });
      try {
        await batch.commit();
      } catch (err) {
        handleAsyncError(err);
        try {
          handleFirestoreError(err, 'delete', 'realisasis/bulk');
        } catch (e: any) {
          if (e.message === 'QUOTA_EXCEEDED') break;
          throw e;
        }
      }
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
      login, logout, 
      saveSKPD, saveSKPDsBulk, deleteSKPD, deleteAllSKPDs,
      saveAnggaran, saveAnggaransBulk, deleteAnggaran, deleteAllAnggarans,
      saveRealisasi, saveRealisasisBulk, deleteRealisasi, deleteAllRealisasi,
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
