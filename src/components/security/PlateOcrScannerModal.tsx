import React, { useRef, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  Camera,
  X,
  RefreshCw,
  Check,
  Sparkles,
  Loader2,
  AlertCircle,
  Scan,
  Keyboard,
  RotateCcw,
} from 'lucide-react';

interface PlateOcrScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDetected: (plate: string) => void;
}

interface DetectedBoxNormalized {
  leftPct: number;
  topPct: number;
  widthPct: number;
  heightPct: number;
  conf: number;
}

/**
 * Daftar kode wilayah plat nomor resmi di Indonesia (Sumatera, Jawa, Kalimantan, Sulawesi, dll.)
 */
const VALID_INDONESIAN_REGIONS = new Set([
  'BK', 'BB', 'BL', 'BM', 'BA', 'BP', 'BG', 'BN', 'BD', 'BE', 'BH',
  'A', 'B', 'D', 'E', 'F', 'T', 'Z', 'G', 'H', 'K', 'R', 'AA', 'AB', 'AD',
  'L', 'M', 'N', 'P', 'S', 'W', 'AE', 'AG',
  'DK', 'DR', 'EA', 'DH', 'EB', 'ED',
  'KB', 'KH', 'DA', 'KT', 'KU',
  'DB', 'DL', 'DM', 'DN', 'DT', 'DD', 'DC', 'DP', 'DW', 'DE', 'DG', 'PA', 'PB',
]);

/**
 * Parser cerdas plat nomor Indonesia (untuk fallback ketik manual).
 */
export const extractIndonesianPlate = (rawText: string): string | null => {
  if (!rawText) return null;

  const clean = rawText.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (clean.length < 4 || clean.length > 10) return null;

  for (const startOffset of [0, 1]) {
    const sub = clean.slice(startOffset);
    if (sub.length < 4) continue;

    for (const prefixLen of [2, 1]) {
      if (sub.length <= prefixLen + 1) continue;
      const rawPrefix = sub.slice(0, prefixLen);
      if (!VALID_INDONESIAN_REGIONS.has(rawPrefix)) continue;

      const rest = sub.slice(prefixLen);
      const match = rest.match(/^([0-9OIBDQ]{1,4})([A-Z018]{1,3})/);
      if (!match) continue;

      const digits = match[1]
        .replace(/[ODQ]/g, '0')
        .replace(/I/g, '1')
        .replace(/B/g, '8');

      if (!/^[1-9][0-9]{0,3}$/.test(digits)) continue;

      const suffix = match[2]
        .replace(/0/g, 'O')
        .replace(/1/g, 'I')
        .replace(/8/g, 'B');

      if (!/^[A-Z]{1,3}$/.test(suffix)) continue;

      const totalLen = rawPrefix.length + digits.length + suffix.length;
      if (totalLen < 5) continue;

      return `${rawPrefix} ${digits} ${suffix}`;
    }
  }

  return null;
};

/**
 * Resolusi cerdas antara 2 frame yang hampir identik (contoh: "B 1234 WIG" & "B 1234 WLG" -> "B 1234 WLG").
 */
const isOneCharSubsequence = (shorter: string, longer: string): boolean => {
  if (longer.length !== shorter.length + 1) return false;
  let i = 0;
  let j = 0;
  let skipped = 0;
  while (i < shorter.length && j < longer.length) {
    if (shorter[i] === longer[j]) {
      i++;
      j++;
    } else {
      skipped++;
      if (skipped > 1) return false;
      j++;
    }
  }
  return true;
};

