import React, { useRef, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Camera, X, RefreshCw, Check, Sparkles, Loader2, AlertCircle, Scan, Keyboard } from 'lucide-react';
import { createWorker, Worker, PSM } from 'tesseract.js';

interface PlateOcrScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDetected: (plate: string) => void;
}

/**
 * Normalisasi karakter angka yang sering salah terbaca oleh OCR di blok tengah plat nomor.
 */
const normalizeOcrDigits = (rawDigits: string): string => {
  return rawDigits
    .replace(/[ODQ]/g, '0')
    .replace(/[IL]/g, '1')
    .replace(/Z/g, '2')
    .replace(/S/g, '5')
    .replace(/G/g, '6')
    .replace(/B/g, '8');
};

/**
 * Normalisasi karakter huruf yang sering salah terbaca oleh OCR di blok wilayah/seri.
 */
const normalizeOcrLetters = (rawLetters: string): string => {
  return rawLetters
    .replace(/0/g, 'O')
    .replace(/1/g, 'I')
    .replace(/2/g, 'Z')
    .replace(/5/g, 'S')
    .replace(/8/g, 'B');
};

/**
 * Ekstraksi plat nomor polisi Indonesia dari teks mentah OCR.
 * Format standar Indonesia: [1-2 Huruf Wilayah] [1-4 Angka] [1-3 Huruf Seri]
 * Contoh: BK 8210 GI, B 1234 ABC, D 123 XX, BL 999 Z
 */
