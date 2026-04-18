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
        const next = [...prev];
        snapshot.docChanges().forEach((change) => {
          const data = { id: change.doc.id, ...change.doc.data() } as SKPD;
          if (change.type === 'added') {
            const index = next.findIndex(i => i.id === data.id);
            if (index === -1) next.push(data);
          } else if (change.type === 'modified') {
            const index = next.findIndex(i => i.id === data.id);
            if (index > -1) next[index] = data;
          } else if (change.type === 'removed') {
            const index = next.findIndex(i => i.id === data.id);
            if (index > -1) next.splice(index, 1);
          }
        });
        return next;
      });
      setDataLoading(prev => ({ ...prev, skpds: false }));
    }, (err) => {
      console.error("SKPD Sync Error:", err);
      setSyncError("Gagal sinkronisasi SKPD. Periksa koneksi atau hak akses.");
      setDataLoading(prev => ({ ...prev, skpds: false }));
    });

    const unsubAnggaran = onSnapshot(collection(db, 'anggarans'), (snapshot) => {
      setAnggarans(prev => {
        const next = [...prev];
        snapshot.docChanges().forEach((change) => {
          const data = { id: change.doc.id, ...change.doc.data() } as Anggaran;
          if (change.type === 'added') {
            const index = next.findIndex(i => i.id === data.id);
            if (index === -1) next.push(data);
          } else if (change.type === 'modified') {
            const index = next.findIndex(i => i.id === data.id);
            if (index > -1) next[index] = data;
          } else if (change.type === 'removed') {
            const index = next.findIndex(i => i.id === data.id);
            if (index > -1) next.splice(index, 1);
          }
        });
        return next;
      });
      setDataLoading(prev => ({ ...prev, anggarans: false }));
    }, (err) => {
      console.error("Anggaran Sync Error:", err);
      setSyncError("Gagal sinkronisasi Anggaran. Periksa koneksi atau hak akses.");
      setDataLoading(prev => ({ ...prev, anggarans: false }));
    });

    const unsubRealisasi = onSnapshot(query(collection(db, 'realisasis'), orderBy('tanggal', 'desc')), (snapshot) => {
      setRealisasis(prev => {
        const next = [...prev];
        snapshot.docChanges().forEach((change) => {
          const data = { id: change.doc.id, ...change.doc.data() } as Realisasi;
          if (change.type === 'added') {
            const index = next.findIndex(i => i.id === data.id);
            if (index === -1) next.push(data);
          } else if (change.type === 'modified') {
            const index = next.findIndex(i => i.id === data.id);
            if (index > -1) next[index] = data;
          } else if (change.type === 'removed') {
            const index = next.findIndex(i => i.id === data.id);
            if (index > -1) next.splice(index, 1);
          }
        });
        return next;
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

  return (
    <FirebaseContext.Provider value={{ 
      user, loading, syncError, dataLoading, skpds, anggarans, realisasis, 
      login, logout, 
      saveSKPD, saveSKPDsBulk, deleteSKPD,
      saveAnggaran, saveAnggaransBulk, deleteAnggaran,
      saveRealisasi, saveRealisasisBulk, deleteRealisasi
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