const mergeSimilarPlates = (plateA: string, plateB: string): string | null => {
  if (plateA === plateB) return plateA;

  const cleanA = plateA.replace(/\s+/g, '');
  const cleanB = plateB.replace(/\s+/g, '');

  // Jika Frame 1 kurang 1 angka/huruf (misal 'B 156 TOR') dan Frame 2 lengkap ('B 2156 TOR'), ambil yang LENGKAP!
  if (isOneCharSubsequence(cleanA, cleanB)) return plateB;
  if (isOneCharSubsequence(cleanB, cleanA)) return plateA;

  const partsA = plateA.split(' ');
  const partsB = plateB.split(' ');
  if (partsA.length !== 3 || partsB.length !== 3) return null;
  if (partsA[0] !== partsB[0] || partsA[1] !== partsB[1]) return null;

  const seriA = partsA[2];
  const seriB = partsB[2];
  if (seriA.length !== seriB.length) return null;

  let diffCount = 0;
  let mergedSeri = '';

  for (let i = 0; i < seriA.length; i++) {
    const ca = seriA[i];
    const cb = seriB[i];
    if (ca === cb) {
      mergedSeri += ca;
    } else if ((ca === 'L' && cb === 'I') || (ca === 'I' && cb === 'L')) {
      mergedSeri += 'L';
      diffCount++;
    } else if ((ca === 'O' && cb === 'Q') || (ca === 'Q' && cb === 'O')) {
      mergedSeri += 'O';
      diffCount++;
    } else if ((ca === 'G' && cb === 'C') || (ca === 'C' && cb === 'G')) {
      mergedSeri += 'G';
      diffCount++;
    } else if ((ca === 'N' && cb === 'H') || (ca === 'H' && cb === 'N')) {
      mergedSeri += 'N';
      diffCount++;
    } else {
      return null;
    }
  }

  if (diffCount <= 1) {
    return `${partsA[0]} ${partsA[1]} ${mergedSeri}`;
  }
  return null;
};

const COUNTDOWN_DURATION_MS = 500;

