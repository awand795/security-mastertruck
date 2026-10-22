import React, { useState } from 'react';
import { Camera, Trash2, Plus, Eye } from 'lucide-react';
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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-xs sm:text-sm font-bold text-[#0F172A]">
            Dokumentasi Foto Fisik ({eventTitle})
          </h4>
          <p className="text-[11px] text-[#64748B]">
            Ambil foto 4 sudut utama dan tambahkan sudut khusus jika ada lecet/kondisi khusus.
          </p>
        </div>
        <button
          type="button"
          onClick={handleAddCustomSlot}
          className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-[#12388F]/10 text-[#12388F] hover:bg-[#12388F]/20 border border-[#12388F]/20 text-xs font-bold transition cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Tambah Sudut Foto</span>
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {photos.map((slot) => {
          const hasPhoto = Boolean(slot.dataUrl);
          return (
            <div
              key={slot.id}
              className={`relative rounded-xl border p-2 flex flex-col items-center justify-between text-center transition ${
                hasPhoto
                  ? 'border-[#16A34A]/40 bg-[#DCFCE7]/30'
                  : 'border-[#CBD5E1] bg-[#F8FAFC] hover:border-[#94A3B8]'
              }`}
            >
              <div className="w-full flex items-center justify-between px-1 mb-1.5">
                <span className="text-[11px] font-bold text-[#0F172A] truncate max-w-[110px]" title={slot.label}>
                  {slot.label}
                </span>
                {hasPhoto && (
                  <button
                    type="button"
                    onClick={() => handleRemovePhoto(slot.id)}
                    className="text-[#DC2626] hover:text-[#B91C1C] p-0.5 rounded transition cursor-pointer"
                    title="Hapus Foto"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {hasPhoto ? (
                <div className="relative w-full aspect-video rounded-lg overflow-hidden group shadow-2xs">
                  <img
                    src={slot.dataUrl}
                    alt={slot.label}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center space-x-2 transition">
                    <button
                      type="button"
                      onClick={() => setPreviewPhoto(slot.dataUrl!)}
                      className="p-1.5 bg-white text-[#0F172A] rounded-lg hover:bg-slate-100 transition cursor-pointer"
                      title="Lihat Penuh"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleOpenCapture(slot.id)}
                      className="p-1.5 bg-[#12388F] text-white rounded-lg hover:bg-[#0D2A6B] transition cursor-pointer"
                      title="Ambil Ulang"
                    >
                      <Camera className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => handleOpenCapture(slot.id)}
                  className="w-full aspect-video rounded-lg border border-dashed border-[#CBD5E1] hover:border-[#12388F] bg-white flex flex-col items-center justify-center text-[#64748B] hover:text-[#12388F] transition cursor-pointer"
                >
                  <Camera className="w-6 h-6 mb-1 text-[#12388F]" />
                  <span className="text-[11px] font-bold">Buka Kamera</span>
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
      {previewPhoto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4">
          <div className="relative max-w-2xl w-full bg-white border border-[#CBD5E1] rounded-2xl overflow-hidden p-2 shadow-2xl">
            <button
              onClick={() => setPreviewPhoto(null)}
              className="absolute top-4 right-4 z-10 p-2 bg-black/60 text-white rounded-full hover:bg-black/80 transition cursor-pointer"
            >
              ✕
            </button>
            <img src={previewPhoto} alt="Full preview" className="w-full h-auto rounded-xl" />
          </div>
        </div>
      )}
    </div>
  );
};