export const extractIndonesianPlate = (rawText: string): string | null => {
  if (!rawText) return null;

  // Periksa per baris terlebih dahulu (agar baris masa berlaku pajak misal "10 28" di bawah tidak mengganggu)
  const lines = rawText
    .toUpperCase()
    .split(/[\r\n]+/)
    .map((line) =>
      line
        .replace(/[^A-Z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
    )
    .filter(Boolean);

  // Gabungkan juga seluruh teks sebagai fallback
  const candidatesToCheck = [...lines, lines.join(' ')];

  for (const line of candidatesToCheck) {
    // 1. Match pola langsung dengan spasi: [1-2 huruf] [1-4 angka/karakter mirip angka] [1-3 huruf]
    const spacedRegex = /\b([A-Z]{1,2})\s+([0-9ODQILZSGB]{1,4})\s+([A-Z0-9]{1,3})\b/g;
    let match: RegExpExecArray | null;
    while ((match = spacedRegex.exec(line)) !== null) {
      const wilayah = normalizeOcrLetters(match[1]);
      const nomor = normalizeOcrDigits(match[2]);
      const seri = normalizeOcrLetters(match[3]);

      if (
        /^[A-Z]{1,2}$/.test(wilayah) &&
        /^[1-9][0-9]{0,3}$/.test(nomor) &&
        /^[A-Z]{1,3}$/.test(seri)
      ) {
        return `${wilayah} ${nomor} ${seri}`;
      }
    }

    // 2. Match pola tanpa spasi atau spasi sebagian (misal "BK8210GI" atau "BK 8210GI")
    const compactRegex = /\b([A-Z]{1,2})\s*([1-9][0-9]{0,3})\s*([A-Z]{1,3})\b/g;
    while ((match = compactRegex.exec(line)) !== null) {
      const wilayah = match[1];
      const nomor = match[2];
      const seri = match[3];
      if (
        /^[A-Z]{1,2}$/.test(wilayah) &&
        /^[1-9][0-9]{0,3}$/.test(nomor) &&
        /^[A-Z]{1,3}$/.test(seri)
      ) {
        return `${wilayah} ${nomor} ${seri}`;
      }
    }
  }

  return null;
};

export const PlateOcrScannerModal: React.FC<PlateOcrScannerModalProps> = ({
  isOpen,
  onClose,
  onDetected,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const isScanningRef = useRef<boolean>(false);
  const isDetectedRef = useRef<boolean>(false);
  const cropCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [isWorkerReady, setIsWorkerReady] = useState(false);
  const [workerStatusText, setWorkerStatusText] = useState('Menyiapkan sensor Auto-OCR...');
  const [detectedPlate, setDetectedPlate] = useState<string | null>(null);
  const [capturedSnapshot, setCapturedSnapshot] = useState<string | null>(null);
  const [isShutterFlash, setIsShutterFlash] = useState(false);
  const [rawOcrPreview, setRawOcrPreview] = useState<string>('');
  const [isProcessingFrame, setIsProcessingFrame] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [manualMode, setManualMode] = useState(false);
  const [manualText, setManualText] = useState('');

  // 1. Bersihkan hardware kamera
  const stopCameraHardware = () => {
    isScanningRef.current = false;
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
        } catch {
          /* ignore */
        }
      }
      videoRef.current.srcObject = null;
    }
  };

  // 2. Inisialisasi Tesseract OCR Worker
  useEffect(() => {
    let isCancelled = false;

    const initWorker = async () => {
      try {
        setWorkerStatusText('Mengaktifkan deteksi plat otomatis...');
        const worker = await createWorker('eng');
        if (isCancelled) {
          await worker.terminate();
          return;
        }

        await worker.setParameters({
          tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 ',
          tessedit_pageseg_mode: PSM.SINGLE_BLOCK,
        });

        workerRef.current = worker;
        setIsWorkerReady(true);
        setWorkerStatusText('Arahkan kamera ke plat — Otomatis Jepret saat terdeteksi');
      } catch (err) {
        console.error('Failed to init Tesseract worker:', err);
        if (!isCancelled) {
          setWorkerStatusText('Sensor kamera siap');
          setIsWorkerReady(true);
        }
      }
    };

    if (isOpen) {
      initWorker();
    }

    return () => {
      isCancelled = true;
      if (workerRef.current) {
        workerRef.current.terminate().catch(() => {});
        workerRef.current = null;
      }
      setIsWorkerReady(false);
    };
  }, [isOpen]);

  // 3. Start Camera Hardware dengan Fallback Lengkap
  const startCamera = async (mode: 'environment' | 'user') => {
    stopCameraHardware();
    setErrorMsg(null);

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setErrorMsg(
        'Kamera langsung tidak didukung peramban pada koneksi HTTP tanpa SSL. Gunakan HTTPS atau izinkan akses di chrome://flags.'
      );
      return;
    }

    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: mode },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });
      streamRef.current = mediaStream;
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        await videoRef.current.play().catch(() => {});
      }
      isScanningRef.current = true;
    } catch (err1) {
      console.warn('Mode constraint failed, trying user camera fallback:', err1);
      try {
        const fallbackUserStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user' },
          audio: false,
        });
        streamRef.current = fallbackUserStream;
        if (videoRef.current) {
          videoRef.current.srcObject = fallbackUserStream;
          await videoRef.current.play().catch(() => {});
        }
        isScanningRef.current = true;
      } catch (err2) {
        console.warn('User camera fallback failed, trying video: true fallback:', err2);
        try {
          const genericStream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false,
          });
          streamRef.current = genericStream;
          if (videoRef.current) {
            videoRef.current.srcObject = genericStream;
            await videoRef.current.play().catch(() => {});
          }
          isScanningRef.current = true;
        } catch (finalErr: any) {
          console.error('All camera attempts failed:', finalErr);
          if (finalErr.name === 'NotAllowedError' || finalErr.name === 'PermissionDeniedError') {
            setErrorMsg('Izin akses kamera diblokir. Klik ikon gembok / kamera di address bar browser untuk mengizinkan.');
          } else if (finalErr.name === 'NotFoundError' || finalErr.name === 'DevicesNotFoundError') {
            setErrorMsg('Kamera (webcam) tidak ditemukan di perangkat ini.');
          } else {
            setErrorMsg(finalErr.message || 'Gagal menyalakan kamera.');
          }
        }
      }
    }
  };

  // 4. Crop area plat nomor dari video stream tanpa merusak kontras asli
  const captureCroppedPlateFrame = (): HTMLCanvasElement | null => {
    const video = videoRef.current;
    if (!video || video.readyState < 2 || !video.videoWidth || !video.videoHeight) return null;

    if (!cropCanvasRef.current) {
      cropCanvasRef.current = document.createElement('canvas');
    }
    const canvas = cropCanvasRef.current;

    // Ambil area kotak target tengah viewport (82% lebar, 42% tinggi)
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    const cropW = Math.round(vw * 0.82);
    const cropH = Math.round(vh * 0.42);
    const cropX = Math.round((vw - cropW) / 2);
    const cropY = Math.round((vh - cropH) / 2);

    const targetW = 720;
    const targetH = Math.round((cropH / cropW) * targetW);

    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;

    ctx.drawImage(video, cropX, cropY, cropW, cropH, 0, 0, targetW, targetH);

    // Konversi grayscale bersih dengan peningkatan ketajaman kontras yang benar (nilai kontras 35 dari skala -255..255)
    try {
      const imgData = ctx.getImageData(0, 0, targetW, targetH);
      const d = imgData.data;
      const contrast = 35;
      const factor = (259 * (contrast + 255)) / (255 * (259 - contrast));

      for (let i = 0; i < d.length; i += 4) {
        const gray = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
        const c = factor * (gray - 128) + 128;
        const clamped = Math.max(0, Math.min(255, c));
        d[i] = clamped;
        d[i + 1] = clamped;
        d[i + 2] = clamped;
      }
      ctx.putImageData(imgData, 0, 0);
    } catch {
      /* gunakan gambar asli bila gagal */
    }

    return canvas;
  };

  // Trigger Auto-Snap ketika plat nomor terdeteksi
  const triggerAutoSnap = (plate: string, canvas: HTMLCanvasElement) => {
    if (isDetectedRef.current) return;
    isDetectedRef.current = true;
    isScanningRef.current = false;

    try {
      setCapturedSnapshot(canvas.toDataURL('image/jpeg', 0.88));
    } catch {
      /* ignore */
    }

    setIsShutterFlash(true);
    setTimeout(() => setIsShutterFlash(false), 180);

    setDetectedPlate(plate);
    navigator.vibrate?.([60, 40, 80]);

    // Langsung otomatis kirim hasil jepretan ke form setelah efek jepret singkat (380ms)
    setTimeout(() => {
      stopCameraHardware();
      onDetected(plate);
      onClose();
    }, 380);
  };

  // 5. Loop Auto-Scan Kontinu (~220ms antar frame) -> begitu terdeteksi langsung jepret otomatis!
  useEffect(() => {
    if (!isOpen || !isWorkerReady || manualMode) return;

    let timerId: any = null;
    isDetectedRef.current = false;

    const processNextFrame = async () => {
      if (
        !isScanningRef.current ||
        isDetectedRef.current ||
        !workerRef.current ||
        !videoRef.current
      ) {
        return;
      }

      const canvas = captureCroppedPlateFrame();
      if (!canvas) {
        timerId = setTimeout(processNextFrame, 200);
        return;
      }

      setIsProcessingFrame(true);

      try {
        const { data } = await workerRef.current.recognize(canvas);
        const text = data?.text || '';
        if (text.trim()) {
          setRawOcrPreview(text.trim().replace(/\n+/g, ' '));
        }

        const plate = extractIndonesianPlate(text);
        if (plate && !isDetectedRef.current) {
          triggerAutoSnap(plate, canvas);
          return;
        }
      } catch (err) {
        console.warn('OCR frame recognition error:', err);
      } finally {
        setIsProcessingFrame(false);
      }

      if (!isDetectedRef.current && isScanningRef.current) {
        timerId = setTimeout(processNextFrame, 220);
      }
    };

    const startDelay = setTimeout(() => {
      processNextFrame();
    }, 300);

    return () => {
      clearTimeout(startDelay);
      if (timerId) clearTimeout(timerId);
    };
  }, [isOpen, isWorkerReady, manualMode]);

  // Handle buka/tutup kamera
  useEffect(() => {
    if (isOpen) {
      setDetectedPlate(null);
      setCapturedSnapshot(null);
      setRawOcrPreview('');
      setManualMode(false);
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

  const handleSwitchCamera = () => {
    const next = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(next);
    startCamera(next);
  };

  const handleManualCapture = async () => {
    if (!videoRef.current) return;
    setIsProcessingFrame(true);
    const canvas = captureCroppedPlateFrame();
    if (!canvas) {
      setIsProcessingFrame(false);
      return;
    }

    try {
      if (workerRef.current) {
        const { data } = await workerRef.current.recognize(canvas);
        const plate = extractIndonesianPlate(data?.text || '');
        if (plate) {
          triggerAutoSnap(plate, canvas);
          return;
        }
        setManualText(data?.text?.trim().replace(/\s+/g, ' ') || '');
      }
      setManualMode(true);
    } catch (err) {
      console.warn('Manual capture error:', err);
      setManualMode(true);
    } finally {
      setIsProcessingFrame(false);
    }
  };

  const handleConfirmManualPlate = () => {
    const plate = extractIndonesianPlate(manualText) || manualText.trim().toUpperCase();
    if (plate) {
      stopCameraHardware();
      onDetected(plate);
      onClose();
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Scan Kamera Plat Nomor"
      className="fixed inset-0 z-[9999] flex items-stretch justify-center bg-black/95 backdrop-blur-md sm:items-center sm:p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div
        className="relative flex h-full w-full flex-col overflow-hidden bg-surface-raised sm:h-auto sm:max-h-[92vh] sm:max-w-lg sm:rounded-3xl sm:border sm:border-border sm:shadow-pop"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border bg-surface-raised px-4 py-3 safe-top">
          <div className="flex items-center gap-2 min-w-0">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-on shadow-card">
              <Scan className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <h3 className="truncate text-sm font-bold text-ink sm:text-base">
                Scan Otomatis Plat Nomor
              </h3>
              <p className="truncate text-[10px] font-semibold text-status-green">
                Otomatis Jepret langsung saat plat nomor terdeteksi
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            aria-label="Tutup pemindai"
            className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-xl text-ink-muted transition hover:bg-surface-sunken hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Viewport Kamera dengan Overlay Target Plat Nomor */}
        <div className="relative flex min-h-0 w-full flex-1 items-center justify-center overflow-hidden bg-black sm:aspect-[4/3] sm:flex-none">
          {errorMsg ? (
            <div className="m-4 max-w-sm space-y-3 rounded-2xl border border-border bg-surface-raised p-5 text-center">
              <AlertCircle className="mx-auto h-8 w-8 text-status-red" />
              <p className="text-xs font-semibold leading-relaxed text-ink sm:text-sm">
                {errorMsg}
              </p>
              <button
                type="button"
                onClick={() => startCamera(facingMode)}
                className="mt-1 cursor-pointer rounded-xl border border-border-strong bg-surface-raised px-4 py-2.5 text-xs font-bold text-ink transition hover:bg-surface-sunken focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
              >
                Coba Lagi
              </button>
            </div>
          ) : (
            <>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="h-full w-full object-cover"
              />

              {/* Efek Flash Kamera Saat Auto-Jepret */}
              {isShutterFlash && (
                <div className="pointer-events-none absolute inset-0 z-30 bg-white/80 transition-opacity duration-150" />
              )}

              {/* Bounding Box Frame Target Plat Nomor Indonesia */}
              <div
                className={`pointer-events-none absolute left-1/2 top-1/2 h-[38%] w-[82%] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-2xl border-2 transition-all duration-200 ${
                  detectedPlate
                    ? 'border-status-green bg-status-green/25 shadow-[0_0_35px_rgba(34,197,94,0.75)] scale-[1.02]'
                    : 'border-white/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.55)]'
                }`}
              >
                {/* Freeze frame hasil auto-capture */}
                {capturedSnapshot && (
                  <img
                    src={capturedSnapshot}
                    alt="Captured plate"
                    className="absolute inset-0 h-full w-full object-cover opacity-40"
                  />
                )}

                {/* 4 Pojok Sudut Khas Scanner */}
                <div className="absolute -left-1 -top-1 h-5 w-5 border-l-4 border-t-4 border-accent rounded-tl-lg" />
                <div className="absolute -right-1 -top-1 h-5 w-5 border-r-4 border-t-4 border-accent rounded-tr-lg" />
                <div className="absolute -bottom-1 -left-1 h-5 w-5 border-b-4 border-l-4 border-accent rounded-bl-lg" />
                <div className="absolute -bottom-1 -right-1 h-5 w-5 border-b-4 border-r-4 border-accent rounded-br-lg" />

                {/* Laser scan line animation (jika belum terdeteksi) */}
                {!detectedPlate && (
                  <div className="absolute inset-x-2 top-0 h-0.5 bg-gradient-to-r from-transparent via-accent to-transparent shadow-[0_0_8px_rgba(234,88,12,0.8)] animate-[scanLaser_1.8s_ease-in-out_infinite]" />
                )}

                {/* Label Status di dalam box */}
                <div className="relative z-10 flex h-full w-full flex-col items-center justify-center p-2 text-center">
                  {detectedPlate ? (
                    <div className="flex flex-col items-center gap-1 animate-in zoom-in-90 duration-150">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-status-green text-white shadow-lg">
                        <Check className="h-6 w-6 stroke-[3]" />
                      </div>
                      <span className="font-mono text-2xl font-black tracking-[0.14em] text-white drop-shadow-md">
                        {detectedPlate}
                      </span>
                      <span className="rounded-full bg-status-green px-2.5 py-0.5 text-[10px] font-bold text-white shadow">
                        Terjepret Otomatis!
                      </span>
                    </div>
                  ) : (
                    <span className="rounded-lg bg-black/45 px-2.5 py-1 font-mono text-[11px] font-bold tracking-wider text-white/95 backdrop-blur-xs">
                      Arahkan Plat Nomor ke Dalam Kotak Ini
                    </span>
                  )}
                </div>
              </div>

              {/* Live Preview Text Bawah Kamera */}
              <div className="pointer-events-none absolute bottom-4 inset-x-4 flex flex-col items-center gap-1.5">
                <div className="flex items-center gap-1.5 rounded-full bg-black/80 px-3.5 py-1.5 text-[11px] font-semibold text-white/95 backdrop-blur-md">
                  {isProcessingFrame ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-accent" />
                  ) : (
                    <Sparkles className="h-3.5 w-3.5 text-status-green" />
                  )}
                  <span>
                    {detectedPlate
                      ? `Terdeteksi: ${detectedPlate} — Memproses...`
                      : workerStatusText}
                  </span>
                </div>
                {rawOcrPreview && !detectedPlate && (
                  <span className="max-w-[85%] truncate rounded-md bg-black/55 px-2 py-0.5 font-mono text-[10px] text-white/75 backdrop-blur-xs">
                    Mendeteksi: {rawOcrPreview}
                  </span>
                )}
              </div>
            </>
          )}
        </div>

        {/* Modal Koreksi Manual (jika plat sangat kotor/rusak) */}
        {manualMode && (
          <div className="border-t border-border bg-surface-raised p-4 space-y-3 animate-in slide-in-from-bottom-2 duration-200">
            <div>
              <label className="text-xs font-bold text-ink">
                Koreksi / Ketik Plat Nomor:
              </label>
              <input
                type="text"
                autoFocus
                value={manualText}
                onChange={(e) => setManualText(e.target.value.toUpperCase())}
                placeholder="BK 1234 ABC"
                className="mt-1 w-full rounded-xl border border-border-strong bg-surface-sunken px-3.5 py-2.5 font-mono text-base font-bold tracking-widest text-ink focus:border-accent focus:outline-none"
              />
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setManualMode(false)}
                className="flex-1 cursor-pointer rounded-xl border border-border bg-surface-raised py-2.5 text-xs font-bold text-ink hover:bg-surface-sunken"
              >
                Kembali ke Auto-Scan
              </button>
              <button
                type="button"
                onClick={handleConfirmManualPlate}
                className="flex-1 cursor-pointer rounded-xl bg-accent py-2.5 text-xs font-bold text-accent-on shadow-card hover:bg-accent-hover"
              >
                Gunakan Plat Ini
              </button>
            </div>
          </div>
        )}

        {/* Action Controls Bawah */}
        {!manualMode && (
          <div className="flex shrink-0 items-center justify-between gap-2.5 border-t border-border bg-surface-raised px-4 py-3 pb-[calc(0.85rem+env(safe-area-inset-bottom,0px))] sm:pb-3">
            <button
              type="button"
              onClick={handleSwitchCamera}
              className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-xl border border-border-strong bg-surface-raised text-ink transition hover:bg-surface-sunken focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 active:scale-95"
              title="Balik kamera (Depan / Belakang)"
              aria-label="Balik kamera"
            >
              <RefreshCw className="h-4 w-4" />
            </button>

            <div className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-status-green/30 bg-status-green-bg px-3 py-2.5 text-xs font-bold text-status-green">
              <Camera className="h-4 w-4 shrink-0 animate-pulse" />
              <span className="truncate">Auto-Jepret Aktif (Arahkan ke Plat)</span>
            </div>

            <button
              type="button"
              onClick={handleManualCapture}
              disabled={Boolean(errorMsg)}
              className="flex h-10 shrink-0 cursor-pointer items-center gap-1.5 rounded-xl border border-border-strong bg-surface-raised px-3 text-xs font-bold text-ink-muted transition hover:bg-surface-sunken hover:text-ink active:scale-95"
              title="Ketik manual jika plat kotor/rusak"
            >
              <Keyboard className="h-3.5 w-3.5" />
              <span>Manual</span>
            </button>
          </div>
        )}
      </div>

      {/* Style laser animation */}
      <style>{`
        @keyframes scanLaser {
          0% { top: 5%; opacity: 0.25; }
          50% { top: 90%; opacity: 1; }
          100% { top: 5%; opacity: 0.25; }
        }
      `}</style>
    </div>,
    document.body
  );
};
