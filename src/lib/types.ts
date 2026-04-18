export interface SKPD {
  id: string;
  kode: string;
  nama: string;
}

export interface Anggaran {
  id: string;
  skpdId: string;
  kodeProgram?: string;
  namaProgram?: string;
  kodeKegiatan?: string;
  namaKegiatan?: string;
  kodeSubKegiatan?: string;
  namaSubKegiatan?: string;
  kodeAkun: string;
  namaAkun: string;
  pagu: number; // Planned budget
}

export interface Realisasi {
  id: string;
  anggaranId: string;
  tanggal: string;
  nilai: number;
  keterangan: string;
}

export interface DashboardStats {
  totalAnggaran: number;
  totalRealisasi: number;
  totalSisa: number;
  persentase: number;
}
