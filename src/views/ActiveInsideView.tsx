import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Truck,
  Search,
  Clock,
  User,
  Phone,
  Timer,
  AlertTriangle,
  ArrowRight,
  Loader2,
  X,
  Sparkles,
  Info,
} from 'lucide-react';
import { securityApi } from '../api/client';
import { useSecurityStore } from '../store/useSecurityStore';
import { ActiveInsideVehicle } from '../types';
import { formatPlate, normalizePlate } from '../utils/plate';
import { CARD, FIELD_PLATE, CHIP_BASE, CHIP_TONE } from '../styles/ui';

interface ActiveInsideViewProps {
  onNavigateToCheckout?: (plate: string) => void;
}

const formatDuration = (waktuMasuk: string) => {
  const start = new Date(waktuMasuk.replace(' ', 'T'));
  if (Number.isNaN(start.getTime())) return null;
  const diffMs = Date.now() - start.getTime();
  if (diffMs < 0) return null;
  const totalMinutes = Math.floor(diffMs / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours >= 24) return `${Math.floor(hours / 24)} hari ${hours % 24} jam`;
  if (hours > 0) return `${hours} jam ${minutes} menit`;
  return `${minutes} menit`;
};

export const ActiveInsideView: React.FC<ActiveInsideViewProps> = ({ onNavigateToCheckout }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const kodeCabang = useSecurityStore((state) => state.kodeCabang);

  const cleanQuery = normalizePlate(searchTerm);

  const {
    data: vehicles = [],
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['active-inside-list', cleanQuery, kodeCabang],
    queryFn: () => securityApi.getActiveInside(cleanQuery, kodeCabang),
    refetchInterval: 4000,
  });

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between px-0.5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-on shadow-card">
            <Truck className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold leading-tight text-ink">Kendaraan di Dalam Bengkel</h2>
            <p className="text-xs font-semibold text-ink-subtle">
              Monitoring live armada yang belum check-out
            </p>
          </div>
        </div>

        <div className="inline-flex items-center gap-2 rounded-xl border border-accent/30 bg-accent/10 px-3 py-1.5 text-xs font-bold text-accent self-start sm:self-auto">
          <Sparkles className="h-3.5 w-3.5" />
          <span>{vehicles.length} Unit di Dalam</span>
        </div>
      </div>

      {/* Input Pencarian */}
      <div className="relative">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Cari nomor polisi atau nama driver..."
          className={`${FIELD_PLATE} pl-10 text-sm`}
        />
        {searchTerm && (
          <button
            type="button"
            onClick={() => setSearchTerm('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-subtle hover:text-ink cursor-pointer p-1"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Konten Daftar Unit */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-16 text-center text-ink-muted">
          <Loader2 className="h-8 w-8 animate-spin text-accent mb-2" />
          <p className="text-sm font-semibold">Memuat data armada di dalam bengkel...</p>
        </div>
      ) : vehicles.length === 0 ? (
        <div className={`${CARD} flex flex-col items-center justify-center py-14 text-center`}>
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-sunken text-ink-subtle mb-3">
            <Truck className="h-6 w-6" />
          </div>
          <h3 className="text-sm font-bold text-ink">Tidak Ada Kendaraan di Dalam Area</h3>
          <p className="mt-1 max-w-sm text-xs text-ink-muted">
            {searchTerm
              ? `Tidak ditemukan unit dengan kata kunci "${searchTerm}".`
              : 'Semua kendaraan yang masuk telah menyelesaikan kunjungan atau belum ada check-in hari ini.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {vehicles.map((v) => {
            const duration = formatDuration(v.waktu_masuk);
            const timeInFormatted = (() => {
              const d = new Date((v.waktu_masuk || '').replace(' ', 'T'));
              if (Number.isNaN(d.getTime())) return v.waktu_masuk || '-';
              return (
                d.toLocaleTimeString('id-ID', {
                  hour: '2-digit',
                  minute: '2-digit',
                  timeZone: 'Asia/Jakarta',
                }) + ' WIB'
              );
            })();

            return (
              <div
                key={v.id}
                className={`${CARD} relative flex flex-col justify-between p-4 transition-all hover:border-accent/40 hover:shadow-card`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2 border-b border-border pb-2.5">
                    <div>
                      <span className="font-mono text-base font-black tracking-wider text-ink">
                        {formatPlate(v.no_polisi)}
                      </span>
                      <p className="text-xs font-semibold text-ink-muted flex items-center gap-1 mt-0.5">
                        <User className="h-3 w-3" />
                        {v.nama_pengemudi || 'Driver'}
                      </p>
                    </div>
                    <span className={`${CHIP_BASE} ${CHIP_TONE.blue}`}>
                      Di Dalam Area
                    </span>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-xl border border-border bg-surface-sunken p-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-ink-subtle flex items-center gap-1">
                        <Clock className="h-3 w-3 text-status-green" /> Waktu Masuk
                      </span>
                      <p className="font-bold text-ink mt-0.5">{timeInFormatted}</p>
                    </div>

                    <div className="rounded-xl border border-border bg-surface-sunken p-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-ink-subtle flex items-center gap-1">
                        <Timer className="h-3 w-3 text-accent" /> Durasi Parkir
                      </span>
                      <p className="font-bold text-accent mt-0.5">{duration || '-'}</p>
                    </div>
                  </div>

                  <div className="mt-2.5 space-y-1 text-xs">
                    {v.tipe_kunjungan && (
                      <div className="flex items-center justify-between text-ink-muted">
                        <span>Tujuan:</span>
                        <span className="font-semibold text-ink">{v.tipe_kunjungan}</span>
                      </div>
                    )}

                    {v.keluhan && (
                      <div className="flex items-start justify-between text-ink-muted gap-2">
                        <span className="shrink-0">Keperluan:</span>
                        <span className="truncate max-w-[65%] text-right font-medium text-ink">
                          {v.keluhan}
                        </span>
                      </div>
                    )}

                    {v.pic_tujuan && (
                      <div className="flex items-center justify-between text-ink-muted text-[11px]">
                        <span>PIC:</span>
                        <span className="font-semibold text-accent">{v.pic_tujuan}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Tombol Proses Check Out */}
                <div className="mt-3.5 pt-2.5 border-t border-border flex items-center justify-end">
                  <button
                    type="button"
                    onClick={() => onNavigateToCheckout?.(v.no_polisi)}
                    className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-accent px-3 py-1.5 text-xs font-bold text-accent-on shadow-xs transition hover:bg-accent-hover active:scale-95"
                  >
                    <span>Proses Check Out</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ActiveInsideView;
