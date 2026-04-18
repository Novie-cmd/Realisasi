import React, { useState } from 'react';
import { 
  Plus, 
  Search, 
  Calendar as CalendarIcon, 
  ArrowRightLeft, 
  Trash2,
  Filter,
  X
} from 'lucide-react';
import { SKPD, Anggaran, Realisasi } from '../lib/types';
import { formatIDR, cn } from '../lib/utils';
import { format } from 'date-fns';

interface Props {
  anggarans: Anggaran[];
  skpds: SKPD[];
  realisasis: Realisasi[];
  setRealisasis: React.Dispatch<React.SetStateAction<Realisasi[]>>;
}

export default function Transactions({ anggarans, skpds, realisasis, setRealisasis }: Props) {
  const [showAdd, setShowAdd] = useState(false);
  const [search, setSearch] = useState('');
  
  const [formData, setFormData] = useState({
    anggaranId: '',
    tanggal: format(new Date(), 'yyyy-MM-dd'),
    nilai: 0,
    keterangan: ''
  });

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.anggaranId || formData.nilai <= 0) return;

    const newRealisasi: Realisasi = {
      id: crypto.randomUUID(),
      ...formData
    };

    setRealisasis(prev => [newRealisasi, ...prev]);
    setShowAdd(false);
    setFormData({
      anggaranId: '',
      tanggal: format(new Date(), 'yyyy-MM-dd'),
      nilai: 0,
      keterangan: ''
    });
  };

  const filteredRealisasi = realisasis.filter(r => {
    const anggaran = anggarans.find(a => a.id === r.anggaranId);
    return r.keterangan.toLowerCase().includes(search.toLowerCase()) || 
           anggaran?.namaAkun.toLowerCase().includes(search.toLowerCase());
  });

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="font-black text-bento-accent text-2xl tracking-tight uppercase">Riwayat Realisasi</h3>
          <p className="text-xs text-bento-text-sub font-bold uppercase tracking-widest mt-1">Audit Log Transaksi Keuangan</p>
        </div>
        
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-bento-text-sub" />
            <input 
              type="text" 
              placeholder="Cari transaksi..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 pr-4 py-2.5 bg-white border border-bento-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-bento-primary/20 focus:border-bento-primary w-full sm:w-64 transition-all"
            />
          </div>
          <button 
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 px-5 py-2.5 bg-bento-primary text-white rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-blue-700 transition-all shadow-md shadow-blue-100"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah</span>
          </button>
        </div>
      </div>

      {showAdd && (
        <div className="fixed inset-0 bg-bento-accent/40 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[24px] w-full max-w-md shadow-2xl overflow-hidden border border-bento-border animate-in fade-in zoom-in duration-300">
            <div className="p-8 border-b border-bento-border flex items-center justify-between bg-slate-50/50">
              <h4 className="font-black text-bento-accent uppercase tracking-tight">Input Transaksi Baru</h4>
              <button onClick={() => setShowAdd(false)} className="text-bento-text-sub hover:text-bento-accent transition-transform hover:scale-110">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleAdd} className="p-8 space-y-5">
              <div>
                <label className="block text-[11px] font-bold text-bento-text-sub uppercase tracking-widest mb-2">Mata Anggaran</label>
                <select 
                  required
                  value={formData.anggaranId}
                  onChange={e => setFormData({...formData, anggaranId: e.target.value})}
                  className="w-full bg-slate-50 border border-bento-border rounded-xl px-4 py-3 text-sm font-bold text-bento-accent focus:ring-2 focus:ring-bento-primary/20 outline-none transition-all"
                >
                  <option value="">Pilih Anggaran...</option>
                  {anggarans.map(a => {
                    const skpd = skpds.find(s => s.id === a.skpdId);
                    return (
                      <option key={a.id} value={a.id}>
                        [{skpd?.kode}] {a.namaAkun}
                      </option>
                    )
                  })}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-bento-text-sub uppercase tracking-widest mb-2">Tanggal</label>
                  <input 
                    type="date"
                    required
                    value={formData.tanggal}
                    onChange={e => setFormData({...formData, tanggal: e.target.value})}
                    className="w-full bg-slate-50 border border-bento-border rounded-xl px-4 py-3 text-sm font-bold text-bento-accent focus:ring-2 focus:ring-bento-primary/20 outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-bento-text-sub uppercase tracking-widest mb-2">Nilai (Rp)</label>
                  <input 
                    type="number"
                    required
                    placeholder="0"
                    value={formData.nilai || ''}
                    onChange={e => setFormData({...formData, nilai: Number(e.target.value)})}
                    className="w-full bg-slate-50 border border-bento-border rounded-xl px-4 py-3 text-sm font-bold text-bento-primary focus:ring-2 focus:ring-bento-primary/20 outline-none font-bold transition-all"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-bento-text-sub uppercase tracking-widest mb-2">Keterangan</label>
                <textarea 
                  rows={3}
                  value={formData.keterangan}
                  onChange={e => setFormData({...formData, keterangan: e.target.value})}
                  className="w-full bg-slate-50 border border-bento-border rounded-xl px-4 py-3 text-sm font-medium text-bento-accent focus:ring-2 focus:ring-bento-primary/20 outline-none resize-none transition-all"
                  placeholder="Contoh: Pembayaran Gaji Pegawai..."
                ></textarea>
              </div>
              <div className="flex gap-4 pt-4">
                <button 
                  type="button"
                  onClick={() => setShowAdd(false)}
                  className="flex-1 px-4 py-3 text-xs font-bold uppercase tracking-widest text-bento-text-sub bg-slate-100 rounded-xl hover:bg-slate-200 transition-all"
                >
                  Batal
                </button>
                <button 
                  type="submit"
                  className="flex-1 px-4 py-3 text-xs font-bold uppercase tracking-widest text-white bg-bento-primary rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-100"
                >
                  Simpan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="bento-card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-bento-border">
                <th className="px-8 py-5 text-[11px] font-bold text-bento-text-sub uppercase tracking-widest">Tanggal</th>
                <th className="px-8 py-5 text-[11px] font-bold text-bento-text-sub uppercase tracking-widest">Akun / SKPD</th>
                <th className="px-8 py-5 text-[11px] font-bold text-bento-text-sub uppercase tracking-widest">Keterangan</th>
                <th className="px-8 py-5 text-[11px] font-bold text-bento-text-sub uppercase tracking-widest text-right">Nilai</th>
                <th className="px-8 py-5 text-[11px] font-bold text-bento-text-sub uppercase tracking-widest text-right">Opsi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-bento-border">
              {filteredRealisasi.map((item) => {
                const anggaran = anggarans.find(a => a.id === item.anggaranId);
                const skpd = skpds.find(s => s.id === anggaran?.skpdId);
                return (
                  <tr key={item.id} className="hover:bg-slate-50/50 transition-all duration-200">
                    <td className="px-8 py-5 text-bento-text-sub font-mono font-bold">
                      {format(new Date(item.tanggal), 'dd/MM/yyyy')}
                    </td>
                    <td className="px-8 py-5">
                      <div className="flex flex-col">
                        <span className="font-bold text-bento-accent leading-tight">{anggaran?.namaAkun || 'No Account'}</span>
                        <span className="text-[10px] text-bento-text-sub font-bold uppercase tracking-tighter truncate max-w-[200px]">{skpd?.nama}</span>
                      </div>
                    </td>
                    <td className="px-8 py-5 text-bento-text-sub font-medium italic">
                      {item.keterangan || '-'}
                    </td>
                    <td className="px-8 py-5 text-right">
                      <span className="font-extrabold text-bento-success">
                        {formatIDR(item.nilai)}
                      </span>
                    </td>
                    <td className="px-8 py-5 text-right">
                      <button 
                         onClick={() => setRealisasis(prev => prev.filter(r => r.id !== item.id))}
                        className="text-bento-text-sub hover:text-bento-danger transition-colors p-2 rounded-lg hover:bg-red-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                )
              })}
              {filteredRealisasi.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-8 py-20 text-center">
                    <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-bento-border border-dashed">
                      <ArrowRightLeft className="w-7 h-7 text-bento-text-sub/40" />
                    </div>
                    <p className="text-sm font-bold text-bento-accent">Belum ada riwayat transaksi</p>
                    <p className="text-xs text-bento-text-sub mt-1">Gunakan tombol "Tambah" untuk mencatat pengeluaran.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
