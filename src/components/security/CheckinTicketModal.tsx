import React from 'react';
import { X, Printer, CheckCircle2, QrCode, FileText, Clock, User, Phone, Truck, ShieldCheck, MapPin } from 'lucide-react';
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
  if (!isOpen || !ticket) return null;

  const handlePrint = () => {
    const printContent = document.getElementById('printable-checkin-ticket');
    if (!printContent) return;

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
    if (doc) {
      doc.open();
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
              }
              body {
                background: #ffffff;
                color: #000000;
                font-family: 'Courier New', Courier, monospace, monospace;
                font-size: 11px;
                line-height: 1.35;
                margin: 0;
                padding: 4mm 5mm;
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
              }
              .ticket-wrapper {
                width: 100%;
                max-width: 72mm;
                margin: 0 auto;
                text-align: center;
              }
              .header-title {
                font-size: 14px;
                font-weight: 900;
                letter-spacing: 0.05em;
                margin-bottom: 2px;
                text-transform: uppercase;
              }
              .header-sub {
                font-size: 9px;
                color: #333333;
                margin-bottom: 6px;
              }
              .divider {
                border-top: 1px dashed #000000;
                margin: 6px 0;
              }
              .plate-box {
                border: 2px solid #000000;
                padding: 4px 6px;
                margin: 6px 0;
                font-size: 16px;
                font-weight: 900;
                letter-spacing: 0.1em;
                font-family: 'Courier New', Courier, monospace;
              }
              .info-row {
                display: flex;
                justify-content: space-between;
                font-size: 10.5px;
                margin: 3px 0;
                text-align: left;
              }
              .info-label {
                color: #444444;
                width: 42%;
                flex-shrink: 0;
              }
              .info-value {
                width: 58%;
                font-weight: bold;
                text-align: right;
                word-break: break-word;
              }
              .footer-text {
                font-size: 9px;
                color: #444444;
                margin-top: 8px;
                line-height: 1.25;
              }
              .barcode-box {
                margin: 8px 0 4px 0;
                padding: 4px;
                font-family: monospace;
                font-weight: bold;
                font-size: 12px;
                letter-spacing: 0.15em;
              }
            </style>
          </head>
          <body>
            <div class="ticket-wrapper">
              ${printContent.innerHTML}
            </div>
          </body>
        </html>
      `);
      doc.close();

      setTimeout(() => {
        try {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
        } catch (e) {
          console.error('Print iframe error:', e);
          window.print();
        }
      }, 350);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/80 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Check In Berhasil</h3>
              <p className="text-xs text-slate-500">Karcis izin masuk gerbang diterbitkan</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Content / Preview Tiket */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4">
          {/* Box Karcis Fisik (Siap Cetak Thermal 80mm) */}
          <div
            id="printable-checkin-ticket"
            className="mx-auto max-w-[340px] rounded-xl border border-dashed border-slate-300 bg-slate-50/70 p-4 font-mono text-slate-800 shadow-inner"
          >
            {/* Kop Bengkel */}
            <div className="text-center pb-2">
              <p className="font-sans text-[10px] font-bold tracking-widest uppercase text-slate-400">
                POS SECURITY GERBANG
              </p>
              <h4 className="font-sans text-sm font-black text-slate-900 tracking-tight">
                BENGKEL MASTER TRUK KIM 3
              </h4>
              <p className="font-sans text-[10px] text-slate-500">
                Jl. Pulau Pinang II, Kawasan Industri Medan 3
              </p>
            </div>

            <div className="border-t border-dashed border-slate-300 my-2" />

            {/* Nomor Polisi Box */}
            <div className="my-2 rounded-lg border-2 border-slate-800 bg-white py-2 text-center shadow-xs">
              <p className="text-[9px] uppercase tracking-wider text-slate-400 font-sans">
                NOMOR POLISI KENDARAAN
              </p>
              <p className="text-xl font-black tracking-widest text-slate-900">
                {formatPlate(ticket.no_polisi)}
              </p>
            </div>

            {/* Detail Karcis Gerbang */}
            <div className="space-y-1.5 text-xs py-1">
              <div className="flex justify-between items-center text-[11px]">
                <span className="text-slate-500">NO. TIKET:</span>
                <span className="font-bold text-slate-900">{ticket.nomor_tiket}</span>
              </div>
              <div className="flex justify-between items-center text-[11px]">
                <span className="text-slate-500">WAKTU MASUK:</span>
                <span className="font-semibold text-emerald-700">{ticket.waktu_masuk}</span>
              </div>
              <div className="flex justify-between items-center text-[11px]">
                <span className="text-slate-500">TUJUAN:</span>
                <span className="font-bold text-blue-700 uppercase">{ticket.tujuan}</span>
              </div>
              <div className="flex justify-between items-center text-[11px]">
                <span className="text-slate-500">PENGEMUDI:</span>
                <span className="font-semibold text-slate-900 max-w-[170px] truncate text-right">
                  {ticket.nama_driver}
                </span>
              </div>
              <div className="flex justify-between items-center text-[11px]">
                <span className="text-slate-500">PIC / TUJUAN:</span>
                <span className="font-semibold text-slate-900 max-w-[170px] truncate text-right">
                  {ticket.pic}
                </span>
              </div>
              {ticket.kontak && (
                <div className="flex justify-between items-center text-[11px]">
                  <span className="text-slate-500">KONTAK:</span>
                  <span className="font-semibold text-slate-700">{ticket.kontak}</span>
                </div>
              )}
              {ticket.keperluan && (
                <div className="flex justify-between items-start text-[11px] pt-0.5">
                  <span className="text-slate-500 shrink-0">KEPERLUAN:</span>
                  <span className="font-medium text-slate-800 text-right max-w-[170px] break-words">
                    {ticket.keperluan}
                  </span>
                </div>
              )}
              <div className="flex justify-between items-center text-[11px] pt-0.5 border-t border-slate-200">
                <span className="text-slate-500">PETUGAS JAGA:</span>
                <span className="font-bold text-slate-800 uppercase">{ticket.oleh}</span>
              </div>
            </div>

            <div className="border-t border-dashed border-slate-300 my-2" />

            {/* Catatan Bawah Karcis */}
            <div className="text-center space-y-1 text-[9px] text-slate-500 font-sans">
              <p className="font-semibold text-slate-700">
                Simpan tiket ini selama kendaraan di area bengkel.
              </p>
              <p>
                Wajib diserahkan ke Security saat proses Check Out keluar gerbang.
              </p>
            </div>
          </div>
        </div>

        {/* Modal Actions */}
        <div className="border-t border-slate-200 bg-slate-50 px-5 py-3.5 flex flex-col-reverse sm:flex-row items-center justify-between gap-2.5">
          <button
            type="button"
            onClick={onNextCheckin}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-100 transition cursor-pointer"
          >
            Check In Berikutnya
          </button>

          <button
            type="button"
            onClick={handlePrint}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-[#12388F] px-5 py-2.5 text-xs font-bold text-white shadow-md shadow-[#12388F]/25 hover:bg-[#0D2A6B] transition cursor-pointer"
          >
            <Printer className="h-4 w-4" />
            <span>Cetak Karcis Tiket</span>
          </button>
        </div>
      </div>
    </div>
  );
};
