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
  writeBatch
} from 'firebase/firestore';
import { auth, db, googleProvider, handleFirestoreError, testFirestoreConnection } from '../lib/firebase';
import { SKPD, Anggaran, Realisasi } from '../lib/types';

interface FirebaseContextType {
  user: User | null;
  loading: boolean;
  syncError: string | null;
  dataLoading: { skpds: boolean; anggarans: boolean; realisasis: boolean };
  skpds: SKPD[];
  anggarans: Anggaran[];
  realisasis: Realisasi[];
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

  useEffect(() => {
    testFirestoreConnection();
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
      
      if (u) {
        // Create/Update user profile
        setDoc(doc(db, 'users', u.uid), {
          email: u.email,
          name: u.displayName,
          lastLogin: new Date().toISOString()
        }, { merge: true });
      }
    });

    return unsubscribe;
  }, []);

  // Real-time listeners
  useEffect(() => {
    if (!user) {
      setSkpds([]);
      setAnggarans([]);
      setRealisasis([]);
      return;
    }

    const unsubSkpd = onSnapshot(collection(db, 'skpds'), (snapshot) => {
      setSkpds(prev => {
        const map = new Map(prev.map(i => [i.id, i]));
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
      console.error("SKPD Sync Error:", err);
      setSyncError("Gagal sinkronisasi SKPD. Periksa koneksi atau hak akses.");
      setDataLoading(prev => ({ ...prev, skpds: false }));
    });

    const unsubAnggaran = onSnapshot(collection(db, 'anggarans'), (snapshot) => {
      setAnggarans(prev => {
        const map = new Map(prev.map(i => [i.id, i]));
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
      console.error("Anggaran Sync Error:", err);
      setSyncError("Gagal sinkronisasi Anggaran. Periksa koneksi atau hak akses.");
      setDataLoading(prev => ({ ...prev, anggarans: false }));
    });

    const unsubRealisasi = onSnapshot(query(collection(db, 'realisasis'), orderBy('tanggal', 'desc')), (snapshot) => {
      setRealisasis(prev => {
        const map = new Map(prev.map(i => [i.id, i]));
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
      console.error("Realisasi Sync Error:", err);
      setSyncError("Gagal sinkronisasi Realisasi. Periksa koneksi atau hak akses.");
      setDataLoading(prev => ({ ...prev, realisasis: false }));
    });

    return () => {
      unsubSkpd();
      unsubAnggaran();
      unsubRealisasi();
    };
  }, [user]);

  const login = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      console.error("Login Error", err);
    }
  };

  const logout = () => signOut(auth);

  const saveSKPD = async (data: SKPD) => {
    try {
      await setDoc(doc(db, 'skpds', data.id), data);
    } catch (err) { handleFirestoreError(err, 'create', `skpds/${data.id}`); }
  };

  const saveSKPDsBulk = async (data: SKPD[]) => {
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
        handleFirestoreError(err, 'write', 'skpds/bulk');
      }
    }
  };

  const deleteSKPD = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'skpds', id));
    } catch (err) { handleFirestoreError(err, 'delete', `skpds/${id}`); }
  };

  const deleteAllSKPDs = async () => {
    const chunks = [];
    for (let i = 0; i < skpds.length; i += 500) {
      chunks.push(skpds.slice(i, i + 500));
    }

    for (const chunk of chunks) {
      const batch = writeBatch(db);
      chunk.forEach(item => {
        batch.delete(doc(db, 'skpds', item.id));
      });
      try {
        await batch.commit();
      } catch (err) {
        handleFirestoreError(err, 'delete', 'skpds/bulk');
      }
    }
  };

  const saveAnggaran = async (data: Anggaran) => {
    try {
      await setDoc(doc(db, 'anggarans', data.id), data);
    } catch (err) { handleFirestoreError(err, 'create', `anggarans/${data.id}`); }
  };

  const saveAnggaransBulk = async (data: Anggaran[]) => {
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
        handleFirestoreError(err, 'write', 'anggarans/bulk');
      }
    }
  };

  const deleteAnggaran = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'anggarans', id));
    } catch (err) { handleFirestoreError(err, 'delete', `anggarans/${id}`); }
  };

  const deleteAllAnggarans = async () => {
    const chunks = [];
    for (let i = 0; i < anggarans.length; i += 500) {
      chunks.push(anggarans.slice(i, i + 500));
    }

    for (const chunk of chunks) {
      const batch = writeBatch(db);
      chunk.forEach(item => {
        batch.delete(doc(db, 'anggarans', item.id));
      });
      try {
        await batch.commit();
      } catch (err) {
        handleFirestoreError(err, 'delete', 'anggarans/bulk');
      }
    }
  };

  const saveRealisasi = async (data: Realisasi) => {
    try {
      await setDoc(doc(db, 'realisasis', data.id), data);
    } catch (err) { handleFirestoreError(err, 'create', `realisasis/${data.id}`); }
  };

  const saveRealisasisBulk = async (data: Realisasi[]) => {
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
        handleFirestoreError(err, 'write', 'realisasis/bulk');
      }
    }
  };

  const deleteRealisasi = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'realisasis', id));
    } catch (err) { handleFirestoreError(err, 'delete', `realisasis/${id}`); }
  };

  const deleteAllRealisasi = async () => {
    const chunks = [];
    for (let i = 0; i < realisasis.length; i += 500) {
      chunks.push(realisasis.slice(i, i + 500));
    }

    for (const chunk of chunks) {
      const batch = writeBatch(db);
      chunk.forEach(item => {
        batch.delete(doc(db, 'realisasis', item.id));
      });
      try {
        await batch.commit();
      } catch (err) {
        handleFirestoreError(err, 'delete', 'realisasis/bulk');
      }
    }
  };

  return (
    <FirebaseContext.Provider value={{ 
      user, loading, syncError, dataLoading, skpds, anggarans, realisasis, 
      login, logout, 
      saveSKPD, saveSKPDsBulk, deleteSKPD, deleteAllSKPDs,
      saveAnggaran, saveAnggaransBulk, deleteAnggaran, deleteAllAnggarans,
      saveRealisasi, saveRealisasisBulk, deleteRealisasi, deleteAllRealisasi
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
