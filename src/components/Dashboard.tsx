import React, { useMemo } from 'react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { 
  DollarSign, 
  TrendingUp, 
  Wallet, 
  AlertCircle,
  Database,
  RefreshCw,
  Trash2
} from 'lucide-react';
import { SKPD, Anggaran, Realisasi } from '../lib/types';
import { formatIDR, formatPercent, cn } from '../lib/utils';
import { motion } from 'motion/react';
import { useFirebase } from '../contexts/FirebaseContext';

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];

export default function Dashboard() {
  const { 
    skpds, anggarans, realisasis, quotaExceeded, 
    resetQuotaStatus, clearAllData, deleteAnggaranAndRealisasi,
    hasPendingUpdates, clearOfflineQueue
  } = useFirebase();
  const [isDeleting, setIsDeleting] = React.useState(false);
  const stats = useMemo(() => {
    if (!anggarans || !realisasis) return { totalAnggaran: 0, totalRealisasi: 0, totalSisa: 0, persentase: 0 };
    
    const totalAnggaran = anggarans.reduce((sum, item) => sum + (Number(item?.pagu) || 0), 0);
    const totalRealisasi = realisasis.reduce((sum, item) => sum + (Number(item?.nilai) || 0), 0);
    const totalSisa = Math.max(0, totalAnggaran - totalRealisasi);
    const persentase = totalAnggaran > 0 ? totalRealisasi / totalAnggaran : 0;

    return { totalAnggaran, totalRealisasi, totalSisa, persentase };
  }, [anggarans, realisasis]);

  const chartData = useMemo(() => {
    if (!skpds || skpds.length === 0) return [];
    
    // Optimasi: Gunakan Map untuk lookup O(1)
    const skpdAnggaranMap = new Map<string, number>();
    const skpdRealisasiMap = new Map<string, number>();
    const anggaranToSkpdMap = new Map<string, string>();

    // Index anggaran -> skpd mapping dan hitung total anggaran per skpd
    (anggarans || []).forEach(a => {
      if (!a) return;
      if (a.skpdId) {
        skpdAnggaranMap.set(a.skpdId, (skpdAnggaranMap.get(a.skpdId) || 0) + (Number(a.pagu) || 0));
        anggaranToSkpdMap.set(a.id, a.skpdId);
      }
    });

    // Hitung total realisasi per skpd menggunakan mapping anggaran
    (realisasis || []).forEach(r => {
      if (!r) return;
      const skpdId = anggaranToSkpdMap.get(r.anggaranId);
      if (skpdId) {
        skpdRealisasiMap.set(skpdId, (skpdRealisasiMap.get(skpdId) || 0) + (Number(r.nilai) || 0));
      }
    });
    
    return skpds.map(skpd => {
      const Anggaran = skpdAnggaranMap.get(skpd.id) || 0;
      const Realisasi = skpdRealisasiMap.get(skpd.id) || 0;

      return {
        nama: skpd?.nama || 'Unknown',
        Anggaran,
        Realisasi,
        Sisa: Math.max(0, Anggaran - Realisasi)
      };
    }).sort((a, b) => (b.Anggaran || 0) - (a.Anggaran || 0)).slice(0, 5);
  }, [skpds, anggarans, realisasis]);

  const pieData = useMemo(() => {
    if (!realisasis || !anggarans) return [];
    
    // Optimasi: Pre-map anggaran untuk lookup cepat
    const anggaranMap = new Map<string, Anggaran>((anggarans || []).filter(Boolean).map(a => [a.id, a]));
    const data: Record<string, number> = {};

    realisasis.forEach(r => {
      if (!r) return;
      const anggaran = anggaranMap.get(r.anggaranId);
      if (anggaran && anggaran.namaAkun) {
        data[anggaran.namaAkun] = (data[anggaran.namaAkun] || 0) + (Number(r.nilai) || 0);
      }
    });

    return Object.entries(data)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  }, [realisasis, anggarans]);

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-bento-accent tracking-tighter uppercase">Executive Dashboard</h2>
          <p className="text-xs text-bento-text-sub font-bold uppercase tracking-widest mt-1">Sistem Informasi Realisasi Anggaran 2026</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {hasPendingUpdates && (
            <button 
              onClick={() => clearOfflineQueue()}
              className="flex items-center gap-2 px-4 py-2 bg-amber-50 border border-amber-200 text-amber-700 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-amber-100 transition-all shadow-sm"
              title="Bersihkan antrean data yang gagal sinkron"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Bersihkan Antrean
            </button>
          )}

          <button 
            onClick={async () => {
              setIsDeleting(true);
              await deleteAnggaranAndRealisasi();
              setIsDeleting(false);
            }}
            disabled={isDeleting || (anggarans.length === 0 && realisasis.length === 0)}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-red-200 text-red-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-red-50 transition-all shadow-sm disabled:opacity-30"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Hapus Anggaran & Realisasi
          </button>

          <button 
            onClick={async () => {
              if (window.confirm('PERINGATAN KRITIKAL: Ini akan menghapus TOTAL seluruh data (termasuk SKPD). Lanjutkan?')) {
                setIsDeleting(true);
                await clearAllData();
                setIsDeleting(false);
              }
            }}
            disabled={isDeleting || (skpds.length === 0 && anggarans.length === 0)}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-red-700 transition-all shadow-md disabled:opacity-30"
          >
            <Database className="w-3.5 h-3.5" />
            Kosongkan Total Database
          </button>
        </div>
      </div>

      {quotaExceeded && (
        <motion.div 
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          className="bg-amber-50 border border-amber-200 rounded-2xl p-6 flex flex-col md:flex-row items-start md:items-center gap-6 overflow-hidden shadow-sm"
        >
          <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center flex-shrink-0">
            <AlertCircle className="w-6 h-6 text-amber-600" />
          </div>
          <div className="flex-1">
            <h4 className="text-sm font-bold text-amber-900 leading-none mb-2 uppercase tracking-wider">Mode Dokumentasi (Offline)</h4>
            <p className="text-xs text-amber-700 font-medium leading-relaxed max-w-2xl">
              Batas kuota database tercapai. Sistem beralih menggunakan data cadangan lokal. Anda tetap dapat melakukan input, dan data akan sinkron otomatis saat kuota tersedia kembali.
            </p>
          </div>
          <button
            onClick={() => resetQuotaStatus()}
            className="flex items-center gap-2 px-5 py-2.5 bg-amber-600 text-white text-xs font-bold uppercase tracking-widest rounded-xl hover:bg-amber-700 transition-all shadow-md active:scale-95 flex-shrink-0"
          >
            <RefreshCw className="w-4 h-4" />
            Hubungkan Sekarang
          </button>
        </motion.div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
      {/* Stats Cards - Bento Row 1 */}
      <StatCard 
        title="Total Pagu" 
        value={formatIDR(stats.totalAnggaran)} 
        icon={Wallet} 
        trend="Anggaran Murni + Perubahan"
      />
      <StatCard 
        title="Realisasi" 
        value={formatIDR(stats.totalRealisasi)} 
        icon={TrendingUp} 
        trend={`${formatPercent(stats.persentase)} dari Target`}
        trendColor="text-bento-success"
      />
      <StatCard 
        title="Sisa Anggaran" 
        value={formatIDR(stats.totalSisa)} 
        icon={DollarSign} 
        trend={`SiLPA Potensial: ${formatPercent(1 - stats.persentase)}`}
        trendColor="text-bento-warning"
      />
      <div className="bg-bento-accent rounded-2xl p-6 text-white shadow-lg flex flex-col justify-center">
        <h4 className="text-[11px] font-bold text-white/50 uppercase tracking-widest mb-2">Persentase Capaian</h4>
        <p className="text-4xl font-extrabold tracking-tight mb-2 text-white">{formatPercent(stats.persentase)}</p>
        <span className="text-xs text-bento-success font-semibold flex items-center gap-1">
          <TrendingUp className="w-3 h-3" /> On Track
        </span>
      </div>

      {/* Main Chart - Bento Row 2+3 */}
      <div className="md:col-span-3 md:row-span-2 bento-card flex flex-col min-h-[450px]">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h3 className="font-bold text-bento-accent text-base">Tren Realisasi per SKPD</h3>
            <p className="text-xs text-bento-text-sub">Perbandingan Anggaran vs Realisasi (5 SKPD Tertinggi)</p>
          </div>
          <div className="flex gap-4 text-[10px] uppercase font-bold tracking-widest text-bento-text-sub">
            <span className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-bento-border"></div> Pagu</span>
            <span className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-bento-primary"></div> Realisasi</span>
          </div>
        </div>
        <div className="flex-1">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#e2e8f0" />
              <XAxis 
                dataKey="nama" 
                fontSize={10} 
                tickLine={false} 
                axisLine={false}
                tick={{ fill: '#64748b', fontWeight: 500 }}
              />
              <YAxis 
                fontSize={10} 
                tickLine={false} 
                axisLine={false}
                tickFormatter={(val) => `Rp${val/1e6}jt`}
                tick={{ fill: '#64748b' }}
              />
              <Tooltip 
                cursor={{ fill: 'rgba(0,0,0,0.02)' }}
                contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                formatter={(value: number) => formatIDR(value)}
              />
              <Bar dataKey="Anggaran" fill="#e2e8f0" radius={[6, 6, 0, 0]} barSize={40} />
              <Bar dataKey="Realisasi" fill="#2563eb" radius={[6, 6, 0, 0]} barSize={40} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Side Bento Card */}
      <div className="bg-gradient-to-br from-bento-primary to-blue-800 rounded-2xl p-6 text-white shadow-md flex flex-col justify-between overflow-hidden relative">
        <div className="relative z-10">
          <h3 className="font-bold text-lg mb-2 leading-tight">Pusat Data Master</h3>
          <p className="text-xs text-white/70 leading-relaxed mb-6">Sinkronisasi data SKPD & Anggaran melalui file Excel (.xlsx).</p>
          
          <div className="space-y-3">
            {[
              { icon: Database, label: 'Kamus SKPD' },
              { icon: Wallet, label: 'Pagu Anggaran' },
              { icon: AlertCircle, label: 'Bantuan' }
            ].map((btn) => (
              <button key={btn.label} className="w-full flex items-center gap-3 px-4 py-2.5 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl text-xs font-medium transition-all text-left">
                <btn.icon className="w-4 h-4" />
                {btn.label}
              </button>
            ))}
          </div>
        </div>
        {/* Decorator blob */}
        <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-white/10 rounded-full blur-2xl"></div>
      </div>

      {/* Account Distribution - Bento Row 3 Right */}
      <div className="bento-card flex flex-col">
        <h3 className="font-bold text-bento-accent text-sm mb-4">Distribusi Akun</h3>
        <div className="h-[180px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={80}
                paddingAngle={4}
                dataKey="value"
              >
                {pieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip 
                formatter={(value: number) => formatIDR(value)}
                contentStyle={{ borderRadius: '12px', boxShadow: 'none', border: '1px solid #e2e8f0' }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-4 space-y-1.5 flex-1">
          {pieData.slice(0, 3).map((item, index) => (
            <div key={item.name} className="flex items-center justify-between text-[10px] font-medium">
              <div className="flex items-center gap-2 truncate">
                <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                <span className="text-bento-text-sub truncate">{item.name}</span>
              </div>
              <span className="text-bento-accent">{formatPercent(item.value / (stats.totalRealisasi || 1))}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  </div>
);
}

function StatCard({ title, value, icon: Icon, trend, trendColor = "text-bento-text-sub" }: any) {
  return (
    <motion.div 
      whileHover={{ y: -2 }}
      className="bento-card flex flex-col justify-between"
    >
      <div>
        <h4 className="bento-stat-label">{title}</h4>
        <p className="bento-stat-value">{value}</p>
      </div>
      <div className={cn("text-[10px] font-bold mt-4 flex items-center gap-1", trendColor)}>
        {trend}
      </div>
    </motion.div>
  );
}
