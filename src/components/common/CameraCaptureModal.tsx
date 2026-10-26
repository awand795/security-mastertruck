import React, { useRef, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Camera, X, RefreshCw, Check, AlertCircle } from 'lucide-react';

interface CameraCaptureModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCapture: (base64Image: string) => void;
  title?: string;
}

export const CameraCaptureModal: React.FC<CameraCaptureModalProps> = ({
  isOpen,
  onClose,
  onCapture,
  title = 'Ambil Foto Kendaraan',
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Fungsi mematikan kamera secara bersih
  const stopCameraHardware = () => {
    if (streamRef.current) {
      try {
        const tracks = streamRef.current.getTracks();
        tracks.forEach((track) => {
          track.stop();
          track.enabled = false;
        });
      } catch (err) {
        console.warn('Error stopping stream tracks:', err);
      }
      streamRef.current = null;
    }

    if (videoRef.current) {
      if (videoRef.current.srcObject) {
        try {
          const s = videoRef.current.srcObject as MediaStream;
          s.getTracks().forEach((t) => {
            t.stop();
            t.enabled = false;
          });
        } catch (e) {
          /* ignore */
        }
      }
      videoRef.current.srcObject = null;
    }
  };

  const startCamera = async (mode: 'environment' | 'user') => {
    stopCameraHardware();
    setErrorMsg(null);

    // Cek ketersediaan mediaDevices pada peramban
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setErrorMsg('Peramban atau koneksi HTTP tidak mendukung MediaDevices API. Gunakan peramban modern atau akses via HTTPS / localhost.');
      return;
    }

    try {
      // 1. Coba dengan constraint ideal
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: mode },
        audio: false,
      });
      streamRef.current = mediaStream;
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        videoRef.current.play().catch(() => {});
      }
    } catch (err: any) {
      console.warn('Camera mode constraint failed, trying basic video fallback:', err);
      try {
        // 2. Fallback: tanpa constraint facingMode sama sekali
        const fallbackStream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });
        streamRef.current = fallbackStream;
        if (videoRef.current) {
          videoRef.current.srcObject = fallbackStream;
          videoRef.current.play().catch(() => {});
        }
      } catch (fallbackErr: any) {
        console.error('All camera attempts failed:', fallbackErr);
        if (fallbackErr.name === 'NotAllowedError' || fallbackErr.name === 'PermissionDeniedError') {
          setErrorMsg('Izin akses kamera diblokir oleh browser. Klik ikon gembok / kamera di address bar browser untuk mengizinkan kamera.');
        } else if (fallbackErr.name === 'NotFoundError' || fallbackErr.name === 'DevicesNotFoundError') {
          setErrorMsg('Perangkat kamera (webcam) tidak ditemukan di laptop/komputer ini.');
        } else if (fallbackErr.name === 'NotReadableError' || fallbackErr.name === 'TrackStartError') {
          setErrorMsg('Kamera sedang digunakan oleh aplikasi lain (Zoom, Teams, dll). Tutup aplikasi tersebut dan coba lagi.');
        } else {
          setErrorMsg('Gagal mengakses kamera: ' + (fallbackErr.message || 'Periksa izin kamera pada browser Anda.'));
        }
      }
    }
  };

  useEffect(() => {
    if (isOpen) {
      setCapturedPhoto(null);
      startCamera(facingMode);
    } else {
      stopCameraHardware();
    }

    return () => {
      stopCameraHardware();
    };
  }, [isOpen]);

  const handleClose = () => {
    stopCameraHardware();
    onClose();
  };

  const switchCamera = () => {
    const nextMode = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(nextMode);
    startCamera(nextMode);
  };

  const takeSnapshot = () => {
    if (videoRef.current) {
      const video = videoRef.current;
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        setCapturedPhoto(dataUrl);
      }
    }
  };

  const confirmPhoto = () => {
    if (capturedPhoto) {
      stopCameraHardware();
      onCapture(capturedPhoto);
      onClose();
    }
  };

  const retakePhoto = () => {
    setCapturedPhoto(null);
    startCamera(facingMode);
  };

  if (!isOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-stretch justify-center bg-black/90 backdrop-blur-sm sm:items-center sm:bg-overlay sm:p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div
        className="relative flex h-full w-full flex-col overflow-hidden bg-surface-raised sm:h-auto sm:max-h-[92vh] sm:max-w-lg sm:rounded-2xl sm:border sm:border-border sm:shadow-pop"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border bg-surface-raised px-4 py-3 safe-top">
          <div className="flex min-w-0 items-center gap-2">
            <Camera className="h-5 w-5 shrink-0 text-accent" />
            <h3 className="truncate text-sm font-bold text-ink sm:text-base">{title}</h3>
          </div>
          <button
            onClick={handleClose}
            aria-label="Tutup kamera"
            className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-xl text-ink-muted transition hover:bg-surface-sunken hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Viewport Kamera (fullscreen di mobile) */}
        <div className="relative flex min-h-0 w-full flex-1 items-center justify-center overflow-hidden bg-black sm:aspect-video sm:flex-none">
          {errorMsg ? (
            <div className="m-4 max-w-sm space-y-2 rounded-2xl border border-border bg-surface-raised p-5 text-center">
              <AlertCircle className="mx-auto h-8 w-8 text-status-red" />
              <p className="text-xs font-semibold leading-relaxed text-ink sm:text-sm">{errorMsg}</p>
              <button
                type="button"
                onClick={() => startCamera(facingMode)}
                className="mt-1 cursor-pointer rounded-xl border border-border-strong bg-surface-raised px-4 py-2.5 text-xs font-bold text-ink transition hover:bg-surface-sunken focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
              >
                Coba Lagi
              </button>
            </div>
          ) : capturedPhoto ? (
            <img src={capturedPhoto} alt="Captured preview" className="h-full w-full object-cover" />
          ) : (
            <video ref={videoRef} autoPlay playsInline muted className="h-full w-full object-cover" />
          )}

          {/* Guidelines Overlay */}
          {!capturedPhoto && !errorMsg && (
            <div className="pointer-events-none absolute inset-5 flex items-center justify-center rounded-2xl border border-dashed border-white/40">
              <span className="font-mono text-xs tracking-wider text-white/70">Posisikan Unit Armada</span>
            </div>
          )}
        </div>

        {/* Action Controls */}
        <div className="flex shrink-0 items-center justify-between gap-3 border-t border-border bg-surface-raised px-4 py-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] sm:pb-4">
          {capturedPhoto ? (
            <>
              <button
                type="button"
                onClick={retakePhoto}
                className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl border border-border-strong bg-surface-raised px-4 py-3.5 text-sm font-bold text-ink transition hover:bg-surface-sunken focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 active:scale-95"
              >
                <RefreshCw className="h-4 w-4" />
                <span>Foto Ulang</span>
              </button>
              <button
                type="button"
                onClick={confirmPhoto}
                className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl bg-accent px-4 py-3.5 text-sm font-bold text-accent-on shadow-card transition hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 active:scale-95"
              >
                <Check className="h-4 w-4" />
                <span>Gunakan Foto</span>
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={switchCamera}
                className="flex h-12 w-12 shrink-0 cursor-pointer items-center justify-center rounded-xl border border-border-strong bg-surface-raised text-ink transition hover:bg-surface-sunken focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 active:scale-95"
                title="Balik kamera"
                aria-label="Balik kamera"
              >
                <RefreshCw className="h-5 w-5" />
              </button>

              {/* Shutter besar di tengah, aman untuk satu tangan */}
              <button
                type="button"
                onClick={() => {
                  navigator.vibrate?.(12);
                  takeSnapshot();
                }}
                disabled={Boolean(errorMsg)}
                aria-label="Jepret foto"
                className="flex h-16 w-16 shrink-0 cursor-pointer items-center justify-center rounded-full border-4 border-white/70 bg-status-green-fill text-white shadow-lg transition disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 active:scale-95"
              >
                <Camera className="h-6 w-6" />
              </button>

              <div className="h-12 w-12 shrink-0" aria-hidden="true" />
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};
