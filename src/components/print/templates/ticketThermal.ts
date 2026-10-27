import { COMPANY_CONFIG } from '../../../config/company';
import { escapeHtml } from '../../../utils/print/escapeHtml';
import { formatDateTime } from '../../../utils/print/formatDateTime';
import { formatPlate } from '../../../utils/plate';

export interface TicketPrintData {
  nomor_tiket: string;
  no_polisi: string;
  waktu_masuk: string;
  nama_driver: string;
  jenis: string;
  booking_id?: number | null;
  no_booking?: string | null;
  nama_perusahaan?: string | null;
  tujuan: string;
  keperluan: string;
  kontak: string;
  pic: string;
  oleh: string;
  fotoCount?: string | number;
}

export interface TicketThermalOptions {
  qrDataUrl?: string;
  isReprint?: boolean;
  printedAt?: string;
  printedBy?: string;
}

export function generateTicketThermalHtml(
  ticket: TicketPrintData,
  options?: TicketThermalOptions
): string {
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

  return `
<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="utf-8" />
  <title>Karcis Masuk - ${escapeHtml(ticket.nomor_tiket)}</title>
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
    .ticket-title {
      font-size: 13px;
      font-weight: 900;
      letter-spacing: 0.5px;
      margin-top: 4px;
      text-transform: uppercase;
    }
    .ticket-number {
      font-size: 14px;
      font-weight: 900;
      letter-spacing: 1px;
      margin: 2px 0;
    }
    .badge-jenis {
      display: inline-block;
      border: 1px solid #000000;
      padding: 1px 6px;
      font-size: 9.5px;
      font-weight: bold;
      text-transform: uppercase;
      margin-top: 3px;
    }
    .reprint-badge {
      display: inline-block;
      border: 1.5px solid #000000;
      padding: 1px 8px;
      font-size: 10px;
      font-weight: 900;
      letter-spacing: 1px;
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
      width: 38%;
      color: #000000;
      flex-shrink: 0;
    }
    .sep {
      width: 4%;
      text-align: center;
      flex-shrink: 0;
    }
    .val {
      width: 58%;
      text-align: right;
      font-weight: bold;
      word-break: break-word;
    }
    .notes-box {
      border: 1px dashed #000000;
      padding: 4px;
      margin: 6px 0;
      font-size: 9.5px;
      text-align: left;
      line-height: 1.3;
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
    
    <div class="ticket-title">KARCIS MASUK KENDARAAN</div>
    <div class="ticket-number">${escapeHtml(ticket.nomor_tiket)}</div>
    
    <div>
      <span class="badge-jenis">[ ${escapeHtml(jenisLabel)} ]</span>
    </div>

    ${isReprint ? '<div><span class="reprint-badge">** SALINAN / REPRINT **</span></div>' : ''}
  </div>

  <div class="plate-box">
    ${escapeHtml(formatPlate(ticket.no_polisi))}
  </div>

  ${qrImage ? `
  <div class="qr-container">
    <img src="${qrImage}" alt="QR Tiket" />
    <div style="font-size: 8px; margin-top: 1px;">SCAN UNTUK CHECK-OUT</div>
  </div>
  ` : ''}

  <div class="divider"></div>

  <div class="row">
    <span class="label">Waktu Masuk</span>
    <span class="sep">:</span>
    <span class="val">${escapeHtml(formatDateTime(ticket.waktu_masuk))}</span>
  </div>

  <div class="row">
    <span class="label">Pengemudi</span>
    <span class="sep">:</span>
    <span class="val">${escapeHtml(ticket.nama_driver || '-')}</span>
  </div>

  ${ticket.kontak ? `
  <div class="row">
    <span class="label">No. Telepon</span>
    <span class="sep">:</span>
    <span class="val">${escapeHtml(ticket.kontak)}</span>
  </div>
  ` : ''}

  ${ticket.nama_perusahaan ? `
  <div class="row">
    <span class="label">Perusahaan</span>
    <span class="sep">:</span>
    <span class="val">${escapeHtml(ticket.nama_perusahaan)}</span>
  </div>
  ` : ''}

  ${ticket.no_booking || ticket.booking_id ? `
  <div class="row">
    <span class="label">No. Booking</span>
    <span class="sep">:</span>
    <span class="val">${escapeHtml(ticket.no_booking || String(ticket.booking_id))}</span>
  </div>
  ` : ''}

  <div class="row">
    <span class="label">PIC Bengkel</span>
    <span class="sep">:</span>
    <span class="val">${escapeHtml(ticket.pic || '-')}</span>
  </div>

  <div class="row">
    <span class="label">Tujuan/Layanan</span>
    <span class="sep">:</span>
    <span class="val">${escapeHtml(ticket.tujuan || '-')}</span>
  </div>

  ${ticket.keperluan ? `
  <div class="row">
    <span class="label">Keperluan</span>
    <span class="sep">:</span>
    <span class="val">${escapeHtml(ticket.keperluan)}</span>
  </div>
  ` : ''}

  ${ticket.fotoCount ? `
  <div class="row">
    <span class="label">Dokumentasi</span>
    <span class="sep">:</span>
    <span class="val">Foto ${escapeHtml(String(ticket.fotoCount))}</span>
  </div>
  ` : ''}

  <div class="row">
    <span class="label">Petugas Jaga</span>
    <span class="sep">:</span>
    <span class="val">${escapeHtml(ticket.oleh || '-')}</span>
  </div>

  <div class="divider"></div>

  <div class="notes-box">
    <strong>PERHATIAN PENGEMUDI:</strong><br />
    1. Simpan karcis ini baik-baik selama berada di dalam area bengkel.<br />
    2. Tunjukkan karcis ini ke Security saat hendak check-out keluar.<br />
    3. Kehilangan karcis wajib melampirkan STNK asli & identitas resmi.
  </div>

  <div class="divider-double"></div>

  <div class="footer">
    Dicetak: ${escapeHtml(now)}<br />
    Oleh: ${escapeHtml(printedBy)}<br />
    <em>Sistem Pos Security KIM 3</em>
  </div>
</body>
</html>
`;
}
