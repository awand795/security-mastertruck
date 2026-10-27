import { COMPANY_CONFIG } from '../../../config/company';
import { escapeHtml } from '../../../utils/print/escapeHtml';
import { formatDateTime } from '../../../utils/print/formatDateTime';
import { formatDurationHuman } from '../../../utils/print/formatDuration';
import { formatPlate } from '../../../utils/plate';
import { MemoPrintData, MemoThermalOptions } from './memoThermal';

export interface MemoOfficialOptions extends MemoThermalOptions {
  paperSize?: 'A4' | 'A5';
  twoCopies?: boolean;
}

export function generateMemoOfficialHtml(
  memo: MemoPrintData,
  options?: MemoOfficialOptions
): string {
  const paperSize = options?.paperSize || 'A4';
  const isA5 = paperSize === 'A5';
  const isReprint = Boolean(options?.isReprint);
  const twoCopies = Boolean(options?.twoCopies);
  const now = options?.printedAt || formatDateTime(new Date().toISOString());
  const printedBy = options?.printedBy || memo.petugas_keluar || 'Security KIM 3';
  const qrImage = options?.qrDataUrl || '';

  // Hitung durasi presisi
  const durasiFormatted = formatDurationHuman(
    memo.waktu_masuk,
    memo.waktu_keluar,
    memo.durasi_jam
  );

  // Status verifikasi operasional berbasis data riil (tanpa mengarang checklist)
  const isPembayaranLunas = Boolean(
    memo.cek_pembayaran_lunas ||
    (memo.status_pembayaran && memo.status_pembayaran.trim().toUpperCase() === 'LUNAS')
  );
  const hasSufficientPhotos = (memo.jumlah_foto_keluar ?? 0) >= 4;
  const isBakMuatanChecked = Boolean(memo.cek_bak_muatan);
  const isNopolChecked = Boolean(memo.cek_kesesuaian_nopol);
  const isCheckedOut = Boolean(memo.waktu_keluar && memo.waktu_keluar.trim() !== '');

  const fotoLabel = memo.jumlah_foto_keluar !== undefined
    ? `Pemeriksaan Fisik Kendaraan (${memo.jumlah_foto_keluar}/4 Sudut)`
    : 'Pemeriksaan Fisik Kendaraan (Kamera Gerbang)';

  const pageCss = isA5
    ? `@page { size: A5 landscape; margin: 0; }`
    : `@page { size: A4 portrait; margin: 0; }`;

  const wrapperPadding = isA5 ? '7mm 9mm' : '10mm 12mm';

  const renderSingleSheet = (sheetIndex: number, totalSheets: number) => {
    const defaultCopyLabel = isReprint
      ? 'SALINAN / REPRINT'
      : totalSheets > 1
      ? sheetIndex === 1
        ? 'LEMBAR 1: PENGEMUDI (ASLI)'
        : 'LEMBAR 2: ARSIP SECURITY (SALINAN)'
      : 'LEMBAR ASLI';

    return `
    <div class="page-wrapper ${sheetIndex < totalSheets ? 'page-break' : ''}">
      <!-- KOP RESMI DOKUMEN -->
      <div class="kop-header">
        <div class="kop-left">
          <div class="logo-chip">
            <img src="${escapeHtml(COMPANY_CONFIG.logoPath)}" alt="Master Truck Logo" />
          </div>
          <div class="kop-identity">
            <h1>${escapeHtml(COMPANY_CONFIG.brandName)}</h1>
            <div class="branch">${escapeHtml(COMPANY_CONFIG.branchName)} • ${escapeHtml(COMPANY_CONFIG.gateName)}</div>
            <div class="address">${escapeHtml(COMPANY_CONFIG.address)}, ${escapeHtml(COMPANY_CONFIG.city)} • Telp: ${escapeHtml(COMPANY_CONFIG.phone)}</div>
          </div>
        </div>
        <div class="kop-right">
          <div>
            <span class="doc-badge">${escapeHtml(defaultCopyLabel)}</span>
            ${isReprint ? '<span class="reprint-tag">REPRINT ARSIP</span>' : ''}
          </div>
          <div class="doc-title">SURAT IZIN KELUAR (GATE PASS)</div>
          <div class="doc-number">NO: ${escapeHtml(memo.nomor_memo)}</div>
          <div class="doc-date">Tgl Keluar: ${escapeHtml(formatDateTime(memo.waktu_keluar))}</div>
        </div>
      </div>

      <!-- KARTU ARMADA & STATUS IZIN KELUAR -->
      <div class="highlight-card">
        <div>
          <div style="font-size: 8pt; font-weight: 700; color: #475569; text-transform: uppercase; margin-bottom: 2px;">
            NOMOR POLISI ARMADA
          </div>
          <div class="plate-badge">${escapeHtml(formatPlate(memo.no_polisi))}</div>
        </div>
        <div class="cleared-box">
          ${isCheckedOut ? `
          <div style="font-size: 8pt; font-weight: 800; color: #15803d; letter-spacing: 0.05em; text-transform: uppercase;">
            ✓ CHECK-OUT TERCATAT
          </div>
          <div style="font-size: 7.5pt; color: #475569;">Kendaraan telah teregistrasi keluar di pos gerbang</div>
          ` : `
          <div style="font-size: 8pt; font-weight: 800; color: #b45309; letter-spacing: 0.05em; text-transform: uppercase;">
            PROSES KELUAR
          </div>
          <div style="font-size: 7.5pt; color: #475569;">Menunggu verifikasi pemeriksaan gerbang</div>
          `}
        </div>
        <div class="qr-badge-box">
          ${qrImage ? `<img src="${qrImage}" alt="QR Gate Pass" />` : ''}
        </div>
      </div>

      <!-- TABEL DATA OPERASIONAL CHECK-OUT -->
      <table class="data-table">
        <tbody>
          <tr>
            <th>Nomor Tiket Masuk</th>
            <td class="val-mono">${escapeHtml(memo.nomor_tiket)}</td>
            <th>Nama Pengemudi</th>
            <td class="val-bold">${escapeHtml(memo.nama_pengemudi || '-')}</td>
          </tr>
          <tr>
            <th>Waktu Masuk</th>
            <td>${escapeHtml(formatDateTime(memo.waktu_masuk))}</td>
            <th>Perusahaan / Customer</th>
            <td>${escapeHtml(memo.nama_perusahaan || '-')}</td>
          </tr>
          <tr>
            <th>Waktu Keluar</th>
            <td>${escapeHtml(formatDateTime(memo.waktu_keluar))}</td>
            <th>PIC / Layanan Dituju</th>
            <td>${escapeHtml(memo.pic_tujuan || '-')}</td>
          </tr>
          <tr style="background-color: #f8fafc;">
            <th>DURASI KUNJUNGAN</th>
            <td colspan="3" class="val-bold" style="color: #0f172a; font-size: ${isA5 ? '9pt' : '10.5pt'};">
              ⏱ ${escapeHtml(durasiFormatted)}
            </td>
          </tr>
          ${memo.no_invoice || memo.no_spk || memo.status_pembayaran ? `
          <tr>
            <th>Referensi Transaksi</th>
            <td colspan="3">
              ${memo.no_invoice ? `<span><strong>Invoice:</strong> ${escapeHtml(memo.no_invoice)}</span> ` : ''}
              ${memo.status_pembayaran ? `<span style="display:inline-block; margin-left:6px; padding:1px 6px; background:#dcfce7; color:#15803d; border-radius:3px; font-weight:bold; font-size:8pt;">${escapeHtml(memo.status_pembayaran)}</span> ` : ''}
              ${memo.no_spk ? `<span style="margin-left:6px;"><strong>SPK:</strong> ${escapeHtml(memo.no_spk)}</span>` : ''}
            </td>
          </tr>
          ` : ''}
          ${memo.catatan_keluar ? `
          <tr>
            <th>Catatan Pos Gerbang</th>
            <td colspan="3">${escapeHtml(memo.catatan_keluar)}</td>
          </tr>
          ` : ''}
        </tbody>
      </table>

      <!-- CHECKLIST PEMERIKSAAN KELUAR ENTERPRISE (BERBASIS DATA RIIL) -->
      <div class="checklist-card">
        <div style="font-size: 8pt; font-weight: 800; color: #0f172a; text-transform: uppercase; margin-bottom: 4px;">
          LEMBAR PEMERIKSAAN FISIK &amp; ADMINISTRASI GERBANG:
        </div>
        <div class="checklist-grid">
          <div class="check-item">
            <span class="${isPembayaranLunas ? 'box-checked' : 'box-empty'}">
              ${isPembayaranLunas ? '☑' : '☐'}
            </span>
            Administrasi &amp; Pembayaran Invoice Kasir Lunas
          </div>
          <div class="check-item">
            <span class="${hasSufficientPhotos ? 'box-checked' : 'box-empty'}">
              ${hasSufficientPhotos ? '☑' : '☐'}
            </span>
            ${escapeHtml(fotoLabel)}
          </div>
          <div class="check-item">
            <span class="${isBakMuatanChecked ? 'box-checked' : 'box-empty'}">
              ${isBakMuatanChecked ? '☑' : '☐'}
            </span>
            Pemeriksaan Bak / Muatan / Barang Bawaan
          </div>
          <div class="check-item">
            <span class="${isNopolChecked ? 'box-checked' : 'box-empty'}">
              ${isNopolChecked ? '☑' : '☐'}
            </span>
            Kesesuaian Fisik Nomor Polisi dengan Tiket Masuk
          </div>
        </div>
      </div>

      <!-- TANDA TANGAN 3 PIHAK -->
      <div class="signatures-block">
        <div class="sig-col">
          <div class="sig-role">Pengemudi / Driver,</div>
          <div class="sig-space"></div>
          <div class="sig-line"></div>
          <div class="sig-name">( ${escapeHtml(memo.nama_pengemudi || 'Pengemudi')} )</div>
          <div class="sig-sub">Tgl: ${escapeHtml(now.split(',')[0] || '')}</div>
        </div>
        <div class="sig-col">
          <div class="sig-role">Petugas Security Gerbang,</div>
          <div class="sig-space"></div>
          <div class="sig-line"></div>
          <div class="sig-name">( ${escapeHtml(memo.petugas_keluar || 'Security KIM 3')} )</div>
          <div class="sig-sub">Pos Jaga Gerbang</div>
        </div>
        <div class="sig-col">
          <div class="sig-role">Kasir / Service Advisor (SA),</div>
          <div class="sig-space"></div>
          <div class="sig-line"></div>
          <div class="sig-name">( ___________________________ )</div>
          <div class="sig-sub">Bagian Keuangan / POS</div>
        </div>
      </div>

      <!-- FOOTER KONTROL DOKUMEN -->
      <div class="footer-audit">
        <span>Dicetak oleh: ${escapeHtml(printedBy)} • Pos Security Gerbang KIM 3</span>
        <span>Waktu Cetak: ${escapeHtml(now)} • Status Dokumen: <strong>${escapeHtml(defaultCopyLabel)}</strong></span>
      </div>
    </div>
    `;
  };

  const totalSheets = twoCopies ? 2 : 1;
  const sheetsHtml = Array.from({ length: totalSheets }, (_, idx) => renderSingleSheet(idx + 1, totalSheets)).join('\n');

  return `
<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="utf-8" />
  <title>Gate Pass Resmi - ${escapeHtml(memo.nomor_memo)}</title>
  <style>
    ${pageCss}
    *, *::before, *::after {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    html, body {
      background: #ffffff !important;
      color: #0f172a !important;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif !important;
      font-size: ${isA5 ? '9pt' : '10pt'} !important;
      line-height: 1.35 !important;
      margin: 0 !important;
      padding: 0 !important;
    }
    .page-wrapper {
      width: 100% !important;
      max-width: ${isA5 ? '210mm' : '210mm'} !important;
      margin: 0 auto !important;
      padding: ${wrapperPadding} !important;
      background: #ffffff !important;
      page-break-inside: avoid !important;
      break-inside: avoid !important;
    }
    .page-break {
      page-break-after: always !important;
      break-after: page !important;
    }
    .kop-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2px solid #0f172a;
      padding-bottom: ${isA5 ? '6px' : '10px'};
      margin-bottom: ${isA5 ? '6px' : '10px'};
      gap: 12px;
    }
    .kop-left {
      display: flex;
      align-items: center;
      gap: 12px;
      flex: 1;
    }
    .logo-chip {
      background-color: #0A0D14 !important;
      border: 1px solid #1e293b;
      border-radius: 6px;
      padding: 4px 8px;
      display: inline-flex;
      align-items: center;
    }
    .logo-chip img {
      height: ${isA5 ? '34px' : '42px'};
      width: auto;
      object-fit: contain;
      display: block;
    }
    .kop-identity h1 {
      font-size: ${isA5 ? '12pt' : '14pt'};
      font-weight: 900;
      letter-spacing: -0.02em;
      text-transform: uppercase;
      color: #0f172a;
      line-height: 1.1;
    }
    .kop-identity .branch {
      font-size: ${isA5 ? '8pt' : '9pt'};
      font-weight: 700;
      color: #334155;
      margin-top: 1px;
    }
    .kop-identity .address {
      font-size: ${isA5 ? '7pt' : '8pt'};
      color: #475569;
      line-height: 1.25;
      max-width: 500px;
    }
    .kop-right {
      text-align: right;
      flex-shrink: 0;
    }
    .doc-badge {
      display: inline-block;
      padding: 2px 7px;
      border-radius: 4px;
      font-size: 7.5pt;
      font-weight: 800;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      background-color: #f0fdf4;
      color: #166534;
      border: 1px solid #bbf7d0;
    }
    .reprint-tag {
      display: inline-block;
      padding: 2px 7px;
      border-radius: 4px;
      font-size: 7.5pt;
      font-weight: 800;
      background-color: #fef2f2;
      color: #b91c1c;
      border: 1px solid #fecaca;
      margin-left: 3px;
    }
    .doc-title {
      font-size: ${isA5 ? '11.5pt' : '13.5pt'};
      font-weight: 900;
      text-transform: uppercase;
      margin-top: 2px;
      color: #0f172a;
      letter-spacing: -0.01em;
    }
    .doc-number {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: ${isA5 ? '8.5pt' : '10pt'};
      font-weight: 800;
      color: #1e293b;
    }
    .doc-date {
      font-size: 7.5pt;
      color: #475569;
    }
    .highlight-card {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border: 1.5px solid #cbd5e1;
      border-radius: 5px;
      padding: ${isA5 ? '6px 10px' : '8px 12px'};
      margin-bottom: ${isA5 ? '6px' : '10px'};
      background-color: #f8fafc;
    }
    .plate-badge {
      display: inline-block;
      border: 2px solid #0f172a;
      border-radius: 4px;
      padding: 2px 8px;
      background-color: #ffffff;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: ${isA5 ? '12pt' : '14pt'};
      font-weight: 900;
      letter-spacing: 0.06em;
      color: #0f172a;
    }
    .cleared-box {
      text-align: center;
      padding: 0 10px;
    }
    .qr-badge-box img {
      width: ${isA5 ? '50px' : '60px'};
      height: ${isA5 ? '50px' : '60px'};
      object-fit: contain;
      border: 1px solid #cbd5e1;
      border-radius: 4px;
      background: #ffffff;
      padding: 2px;
      display: block;
    }
    .data-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: ${isA5 ? '6px' : '10px'};
    }
    .data-table th, .data-table td {
      border: 1px solid #cbd5e1;
      padding: ${isA5 ? '4px 7px' : '5px 9px'};
      font-size: ${isA5 ? '8pt' : '9pt'};
      vertical-align: top;
    }
    .data-table th {
      background-color: #f1f5f9;
      color: #334155;
      font-weight: 700;
      width: 24%;
      text-align: left;
    }
    .data-table td {
      color: #0f172a;
    }
    .data-table td.val-bold {
      font-weight: 700;
    }
    .data-table td.val-mono {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-weight: 700;
    }
    .checklist-card {
      border: 1px solid #cbd5e1;
      border-radius: 5px;
      padding: ${isA5 ? '5px 8px' : '7px 10px'};
      margin-bottom: ${isA5 ? '6px' : '10px'};
      background-color: #ffffff;
    }
    .checklist-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: ${isA5 ? '3px 10px' : '4px 12px'};
      font-size: ${isA5 ? '7.5pt' : '8.5pt'};
      color: #334155;
    }
    .check-item {
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .box-checked {
      font-size: 11pt;
      font-weight: 900;
      color: #166534;
      line-height: 1;
    }
    .box-empty {
      font-size: 11pt;
      color: #64748b;
      line-height: 1;
    }
    .signatures-block {
      page-break-inside: avoid;
      break-inside: avoid;
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 12px;
      margin-top: ${isA5 ? '6px' : '10px'};
      border-top: 1px solid #cbd5e1;
      padding-top: ${isA5 ? '5px' : '8px'};
      text-align: center;
    }
    .sig-col {
      display: flex;
      flex-direction: column;
      align-items: center;
    }
    .sig-role {
      font-size: ${isA5 ? '7.5pt' : '8.5pt'};
      color: #475569;
      font-weight: 600;
    }
    .sig-space {
      height: ${isA5 ? '34px' : '44px'};
      width: 100%;
    }
    .sig-line {
      width: 140px;
      border-bottom: 1px solid #64748b;
      margin-bottom: 2px;
    }
    .sig-name {
      font-size: ${isA5 ? '8pt' : '9pt'};
      font-weight: 700;
      color: #0f172a;
    }
    .sig-sub {
      font-size: 7pt;
      color: #64748b;
    }
    .footer-audit {
      margin-top: ${isA5 ? '5px' : '8px'};
      border-top: 1px dotted #cbd5e1;
      padding-top: 3px;
      font-size: 7pt;
      color: #475569;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
  </style>
</head>
<body>
  ${sheetsHtml}
</body>
</html>
`;
}
