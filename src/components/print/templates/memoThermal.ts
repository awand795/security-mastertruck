import { COMPANY_CONFIG } from '../../../config/company';
import { escapeHtml } from '../../../utils/print/escapeHtml';
import { formatDateTime } from '../../../utils/print/formatDateTime';
import { formatDurationHuman } from '../../../utils/print/formatDuration';
import { formatPlate } from '../../../utils/plate';

export interface MemoPrintData {
  id: number;
  nomor_memo: string;
  nomor_tiket: string;
  no_polisi: string;
  nama_pengemudi: string;
  pic_tujuan: string;
  waktu_masuk: string;
  waktu_keluar: string;
  petugas_keluar: string;
  durasi?: string;
  durasi_jam?: number;
  catatan_keluar?: string;
  nama_perusahaan?: string;
  tipe_kunjungan?: string;
  no_invoice?: string;
  status_pembayaran?: string;
  no_spk?: string;
  jumlah_foto_keluar?: number;
  cek_pembayaran_lunas?: boolean;
  cek_bak_muatan?: boolean;
  cek_kesesuaian_nopol?: boolean;
}

export interface MemoThermalOptions {
  qrDataUrl?: string;
  isReprint?: boolean;
  printedAt?: string;
  printedBy?: string;
  copyLabel?: string;
}

