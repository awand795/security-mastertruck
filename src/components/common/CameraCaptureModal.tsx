import React, { useRef, useState, useEffect } from 'react';
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4">
      <div className="relative w-full max-w-lg bg-white border border-[#CBD5E1] rounded-2xl overflow-hidden shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#E2E8F0] bg-white">
          <div className="flex items-center space-x-2">
            <Camera className="w-5 h-5 text-[#12388F]" />
            <h3 className="font-bold text-[#0F172A] text-base">{title}</h3>
          </div>
          <button
            onClick={handleClose}
            className="p-1.5 text-[#64748B] hover:text-[#0F172A] rounded-lg hover:bg-[#F1F5F9] transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Viewport Kamera */}
        <div className="relative aspect-video w-full bg-slate-950 flex items-center justify-center overflow-hidden">
          {errorMsg ? (
            <div className="text-center p-6 text-red-400 text-xs sm:text-sm max-w-sm space-y-2">
              <AlertCircle className="w-8 h-8 text-red-400 mx-auto" />
              <p className="font-semibold text-white">{errorMsg}</p>
              <button
                type="button"
                onClick={() => startCamera(facingMode)}
                className="mt-3 px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-semibold cursor-pointer"
              >
                Coba Lagi
              </button>
            </div>
          ) : capturedPhoto ? (
            <img src={capturedPhoto} alt="Captured preview" className="w-full h-full object-cover" />
          ) : (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
          )}

          {/* Guidelines Overlay */}
          {!capturedPhoto && !errorMsg && (
            <div className="absolute inset-4 border border-dashed border-white/30 rounded-xl pointer-events-none flex items-center justify-center">
              <span className="text-xs text-white/50 tracking-wider font-mono">Posisikan Unit Armada</span>
            </div>
          )}
        </div>

        {/* Action Controls */}
        <div className="p-4 bg-white flex items-center justify-between border-t border-[#E2E8F0]">
          {capturedPhoto ? (
            <>
              <button
                type="button"
                onClick={retakePhoto}
                className="flex items-center space-x-2 px-4 py-2.5 rounded-xl border border-[#CBD5E1] bg-white text-[#0F172A] hover:bg-[#F1F5F9] text-xs font-bold transition cursor-pointer"
              >
                <RefreshCw className="w-4 h-4 text-[#12388F]" />
                <span>Foto Ulang</span>
              </button>
              <button
                type="button"
                onClick={confirmPhoto}
                className="flex items-center space-x-2 px-6 py-2.5 rounded-xl bg-[#12388F] hover:bg-[#0D2A6B] text-white text-xs font-bold shadow-md shadow-[#12388F]/25 transition cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>Gunakan Foto</span>
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={switchCamera}
                className="flex items-center space-x-2 px-3 py-2 rounded-xl bg-[#F1F5F9] text-[#0F172A] hover:bg-[#E2E8F0] text-xs font-bold transition cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Balik Kamera</span>
              </button>

              <button
                type="button"
                onClick={takeSnapshot}
                disabled={Boolean(errorMsg)}
                className="flex items-center space-x-2 px-6 py-2.5 rounded-full bg-[#16A34A] hover:bg-[#15803D] disabled:opacity-40 text-white font-bold text-xs shadow-md shadow-[#16A34A]/25 active:scale-95 transition cursor-pointer"
              >
                <Camera className="w-4 h-4" />
                <span>Jepret Foto</span>
              </button>

              <div className="w-20"></div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
