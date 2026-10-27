import { COMPANY_CONFIG } from '../../../config/company';
import { escapeHtml } from '../../../utils/print/escapeHtml';
import { formatDateTime } from '../../../utils/print/formatDateTime';
import { formatPlate } from '../../../utils/plate';
import { TicketPrintData, TicketThermalOptions } from './ticketThermal';

export interface TicketOfficialOptions extends TicketThermalOptions {
  paperSize?: 'A4' | 'A5';
}

export function generateTicketOfficialHtml(
  ticket: TicketPrintData,
  options?: TicketOfficialOptions
): string {
  const paperSize = options?.paperSize || 'A4';
  const isA5 = paperSize === 'A5';
  const isReprint = Boolean(options?.isReprint);
  const now = options?.printedAt || formatDateTime(new Date().toISOString());
  const printedBy = options?.printedBy || ticket.oleh || 'Security KIM 3';
  const qrImage = options?.qrDataUrl || '';

  const jenisLabel = (() => {
    const raw = (ticket.jenis || '').toUpperCase();
    if (raw.includes('BOOKING')) return 'BOOKING CONFIRMED';
    if (raw.includes('WALK_IN_MEMBER') || raw.includes('MEMBER')) return 'WALK-IN (MEMBER)';
    return 'WALK-IN';
  })();

  const pageCss = isA5
    ? `@page { size: A5 landscape; margin: 0; }`
    : `@page { size: A4 portrait; margin: 0; }`;

  const wrapperPadding = isA5 ? '8mm 10mm' : '10mm 12mm';

  return `
<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="utf-8" />
  <title>Karcis Masuk Resmi - ${escapeHtml(ticket.nomor_tiket)}</title>
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
      font-size: ${isA5 ? '9.5pt' : '10.5pt'} !important;
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
    }
    .kop-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2px solid #0f172a;
      padding-bottom: ${isA5 ? '8px' : '12px'};
      margin-bottom: ${isA5 ? '8px' : '12px'};
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
      padding: 5px 10px;
      display: inline-flex;
      align-items: center;
    }
    .logo-chip img {
      height: ${isA5 ? '36px' : '44px'};
      width: auto;
      object-fit: contain;
      display: block;
    }
    .kop-identity h1 {
      font-size: ${isA5 ? '13pt' : '15pt'};
      font-weight: 900;
      letter-spacing: -0.02em;
      text-transform: uppercase;
      color: #0f172a;
      line-height: 1.1;
    }
    .kop-identity .branch {
      font-size: ${isA5 ? '8.5pt' : '9.5pt'};
      font-weight: 700;
      color: #334155;
      margin-top: 2px;
    }
    .kop-identity .address {
      font-size: ${isA5 ? '7.5pt' : '8.5pt'};
      color: #475569;
      line-height: 1.25;
      max-width: 520px;
    }
    .kop-right {
      text-align: right;
      flex-shrink: 0;
    }
    .doc-badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 8pt;
      font-weight: 800;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      background-color: #eff6ff;
      color: #1d4ed8;
      border: 1px solid #bfdbfe;
    }
    .reprint-tag {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 8pt;
      font-weight: 800;
      background-color: #fef2f2;
      color: #b91c1c;
      border: 1px solid #fecaca;
      margin-left: 4px;
    }
    .doc-title {
      font-size: ${isA5 ? '12pt' : '14pt'};
      font-weight: 900;
      text-transform: uppercase;
      margin-top: 3px;
      color: #0f172a;
      letter-spacing: -0.01em;
    }
    .doc-number {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: ${isA5 ? '9pt' : '10.5pt'};
      font-weight: 800;
      color: #1e293b;
    }
    .doc-date {
      font-size: 8pt;
      color: #475569;
    }
    .highlight-card {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border: 1.5px solid #cbd5e1;
      border-radius: 6px;
      padding: ${isA5 ? '8px 12px' : '10px 14px'};
      margin-bottom: ${isA5 ? '8px' : '12px'};
      background-color: #f8fafc;
    }
    .plate-badge {
      display: inline-block;
      border: 2px solid #0f172a;
      border-radius: 4px;
      padding: 3px 10px;
      background-color: #ffffff;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: ${isA5 ? '13pt' : '15pt'};
      font-weight: 900;
      letter-spacing: 0.06em;
      color: #0f172a;
    }
    .qr-badge-box {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .qr-badge-box img {
      width: ${isA5 ? '54px' : '64px'};
      height: ${isA5 ? '54px' : '64px'};
      object-fit: contain;
      border: 1px solid #cbd5e1;
      border-radius: 4px;
      background: #ffffff;
      padding: 2px;
    }
    .data-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: ${isA5 ? '8px' : '12px'};
    }
    .data-table th, .data-table td {
      border: 1px solid #cbd5e1;
      padding: ${isA5 ? '4px 8px' : '6px 10px'};
      font-size: ${isA5 ? '8.5pt' : '9.5pt'};
      vertical-align: top;
    }
    .data-table th {
      background-color: #f1f5f9;
      color: #334155;
      font-weight: 700;
      width: 25%;
      text-align: left;
    }
    .data-table td {
      color: #0f172a;
    }
    .data-table td.val-bold {
      font-weight: 700;
    }
    .rules-card {
      border: 1px dashed #94a3b8;
      border-radius: 6px;
      padding: ${isA5 ? '6px 10px' : '8px 12px'};
      margin-bottom: ${isA5 ? '8px' : '14px'};
      background-color: #ffffff;
      font-size: ${isA5 ? '7.5pt' : '8.5pt'};
      color: #334155;
      line-height: 1.35;
    }
    .rules-card strong {
      color: #0f172a;
    }
    .signatures-block {
      page-break-inside: avoid;
      break-inside: avoid;
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 20px;
      margin-top: ${isA5 ? '8px' : '14px'};
      border-top: 1px solid #cbd5e1;
      padding-top: ${isA5 ? '6px' : '10px'};
      text-align: center;
    }
    .sig-col {
      display: flex;
      flex-direction: column;
      align-items: center;
    }
    .sig-role {
      font-size: ${isA5 ? '8pt' : '9pt'};
      color: #475569;
      font-weight: 600;
    }
    .sig-space {
      height: ${isA5 ? '38px' : '50px'};
      width: 100%;
    }
    .sig-line {
      width: 180px;
      border-bottom: 1px solid #64748b;
      margin-bottom: 3px;
    }
    .sig-name {
      font-size: ${isA5 ? '8.5pt' : '9.5pt'};
      font-weight: 700;
      color: #0f172a;
    }
    .footer-audit {
      margin-top: ${isA5 ? '6px' : '10px'};
      border-top: 1px dotted #cbd5e1;
      padding-top: 4px;
      font-size: 7.5pt;
      color: #475569;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
  </style>
</head>
<body>
  <div class="page-wrapper">
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
          <span class="doc-badge">${escapeHtml(jenisLabel)}</span>
          ${isReprint ? '<span class="reprint-tag">SALINAN</span>' : ''}
        </div>
        <div class="doc-title">KARCIS MASUK KENDARAAN</div>
        <div class="doc-number">NO: ${escapeHtml(ticket.nomor_tiket)}</div>
        <div class="doc-date">Tgl Masuk: ${escapeHtml(formatDateTime(ticket.waktu_masuk))}</div>
      </div>
    </div>

    <!-- HIGHLIGHT PLAT & QR CODE -->
    <div class="highlight-card">
      <div>
        <div style="font-size: 8pt; font-weight: 700; color: #475569; text-transform: uppercase; margin-bottom: 3px;">
          NOMOR POLISI ARMADA
        </div>
        <div class="plate-badge">${escapeHtml(formatPlate(ticket.no_polisi))}</div>
      </div>
      <div class="qr-badge-box">
        <div style="text-align: right;">
          <div style="font-size: 8pt; font-weight: 800; color: #0f172a;">TIKET GERBANG DIGITAL</div>
          <div style="font-size: 7.5pt; color: #475569;">Scan QR saat pemeriksaan keluar</div>
        </div>
        ${qrImage ? `<img src="${qrImage}" alt="QR Tiket" />` : ''}
      </div>
    </div>

    <!-- TABEL DATA RINCIAN KUNJUNGAN -->
    <table class="data-table">
      <tbody>
        <tr>
          <th>Nama Pengemudi</th>
          <td class="val-bold">${escapeHtml(ticket.nama_driver || '-')}</td>
          <th>Waktu Check-In</th>
          <td>${escapeHtml(formatDateTime(ticket.waktu_masuk))}</td>
        </tr>
        <tr>
          <th>No. Telepon Driver</th>
          <td>${escapeHtml(ticket.kontak || '-')}</td>
          <th>Perusahaan / Mitra</th>
          <td>${escapeHtml(ticket.nama_perusahaan || '-')}</td>
        </tr>
        <tr>
          <th>PIC Bengkel Dituju</th>
          <td class="val-bold">${escapeHtml(ticket.pic || '-')}</td>
          <th>Tujuan / Layanan</th>
          <td>${escapeHtml(ticket.tujuan || '-')}</td>
        </tr>
        ${ticket.no_booking || ticket.booking_id ? `
        <tr>
          <th>Referensi Booking</th>
          <td colspan="3" class="val-bold" style="font-family: monospace;">
            ${escapeHtml(ticket.no_booking || String(ticket.booking_id))}
          </td>
        </tr>
        ` : ''}
        <tr>
          <th>Keperluan / Keluhan</th>
          <td colspan="3">${escapeHtml(ticket.keperluan || '-')}</td>
        </tr>
        <tr>
          <th>Petugas Security Masuk</th>
          <td>${escapeHtml(ticket.oleh || '-')}</td>
          <th>Dokumentasi Gerbang</th>
          <td>Foto Fisik: ${escapeHtml(String(ticket.fotoCount || '4/4 Sudut'))}</td>
        </tr>
      </tbody>
    </table>

    <!-- PERATURAN & INSTRUKSI OPERASIONAL -->
    <div class="rules-card">
      <strong>TATA TERTIB AREA BENGKEL & KETENTUAN CHECK-OUT:</strong><br />
      1. Karcis ini adalah bukti sah registrasi kendaraan masuk di Pos Security KIM 3.<br />
      2. Pengemudi wajib mematuhi batas kecepatan maksimum 15 km/jam dan APD yang berlaku di bengkel.<br />
      3. Simpan dokumen ini dengan aman dan serahkan kepada Security bersama Gate Pass / Faktur resmi saat meninggalkan area bengkel.
    </div>

    <!-- BLOK TANDA TANGAN DUA PIHAK -->
    <div class="signatures-block">
      <div class="sig-col">
        <div class="sig-role">Pengemudi / Driver Kendaraan,</div>
        <div class="sig-space"></div>
        <div class="sig-line"></div>
        <div class="sig-name">( ${escapeHtml(ticket.nama_driver || 'Pengemudi')} )</div>
      </div>
      <div class="sig-col">
        <div class="sig-role">Petugas Security Gerbang Masuk,</div>
        <div class="sig-space"></div>
        <div class="sig-line"></div>
        <div class="sig-name">( ${escapeHtml(ticket.oleh || 'Petugas Security')} )</div>
      </div>
    </div>

    <!-- AUDIT FOOTER -->
    <div class="footer-audit">
      <span>Dicetak otomatis oleh Sistem Security KIM 3 • Operator: ${escapeHtml(printedBy)}</span>
      <span>Waktu Cetak: ${escapeHtml(now)}</span>
    </div>
  </div>
</body>
</html>
`;
}
