/**
 * Konfigurasi Identitas Perusahaan & Cabang Pos Security Bengkel KIM 3
 * Digunakan untuk Kop Dokumen Resmi, Tiket Check-In, dan Gate Pass (Memo Keluar).
 */

export interface CompanyConfig {
  /** Nama resmi badan hukum perusahaan */
  legalName: string;
  /** Merek / nama dagang yang konsisten dengan aplikasi */
  brandName: string;
  /** Nama cabang / pos operasional */
  branchName: string;
  /** Pos jaga gerbang */
  gateName: string;
  /** Alamat lengkap lokasi cabang */
  address: string;
  /** Kawasan industri / wilayah */
  city: string;
  province: string;
  postalCode: string;
  /** Nomor telepon operasional */
  phone: string;
  /** Email operasional */
  email: string;
  /** Path relatif file logo di public/ */
  logoPath: string;
}

export const COMPANY_CONFIG: CompanyConfig = {
  legalName: 'PT MASTER TRUCK INDONESIA',
  brandName: 'Master Truck',
  branchName: 'Cabang Kawasan Industri Medan III (KIM 3)',
  gateName: 'Pos Security Gerbang Utama KIM 3',
  address: 'Kawasan Industri Medan III (KIM 3), Jl. Pulau Pinang Raya No. 88, Saentis, Percut Sei Tuan',
  city: 'Deli Serdang',
  province: 'Sumatera Utara',
  postalCode: '20371',
  phone: '061-8888-9999 / 0812-3456-7890',
  email: 'security.kim3@mastertruck.co.id',
  logoPath: '/master-truck-logo.png',
};
