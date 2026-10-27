import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { X, Printer, CheckCircle2, Receipt, FileText, ArrowRight } from 'lucide-react';
import { generateTicketThermalHtml, TicketPrintData } from '../print/templates/ticketThermal';
import { generateTicketOfficialHtml } from '../print/templates/ticketOfficial';
import { printHtmlDocument } from '../../utils/print/printDocument';
import { generateQrDataUrl } from '../../utils/print/qr';

export type SuccessTicketData = TicketPrintData;

interface CheckinTicketModalProps {
  ticket: SuccessTicketData | null;
  isOpen: boolean;
  onClose: () => void;
  onNextCheckin: () => void;
  isReprint?: boolean;
}

export const CheckinTicketModal: React.FC<CheckinTicketModalProps> = ({
  ticket,
  isOpen,
  onClose,
  onNextCheckin,
  isReprint = false,
}) => {
  const [printFormat, setPrintFormat] = useState<'thermal' | 'official'>('thermal');
  const [officialPaperSize, setOfficialPaperSize] = useState<'A4' | 'A5'>('A4');
  const [qrDataUrl, setQrDataUrl] = useState<string>('');

  // Generate QR Code data URL dari nomor tiket
  useEffect(() => {
    let isMounted = true;
    if (ticket?.nomor_tiket) {
      generateQrDataUrl(ticket.nomor_tiket, { width: 140 }).then((url) => {
        if (isMounted) setQrDataUrl(url);
      });
    } else {
      setQrDataUrl('');
    }
    return () => {
      isMounted = false;
    };
  }, [ticket?.nomor_tiket]);

  // Keyboard shortcut Esc untuk menutup modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  // Preview HTML yang 100% identik dengan hasil cetak
  const previewHtml = useMemo(() => {
    if (!ticket) return '';
    if (printFormat === 'thermal') {
      return generateTicketThermalHtml(ticket, {
        qrDataUrl,
        isReprint,
      });
    }
    return generateTicketOfficialHtml(ticket, {
      qrDataUrl,
      isReprint,
      paperSize: officialPaperSize,
    });
  }, [ticket, printFormat, officialPaperSize, qrDataUrl, isReprint]);

  if (!isOpen || !ticket) return null;

  const handlePrint = () => {
    if (!previewHtml) return;
    printHtmlDocument(previewHtml, `Karcis Masuk - ${ticket.nomor_tiket}`);
  };

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="ticket-modal-title"
      className="fixed inset-0 z-9999 flex items-center justify-center bg-overlay p-3 sm:p-4 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="relative flex max-h-[94vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-border bg-surface-raised shadow-pop animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-border bg-surface-sunken px-4 py-3 sm:px-5 sm:py-3.5">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-status-green-bg text-status-green shadow-xs">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div>
              <h3 id="ticket-modal-title" className="text-sm font-bold text-ink sm:text-base">
                Check In Berhasil
              </h3>
              <p className="text-[11px] text-ink-muted">
                {isReprint ? 'Cetak ulang karcis izin masuk gerbang' : 'Karcis izin masuk gerbang siap dicetak'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup modal"
            className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-xl text-ink-subtle transition hover:bg-surface hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Format Selector Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-surface-sunken px-4 py-2 sm:px-5">
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-semibold text-ink-muted mr-1">Format:</span>
            <button
              type="button"
              onClick={() => setPrintFormat('thermal')}
              className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-bold transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 ${
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
              className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-bold transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 ${
                printFormat === 'official'
                  ? 'bg-surface-raised text-accent shadow-card border border-border'
                  : 'border border-transparent text-ink-muted hover:text-ink hover:bg-surface'
              }`}
            >
              <FileText className="h-3.5 w-3.5" />
              <span>Dokumen Resmi</span>
            </button>
          </div>

          {printFormat === 'official' && (
            <div className="flex items-center gap-1 text-xs">
              <span className="text-[11px] text-ink-muted">Ukuran:</span>
              <button
                type="button"
                onClick={() => setOfficialPaperSize('A4')}
                className={`px-2 py-0.5 rounded text-[11px] font-bold cursor-pointer transition ${
                  officialPaperSize === 'A4'
                    ? 'bg-accent text-accent-on'
                    : 'text-ink-muted hover:bg-surface'
                }`}
              >
                A4
              </button>
              <button
                type="button"
                onClick={() => setOfficialPaperSize('A5')}
                className={`px-2 py-0.5 rounded text-[11px] font-bold cursor-pointer transition ${
                  officialPaperSize === 'A5'
                    ? 'bg-accent text-accent-on'
                    : 'text-ink-muted hover:bg-surface'
                }`}
              >
                A5
              </button>
            </div>
          )}
        </div>

        {/* Live Preview Canvas (WYSIWYG Iframe) */}
        <div className="flex-1 overflow-y-auto bg-surface-sunken p-3 sm:p-5 flex items-center justify-center min-h-[380px] max-h-[58vh]">
          <div
            className={`w-full transition-all duration-150 rounded-lg shadow-card border border-border overflow-hidden bg-white ${
              printFormat === 'thermal' ? 'max-w-[340px]' : 'max-w-[580px]'
            }`}
          >
            <iframe
              srcDoc={previewHtml}
              title="Pratinjau Karcis Masuk"
              className="w-full border-0 bg-white"
              style={{
                height: printFormat === 'thermal' ? '460px' : '480px',
              }}
            />
          </div>
        </div>

        {/* Modal Actions Footer */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border bg-surface-sunken px-4 py-3 sm:px-5">
          <div className="text-xs text-ink-subtle hidden sm:block">
            Tekan <kbd className="px-1.5 py-0.5 rounded bg-surface border border-border text-[10px] font-mono">Esc</kbd> untuk menutup
          </div>
          <div className="flex items-center gap-2 ml-auto">
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex h-9 items-center justify-center gap-2 rounded-xl bg-accent px-4 text-xs font-bold text-accent-on shadow-card transition hover:opacity-90 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
            >
              <Printer className="h-4 w-4" />
              <span>Cetak Sekarang</span>
            </button>
            <button
              type="button"
              onClick={onNextCheckin}
              className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-border bg-surface-raised px-3.5 text-xs font-bold text-ink transition hover:bg-surface hover:border-border-strong cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
            >
              <span>Check-In Berikutnya</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
