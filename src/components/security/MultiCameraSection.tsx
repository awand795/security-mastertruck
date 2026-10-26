import React, { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Camera, Trash2, Plus, X, RefreshCw, CheckCircle2, Upload, Sparkles } from 'lucide-react';
import { CameraCaptureModal } from '../common/CameraCaptureModal';

export interface PhotoSlot {
  id: string;
  label: string;
  dataUrl?: string;
  isCustom?: boolean;
}

interface MultiCameraSectionProps {
  photos: PhotoSlot[];
  onChange: (photos: PhotoSlot[]) => void;
  eventTitle: string; // 'Check In' or 'Check Out'
}

export const MultiCameraSection: React.FC<MultiCameraSectionProps> = ({
  photos,
  onChange,
  eventTitle,
}) => {
  const [activeSlotId, setActiveSlotId] = useState<string | null>(null);
  const [previewPhoto, setPreviewPhoto] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadTargetSlotId, setUploadTargetSlotId] = useState<string | null>(null);

  const handleOpenCapture = (id: string) => {
    setActiveSlotId(id);
  };

  const handleCaptureComplete = (base64: string) => {
    if (!activeSlotId) return;
    const updated = photos.map((slot) =>
      slot.id === activeSlotId ? { ...slot, dataUrl: base64 } : slot
    );
    onChange(updated);
    setActiveSlotId(null);
  };

  const handleRemovePhoto = (id: string) => {
    const target = photos.find((p) => p.id === id);
    if (target?.isCustom) {
      onChange(photos.filter((p) => p.id !== id));
    } else {
      onChange(photos.map((p) => (p.id === id ? { ...p, dataUrl: undefined } : p)));
    }
  };

  const handleAddCustomSlot = (autoCapture: boolean = true) => {
    const nextIdx = photos.filter((p) => p.isCustom).length + 1;
    const newSlot: PhotoSlot = {
      id: `custom_${Date.now()}`,
      label: `Foto Tambahan ${nextIdx}`,
      isCustom: true,
    };
    onChange([...photos, newSlot]);
    if (autoCapture) {
      setActiveSlotId(newSlot.id);
    }
    return newSlot.id;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      if (uploadTargetSlotId) {
        // Jika upload ke slot yang sudah ada
        const updated = photos.map((slot) =>
          slot.id === uploadTargetSlotId ? { ...slot, dataUrl: base64 } : slot
        );
        onChange(updated);
        setUploadTargetSlotId(null);
      } else {
        // Upload langsung sebagai slot foto tambahan baru
        const nextIdx = photos.filter((p) => p.isCustom).length + 1;
        const newSlot: PhotoSlot = {
          id: `custom_${Date.now()}`,
          label: `Foto Tambahan ${nextIdx}`,
          isCustom: true,
          dataUrl: base64,
        };
        onChange([...photos, newSlot]);
      }
    };
    reader.readAsDataURL(file);
    // Reset file input agar bisa upload file yang sama jika diinginkan
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const triggerUploadForSlot = (slotId?: string) => {
    setUploadTargetSlotId(slotId || null);
    fileInputRef.current?.click();
  };

  const activeSlot = photos.find((p) => p.id === activeSlotId);
  const completedCount = photos.filter((p) => Boolean(p.dataUrl)).length;

  return (
    <div className="space-y-3">
      {/* Hidden file input for gallery upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />

      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 space-y-1">
          <div className="flex items-center gap-1.5">
            <h4 className="text-xs font-bold text-ink">Foto {eventTitle}</h4>
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-accent/10 text-accent">
              <Sparkles className="h-2.5 w-2.5" />
              Multi-Angle
            </span>
          </div>
          <p
            className={`text-[10px] font-semibold ${
              completedCount > 0 ? 'text-status-green' : 'text-ink-subtle'
            }`}
          >
            {completedCount}/{photos.length} sudut fisik terambil • opsional
          </p>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => triggerUploadForSlot()}
            className="inline-flex shrink-0 cursor-pointer items-center gap-1 rounded-xl border border-border bg-surface-raised px-2.5 py-1.5 text-[11px] font-semibold text-ink-muted transition hover:bg-surface-sunken hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 active:scale-95"
            title="Upload file foto dari komputer / galeri"
          >
            <Upload className="h-3 w-3" />
            Upload
          </button>
          <button
            type="button"
            onClick={() => handleAddCustomSlot(true)}
            className="inline-flex shrink-0 cursor-pointer items-center gap-1 rounded-xl border border-accent/30 bg-accent/10 px-2.5 py-1.5 text-[11px] font-bold text-accent transition hover:bg-accent/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 active:scale-95"
          >
            <Plus className="h-3.5 w-3.5" />
            Tambah Foto
          </button>
        </div>
      </div>

      {/* Grid Foto Sudut */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {photos.map((slot) => {
          const hasPhoto = Boolean(slot.dataUrl);
          return (
            <div
              key={slot.id}
              className={`group relative flex flex-col justify-between rounded-2xl border p-2 transition-all duration-200 ${
                hasPhoto
                  ? 'border-status-green/50 bg-status-green-bg/60 shadow-xs'
                  : 'border-border-strong/70 bg-surface-sunken hover:border-accent/40 hover:bg-surface-sunken/80'
              }`}
            >
              <div className="mb-1.5 flex items-center justify-between gap-1 px-1">
                <span className="truncate text-[10px] font-bold text-ink" title={slot.label}>
                  {slot.label}
                </span>
                <div className="flex items-center gap-1">
                  {hasPhoto && (
                    <span className="flex shrink-0 items-center gap-0.5 rounded-full bg-emerald-100 px-1.5 py-0.2 text-[9px] font-bold text-status-green dark:bg-emerald-950/60">
                      <CheckCircle2 className="h-2.5 w-2.5" />
                      OK
                    </span>
                  )}
                  {(hasPhoto || slot.isCustom) && (
                    <button
                      type="button"
                      onClick={() => handleRemovePhoto(slot.id)}
                      className="shrink-0 cursor-pointer rounded p-1 text-ink-subtle transition hover:bg-rose-50 hover:text-status-red focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 dark:hover:bg-rose-950/40"
                      title={slot.isCustom ? 'Hapus slot foto ini' : 'Hapus foto'}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {hasPhoto ? (
                <div className="relative overflow-hidden rounded-xl border border-border bg-surface">
                  <button
                    type="button"
                    onClick={() => setPreviewPhoto(slot.dataUrl!)}
                    title="Klik untuk perbesar foto"
                    className="block w-full cursor-zoom-in"
                  >
                    <img
                      src={slot.dataUrl}
                      alt={slot.label}
                      className="aspect-[4/3] w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  </button>
                  <div className="absolute bottom-1.5 right-1.5 flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => triggerUploadForSlot(slot.id)}
                      title="Ganti dengan upload file"
                      className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-xs transition hover:bg-black/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
                    >
                      <Upload className="h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleOpenCapture(slot.id)}
                      title="Ambil ulang lewat kamera"
                      className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-xs transition hover:bg-black/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
                    >
                      <RefreshCw className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex aspect-[4/3] w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border-strong/80 bg-surface-raised p-2 text-ink-muted transition hover:border-accent hover:bg-accent/5 hover:text-accent">
                  <button
                    type="button"
                    onClick={() => handleOpenCapture(slot.id)}
                    className="flex w-full cursor-pointer flex-col items-center justify-center gap-1 focus-visible:outline-none"
                    title="Buka kamera untuk foto sudut ini"
                  >
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-sunken text-ink transition group-hover:bg-accent group-hover:text-white">
                      <Camera className="h-4 w-4" />
                    </div>
                    <span className="text-[11px] font-bold text-ink group-hover:text-accent">
                      Buka Kamera
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => triggerUploadForSlot(slot.id)}
                    className="text-[10px] font-medium text-ink-subtle underline hover:text-accent focus-visible:outline-none"
                  >
                    atau upload file
                  </button>
                </div>
              )}
            </div>
          );
        })}

        {/* MODERN "ADD PHOTO" CARD TILE (Seperti di Web-Web Modern) */}
        <div className="group relative flex flex-col justify-between rounded-2xl border border-dashed border-accent/40 bg-accent/[0.03] p-2 transition-all duration-200 hover:border-accent hover:bg-accent/[0.08] hover:shadow-xs">
          <div className="mb-1.5 flex items-center justify-between gap-1 px-1">
            <span className="truncate text-[10px] font-bold text-accent">
              Tambah Sudut
            </span>
            <span className="rounded-full bg-accent/15 px-1.5 py-0.2 text-[9px] font-bold text-accent">
              + Baru
            </span>
          </div>

          <div className="flex aspect-[4/3] w-full flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-accent/30 bg-surface-raised/70 p-2 text-center transition group-hover:bg-surface-raised group-hover:border-accent/60">
            <button
              type="button"
              onClick={() => handleAddCustomSlot(true)}
              className="flex flex-col items-center justify-center gap-1 focus-visible:outline-none cursor-pointer"
              title="Tambah foto lewat kamera"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent text-white shadow-xs transition hover:scale-110 hover:bg-accent-hover active:scale-95">
                <Plus className="h-4 w-4" />
              </div>
              <span className="text-[11px] font-bold text-ink group-hover:text-accent">
                Foto Tambahan
              </span>
            </button>
            <button
              type="button"
              onClick={() => triggerUploadForSlot()}
              className="text-[10px] font-medium text-accent hover:underline focus-visible:outline-none cursor-pointer"
            >
              atau upload file
            </button>
          </div>
        </div>
      </div>

      {/* Camera Capture Modal */}
      {activeSlotId && (
        <CameraCaptureModal
          isOpen={true}
          title={`Foto: ${activeSlot?.label || 'Kendaraan'}`}
          onClose={() => setActiveSlotId(null)}
          onCapture={handleCaptureComplete}
        />
      )}

      {/* Image Preview Modal */}
      {previewPhoto &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Pratinjau foto"
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-overlay p-4 backdrop-blur-sm"
            onClick={() => setPreviewPhoto(null)}
          >
            <div
              className="relative w-full max-w-2xl overflow-hidden rounded-2xl bg-black p-2 shadow-pop"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => setPreviewPhoto(null)}
                title="Tutup pratinjau"
                className="absolute right-4 top-4 z-10 flex h-9 w-9 cursor-pointer items-center justify-center rounded-full bg-black/60 text-white transition hover:bg-black/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
              >
                <X className="h-4 w-4" />
              </button>
              <img src={previewPhoto} alt="Pratinjau penuh foto kendaraan" className="h-auto w-full rounded-xl" />
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};
