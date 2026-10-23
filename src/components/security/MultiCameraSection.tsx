import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Camera, Trash2, Plus, X, RefreshCw } from 'lucide-react';
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

  const handleAddCustomSlot = () => {
    const nextIdx = photos.filter((p) => p.isCustom).length + 1;
    const newSlot: PhotoSlot = {
      id: `custom_${Date.now()}`,
      label: `Foto Tambahan ${nextIdx}`,
      isCustom: true,
    };
    onChange([...photos, newSlot]);
    setActiveSlotId(newSlot.id);
  };

  const activeSlot = photos.find((p) => p.id === activeSlotId);
  const completedCount = photos.filter((p) => Boolean(p.dataUrl)).length;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <h4 className="text-xs font-bold text-[#0F172A]">Foto {eventTitle}</h4>
          <span className="text-[10px] font-semibold text-[#64748B]">
            {completedCount}/{photos.length} • opsional
          </span>
        </div>
        <button
          type="button"
          onClick={handleAddCustomSlot}
          className="inline-flex shrink-0 cursor-pointer items-center gap-1 rounded-lg border border-[#CBD5E1] bg-white px-2.5 py-1.5 text-[11px] font-bold text-[#12388F] transition hover:bg-[#F8FAFC]"
        >
          <Plus className="h-3.5 w-3.5" />
          Tambah
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        {photos.map((slot) => {
          const hasPhoto = Boolean(slot.dataUrl);
          return (
            <div
              key={slot.id}
              className={`rounded-xl border p-1.5 ${
                hasPhoto ? 'border-[#16A34A]/30 bg-[#F0FDF4]/50' : 'border-[#CBD5E1] bg-[#F8FAFC]'
              }`}
            >
              <div className="mb-1 flex items-center justify-between gap-1 px-0.5">
                <span
                  className="truncate text-[10px] font-bold text-[#0F172A]"
                  title={slot.label}
                >
                  {slot.label}
                </span>
                {(hasPhoto || slot.isCustom) && (
                  <button
                    type="button"
                    onClick={() => handleRemovePhoto(slot.id)}
                    className="shrink-0 cursor-pointer rounded p-0.5 text-[#94A3B8] transition hover:text-[#B91C1C]"
                    title={slot.isCustom ? 'Hapus sudut foto' : 'Hapus foto'}
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                )}
              </div>

              {hasPhoto ? (
                <div className="relative overflow-hidden rounded-lg border border-[#E2E8F0] bg-slate-100">
                  <button
                    type="button"
                    onClick={() => setPreviewPhoto(slot.dataUrl!)}
                    title="Lihat foto"
                    className="block w-full cursor-zoom-in"
                  >
                    <img
                      src={slot.dataUrl}
                      alt={slot.label}
                      className="aspect-video w-full object-cover"
                    />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleOpenCapture(slot.id)}
                    title="Ambil ulang foto"
                    className="absolute bottom-1 right-1 cursor-pointer rounded-md bg-black/60 p-1.5 text-white transition hover:bg-black/80"
                  >
                    <RefreshCw className="h-3 w-3" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => handleOpenCapture(slot.id)}
                  className="flex aspect-video w-full cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-[#CBD5E1] bg-white text-[#64748B] transition hover:border-[#12388F] hover:text-[#12388F]"
                >
                  <Camera className="mb-0.5 h-4 w-4" />
                  <span className="text-[10px] font-bold">Ambil Foto</span>
                </button>
              )}
            </div>
          );
        })}
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
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
            onClick={() => setPreviewPhoto(null)}
          >
            <div
              className="relative w-full max-w-2xl overflow-hidden rounded-2xl bg-[#0B1F4D] p-2 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => setPreviewPhoto(null)}
                title="Tutup pratinjau"
                className="absolute right-4 top-4 z-10 cursor-pointer rounded-full bg-black/60 p-2 text-white transition hover:bg-black/80"
              >
                <X className="h-4 w-4" />
              </button>
              <img
                src={previewPhoto}
                alt="Pratinjau penuh foto kendaraan"
                className="h-auto w-full rounded-xl"
              />
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};
