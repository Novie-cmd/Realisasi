/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { 
  LayoutDashboard, 
  Database, 
  FileText, 
  Menu, 
  X, 
  TrendingUp, 
  ArrowRightLeft,
  Settings,
  LogOut,
  ChevronRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { SKPD, Anggaran, Realisasi } from './lib/types';
import Dashboard from './components/Dashboard';
import MasterData from './components/MasterData';
import Transactions from './components/Transactions';
import Reports from './components/Reports';
import { cn } from './lib/utils';

type Page = 'dashboard' | 'master' | 'transactions' | 'reports';

export default function App() {
  const [activePage, setActivePage] = useState<Page>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  
  const [skpds, setSkpds] = useState<SKPD[]>([]);
  const [anggarans, setAnggarans] = useState<Anggaran[]>([]);
  const [realisasis, setRealisasis] = useState<Realisasi[]>([]);

  // Load initial data
  useEffect(() => {
    const savedSkpds = localStorage.getItem('skpds');
    const savedAnggarans = localStorage.getItem('anggarans');
    const savedRealisasis = localStorage.getItem('realisasis');

    if (savedSkpds) {
      setSkpds(JSON.parse(savedSkpds));
    } else {
      // Sample SKPD
      const sampleSKPD = [
        { id: '1', kode: 'SKPD.01', nama: 'Dinas Pendidikan' },
        { id: '2', kode: 'SKPD.02', nama: 'Dinas Kesehatan' }
      ];
      setSkpds(sampleSKPD);
    }

    if (savedAnggarans) {
      setAnggarans(JSON.parse(savedAnggarans));
    } else {
      // Sample Anggaran
      const sampleAnggaran = [
        { id: 'a1', skpdId: '1', kodeAkun: '5.1.01', namaAkun: 'Belanja Pegawai', pagu: 5000000000 },
        { id: 'a2', skpdId: '1', kodeAkun: '5.1.02', namaAkun: 'Belanja Barang & Jasa', pagu: 2000000000 },
        { id: 'a3', skpdId: '2', kodeAkun: '5.1.01', namaAkun: 'Belanja Pegawai', pagu: 4000000000 },
        { id: 'a4', skpdId: '2', kodeAkun: '5.2.01', namaAkun: 'Belanja Modal', pagu: 8000000000 }
      ];
      setAnggarans(sampleAnggaran);
    }

    if (savedRealisasis) {
      setRealisasis(JSON.parse(savedRealisasis));
    } else {
      // Sample Realisasi
      const sampleRealisasi = [
        { id: 'r1', anggaranId: 'a1', tanggal: '2024-01-15', nilai: 450000000, keterangan: 'Gaji Januari' },
        { id: 'r2', anggaranId: 'a3', tanggal: '2024-01-15', nilai: 380000000, keterangan: 'Gaji Januari' },
        { id: 'r3', anggaranId: 'a2', tanggal: '2024-02-10', nilai: 120000000, keterangan: 'ATK Kantor' }
      ];
      setRealisasis(sampleRealisasi);
    }
  }, []);

  // Sync with storage
  useEffect(() => {
    localStorage.setItem('skpds', JSON.stringify(skpds));
    localStorage.setItem('anggarans', JSON.stringify(anggarans));
    localStorage.setItem('realisasis', JSON.stringify(realisasis));
  }, [skpds, anggarans, realisasis]);

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'master', label: 'Master Data', icon: Database },
    { id: 'transactions', label: 'Realisasi', icon: ArrowRightLeft },
    { id: 'reports', label: 'Laporan', icon: FileText },
  ];

  return (
    <div className="flex h-screen bg-[#f4f6f9] text-[#1e293b] overflow-hidden font-sans">
      {/* Sidebar - Bento Style */}
      <motion.aside
        initial={{ width: sidebarOpen ? 260 : 80 }}
        animate={{ width: sidebarOpen ? 260 : 80 }}
        className="bg-bento-accent text-white flex flex-col z-20"
      >
        <div className="p-8 flex items-center justify-between">
          {sidebarOpen && (
            <div className="flex items-center gap-3 overflow-hidden whitespace-nowrap">
              <div className="w-9 h-9 bg-white rounded-lg flex items-center justify-center text-bento-accent font-black text-xl">
                A
              </div>
              <span className="font-extrabold text-lg tracking-tight">SI-REALISASI</span>
            </div>
          )}
          {!sidebarOpen && (
            <div className="w-9 h-9 bg-white rounded-lg flex items-center justify-center text-bento-accent font-black text-xl mx-auto">
              A
            </div>
          )}
        </div>

        <nav className="flex-1 px-4 space-y-1">
          {/* Dashboard Group */}
          <div className={cn("bento-nav-item", activePage === 'dashboard' && "active")} onClick={() => setActivePage('dashboard')}>
            <LayoutDashboard className="w-5 h-5" />
            {sidebarOpen && <span>Dashboard</span>}
          </div>

          <div className="bento-group-label">{sidebarOpen ? 'Master Data' : '•••'}</div>
          <div className={cn("bento-nav-item", activePage === 'master' && "active")} onClick={() => setActivePage('master')}>
            <Database className="w-5 h-5" />
            {sidebarOpen && <span>Data Master</span>}
          </div>
          <div className={cn("bento-nav-item", activePage === 'transactions' && "active")} onClick={() => setActivePage('transactions')}>
            <ArrowRightLeft className="w-5 h-5" />
            {sidebarOpen && <span>Realisasi</span>}
          </div>

          <div className="bento-group-label">{sidebarOpen ? 'Pelaporan' : '•••'}</div>
          <div className={cn("bento-nav-item", activePage === 'reports' && "active")} onClick={() => setActivePage('reports')}>
            <FileText className="w-5 h-5" />
            {sidebarOpen && <span>Laporan</span>}
          </div>
        </nav>

        <div className="p-6 border-t border-white/10 space-y-4">
          <button 
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="w-full flex items-center gap-3 px-4 py-2 text-white/50 hover:text-white transition-all text-sm"
          >
            {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5 mx-auto" />}
            {sidebarOpen && <span>Tutup Sidebar</span>}
          </button>
          {sidebarOpen && (
            <div className="text-[10px] text-white/30 font-mono tracking-tighter">
              v2.4.0 Build 2026 AI Studio
            </div>
          )}
        </div>
      </motion.aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        <header className="h-20 flex items-center justify-between px-10 bg-transparent border-none sticky top-0 z-10">
          <div>
            <h2 className="text-2xl font-bold text-bento-accent tracking-tight leading-none mb-1">
              {navItems.find(i => i.id === activePage)?.label}
            </h2>
            <p className="text-xs text-bento-text-sub font-medium">Tahun Anggaran 2026 • Real-time Monitoring</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right mr-2 hidden sm:block">
              <p className="text-sm font-bold text-bento-accent">Budi Santoso</p>
              <p className="text-[11px] text-bento-text-sub font-medium uppercase tracking-wider">BPKAD Prov. Maju Jaya</p>
            </div>
            <div className="w-11 h-11 bg-bento-border rounded-full flex items-center justify-center text-gray-500 overflow-hidden shadow-sm">
              <div className="w-full h-full bg-gradient-to-br from-gray-200 to-gray-300"></div>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-10 pt-4 scroll-smooth">
          <AnimatePresence mode="wait">
            <motion.div
              key={activePage}
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.02 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              className="max-w-7xl mx-auto h-full"
            >
              {activePage === 'dashboard' && (
                <Dashboard 
                  skpds={skpds} 
                  anggarans={anggarans} 
                  realisasis={realisasis} 
                />
              )}
              {activePage === 'master' && (
                <MasterData 
                  skpds={skpds} 
                  setSkpds={setSkpds}
                  anggarans={anggarans}
                  setAnggarans={setAnggarans}
                />
              )}
              {activePage === 'transactions' && (
                <Transactions 
                  anggarans={anggarans}
                  skpds={skpds}
                  realisasis={realisasis}
                  setRealisasis={setRealisasis}
                />
              )}
              {activePage === 'reports' && (
                <Reports 
                  skpds={skpds}
                  anggarans={anggarans}
                  realisasis={realisasis}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}