export function generateMemoThermalHtml(
  memo: MemoPrintData,
  options?: MemoThermalOptions
): string {
  const isReprint = Boolean(options?.isReprint);
  const now = options?.printedAt || formatDateTime(new Date().toISOString());
  const printedBy = options?.printedBy || memo.petugas_keluar || 'Security KIM 3';
  const qrImage = options?.qrDataUrl || '';
  const copyLabel = options?.copyLabel || (isReprint ? 'SALINAN / REPRINT' : 'LEMBAR ASLI');

  // Hitung durasi secara presisi dari waktu_masuk & waktu_keluar atau durasi_jam
  const durasiFormatted = formatDurationHuman(
    memo.waktu_masuk,
    memo.waktu_keluar,
    memo.durasi_jam
  );

  // Hitung status checklist operasional berbasis data riil (tanpa mengarang klaim)
  const isPembayaranLunas = Boolean(
    memo.cek_pembayaran_lunas ||
    (memo.status_pembayaran && memo.status_pembayaran.trim().toUpperCase() === 'LUNAS')
  );
  const hasSufficientPhotos = (memo.jumlah_foto_keluar ?? 0) >= 4;
  const isBakMuatanChecked = Boolean(memo.cek_bak_muatan);
  const isNopolChecked = Boolean(memo.cek_kesesuaian_nopol);
  const isCheckedOut = Boolean(memo.waktu_keluar && memo.waktu_keluar.trim() !== '');

  const fotoLabel = memo.jumlah_foto_keluar !== undefined
    ? `Foto Fisik: ${memo.jumlah_foto_keluar}/4 Sudut`
    : 'Pemeriksaan Fisik 4 Sudut';

  return `
<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="utf-8" />
  <title>Gate Pass Thermal - ${escapeHtml(memo.nomor_memo)}</title>
  <style>
    @page {
      size: 80mm auto;
      margin: 0;
    }
    *, *::before, *::after {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    html, body {
      background: #ffffff !important;
      color: #000000 !important;
      font-family: 'Courier New', Courier, ui-monospace, monospace !important;
      font-size: 11px !important;
      line-height: 1.35 !important;
      width: 80mm !important;
      max-width: 80mm !important;
      margin: 0 auto !important;
      padding: 4mm 5mm !important;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    .text-center { text-align: center; }
    .text-right { text-align: right; }
    .bold { font-weight: bold; }
    .divider {
      border-top: 1px dashed #000000;
      margin: 6px 0;
    }
    .divider-double {
      border-top: 2px dashed #000000;
      margin: 6px 0;
    }
    .header-brand {
      font-size: 15px;
      font-weight: 900;
      letter-spacing: 0.5px;
      text-transform: uppercase;
    }
    .header-sub {
      font-size: 9px;
      margin-top: 1px;
    }
    .memo-title {
      font-size: 13px;
      font-weight: 900;
      letter-spacing: 0.5px;
      margin-top: 4px;
      text-transform: uppercase;
    }
    .memo-number {
      font-size: 13.5px;
      font-weight: 900;
      letter-spacing: 0.8px;
      margin: 2px 0;
    }
    .reprint-badge {
      display: inline-block;
      border: 1.5px solid #000000;
      padding: 1px 8px;
      font-size: 10px;
      font-weight: 900;
      letter-spacing: 0.8px;
      margin-top: 3px;
    }
    .plate-box {
      border: 2px solid #000000;
      padding: 4px 6px;
      margin: 6px 0;
      text-align: center;
      font-size: 16px;
      font-weight: 900;
      letter-spacing: 1.5px;
    }
    .qr-container {
      margin: 6px 0;
      text-align: center;
    }
    .qr-container img {
      width: 120px;
      height: 120px;
      object-fit: contain;
      display: block;
      margin: 0 auto;
    }
    .row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 2.5px;
      word-break: break-word;
    }
    .label {
      width: 40%;
      color: #000000;
      flex-shrink: 0;
    }
    .sep {
      width: 4%;
      text-align: center;
      flex-shrink: 0;
    }
    .val {
      width: 56%;
      text-align: right;
      font-weight: bold;
      word-break: break-word;
    }
    .checklist-box {
      border: 1px dashed #000000;
      padding: 4px 6px;
      margin: 6px 0;
      font-size: 9.5px;
      line-height: 1.4;
    }
    .cleared-badge {
      display: inline-block;
      border: 2px solid #000000;
      padding: 3px 10px;
      font-size: 12px;
      font-weight: 900;
      letter-spacing: 1px;
      margin: 5px 0;
      text-transform: uppercase;
    }
    .footer {
      font-size: 8.5px;
      text-align: center;
      margin-top: 5px;
      line-height: 1.3;
    }
  </style>
</head>
<body>
  <div class="text-center">
    <div class="header-brand">${escapeHtml(COMPANY_CONFIG.brandName)}</div>
    <div class="header-sub">${escapeHtml(COMPANY_CONFIG.branchName)}</div>
    <div class="header-sub">${escapeHtml(COMPANY_CONFIG.gateName)}</div>

    <div class="divider"></div>

    <div class="memo-title">SURAT IZIN KELUAR (GATE PASS)</div>
    <div class="memo-number">${escapeHtml(memo.nomor_memo)}</div>
    <div style="font-size: 9.5px;">Ref Tiket: ${escapeHtml(memo.nomor_tiket)}</div>

    <div>
      <span class="reprint-badge">[ ${escapeHtml(copyLabel)} ]</span>
    </div>
  </div>

  <div class="plate-box">
    ${escapeHtml(formatPlate(memo.no_polisi))}
  </div>

  ${qrImage ? `
  <div class="qr-container">
    <img src="${qrImage}" alt="QR Gate Pass" />
    <div style="font-size: 8px; margin-top: 1px;">VERIFIKASI DIGITAL KELUAR</div>
  </div>
  ` : ''}

  <div class="divider"></div>

  <div class="row">
    <span class="label">Pengemudi</span>
    <span class="sep">:</span>
    <span class="val">${escapeHtml(memo.nama_pengemudi || '-')}</span>
  </div>

  ${memo.nama_perusahaan ? `
  <div class="row">
    <span class="label">Perusahaan</span>
    <span class="sep">:</span>
    <span class="val">${escapeHtml(memo.nama_perusahaan)}</span>
  </div>
  ` : ''}

  <div class="row">
    <span class="label">PIC / Tujuan</span>
    <span class="sep">:</span>
    <span class="val">${escapeHtml(memo.pic_tujuan || '-')}</span>
  </div>

  <div class="row">
    <span class="label">Waktu Masuk</span>
    <span class="sep">:</span>
    <span class="val">${escapeHtml(formatDateTime(memo.waktu_masuk))}</span>
  </div>

  <div class="row">
    <span class="label">Waktu Keluar</span>
    <span class="sep">:</span>
    <span class="val">${escapeHtml(formatDateTime(memo.waktu_keluar))}</span>
  </div>

  <div class="row" style="background: #f0f0f0; padding: 1px 0;">
    <span class="label"><strong>DURASI</strong></span>
    <span class="sep">:</span>
    <span class="val"><strong>${escapeHtml(durasiFormatted)}</strong></span>
  </div>

  <div class="row">
    <span class="label">Petugas Keluar</span>
    <span class="sep">:</span>
    <span class="val">${escapeHtml(memo.petugas_keluar || '-')}</span>
  </div>

  ${memo.catatan_keluar ? `
  <div class="row">
    <span class="label">Catatan Pos</span>
    <span class="sep">:</span>
    <span class="val">${escapeHtml(memo.catatan_keluar)}</span>
  </div>
  ` : ''}

  <div class="divider"></div>

  <div class="checklist-box">
    <strong>VERIFIKASI PEMERIKSAAN KELUAR:</strong><br />
    [${isPembayaranLunas ? 'X' : ' '}] Administrasi / Pembayaran Lunas<br />
    [${hasSufficientPhotos ? 'X' : ' '}] ${escapeHtml(fotoLabel)}<br />
    [${isBakMuatanChecked ? 'X' : ' '}] Pemeriksaan Bak &amp; Muatan<br />
    [${isNopolChecked ? 'X' : ' '}] Kesesuaian Nopol Fisik &amp; Tiket
  </div>

  <div class="text-center">
    <span class="cleared-badge">${isCheckedOut ? 'KENDARAAN TELAH CHECK-OUT' : 'PROSES PEMERIKSAAN GERBANG'}</span>
  </div>

  <div class="divider-double"></div>

  <div class="footer">
    Dicetak: ${escapeHtml(now)}<br />
    Oleh: ${escapeHtml(printedBy)}<br />
    <em>Sistem Pos Security KIM 3 • Sah Tanpa Stempel Basah</em>
  </div>
</body>
</html>
`;
}
