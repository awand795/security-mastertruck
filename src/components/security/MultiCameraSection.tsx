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
          <h4 className="text-sm font-semibold text-slate-200">
            Dokumentasi Foto Fisik ({eventTitle})
          </h4>
          <p className="text-xs text-slate-400">
            Wajib ambil foto 4 sudut utama dan dapat menambahkan sudut khusus jika ada lecet/kondisi khusus.
          </p>
        </div>
        <button
          type="button"
          onClick={handleAddCustomSlot}
          className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-indigo-600/20 text-indigo-400 hover:bg-indigo-600/30 border border-indigo-500/30 text-xs font-medium transition"
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
                  ? 'border-emerald-500/40 bg-emerald-950/10'
                  : 'border-slate-800 bg-slate-900/60 hover:border-slate-700'
              }`}
            >
              <div className="w-full flex items-center justify-between px-1 mb-1.5">
                <span className="text-xs font-medium text-slate-300 truncate max-w-[110px]" title={slot.label}>
                  {slot.label}
                </span>
                {hasPhoto && (
                  <button
                    type="button"
                    onClick={() => handleRemovePhoto(slot.id)}
                    className="text-red-400 hover:text-red-300 p-0.5 rounded transition"
                    title="Hapus Foto"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {hasPhoto ? (
                <div className="relative w-full aspect-video rounded-lg overflow-hidden group">
                  <img
                    src={slot.dataUrl}
                    alt={slot.label}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center space-x-2 transition">
                    <button
                      type="button"
                      onClick={() => setPreviewPhoto(slot.dataUrl!)}
                      className="p-1.5 bg-slate-800 text-white rounded-lg hover:bg-slate-700 transition"
                      title="Lihat Penuh"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleOpenCapture(slot.id)}
                      className="p-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-500 transition"
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
                  className="w-full aspect-video rounded-lg border border-dashed border-slate-700 hover:border-indigo-500/50 bg-slate-950/40 flex flex-col items-center justify-center text-slate-400 hover:text-indigo-400 transition"
                >
                  <Camera className="w-6 h-6 mb-1" />
                  <span className="text-[11px] font-medium">Buka Kamera</span>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="relative max-w-2xl w-full bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden p-2 shadow-2xl">
            <button
              onClick={() => setPreviewPhoto(null)}
              className="absolute top-4 right-4 z-10 p-2 bg-black/60 text-white rounded-full hover:bg-black/90 transition"
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