export const PlateOcrScannerModal: React.FC<PlateOcrScannerModalProps> = ({
  isOpen,
  onClose,
  onDetected,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const isScanningRef = useRef<boolean>(false);
  const isLockedPreviewRef = useRef<boolean>(false);
  const frameCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const recentCandidatesRef = useRef<Array<{ plate: string; confidence: number; time: number }>>([]);
  const countdownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoConfirmTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [detectedPlate, setDetectedPlate] = useState<string | null>(null);
  const [candidateHint, setCandidateHint] = useState<string | null>(null);
  const [trackedBox, setTrackedBox] = useState<DetectedBoxNormalized | null>(null);
  const [countdownProgress, setCountdownProgress] = useState<number>(0);
  const [capturedSnapshot, setCapturedSnapshot] = useState<string | null>(null);
  const [isShutterFlash, setIsShutterFlash] = useState(false);
  const [rawOcrPreview, setRawOcrPreview] = useState<string>('');
  const [isProcessingFrame, setIsProcessingFrame] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [manualMode, setManualMode] = useState(false);
  const [manualText, setManualText] = useState('');

  const clearPreviewTimers = () => {
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
    if (autoConfirmTimeoutRef.current) {
      clearTimeout(autoConfirmTimeoutRef.current);
      autoConfirmTimeoutRef.current = null;
    }
  };

  // 1. Bersihkan hardware kamera
  const stopCameraHardware = () => {
    isScanningRef.current = false;
    clearPreviewTimers();
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

  // 2. Start Camera Hardware
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
          // @ts-ignore
          focusMode: { ideal: 'continuous' },
        } as MediaTrackConstraints,
        audio: false,
      });
      streamRef.current = mediaStream;
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        await videoRef.current.play().catch(() => {});
      }
      isScanningRef.current = true;
    } catch (err1) {
      try {
        const fallbackStream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });
        streamRef.current = fallbackStream;
        if (videoRef.current) {
          videoRef.current.srcObject = fallbackStream;
          await videoRef.current.play().catch(() => {});
        }
        isScanningRef.current = true;
      } catch (finalErr: any) {
        console.error('All camera attempts failed:', finalErr);
        if (finalErr.name === 'NotAllowedError' || finalErr.name === 'PermissionDeniedError') {
          setErrorMsg(
            'Izin akses kamera diblokir. Klik ikon gembok / kamera di address bar browser untuk mengizinkan.'
          );
        } else if (finalErr.name === 'NotFoundError' || finalErr.name === 'DevicesNotFoundError') {
          setErrorMsg('Kamera (webcam) tidak ditemukan di perangkat ini.');
        } else {
          setErrorMsg(finalErr.message || 'Gagal menyalakan kamera.');
        }
      }
    }
  };

  /**
   * 3. Tangkap frame kamera sesuai area layar `object-cover` sebagai JPEG ringan (~20 KB)
   *    untuk dikirim ke Server AI ANPR (`POST /anpr/detect`).
   */
  const captureVisibleFrameBase64 = (): string | null => {
    const video = videoRef.current;
    if (!video || video.readyState < 2 || !video.videoWidth || !video.videoHeight) return null;

    if (!frameCanvasRef.current) {
      frameCanvasRef.current = document.createElement('canvas');
    }
    const canvas = frameCanvasRef.current;

    const vw = video.videoWidth;
    const vh = video.videoHeight;
    const cw = video.clientWidth || vw;
    const ch = video.clientHeight || vh;

    const videoAspect = vw / vh;
    const containerAspect = cw / ch;

    let visibleX = 0;
    let visibleY = 0;
    let visibleW = vw;
    let visibleH = vh;

    if (videoAspect > containerAspect) {
      visibleW = vh * containerAspect;
      visibleX = (vw - visibleW) / 2;
    } else {
      visibleH = vw / containerAspect;
      visibleY = (vh - visibleH) / 2;
    }

    const targetW = 720;
    const targetH = Math.max(320, Math.round((visibleH / visibleW) * targetW));
    canvas.width = targetW;
    canvas.height = targetH;

    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.drawImage(video, visibleX, visibleY, visibleW, visibleH, 0, 0, targetW, targetH);
    try {
      return canvas.toDataURL('image/jpeg', 0.82);
    } catch {
      return null;
    }
  };

  /**
   * Mulai Preview 0.5 Detik dengan Progress Bar sebelum Auto-Jepret final.
   */
  const startPreviewAndAutoSnap = (plate: string, snapshotUrl: string) => {
    if (isLockedPreviewRef.current) return;
    isLockedPreviewRef.current = true;
    isScanningRef.current = false;
    setCandidateHint(null);

    if (snapshotUrl) {
      setCapturedSnapshot(snapshotUrl);
    }

    setIsShutterFlash(true);
    setTimeout(() => setIsShutterFlash(false), 150);

    setDetectedPlate(plate);
    setCountdownProgress(0);
    navigator.vibrate?.([50, 30, 70]);

    const startTime = Date.now();
    clearPreviewTimers();

    countdownTimerRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const pct = Math.min(100, Math.round((elapsed / COUNTDOWN_DURATION_MS) * 100));
      setCountdownProgress(pct);
    }, 35);

    autoConfirmTimeoutRef.current = setTimeout(() => {
      clearPreviewTimers();
      stopCameraHardware();
      onDetected(plate);
      onClose();
    }, COUNTDOWN_DURATION_MS);
  };

  const handleRescan = () => {
    clearPreviewTimers();
    isLockedPreviewRef.current = false;
    recentCandidatesRef.current = [];
    setDetectedPlate(null);
    setCandidateHint(null);
    setTrackedBox(null);
    setCapturedSnapshot(null);
    setCountdownProgress(0);
    isScanningRef.current = true;
  };

  const handleAcceptNow = () => {
    if (!detectedPlate) return;
    clearPreviewTimers();
    stopCameraHardware();
    onDetected(detectedPlate);
    onClose();
  };

  const registerCandidateHit = (
    plate: string,
    confidence: number,
    _isFromYoloBox: boolean,
    snapshotUrl: string
  ): boolean => {
    const now = Date.now();
    const recent = recentCandidatesRef.current.filter((item) => now - item.time < 3500);

    // Verifikasi 2 frame cepat (~0.25 detik): membandingkan Frame 1 & Frame 2 agar tidak langsung jepret
    // saat frame pertama masih goyang/kurang 1 angka, sekaligus memilih kandidat yang paling lengkap!
    for (const prev of recent) {
      const merged = mergeSimilarPlates(prev.plate, plate);
      if (merged) {
        recentCandidatesRef.current = [];
        startPreviewAndAutoSnap(merged, snapshotUrl);
        return true;
      }
    }

    recent.push({ plate, confidence, time: now });
    recentCandidatesRef.current = recent.slice(-5);
    setCandidateHint(plate);
    return false;
  };

  // 4. Loop Kontinu Server-Side AI ANPR (Instan 0 Detik di Semua Device Tanpa Download Model!)
  useEffect(() => {
    if (!isOpen || manualMode) return;

    let timerId: ReturnType<typeof setTimeout> | null = null;
    let isCancelled = false;

    const processNextFrame = async () => {
      if (isCancelled) return;

      const video = videoRef.current;
      if (
        isLockedPreviewRef.current ||
        !isScanningRef.current ||
        !video ||
        video.readyState < 2 ||
        !video.videoWidth ||
        !video.videoHeight
      ) {
        timerId = setTimeout(processNextFrame, 120);
        return;
      }

      const frameDataUrl = captureVisibleFrameBase64();
      if (!frameDataUrl) {
        timerId = setTimeout(processNextFrame, 120);
        return;
      }

      setIsProcessingFrame(true);

      try {
        const res = await fetch('/anpr/detect', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image: frameDataUrl }),
        });

        if (res.ok && !isCancelled && !isLockedPreviewRef.current) {
          const data = await res.json();

          if (data.box) {
            setTrackedBox(data.box);
          } else {
            setTrackedBox(null);
          }

          if (data.rawText) {
            setRawOcrPreview(data.rawText);
          }

          if (data.plate) {
            if (
              registerCandidateHit(
                data.plate,
                Number(data.confidence || 0),
                Boolean(data.isFromYoloBox),
                frameDataUrl
              )
            ) {
              return;
            }
          }
        }
      } catch (err) {
        console.warn('Server ANPR request error:', err);
      } finally {
        if (!isCancelled) {
          setIsProcessingFrame(false);
        }
      }

      if (!isCancelled) {
        timerId = setTimeout(processNextFrame, 90);
      }
    };

    timerId = setTimeout(processNextFrame, 120);

    return () => {
      isCancelled = true;
      if (timerId) clearTimeout(timerId);
    };
  }, [isOpen, manualMode]);

  // Handle buka/tutup kamera
  useEffect(() => {
    if (isOpen) {
      isLockedPreviewRef.current = false;
      recentCandidatesRef.current = [];
      setDetectedPlate(null);
      setCandidateHint(null);
      setTrackedBox(null);
      setCapturedSnapshot(null);
      setCountdownProgress(0);
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

  const handleManualCapture = () => {
    clearPreviewTimers();
    isLockedPreviewRef.current = false;
    setManualText(detectedPlate || candidateHint || '');
    setManualMode(true);
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
      aria-label="Scan Kamera Plat Nomor (AI ANPR)"
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
                AI ANPR Scanner (YOLOv8 + SVTR Server)
              </h3>
              <p className="truncate text-[10px] font-semibold text-status-green">
                Siap Instan 0 Detik di Semua Perangkat • Auto-Jepret
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

        {/* Viewport Kamera */}
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

              {/* Kotak Hijau Dinamis Hasil Deteksi YOLOv8 di Posisi Plat Sebenarnya */}
              {trackedBox && !detectedPlate && (
                <div
                  className="pointer-events-none absolute z-20 rounded-lg border-2 border-status-green bg-status-green/15 shadow-[0_0_20px_rgba(34,197,94,0.8)] transition-all duration-100"
                  style={{
                    left: `${trackedBox.leftPct}%`,
                    top: `${trackedBox.topPct}%`,
                    width: `${trackedBox.widthPct}%`,
                    height: `${trackedBox.heightPct}%`,
                  }}
                >
                  <span className="absolute -top-5 left-0 rounded bg-status-green px-1.5 py-0.5 font-mono text-[9px] font-bold text-white shadow">
                    PLAT {(trackedBox.conf * 100).toFixed(0)}%
                  </span>
                </div>
              )}

              {/* Bounding Box Panduan Tengah / Hasil Jepret */}
              <div
                className={`pointer-events-none absolute left-1/2 top-1/2 h-[32%] w-[82%] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-2xl border-2 transition-all duration-200 ${
                  detectedPlate
                    ? 'border-status-green bg-black/80 shadow-[0_0_40px_rgba(34,197,94,0.85)] scale-[1.03]'
                    : candidateHint
                    ? 'border-amber-400 bg-amber-500/10'
                    : 'border-white/50'
                }`}
              >
                {/* Freeze frame hasil auto-capture */}
                {capturedSnapshot && (
                  <img
                    src={capturedSnapshot}
                    alt="Captured plate"
                    className="absolute inset-0 h-full w-full object-cover opacity-35"
                  />
                )}

                {/* 4 Pojok Sudut Khas Scanner ANPR */}
                <div className="absolute -left-1 -top-1 h-5 w-5 border-l-4 border-t-4 border-accent rounded-tl-lg" />
                <div className="absolute -right-1 -top-1 h-5 w-5 border-r-4 border-t-4 border-accent rounded-tr-lg" />
                <div className="absolute -bottom-1 -left-1 h-5 w-5 border-b-4 border-l-4 border-accent rounded-bl-lg" />
                <div className="absolute -bottom-1 -right-1 h-5 w-5 border-b-4 border-r-4 border-accent rounded-br-lg" />

                {/* Label Status & Preview di dalam kotak */}
                <div className="relative z-10 flex h-full w-full flex-col items-center justify-center px-3 py-2 text-center">
                  {detectedPlate ? (
                    <div className="flex w-full flex-col items-center gap-1.5 animate-in zoom-in-95 duration-150">
                      <div className="flex items-center gap-1.5">
                        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-status-green text-white shadow">
                          <Check className="h-4 w-4 stroke-[3]" />
                        </div>
                        <span className="font-mono text-2xl font-black tracking-[0.14em] text-white drop-shadow sm:text-3xl">
                          {detectedPlate}
                        </span>
                      </div>

                      {/* Progress Bar Countdown */}
                      <div className="h-1.5 w-4/5 overflow-hidden rounded-full bg-white/25">
                        <div
                          className="h-full bg-status-green transition-all duration-75"
                          style={{ width: `${countdownProgress}%` }}
                        />
                      </div>
                      <span className="text-[10px] font-bold tracking-wide text-emerald-300">
                        Terjepret Otomatis!
                      </span>
                    </div>
                  ) : candidateHint ? (
                    <div className="flex flex-col items-center gap-1">
                      <span className="rounded-lg bg-amber-500/90 px-2.5 py-0.5 font-mono text-sm font-black tracking-widest text-black shadow">
                        {candidateHint}
                      </span>
                      <span className="text-[10px] font-bold text-amber-200 drop-shadow">
                        Mengunci fokus plat...
                      </span>
                    </div>
                  ) : !trackedBox ? (
                    <span className="rounded-lg bg-black/45 px-2.5 py-1 font-mono text-[11px] font-bold tracking-wider text-white/90 backdrop-blur-xs">
                      Arahkan Kamera ke Kendaraan / Plat Nomor
                    </span>
                  ) : null}
                </div>
              </div>

              {/* Tombol Interaktif Saat Preview Muncul */}
              {detectedPlate && (
                <div className="absolute bottom-14 inset-x-4 z-30 flex items-center justify-center gap-2.5">
                  <button
                    type="button"
                    onClick={handleRescan}
                    className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-white/30 bg-black/80 px-3.5 py-2 text-xs font-bold text-white shadow-lg backdrop-blur-md transition hover:bg-black active:scale-95"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    <span>Scan Ulang</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleAcceptNow}
                    className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-status-green px-4 py-2 text-xs font-bold text-white shadow-lg transition hover:opacity-95 active:scale-95"
                  >
                    <Check className="h-3.5 w-3.5" />
                    <span>Pakai Sekarang</span>
                  </button>
                </div>
              )}

              {/* Live Preview Status Bawah Kamera */}
              <div className="pointer-events-none absolute bottom-3 inset-x-4 flex flex-col items-center gap-1">
                <div className="flex items-center gap-1.5 rounded-full bg-black/80 px-3.5 py-1.5 text-[11px] font-semibold text-white/95 backdrop-blur-md">
                  {isProcessingFrame ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-accent" />
                  ) : (
                    <Sparkles className="h-3.5 w-3.5 text-status-green" />
                  )}
                  <span>
                    {detectedPlate
                      ? `Terdeteksi Akurat: ${detectedPlate}`
                      : candidateHint
                      ? `Terdeteksi: ${candidateHint} — Mengunci...`
                      : 'AI ANPR Siap — Arahkan ke plat nomor (jauh/dekat otomatis terdeteksi)'}
                  </span>
                </div>
                {rawOcrPreview && !detectedPlate && !candidateHint && (
                  <span className="max-w-[85%] truncate rounded-md bg-black/55 px-2 py-0.5 font-mono text-[10px] text-white/75 backdrop-blur-xs">
                    Sensor AI: {rawOcrPreview}
                  </span>
                )}
              </div>
            </>
          )}
        </div>

        {/* Modal Koreksi Manual */}
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
                onClick={() => {
                  setManualMode(false);
                  handleRescan();
                }}
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
              <span className="truncate">Server AI ANPR Aktif (Tanpa Loading Model)</span>
            </div>

            <button
              type="button"
              onClick={handleManualCapture}
              disabled={Boolean(errorMsg)}
              className="flex h-10 shrink-0 cursor-pointer items-center gap-1.5 rounded-xl border border-border-strong bg-surface-raised px-3 text-xs font-bold text-ink-muted transition hover:bg-surface-sunken hover:text-ink active:scale-95"
              title="Ketik manual jika plat tertutup lumpur/rusak"
            >
              <Keyboard className="h-3.5 w-3.5" />
              <span>Manual</span>
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};
