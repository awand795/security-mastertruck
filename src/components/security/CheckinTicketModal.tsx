import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Printer, CheckCircle2, FileText, Receipt, ShieldCheck } from 'lucide-react';
import { formatPlate } from '../../utils/plate';

export interface SuccessTicketData {
  nomor_tiket: string;
  no_polisi: string;
  waktu_masuk: string;
  nama_driver: string;
  jenis: string;
  booking_id?: number | null;
  tujuan: string;
  keperluan: string;
  kontak: string;
  pic: string;
  oleh: string;
}

interface CheckinTicketModalProps {
  ticket: SuccessTicketData | null;
  isOpen: boolean;
  onClose: () => void;
  onNextCheckin: () => void;
}

export const CheckinTicketModal: React.FC<CheckinTicketModalProps> = ({
  ticket,
  isOpen,
  onClose,
  onNextCheckin,
}) => {
  const [printFormat, setPrintFormat] = useState<'thermal' | 'official'>('thermal');

  if (!isOpen || !ticket) return null;

  const handlePrint = () => {
    let iframe = document.getElementById('ticket-print-iframe') as HTMLIFrameElement;
    if (!iframe) {
      iframe = document.createElement('iframe');
      iframe.id = 'ticket-print-iframe';
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = '0';
      iframe.style.visibility = 'hidden';
      document.body.appendChild(iframe);
    }

    const doc = iframe.contentWindow?.document;
    if (!doc) return;

    doc.open();

    if (printFormat === 'thermal') {
      // ─────────────────────────────────────────────────────────────
      // FORMAT CETAK STRUK THERMAL 80MM (PIXEL-PERFECT, HIGH CONTRAST)
      // ─────────────────────────────────────────────────────────────
      doc.write(`
        <!DOCTYPE html>
        <html lang="id">
          <head>
            <title>Karcis Gerbang - ${ticket.nomor_tiket}</title>
            <meta charset="utf-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1.0" />
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
              body {
                background: #ffffff;
                color: #000000;
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
                font-size: 11px;
                line-height: 1.35;
                padding: 4mm 5mm;
                width: 100%;
                max-width: 76mm;
                margin: 0 auto;
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
              }
              .text-center { text-align: center; }
              .header-sub { font-size: 8.5px; color: #333333; margin-top: 2px; }
              .header-title { font-size: 14px; font-weight: 900; letter-spacing: 0.5px; text-transform: uppercase; margin-top: 2px; }
              .divider { border-top: 1.5px dashed #000000; margin: 6px 0; }
              .plate-box {
                border: 2px solid #000000;
                border-radius: 4px;
                padding: 5px 4px;
                margin: 6px 0;
                text-align: center;
                background: #ffffff;
              }
              .plate-lbl { font-size: 8px; font-weight: 800; letter-spacing: 1px; text-transform: uppercase; color: #444444; }
              .plate-val { font-family: 'Courier New', Courier, monospace; font-size: 19px; font-weight: 900; letter-spacing: 2px; margin-top: 2px; }
              .ticket-code {
                font-family: 'Courier New', Courier, monospace;
                font-size: 14px;
                font-weight: 900;
                letter-spacing: 1px;
                text-align: center;
                margin: 4px 0;
              }
              .badge-box {
                display: inline-block;
                border: 1px solid #000000;
                border-radius: 3px;
                padding: 1.5px 6px;
                font-size: 9px;
                font-weight: 800;
                text-transform: uppercase;
                letter-spacing: 0.5px;
                margin-top: 2px;
              }
              .info-tbl {
                width: 100%;
                border-collapse: collapse;
                margin: 6px 0;
                font-size: 10.5px;
              }
              .info-tbl td {
                padding: 2.5px 0;
                vertical-align: top;
              }
              .lbl { color: #333333; width: 40%; text-align: left; }
              .val { font-weight: bold; width: 60%; text-align: right; word-break: break-word; }
              .footer-box {
                font-size: 8.5px;
                color: #222222;
                text-align: center;
                line-height: 1.3;
                margin-top: 6px;
              }
            </style>
          </head>
          <body>
            <div class="text-center">
              <div class="header-sub" style="letter-spacing: 1.2px; font-weight: 800;">POS SECURITY GERBANG</div>
              <div class="header-title">BENGKEL MASTER TRUK KIM 3</div>
              <div class="header-sub">Jl. Pulau Pinang II, Kawasan Industri Medan 3</div>
            </div>

            <div class="divider"></div>

            <div class="text-center">
              <div style="font-size: 9px; font-weight: 700; color: #444;">KARCIS MASUK KENDARAAN</div>
              <div class="ticket-code">* ${ticket.nomor_tiket} *</div>
              <div>
                <span class="badge-box">
                  ${ticket.jenis === 'BOOKING' ? 'RESERVASI BOOKING' : 'KEDATANGAN WALK-IN'}
                </span>
              </div>
            </div>

            <div class="plate-box">
              <div class="plate-lbl">NOMOR POLISI KENDARAAN</div>
              <div class="plate-val">${formatPlate(ticket.no_polisi)}</div>
            </div>

            <table class="info-tbl">
              <tbody>
                <tr>
                  <td class="lbl">Waktu Masuk</td>
                  <td class="val">${ticket.waktu_masuk}</td>
                </tr>
                <tr>
                  <td class="lbl">Tujuan / Divisi</td>
                  <td class="val">${ticket.tujuan}</td>
                </tr>
                <tr>
                  <td class="lbl">Pengemudi</td>
                  <td class="val">${ticket.nama_driver}</td>
                </tr>
                ${ticket.kontak && ticket.kontak !== '-' ? `
                <tr>
                  <td class="lbl">No. Telepon</td>
                  <td class="val">${ticket.kontak}</td>
                </tr>` : ''}
                <tr>
                  <td class="lbl">PIC Bengkel</td>
                  <td class="val">${ticket.pic}</td>
                </tr>
                ${ticket.keperluan ? `
                <tr>
                  <td class="lbl">Keperluan</td>
                  <td class="val">${ticket.keperluan}</td>
                </tr>` : ''}
                <tr style="border-top: 1px solid #000000;">
                  <td class="lbl" style="padding-top: 4px;">Petugas Jaga</td>
                  <td class="val" style="padding-top: 4px;">${ticket.oleh}</td>
                </tr>
              </tbody>
            </table>

            <div class="divider"></div>

            <div class="footer-box">
              <div style="font-weight: 900; text-transform: uppercase;">Simpan Karcis Tiket Ini</div>
              <div style="margin-top: 2px;">Wajib diserahkan ke Security saat proses Check Out kendaraan.</div>
            </div>
          </body>
        </html>
      `);
    } else {
      // ─────────────────────────────────────────────────────────────
      // FORMAT DOKUMEN RESMI A4 / A5 (FORMAL ENTRANCE PASS)
      // ─────────────────────────────────────────────────────────────
      doc.write(`
        <!DOCTYPE html>
        <html lang="id">
          <head>
            <title>Karcis Masuk Gerbang - ${ticket.nomor_tiket}</title>
            <meta charset="utf-8" />
            <style>
              @page {
                size: A4 portrait;
                margin: 12mm 15mm;
              }
              *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
              body {
                background: #ffffff;
                color: #0f172a;
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
                font-size: 12px;
                line-height: 1.5;
                padding: 10px;
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
              }
              .doc-container {
                width: 100%;
                max-width: 185mm;
                margin: 0 auto;
                border: 1.5px solid #0f172a;
                padding: 18px 22px;
                border-radius: 4px;
              }
              .kop-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                border-bottom: 2px solid #0f172a;
                padding-bottom: 12px;
                margin-bottom: 14px;
              }
              .kop-title { font-size: 18px; font-weight: 900; color: #0f172a; text-transform: uppercase; }
              .kop-sub { font-size: 11px; color: #475569; margin-top: 2px; }
              .doc-badge {
                border: 1.5px solid #16a34a;
                color: #16a34a;
                background: #f0fdf4;
                padding: 4px 10px;
                border-radius: 4px;
                font-weight: 800;
                font-size: 11px;
                letter-spacing: 0.5px;
                text-align: right;
              }
              .section-title {
                font-size: 11px;
                font-weight: 800;
                text-transform: uppercase;
                letter-spacing: 0.5px;
                background: #f1f5f9;
                padding: 4px 8px;
                margin: 12px 0 8px 0;
                border-left: 3px solid #12388f;
              }
              .grid-2 {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 8px 20px;
                font-size: 11.5px;
              }
              .field-row {
                display: flex;
                justify-content: space-between;
                border-bottom: 1px dotted #cbd5e1;
                padding: 3px 0;
              }
              .field-lbl { color: #64748b; font-weight: 500; }
              .field-val { font-weight: 700; color: #0f172a; text-align: right; }
              .plate-highlight {
                font-family: 'Courier New', Courier, monospace;
                font-size: 18px;
                font-weight: 900;
                letter-spacing: 2px;
                background: #f8fafc;
                border: 1.5px solid #0f172a;
                padding: 4px 10px;
                border-radius: 4px;
                display: inline-block;
              }
              .sig-grid {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 40px;
                margin-top: 28px;
                text-align: center;
              }
              .sig-box {
                border-top: 1px solid #0f172a;
                padding-top: 6px;
                font-weight: 700;
                font-size: 11px;
              }
              .notice-box {
                background: #fefce8;
                border: 1px solid #fde047;
                padding: 8px 12px;
                border-radius: 4px;
                font-size: 10px;
                color: #713f12;
                margin-top: 16px;
                line-height: 1.4;
              }
            </style>
          </head>
          <body>
            <div class="doc-container">
              <div class="kop-header">
                <div>
                  <div class="kop-title">BENGKEL MASTER TRUK KIM 3</div>
                  <div class="kop-sub">Divisi Pos Keamanan & Pengawasan Gerbang Logistik</div>
                  <div class="kop-sub" style="font-size: 10px;">Jl. Pulau Pinang II, KIM 3 Medan - Sumatera Utara</div>
                </div>
                <div class="doc-badge">
                  KARCIS MASUK GERBANG<br />
                  <span style="font-family: monospace; font-size: 12px; color: #0f172a;">${ticket.nomor_tiket}</span>
                </div>
              </div>

              <div class="section-title">I. IDENTITAS KENDARAAN & KEDATANGAN</div>
              <div class="grid-2">
                <div class="field-row">
                  <span class="field-lbl">No. Polisi Unit:</span>
                  <span class="field-val"><span class="plate-highlight">${formatPlate(ticket.no_polisi)}</span></span>
                </div>
                <div class="field-row">
                  <span class="field-lbl">Jenis Kedatangan:</span>
                  <span class="field-val">${ticket.jenis === 'BOOKING' ? 'Booking Reservasi' : 'Walk-In'}</span>
                </div>
                <div class="field-row">
                  <span class="field-lbl">Waktu Masuk:</span>
                  <span class="field-val" style="color: #16a34a;">${ticket.waktu_masuk}</span>
                </div>
                <div class="field-row">
                  <span class="field-lbl">Tujuan / Layanan:</span>
                  <span class="field-val">${ticket.tujuan}</span>
                </div>
              </div>

              <div class="section-title">II. PERSONEL PENGEMUDI & KEPERLUAN</div>
              <div class="grid-2">
                <div class="field-row">
                  <span class="field-lbl">Nama Pengemudi:</span>
                  <span class="field-val">${ticket.nama_driver}</span>
                </div>
                <div class="field-row">
                  <span class="field-lbl">Kontak HP:</span>
                  <span class="field-val">${ticket.kontak || '-'}</span>
                </div>
                <div class="field-row">
                  <span class="field-lbl">PIC Bengkel:</span>
                  <span class="field-val">${ticket.pic}</span>
                </div>
                <div class="field-row">
                  <span class="field-lbl">Petugas Security:</span>
                  <span class="field-val">${ticket.oleh}</span>
                </div>
              </div>

              <div class="field-row" style="margin-top: 6px;">
                <span class="field-lbl">Keperluan / Keluhan Awal:</span>
                <span class="field-val" style="max-width: 75%;">${ticket.keperluan || 'Pemeriksaan rutin kendaraan'}</span>
              </div>

              <div class="notice-box">
                <strong>INSTRUKSI KESELAMATAN & PROSEDUR KELUAR:</strong><br />
                1. Karcis ini merupakan bukti sah kendaraan telah melewati pos pemeriksaan gerbang masuk.<br />
                2. Simpan karcis ini di dalam kabin kendaraan selama proses perbaikan berlangsung.<br />
                3. Saat kendaraan akan keluar, tunjukkan karcis ini ke pos Security bersama faktur/memo keluar resmi.
              </div>

              <div class="sig-grid">
                <div>
                  <div style="height: 48px;"></div>
                  <div class="sig-box">( ${ticket.nama_driver} )<br /><span style="font-size: 9.5px; font-weight: normal; color: #64748b;">Pengemudi Kendaraan</span></div>
                </div>
                <div>
                  <div style="height: 48px;"></div>
                  <div class="sig-box">( ${ticket.oleh} )<br /><span style="font-size: 9.5px; font-weight: normal; color: #64748b;">Petugas Security Jaga</span></div>
                </div>
              </div>
            </div>
          </body>
        </html>
      `);
    }

    doc.close();

    setTimeout(() => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } catch (e) {
        console.error('Print iframe error:', e);
        window.print();
      }
    }, 300);
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-overlay p-4 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="relative flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-border bg-surface-raised shadow-pop animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-border bg-surface-sunken px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-status-green-bg text-status-green">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-ink">Check In Berhasil</h3>
              <p className="text-xs text-ink-muted">Karcis izin masuk gerbang siap dicetak</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup"
            className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-xl text-ink-subtle transition hover:bg-surface hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Format Selector Tabs */}
        <div className="flex flex-wrap items-center gap-2 border-b border-border bg-surface-sunken px-5 py-2.5">
          <span className="mr-1 text-xs font-semibold text-ink-muted">Format Cetak:</span>
          <button
            type="button"
            onClick={() => setPrintFormat('thermal')}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 ${
              printFormat === 'thermal'
                ? 'bg-surface-raised text-accent shadow-card border border-border'
                : 'border border-transparent text-ink-muted hover:text-ink hover:bg-surface'
            }`}
          >
            <Receipt className="h-3.5 w-3.5" />
            <span>Struk Thermal (80mm)</span>
          </button>
          <button
            type="button"
            onClick={() => setPrintFormat('official')}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 ${
              printFormat === 'official'
                ? 'bg-surface-raised text-accent shadow-card border border-border'
                : 'border border-transparent text-ink-muted hover:text-ink hover:bg-surface'
            }`}
          >
            <FileText className="h-3.5 w-3.5" />
            <span>Dokumen Standar (A4 / A5)</span>
          </button>
        </div>

        {/* Modal Content / Preview Tiket (area kertas selalu terang) */}
        <div className="flex-1 space-y-4 overflow-y-auto bg-surface p-5 sm:p-6">
          {printFormat === 'thermal' ? (
            /* PREVIEW STRUK THERMAL 80MM */
            <div className="print-paper mx-auto max-w-[320px] rounded-xl border border-dashed border-slate-300 bg-white p-5 font-sans text-slate-900 shadow-md">
              {/* Kop Bengkel */}
              <div className="text-center pb-2">
                <p className="text-[9px] font-black tracking-widest uppercase text-slate-400">
                  POS SECURITY GERBANG
                </p>
                <h4 className="text-sm font-black text-slate-900 tracking-tight">
                  BENGKEL MASTER TRUK KIM 3
                </h4>
                <p className="text-[9px] text-slate-500">
                  Jl. Pulau Pinang II, KIM 3 Medan
                </p>
              </div>

              <div className="border-t border-dashed border-slate-300 my-2" />

              {/* Nomor Tiket */}
              <div className="text-center py-1">
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                  KARCIS MASUK KENDARAAN
                </p>
                <p className="font-mono text-sm font-black tracking-widest text-slate-900">
                  * {ticket.nomor_tiket} *
                </p>
                <span className="mt-1 inline-block rounded-md border border-slate-800 px-2 py-0.5 text-[9px] font-black uppercase text-slate-800">
                  {ticket.jenis === 'BOOKING' ? 'RESERVASI BOOKING' : 'KEDATANGAN WALK-IN'}
                </span>
              </div>

              {/* Nomor Polisi Box */}
              <div className="my-2.5 rounded-lg border-2 border-slate-900 bg-slate-50 py-2 text-center">
                <p className="text-[8px] uppercase tracking-wider text-slate-400 font-bold">
                  NOMOR POLISI KENDARAAN
                </p>
                <p className="font-mono text-xl font-black tracking-widest text-slate-900">
                  {formatPlate(ticket.no_polisi)}
                </p>
              </div>

              {/* Detail Karcis Gerbang */}
              <div className="space-y-1.5 text-xs py-1">
                <div className="flex justify-between items-center text-[11px]">
                  <span className="text-slate-500">Waktu Masuk:</span>
                  <span className="font-bold text-emerald-700">{ticket.waktu_masuk}</span>
                </div>
                <div className="flex justify-between items-center text-[11px]">
                  <span className="text-slate-500">Tujuan:</span>
                  <span className="font-bold text-slate-900 uppercase">{ticket.tujuan}</span>
                </div>
                <div className="flex justify-between items-center text-[11px]">
                  <span className="text-slate-500">Pengemudi:</span>
                  <span className="font-bold text-slate-900 max-w-[170px] truncate text-right">
                    {ticket.nama_driver}
                  </span>
                </div>
                {ticket.kontak && ticket.kontak !== '-' && (
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="text-slate-500">No. Telp:</span>
                    <span className="font-semibold text-slate-700">{ticket.kontak}</span>
                  </div>
                )}
                <div className="flex justify-between items-center text-[11px]">
                  <span className="text-slate-500">PIC Bengkel:</span>
                  <span className="font-bold text-slate-900 max-w-[170px] truncate text-right">
                    {ticket.pic}
                  </span>
                </div>
                {ticket.keperluan && (
                  <div className="flex justify-between items-start text-[11px] pt-0.5">
                    <span className="text-slate-500 shrink-0">Keperluan:</span>
                    <span className="font-semibold text-slate-800 text-right max-w-[170px] break-words">
                      {ticket.keperluan}
                    </span>
                  </div>
                )}
                <div className="flex justify-between items-center text-[11px] pt-1 border-t border-slate-200">
                  <span className="text-slate-500">Petugas Jaga:</span>
                  <span className="font-bold text-slate-800 uppercase">{ticket.oleh}</span>
                </div>
              </div>

              <div className="border-t border-dashed border-slate-300 my-2.5" />

              {/* Catatan Bawah Karcis */}
              <div className="text-center space-y-0.5 text-[8.5px] text-slate-500">
                <p className="font-bold text-slate-700 uppercase">
                  Simpan Karcis Ini di Kendaraan
                </p>
                <p>
                  Wajib diserahkan saat proses Check Out kendaraan.
                </p>
              </div>
            </div>
          ) : (
            /* PREVIEW DOKUMEN RESMI A4/A5 */
            <div className="print-paper mx-auto rounded-xl border border-slate-300 bg-white p-5 font-sans text-slate-900 shadow-md">
              <div className="flex justify-between items-start border-b-2 border-slate-900 pb-3">
                <div>
                  <h4 className="text-base font-black text-slate-900 uppercase">BENGKEL MASTER TRUK KIM 3</h4>
                  <p className="text-xs text-slate-500">Pos Keamanan & Pengawasan Gerbang Logistik</p>
                  <p className="text-[10px] text-slate-400">Jl. Pulau Pinang II, KIM 3 Medan</p>
                </div>
                <div className="rounded-lg border border-emerald-600 bg-emerald-50 px-3 py-1 text-right">
                  <p className="text-[10px] font-bold text-emerald-700">KARCIS MASUK RESMI</p>
                  <p className="font-mono text-xs font-black text-slate-900">{ticket.nomor_tiket}</p>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-2.5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Nomor Polisi Unit</span>
                  <p className="font-mono text-base font-black text-slate-900">{formatPlate(ticket.no_polisi)}</p>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-2.5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Waktu Check In</span>
                  <p className="text-sm font-bold text-emerald-700">{ticket.waktu_masuk}</p>
                </div>
                <div className="border-b border-slate-100 py-1.5 flex justify-between">
                  <span className="text-slate-500">Pengemudi:</span>
                  <span className="font-bold text-slate-900">{ticket.nama_driver}</span>
                </div>
                <div className="border-b border-slate-100 py-1.5 flex justify-between">
                  <span className="text-slate-500">Jenis:</span>
                  <span className="font-bold text-slate-900">{ticket.jenis === 'BOOKING' ? 'Booking' : 'Walk-In'}</span>
                </div>
                <div className="border-b border-slate-100 py-1.5 flex justify-between">
                  <span className="text-slate-500">Kontak:</span>
                  <span className="font-semibold text-slate-700">{ticket.kontak || '-'}</span>
                </div>
                <div className="border-b border-slate-100 py-1.5 flex justify-between">
                  <span className="text-slate-500">PIC Bengkel:</span>
                  <span className="font-bold text-slate-900">{ticket.pic}</span>
                </div>
              </div>

              <div className="mt-3 rounded-lg bg-amber-50 border border-amber-200 p-2.5 text-[10px] text-amber-800">
                <strong>INSTRUKSI GERBANG:</strong> Wajib ditunjukkan ke petugas Security saat unit keluar gerbang bengkel.
              </div>
            </div>
          )}
        </div>

        {/* Modal Actions */}
        <div className="flex flex-col-reverse items-center justify-between gap-2.5 border-t border-border bg-surface-sunken px-5 py-3.5 sm:flex-row">
          <button
            type="button"
            onClick={onNextCheckin}
            className="w-full cursor-pointer rounded-xl border border-border-strong bg-surface-raised px-4 py-3 text-xs font-semibold text-ink shadow-card transition hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 sm:w-auto"
          >
            Check In Berikutnya
          </button>

          <button
            type="button"
            onClick={handlePrint}
            className="w-full cursor-pointer rounded-xl bg-accent px-5 py-3 text-xs font-bold text-accent-on shadow-card transition hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 sm:w-auto"
          >
            <span className="inline-flex items-center justify-center gap-2">
              <Printer className="h-4 w-4" />
              <span>
                {printFormat === 'thermal'
                  ? 'Cetak Struk Thermal (80mm)'
                  : 'Cetak Dokumen Resmi (A4/A5)'}
              </span>
            </span>
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
