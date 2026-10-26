import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Printer,
  CheckCircle2,
  FileCheck,
  Clock,
  User,
  Truck,
  ShieldCheck,
  Hash,
  FileText,
  Receipt,
  Building2,
  Calendar,
} from 'lucide-react';
import { formatPlate } from '../../utils/plate';

export interface MemoKeluarPrintData {
  id: number;
  nomor_memo: string;
  nomor_tiket: string;
  no_polisi: string;
  nama_pengemudi: string;
  pic_tujuan: string;
  waktu_masuk: string;
  waktu_keluar: string;
  petugas_keluar: string;
  durasi: string;
  catatan_keluar?: string;
  nama_perusahaan?: string;
  tipe_kunjungan?: string;
}

interface MemoKeluarPrintModalProps {
  memo: MemoKeluarPrintData | null;
  isOpen: boolean;
  onClose: () => void;
  onNext?: () => void;
}

export const MemoKeluarPrintModal: React.FC<MemoKeluarPrintModalProps> = ({
  memo,
  isOpen,
  onClose,
  onNext,
}) => {
  const [printFormat, setPrintFormat] = useState<'official' | 'thermal'>('official');

  if (!isOpen || !memo) return null;

  const handlePrint = () => {
    let iframe = document.getElementById('memo-print-iframe') as HTMLIFrameElement;
    if (!iframe) {
      iframe = document.createElement('iframe');
      iframe.id = 'memo-print-iframe';
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
      // FORMAT STRUK THERMAL 80MM
      const thermalContent = document.getElementById('printable-thermal-memo');
      doc.write(`
        <!DOCTYPE html>
        <html lang="id">
          <head>
            <title>Gate Pass Thermal - ${memo.nomor_memo}</title>
            <meta charset="utf-8" />
            <style>
              @page { size: 80mm auto; margin: 0; }
              *, *::before, *::after { box-sizing: border-box; }
              body {
                background: #ffffff;
                color: #000000;
                font-family: 'Courier New', Courier, monospace;
                font-size: 11px;
                line-height: 1.35;
                margin: 0;
                padding: 4mm 5mm;
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
              }
              .ticket-wrapper { width: 100%; max-width: 72mm; margin: 0 auto; text-align: center; }
              .header-title { font-size: 14px; font-weight: 900; letter-spacing: 0.05em; text-transform: uppercase; }
              .header-sub { font-size: 9px; color: #333333; margin-bottom: 4px; }
              .divider { border-top: 1px dashed #000000; margin: 6px 0; }
              .plate-box { border: 2px solid #000000; padding: 4px 6px; margin: 6px 0; font-size: 16px; font-weight: 900; letter-spacing: 0.1em; }
              .info-row { display: flex; justify-content: space-between; font-size: 10.5px; margin: 3px 0; text-align: left; }
              .info-label { color: #444444; width: 44%; flex-shrink: 0; }
              .info-value { width: 56%; font-weight: bold; text-align: right; word-break: break-word; }
              .footer-text { font-size: 9px; color: #444444; margin-top: 8px; line-height: 1.25; }
              .barcode-box { margin: 6px 0; font-size: 12px; font-weight: bold; letter-spacing: 0.15em; }
            </style>
          </head>
          <body>
            <div class="ticket-wrapper">
              ${thermalContent ? thermalContent.innerHTML : ''}
            </div>
          </body>
        </html>
      `);
    } else {
      // FORMAT DOKUMEN RESMI A4 / A5 LANDSCAPE (STANDAR INDUSTRI)
      const officialContent = document.getElementById('printable-official-memo');
      doc.write(`
        <!DOCTYPE html>
        <html lang="id">
          <head>
            <title>Memo Keluar Gate Pass - ${memo.nomor_memo}</title>
            <meta charset="utf-8" />
            <style>
              @page {
                size: A4 portrait;
                margin: 12mm 15mm;
              }
              *, *::before, *::after { box-sizing: border-box; }
              body {
                background: #ffffff;
                color: #0f172a;
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
                font-size: 12px;
                line-height: 1.5;
                margin: 0;
                padding: 0;
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
              }
              .doc-container {
                width: 100%;
                max-width: 190mm;
                margin: 0 auto;
                border: 1.5px solid #0f172a;
                padding: 16px 20px;
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
              .kop-title {
                font-size: 18px;
                font-weight: 900;
                color: #0f172a;
                letter-spacing: 0.05em;
                text-transform: uppercase;
                margin: 0;
              }
              .kop-sub {
                font-size: 10px;
                color: #475569;
                margin-top: 2px;
              }
              .memo-badge {
                text-align: right;
              }
              .memo-badge-num {
                font-family: 'Courier New', Courier, monospace;
                font-size: 15px;
                font-weight: 800;
                color: #15803d;
                border: 1px solid #15803d;
                padding: 4px 10px;
                border-radius: 4px;
                display: inline-block;
                background: #f0fdf4;
              }
              .doc-heading {
                text-align: center;
                margin: 10px 0 16px 0;
              }
              .doc-heading h2 {
                margin: 0;
                font-size: 15px;
                font-weight: 800;
                letter-spacing: 0.08em;
                text-transform: uppercase;
                text-decoration: underline;
              }
              .doc-heading p {
                margin: 3px 0 0 0;
                font-size: 11px;
                color: #64748b;
              }
              .info-grid {
                width: 100%;
                border-collapse: collapse;
                margin-bottom: 16px;
              }
              .info-grid td {
                padding: 6px 10px;
                font-size: 11.5px;
                border-bottom: 1px solid #e2e8f0;
                vertical-align: top;
              }
              .info-grid .label {
                width: 25%;
                color: #64748b;
                font-weight: 600;
              }
              .info-grid .sep {
                width: 2%;
                color: #94a3b8;
              }
              .info-grid .val {
                width: 73%;
                font-weight: 700;
                color: #0f172a;
              }
              .plate-highlight {
                font-family: 'Courier New', Courier, monospace;
                font-size: 18px;
                font-weight: 900;
                letter-spacing: 0.12em;
                color: #0f172a;
                background: #f1f5f9;
                padding: 2px 8px;
                border-radius: 4px;
                border: 1px solid #cbd5e1;
                display: inline-block;
              }
              .status-box {
                background: #f8fafc;
                border: 1px solid #cbd5e1;
                padding: 10px 14px;
                border-radius: 6px;
                margin-bottom: 20px;
                font-size: 11px;
              }
              .status-box ul {
                margin: 4px 0 0 0;
                padding-left: 18px;
              }
              .signature-section {
                display: flex;
                justify-content: space-between;
                margin-top: 24px;
                padding-top: 10px;
              }
              .sig-col {
                width: 30%;
                text-align: center;
              }
              .sig-role {
                font-size: 11px;
                font-weight: 700;
                color: #334155;
                margin-bottom: 50px;
              }
              .sig-name {
                font-size: 11px;
                font-weight: 800;
                color: #0f172a;
                border-top: 1px solid #0f172a;
                padding-top: 4px;
              }
              .sig-title {
                font-size: 10px;
                color: #64748b;
              }
            </style>
          </head>
          <body>
            <div class="doc-container">
              ${officialContent ? officialContent.innerHTML : ''}
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
      }
    }, 350);
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-overlay p-4 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="relative flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-border bg-surface-raised shadow-pop animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
          {/* Modal Header */}
          <div className="flex shrink-0 items-center justify-between border-b border-border bg-status-green-bg px-5 py-4">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-status-green-fill text-white shadow-card">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-ink">Cetak Memo Keluar &amp; Gate Pass</h3>
                <p className="text-[11px] font-medium text-status-green">
                  Pilih format cetak resmi (A4/A5) atau struk thermal (80mm)
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              aria-label="Tutup"
              className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-xl text-ink-muted transition hover:bg-surface hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Format Selector Bar */}
          <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-border bg-surface-sunken px-5 py-2.5">
            <span className="text-xs font-bold text-ink">Pilih Format Cetak:</span>
            <div className="inline-flex rounded-xl bg-surface p-1">
              <button
                type="button"
                onClick={() => setPrintFormat('official')}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 ${
                  printFormat === 'official'
                    ? 'bg-surface-raised text-accent shadow-card'
                    : 'text-ink-muted hover:text-ink'
                }`}
              >
                <FileText className="h-3.5 w-3.5" />
                Surat Gate Pass Resmi (A4/A5)
              </button>
              <button
                type="button"
                onClick={() => setPrintFormat('thermal')}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 ${
                  printFormat === 'thermal'
                    ? 'bg-surface-raised text-accent shadow-card'
                    : 'text-ink-muted hover:text-ink'
                }`}
              >
                <Receipt className="h-3.5 w-3.5" />
                Struk Thermal (80mm)
              </button>
            </div>
          </div>

          {/* Modal Body: Scrollable Preview (area kertas selalu terang) */}
          <div className="min-h-0 flex-1 overflow-y-auto bg-surface p-5">
            {printFormat === 'official' ? (
              /* PREVIEW DOKUMEN RESMI A4 / A5 */
              <div className="print-paper mx-auto max-w-[560px] rounded-xl border border-slate-300 bg-white p-6 shadow-sm">
                <div id="printable-official-memo">
                  {/* KOP RESMI */}
                  <div className="kop-header flex items-center justify-between border-b-2 border-slate-900 pb-3">
                    <div>
                      <h1 className="kop-title text-base font-black tracking-wider text-slate-900 uppercase">
                        BENGKEL MASTER TRUCK KIM 3
                      </h1>
                      <p className="kop-sub text-[10px] text-slate-500">
                        Kawasan Industri Modern KIM 3 Medan • Layanan Service & Perbaikan Truk
                      </p>
                    </div>
                    <div className="memo-badge text-right">
                      <span className="memo-badge-num inline-block rounded-md border border-[#15803D] bg-[#F0FDF4] px-2.5 py-1 font-mono text-xs font-bold text-[#15803D]">
                        {memo.nomor_memo}
                      </span>
                    </div>
                  </div>

                  {/* JUDUL MEMO */}
                  <div className="doc-heading my-3 text-center">
                    <h2 className="text-sm font-black tracking-widest text-slate-900 uppercase underline">
                      SURAT IZIN KELUAR KENDARAAN (GATE PASS)
                    </h2>
                    <p className="mt-0.5 text-[10px] text-slate-500">
                      Dokumen resmi verifikasi checkout armada keluar dari area bengkel
                    </p>
                  </div>

                  {/* TABEL DATA ARMADA */}
                  <table className="info-grid w-full text-xs">
                    <tbody>
                      <tr>
                        <td className="label py-1.5 font-semibold text-slate-500">Nomor Polisi</td>
                        <td className="sep py-1.5 text-slate-400">:</td>
                        <td className="val py-1.5">
                          <span className="plate-highlight rounded-md border border-slate-300 bg-slate-50 px-2 py-0.5 font-mono text-base font-black tracking-widest text-slate-900">
                            {formatPlate(memo.no_polisi)}
                          </span>
                        </td>
                      </tr>
                      <tr>
                        <td className="label py-1.5 font-semibold text-slate-500">No. Tiket Masuk</td>
                        <td className="sep py-1.5 text-slate-400">:</td>
                        <td className="val py-1.5 font-mono text-xs text-slate-700">{memo.nomor_tiket}</td>
                      </tr>
                      <tr>
                        <td className="label py-1.5 font-semibold text-slate-500">Pengemudi / Driver</td>
                        <td className="sep py-1.5 text-slate-400">:</td>
                        <td className="val py-1.5 font-bold text-slate-900">{memo.nama_pengemudi}</td>
                      </tr>
                      <tr>
                        <td className="label py-1.5 font-semibold text-slate-500">PIC / Tujuan</td>
                        <td className="sep py-1.5 text-slate-400">:</td>
                        <td className="val py-1.5 font-semibold text-slate-800">{memo.pic_tujuan}</td>
                      </tr>
                      <tr>
                        <td className="label py-1.5 font-semibold text-slate-500">Waktu Check In</td>
                        <td className="sep py-1.5 text-slate-400">:</td>
                        <td className="val py-1.5 text-slate-700">{memo.waktu_masuk}</td>
                      </tr>
                      <tr>
                        <td className="label py-1.5 font-semibold text-slate-500">Waktu Check Out</td>
                        <td className="sep py-1.5 text-slate-400">:</td>
                        <td className="val py-1.5 font-bold text-[#15803D]">{memo.waktu_keluar}</td>
                      </tr>
                      <tr>
                        <td className="label py-1.5 font-semibold text-slate-500">Durasi di Bengkel</td>
                        <td className="sep py-1.5 text-slate-400">:</td>
                        <td className="val py-1.5 text-slate-700">{memo.durasi}</td>
                      </tr>
                      {memo.catatan_keluar && (
                        <tr>
                          <td className="label py-1.5 font-semibold text-slate-500">Catatan Gerbang</td>
                          <td className="sep py-1.5 text-slate-400">:</td>
                          <td className="val py-1.5 text-slate-700 italic">{memo.catatan_keluar}</td>
                        </tr>
                      )}
                    </tbody>
                  </table>

                  {/* BOX STATUS VERIFIKASI */}
                  <div className="status-box my-3 rounded-lg border border-slate-300 bg-slate-50 p-3 text-[11px] text-slate-700">
                    <p className="font-bold text-slate-900">VERIFIKASI ADMINISTRASI & FISIK GERBANG:</p>
                    <ul className="mt-1 list-disc space-y-0.5 pl-4 text-[10.5px]">
                      <li>Pekerjaan servis / transaksi unit armada telah selesai dan disetujui.</li>
                      <li>Pemeriksaan fisik kendaraan & bak muatan telah diverifikasi oleh Pos Security KIM 3.</li>
                      <li>Kendaraan dinyatakan sah dan diizinkan meninggalkan area bengkel KIM 3.</li>
                    </ul>
                  </div>

                  {/* KOLOM TANDA TANGAN 3 PIHAK */}
                  <div className="signature-section mt-6 flex justify-between pt-2 text-center text-xs">
                    <div className="sig-col w-[30%]">
                      <div className="sig-role mb-12 font-bold text-slate-700">Pengemudi / Driver</div>
                      <div className="sig-name border-t border-slate-900 pt-1 font-bold text-slate-900">
                        {memo.nama_pengemudi}
                      </div>
                      <div className="sig-title text-[9px] text-slate-500">Menerima Armada</div>
                    </div>
                    <div className="sig-col w-[30%]">
                      <div className="sig-role mb-12 font-bold text-slate-700">Petugas Security</div>
                      <div className="sig-name border-t border-slate-900 pt-1 font-bold text-slate-900">
                        {memo.petugas_keluar}
                      </div>
                      <div className="sig-title text-[9px] text-slate-500">Pos Gerbang Utama</div>
                    </div>
                    <div className="sig-col w-[30%]">
                      <div className="sig-role mb-12 font-bold text-slate-700">Kasir / SA Bengkel</div>
                      <div className="sig-name border-t border-slate-900 pt-1 font-bold text-slate-900">
                        ( .......................... )
                      </div>
                      <div className="sig-title text-[9px] text-slate-500">Verifikasi Administrasi</div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              /* PREVIEW STRUK THERMAL 80MM */
              <div className="print-paper mx-auto max-w-[320px] rounded-xl border border-dashed border-slate-300 bg-white p-5 shadow-xs">
                <div id="printable-thermal-memo" className="text-center font-mono text-slate-900">
                  <div className="header-title text-sm font-black tracking-wider uppercase">
                    BENGKEL KIM 3
                  </div>
                  <div className="header-sub text-[10px] text-slate-500">
                    GATE PASS • MEMO KELUAR
                  </div>
                  <div className="header-sub text-[9px] text-slate-400">
                    Kawasan Industri Modern KIM 3 Medan
                  </div>

                  <div className="divider my-2 border-t border-dashed border-slate-300" />

                  <div className="plate-box my-2 rounded-lg border-2 border-slate-900 bg-slate-50 py-1.5 text-center font-mono text-xl font-black tracking-widest text-slate-900">
                    {formatPlate(memo.no_polisi)}
                  </div>

                  <div className="barcode-box my-1 text-center font-mono text-xs font-bold tracking-widest text-[#15803D]">
                    * {memo.nomor_memo} *
                  </div>

                  <div className="divider my-2 border-t border-dashed border-slate-300" />

                  <div className="space-y-1 text-left text-[11px]">
                    <div className="info-row flex justify-between gap-2">
                      <span className="info-label text-slate-500">No. Memo:</span>
                      <span className="info-value font-bold text-[#15803D]">{memo.nomor_memo}</span>
                    </div>
                    <div className="info-row flex justify-between gap-2">
                      <span className="info-label text-slate-500">No. Tiket:</span>
                      <span className="info-value font-bold text-slate-700">{memo.nomor_tiket}</span>
                    </div>
                    <div className="info-row flex justify-between gap-2">
                      <span className="info-label text-slate-500">Pengemudi:</span>
                      <span className="info-value truncate font-bold text-slate-800">{memo.nama_pengemudi}</span>
                    </div>
                    <div className="info-row flex justify-between gap-2">
                      <span className="info-label text-slate-500">PIC / Tujuan:</span>
                      <span className="info-value truncate font-bold text-slate-800">{memo.pic_tujuan}</span>
                    </div>
                    <div className="info-row flex justify-between gap-2">
                      <span className="info-label text-slate-500">Waktu Masuk:</span>
                      <span className="info-value font-bold text-slate-800">{memo.waktu_masuk}</span>
                    </div>
                    <div className="info-row flex justify-between gap-2">
                      <span className="info-label text-slate-500">Waktu Keluar:</span>
                      <span className="info-value font-bold text-[#15803D]">{memo.waktu_keluar}</span>
                    </div>
                    <div className="info-row flex justify-between gap-2">
                      <span className="info-label text-slate-500">Durasi:</span>
                      <span className="info-value font-bold text-slate-800">{memo.durasi}</span>
                    </div>
                    <div className="info-row flex justify-between gap-2">
                      <span className="info-label text-slate-500">Petugas Keluar:</span>
                      <span className="info-value font-bold text-slate-800">{memo.petugas_keluar}</span>
                    </div>
                  </div>

                  <div className="divider my-2.5 border-t border-dashed border-slate-300" />

                  <div className="footer-text space-y-1 text-center text-[9px] text-slate-500">
                    <p className="font-bold text-slate-700">STATUS: GATE PASS VERIFIED</p>
                    <p>Kendaraan resmi diizinkan meninggalkan bengkel.</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Modal Footer */}
          <div className="flex shrink-0 flex-col-reverse gap-2.5 border-t border-border bg-surface-sunken p-4 sm:flex-row sm:items-center sm:justify-end">
            {onNext && (
              <button
                type="button"
                onClick={onNext}
                className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-border-strong bg-surface-raised px-4 py-3 text-xs font-semibold text-ink transition hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
              >
                Check Out Berikutnya
              </button>
            )}
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-accent px-5 py-3 text-xs font-bold text-accent-on shadow-card transition hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
            >
              <Printer className="h-4 w-4" />
              {printFormat === 'official' ? 'Cetak Surat Gate Pass Resmi (A4/A5)' : 'Cetak Struk Thermal (80mm)'}
            </button>
          </div>
        </div>
      </div>,
      document.body
    );
  };
