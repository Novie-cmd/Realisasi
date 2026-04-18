import React, { useState } from 'react';
import { 
  Plus, 
  Upload, 
  Trash2, 
  Download, 
  Search, 
  Building2, 
  ListOrdered,
  Database
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { SKPD, Anggaran } from '../lib/types';
import { cn, formatIDR } from '../lib/utils';

interface Props {
  skpds: SKPD[];
  setSkpds: React.Dispatch<React.SetStateAction<SKPD[]>>;
  anggarans: Anggaran[];
  setAnggarans: React.Dispatch<React.SetStateAction<Anggaran[]>>;
}

export default function MasterData({ skpds, setSkpds, anggarans, setAnggarans }: Props) {
  const [tab, setTab] = useState<'skpd' | 'anggaran'>('skpd');
  const [search, setSearch] = useState('');

  const handleImportSKPD = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const data = event.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const results = XLSX.utils.sheet_to_json(sheet);
        
        const newData: SKPD[] = (results as any[])
          .filter((row: any) => row.kode && row.nama)
          .map((row: any) => ({
            id: crypto.randomUUID(),
            kode: String(row.kode),
            nama: String(row.nama),
          }));
        setSkpds(prev => [...prev, ...newData]);
      };
      reader.readAsBinaryString(file);
    }
  };

  const handleImportAnggaran = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const data = event.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const results = XLSX.utils.sheet_to_json(sheet);
        
        const newData: Anggaran[] = (results as any[])
          .filter((row: any) => row.skpdKode && row.kodeAkun && row.pagu)
          .map((row: any) => {
            const skpd = skpds.find(s => s.kode === String(row.skpdKode));
            return {
              id: crypto.randomUUID(),
              skpdId: skpd?.id || '',
              kodeAkun: String(row.kodeAkun),
              namaAkun: String(row.namaAkun || 'No Name'),
              pagu: Number(row.pagu),
            };
          });
        setAnggarans(prev => [...prev, ...newData]);
      };
      reader.readAsBinaryString(file);
    }
  };

  const filteredSkpds = skpds.filter(s => 
    s.nama.toLowerCase().includes(search.toLowerCase()) || 
    s.kode.toLowerCase().includes(search.toLowerCase())
  );

  const filteredAnggarans = anggarans.filter(a => {
    const skpd = skpds.find(s => s.id === a.skpdId);
    return a.namaAkun.toLowerCase().includes(search.toLowerCase()) || 
           skpd?.nama.toLowerCase().includes(search.toLowerCase());
  });

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex bg-bento-border/30 p-1 rounded-xl border border-bento-border w-fit">
          <button 
            onClick={() => setTab('skpd')}
            className={cn(
              "px-5 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all",
              tab === 'skpd' ? "bg-white text-bento-accent shadow-sm" : "text-bento-text-sub hover:text-bento-accent"
            )}
          >
            Data SKPD
          </button>
          <button 
            onClick={() => setTab('anggaran')}
            className={cn(
              "px-5 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all",
              tab === 'anggaran' ? "bg-white text-bento-accent shadow-sm" : "text-bento-text-sub hover:text-bento-accent"
            )}
          >
            Data Anggaran
          </button>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-bento-text-sub" />
            <input 
              type="text" 
              placeholder="Cari data..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 pr-4 py-2.5 bg-white border border-bento-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-bento-primary/20 focus:border-bento-primary w-full sm:w-64 transition-all"
            />
          </div>
          <label className="flex items-center gap-2 px-5 py-2.5 bg-bento-accent text-white rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-slate-800 cursor-pointer transition-all shadow-sm">
            <Upload className="w-4 h-4" />
            <span>Import</span>
            <input 
              type="file" 
              accept=".xlsx,.xls" 
              className="hidden" 
              onChange={tab === 'skpd' ? handleImportSKPD : handleImportAnggaran}
            />
          </label>
        </div>
      </div>

      <div className="bento-card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-bento-border">
                <th className="px-8 py-5 text-[11px] font-bold text-bento-text-sub uppercase tracking-widest">
                  {tab === 'skpd' ? 'ID Unit' : 'Unit Kerja'}
                </th>
                <th className="px-8 py-5 text-[11px] font-bold text-bento-text-sub uppercase tracking-widest">
                  {tab === 'skpd' ? 'Nama Unit' : 'Kode Akun & Nama'}
                </th>
                {tab === 'anggaran' && (
                  <th className="px-8 py-5 text-[11px] font-bold text-bento-text-sub uppercase tracking-widest text-right">
                    Pagu Anggaran
                  </th>
                )}
                <th className="px-8 py-5 text-[11px] font-bold text-bento-text-sub uppercase tracking-widest text-right">
                  Aksi
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-bento-border">
              {tab === 'skpd' ? (
                filteredSkpds.map((skpd) => (
                  <tr key={skpd.id} className="hover:bg-slate-50/50 transition-all duration-200">
                    <td className="px-8 py-5 text-sm font-mono text-bento-primary font-bold">{skpd.kode}</td>
                    <td className="px-8 py-5 text-sm font-bold text-bento-accent">{skpd.nama}</td>
                    <td className="px-8 py-5 text-sm text-right">
                      <button 
                        onClick={() => setSkpds(prev => prev.filter(s => s.id !== skpd.id))}
                        className="text-bento-text-sub hover:text-bento-danger transition-colors p-2 rounded-lg hover:bg-red-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                filteredAnggarans.map((anggaran) => {
                  const skpd = skpds.find(s => s.id === anggaran.skpdId);
                  return (
                    <tr key={anggaran.id} className="hover:bg-slate-50/50 transition-all duration-200">
                      <td className="px-8 py-5">
                        <div className="flex flex-col">
                          <span className="text-sm font-bold text-bento-accent">{skpd?.nama || 'Tanpa Unit'}</span>
                          <span className="text-[10px] font-bold text-bento-text-sub uppercase tracking-tighter">{skpd?.kode}</span>
                        </div>
                      </td>
                      <td className="px-8 py-5">
                        <div className="flex flex-col">
                          <span className="text-sm font-bold text-bento-accent">{anggaran.namaAkun}</span>
                          <span className="text-[11px] font-mono font-medium text-bento-text-sub">{anggaran.kodeAkun}</span>
                        </div>
                      </td>
                      <td className="px-8 py-5 text-sm font-bold text-right text-bento-accent">
                        {formatIDR(anggaran.pagu)}
                      </td>
                      <td className="px-8 py-5 text-sm text-right">
                        <button 
                          onClick={() => setAnggarans(prev => prev.filter(a => a.id !== anggaran.id))}
                          className="text-bento-text-sub hover:text-bento-danger transition-colors p-2 rounded-lg hover:bg-red-50"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  )
                })
              )}
              {(tab === 'skpd' ? filteredSkpds : filteredAnggarans).length === 0 && (
                <tr>
                  <td colSpan={tab === 'skpd' ? 3 : 4} className="px-8 py-20 text-center">
                    <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-bento-border border-dashed">
                      <Database className="w-7 h-7 text-bento-text-sub/40" />
                    </div>
                    <p className="text-sm font-bold text-bento-accent">Belum ada data tersedia</p>
                    <p className="text-xs text-bento-text-sub mt-1">Gunakan fitur import untuk memulai.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CSV Template Helpers */}
      <div className="p-6 bg-white rounded-2xl border border-bento-border flex items-start gap-4 shadow-sm">
        <div className="p-3 bg-bento-primary/10 rounded-xl">
          <Download className="w-5 h-5 text-bento-primary" />
        </div>
        <div>
          <h4 className="text-sm font-bold text-bento-accent mb-1">Panduan Struktur File Excel</h4>
          <p className="text-xs text-bento-text-sub leading-relaxed">
            Pastikan header file sesuai dengan kriteria berikut agar proses sinkronisasi berjalan normal.
          </p>
          <div className="mt-3 inline-block px-3 py-1.5 bg-slate-50 border border-bento-border rounded-lg font-mono text-[11px] text-bento-primary font-bold">
            {tab === 'skpd' ? 'kode, nama' : 'skpdKode, kodeAkun, namaAkun, pagu'}
          </div>
        </div>
      </div>
    </div>
  );
}
