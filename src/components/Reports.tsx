import React, { useState, useMemo } from 'react';
import { 
  FileText, 
  Printer, 
  Download, 
  ChevronDown, 
  ChevronUp,
  Filter,
  CheckCircle2
} from 'lucide-react';
import { format } from 'date-fns';
import { SKPD, Anggaran, Realisasi } from '../lib/types';
import { formatIDR, formatPercent, cn } from '../lib/utils';
import { useFirebase } from '../contexts/FirebaseContext';

type ReportType = 'skpd' | 'akun';

export default function Reports() {
  const { skpds, anggarans, realisasis } = useFirebase();
  const [type, setType] = useState<ReportType>('skpd');

  const reportData = useMemo(() => {
    if (type === 'skpd') {
      return skpds.map(skpd => {
        const pagu = anggarans
          .filter(a => a.skpdId === skpd.id)
          .reduce((sum, item) => sum + item.pagu, 0);
        const realisasi = realisasis
          .filter(r => {
            const a = anggarans.find(ang => ang.id === r.anggaranId);
            return a?.skpdId === skpd.id;
          })
          .reduce((sum, item) => sum + item.nilai, 0);
        return {
          id: skpd.id,
          label: skpd.nama,
          sublabel: skpd.kode,
          pagu,
          realisasi,
          sisa: pagu - realisasi,
          persen: pagu > 0 ? realisasi / pagu : 0
        };
      }).sort((a, b) => b.pagu - a.pagu);
    } else {
      // Group by account name
      const accounts: Record<string, { pagu: number, realisasi: number, kode: string }> = {};
      
      anggarans.forEach(a => {
        if (!accounts[a.namaAkun]) accounts[a.namaAkun] = { pagu: 0, realisasi: 0, kode: a.kodeAkun };
        accounts[a.namaAkun].pagu += a.pagu;
      });

      realisasis.forEach(r => {
        const a = anggarans.find(ang => ang.id === r.anggaranId);
        if (a) {
          if (!accounts[a.namaAkun]) accounts[a.namaAkun] = { pagu: 0, realisasi: 0, kode: a.kodeAkun };
          accounts[a.namaAkun].realisasi += r.nilai;
        }
      });

      return Object.entries(accounts).map(([label, data]) => ({
        id: label,
        label,
        sublabel: data.kode,
        pagu: data.pagu,
        realisasi: data.realisasi,
        sisa: data.pagu - data.realisasi,
        persen: data.pagu > 0 ? data.realisasi / data.pagu : 0
      })).sort((a, b) => b.pagu - a.pagu);
    }
  }, [type, skpds, anggarans, realisasis]);

  const totals = useMemo(() => {
    return reportData.reduce((acc, curr) => ({
      pagu: acc.pagu + curr.pagu,
      realisasi: acc.realisasi + curr.realisasi,
      sisa: acc.sisa + curr.sisa
    }), { pagu: 0, realisasi: 0, sisa: 0 });
  }, [reportData]);

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex bg-bento-border/30 p-1 rounded-xl border border-bento-border w-fit">
          <button 
            onClick={() => setType('skpd')}
            className={cn(
               "px-5 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all",
              type === 'skpd' ? "bg-white text-bento-accent shadow-sm" : "text-bento-text-sub hover:text-bento-accent"
            )}
          >
            Laporan per SKPD
          </button>
          <button 
            onClick={() => setType('akun')}
            className={cn(
              "px-5 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all",
              type === 'akun' ? "bg-white text-bento-accent shadow-sm" : "text-bento-text-sub hover:text-bento-accent"
            )}
          >
            Laporan per Akun
          </button>
        </div>

        <button 
          onClick={() => window.print()}
          className="flex items-center gap-2 px-5 py-2.5 bg-bento-accent text-white rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-slate-800 transition-all shadow-sm"
        >
          <Printer className="w-4 h-4" />
          <span>Cetak Laporan</span>
        </button>
      </div>

      <div className="bento-card p-0 overflow-hidden print:border-none print:shadow-none">
        <div className="p-10 border-b border-bento-border flex justify-between items-center bg-slate-50/50">
          <div>
            <h2 className="text-2xl font-black text-bento-accent tracking-tight uppercase">
              LAPORAN REALISASI ANGGARAN
            </h2>
            <p className="text-sm text-bento-text-sub font-bold mt-1 uppercase tracking-widest">
              {type === 'skpd' ? 'BASIS UNIT KERJA (SKPD)' : 'BASIS MATA ANGGARAN (AKUN)'} • 2026
            </p>
          </div>
          <div className="text-right">
            <div className="w-14 h-14 bg-bento-accent rounded-xl flex items-center justify-center text-white font-black text-2xl ml-auto mb-2 shadow-lg">
              A
            </div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-bento-text-sub">SI-REALISASI SYSTEMS</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50">
                <th className="px-8 py-5 text-[11px] font-bold text-bento-text-sub uppercase tracking-widest border-b border-bento-border">
                  {type === 'skpd' ? 'Unit / Dinas' : 'Uraian Akun Belanja'}
                </th>
                <th className="px-8 py-5 text-[11px] font-bold text-bento-text-sub uppercase tracking-widest border-b border-bento-border text-right">
                  Pagu
                </th>
                <th className="px-8 py-5 text-[11px] font-bold text-bento-text-sub uppercase tracking-widest border-b border-bento-border text-right">
                  Realisasi
                </th>
                <th className="px-8 py-5 text-[11px] font-bold text-bento-text-sub uppercase tracking-widest border-b border-bento-border text-right">
                  Sisa (SiLPA)
                </th>
                <th className="px-8 py-5 text-[11px] font-bold text-bento-text-sub uppercase tracking-widest border-b border-bento-border text-center">
                  Capaian
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-bento-border">
              {reportData.map((row) => (
                <tr key={row.id} className="hover:bg-slate-50/10">
                  <td className="px-8 py-5">
                    <div className="flex flex-col">
                      <span className="text-sm font-bold text-bento-accent">{row.label}</span>
                      <span className="text-[10px] text-bento-text-sub font-bold uppercase tracking-tighter">{row.sublabel}</span>
                    </div>
                  </td>
                  <td className="px-8 py-5 text-sm text-right font-bold text-bento-text-sub">
                    {formatIDR(row.pagu)}
                  </td>
                  <td className="px-8 py-5 text-sm text-right font-bold text-bento-primary">
                    {formatIDR(row.realisasi)}
                  </td>
                  <td className="px-8 py-5 text-sm text-right font-bold text-bento-warning">
                    {formatIDR(row.sisa)}
                  </td>
                  <td className="px-8 py-5 text-center">
                    <div className="flex flex-col items-center gap-1.5">
                      <div className="w-16 h-1.5 bg-bento-border rounded-full overflow-hidden">
                        <div 
                          className={cn(
                            "h-full transition-all duration-500",
                            row.persen >= 1 ? "bg-bento-success" : "bg-bento-primary"
                          )} 
                          style={{ width: `${Math.min(row.persen * 100, 100)}%` }}
                        />
                      </div>
                      <span className="text-[10px] font-black text-bento-accent">{formatPercent(row.persen)}</span>
                    </div>
                  </td>
                </tr>
              ))}
              
              {/* Footer Totals */}
              <tr className="bg-slate-50 font-black border-t-2 border-slate-200">
                <td className="px-8 py-6 text-sm text-bento-accent uppercase tracking-widest">Aggregate Total</td>
                <td className="px-8 py-6 text-sm text-right text-bento-accent">{formatIDR(totals.pagu)}</td>
                <td className="px-8 py-6 text-sm text-right text-bento-primary">{formatIDR(totals.realisasi)}</td>
                <td className="px-8 py-6 text-sm text-right text-bento-warning">{formatIDR(totals.sisa)}</td>
                <td className="px-8 py-6 text-center text-bento-accent">
                   {formatPercent(totals.pagu > 0 ? totals.realisasi / totals.pagu : 0)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="p-10 flex justify-between items-start text-xs text-bento-text-sub border-t border-bento-border bg-slate-50/20">
          <p className="font-medium">Sistem Terverifikasi • {format(new Date(), 'dd MMM yyyy HH:mm')}</p>
          <div className="text-center w-64">
            <p className="mb-20 font-bold uppercase tracking-widest">Sekretaris Daerah,</p>
            <div className="h-px bg-bento-accent w-full mb-2"></div>
            <p className="font-extrabold text-bento-accent text-sm">Dr. Ir. H. Akhmad Basuki, M.Si</p>
            <p className="font-bold">NIP. 19700101 199501 1 001</p>
          </div>
        </div>
      </div>

      <style>{`
        @media print {
          aside, header, nav, button, .no-print {
            display: none !important;
          }
          main {
            padding: 0 !important;
            margin: 0 !important;
            background: white !important;
          }
          body {
            background: white !important;
          }
        }
      `}</style>
    </div>
  );
}
