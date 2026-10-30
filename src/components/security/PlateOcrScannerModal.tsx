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
 * Daftar kode wilayah plat nomor resmi di Indonesia (Sumatera, Jawa, Kalimantan, Sulawesi, dll.)
 */
const VALID_INDONESIAN_REGIONS = new Set([
  // Sumatera (Medan/Sumut = BK, BB; Aceh = BL; Riau = BM; Sumbar = BA; Kepri = BP; Sumsel = BG; Babel = BN; Bengkulu = BD; Lampung = BE; Jambi = BH)
  'BK', 'BB', 'BL', 'BM', 'BA', 'BP', 'BG', 'BN', 'BD', 'BE', 'BH',
  // Jawa
  'A', 'B', 'D', 'E', 'F', 'T', 'Z', 'G', 'H', 'K', 'R', 'AA', 'AB', 'AD',
  'L', 'M', 'N', 'P', 'S', 'W', 'AE', 'AG',
  // Bali & Nusa Tenggara
  'DK', 'DR', 'EA', 'DH', 'EB', 'ED',
  // Kalimantan
  'KB', 'KH', 'DA', 'KT', 'KU',
  // Sulawesi, Maluku, Papua
  'DB', 'DL', 'DM', 'DN', 'DT', 'DD', 'DC', 'DP', 'DW', 'DE', 'DG', 'PA', 'PB',
]);

/**
 * Normalisasi karakter angka yang sering salah terbaca oleh OCR di blok tengah plat nomor.
 */
const normalizeOcrDigits = (rawDigits: string): string => {
  return rawDigits
    .replace(/[ODQ]/g, '0')
    .replace(/[IL|!]/g, '1')
    .replace(/Z/g, '2')
    .replace(/A/g, '4')
    .replace(/S/g, '5')
    .replace(/G/g, '6')
    .replace(/T/g, '7')
    .replace(/B/g, '8');
};

/**
 * Normalisasi karakter huruf yang sering salah terbaca oleh OCR di blok wilayah/seri.
 */
const normalizeOcrLetters = (rawLetters: string): string => {
  return rawLetters
    .replace(/0/g, 'O')
    .replace(/[1|!]/g, 'I')
    .replace(/2/g, 'Z')
    .replace(/4/g, 'A')
    .replace(/5/g, 'S')
    .replace(/6/g, 'G')
    .replace(/8/g, 'B');
};

/**
 * Validasi dan bersihkan kode wilayah (misal ada noise baut "1BK" atau "IBK" -> "BK").
 */
const resolveRegionCode = (rawPrefix: string): string | null => {
  const norm = normalizeOcrLetters(rawPrefix);
  if (VALID_INDONESIAN_REGIONS.has(norm)) return norm;

  if (norm.length >= 2) {
    const lastTwo = norm.slice(-2);
    if (VALID_INDONESIAN_REGIONS.has(lastTwo)) return lastTwo;
    const firstTwo = norm.slice(0, 2);
    if (VALID_INDONESIAN_REGIONS.has(firstTwo)) return firstTwo;
  }
  if (norm.length >= 1) {
    const lastOne = norm.slice(-1);
    if (VALID_INDONESIAN_REGIONS.has(lastOne)) return lastOne;
  }
  return null;
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
    // 1. Match pola dengan spasi penuh maupun sebagian (misal "BK 8210 GI", "BK 8210GI", "BK8210 GI")
    const flexRegex = /(?:^|\s)([A-Z0-9]{1,3})\s*([0-9ODQILZSGBAT]{1,4})\s*([A-Z0-9]{1,3})(?=\s|$)/g;
    let match: RegExpExecArray | null;
    while ((match = flexRegex.exec(line)) !== null) {
      const wilayah = resolveRegionCode(match[1]);
      const nomor = normalizeOcrDigits(match[2]);
      const seri = normalizeOcrLetters(match[3]);

      if (
        wilayah &&
        /^[1-9][0-9]{0,3}$/.test(nomor) &&
        /^[A-Z]{1,3}$/.test(seri)
      ) {
        return `${wilayah} ${nomor} ${seri}`;
      }
    }

    // 2. Match pola nyambung tanpa spasi atau terpecah antar token (misal "BK8210GI" atau "IBK8210G1")
    const compactTokens = line.split(/\s+/);
    for (let i = 0; i < compactTokens.length; i++) {
      const combos = [
        compactTokens[i],
        i + 1 < compactTokens.length ? `${compactTokens[i]}${compactTokens[i + 1]}` : '',
        i + 2 < compactTokens.length
          ? `${compactTokens[i]}${compactTokens[i + 1]}${compactTokens[i + 2]}`
          : '',
      ].filter((c) => c.length >= 4 && c.length <= 10);

      for (const token of combos) {
        // Coba pecah prefix 2 huruf dulu (misal BK, BL, BM, BB), lalu 1 huruf (misal B, D, L)
        for (const prefixLen of [2, 1, 3]) {
          if (token.length <= prefixLen + 1) continue;
          const rawPrefix = token.slice(0, prefixLen);
          const wilayah = resolveRegionCode(rawPrefix);
          if (!wilayah) continue;

          const rest = token.slice(prefixLen);
          const restMatch = rest.match(/^([0-9ODQILZSGBAT]{1,4})([A-Z0-9]{1,3})$/);
          if (restMatch) {
            const nomor = normalizeOcrDigits(restMatch[1]);
            const seri = normalizeOcrLetters(restMatch[2]);
            if (/^[1-9][0-9]{0,3}$/.test(nomor) && /^[A-Z]{1,3}$/.test(seri)) {
              return `${wilayah} ${nomor} ${seri}`;
            }
          }
        }
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
  const invertCanvasRef = useRef<HTMLCanvasElement | null>(null);

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
    }
  };

  /**
   * 4. Crop area kotak target sesuai posisi visual `object-cover` di layar
   *    dan siapkan 2 varian gambar:
   *    - normalCanvas: untuk Plat Putih & Plat Kuning (tulisan gelap di latar terang)
   *    - invertedCanvas: untuk Plat Hitam (tulisan putih/terang di latar gelap)
   */
  const capturePlateCanvases = (): {
    normalCanvas: HTMLCanvasElement;
    invertedCanvas: HTMLCanvasElement;
  } | null => {
    const video = videoRef.current;
    if (!video || video.readyState < 2 || !video.videoWidth || !video.videoHeight) return null;

    if (!cropCanvasRef.current) {
      cropCanvasRef.current = document.createElement('canvas');
    }
    if (!invertCanvasRef.current) {
      invertCanvasRef.current = document.createElement('canvas');
    }

    const vw = video.videoWidth;
    const vh = video.videoHeight;
    const cw = video.clientWidth || vw;
    const ch = video.clientHeight || vh;

    // Hitung area video yang benar-benar tampil di layar akibat CSS `object-cover`
    const videoAspect = vw / vh;
    const containerAspect = cw / ch;

    let visibleX = 0;
    let visibleY = 0;
    let visibleW = vw;
    let visibleH = vh;

    if (videoAspect > containerAspect) {
      // Video lebih lebar dari container -> sisi kiri/kanan terpotong
      visibleW = vh * containerAspect;
      visibleX = (vw - visibleW) / 2;
    } else {
      // Video lebih tinggi dari container -> sisi atas/bawah terpotong
      visibleH = vw / containerAspect;
      visibleY = (vh - visibleH) / 2;
    }

    // Kotak panduan di layar berukuran 82% lebar x 38% tinggi di tengah container
    const boxW = Math.round(visibleW * 0.84);
    const boxH = Math.round(visibleH * 0.40);
    const boxX = Math.round(visibleX + (visibleW - boxW) / 2);
    const boxY = Math.round(visibleY + (visibleH - boxH) / 2);

    const targetW = 720;
    const targetH = Math.max(160, Math.round((boxH / boxW) * targetW));

    const normalCanvas = cropCanvasRef.current;
    normalCanvas.width = targetW;
    normalCanvas.height = targetH;
    const normalCtx = normalCanvas.getContext('2d', { willReadFrequently: true });
    if (!normalCtx) return null;

    normalCtx.drawImage(video, boxX, boxY, boxW, boxH, 0, 0, targetW, targetH);

    const invertedCanvas = invertCanvasRef.current;
    invertedCanvas.width = targetW;
    invertedCanvas.height = targetH;
    const invertCtx = invertedCanvas.getContext('2d', { willReadFrequently: true });
    if (!invertCtx) return null;

    try {
      const imgData = normalCtx.getImageData(0, 0, targetW, targetH);
      const invData = invertCtx.createImageData(targetW, targetH);
      const d = imgData.data;
      const inv = invData.data;

      // Kontras moderat (45) untuk menajamkan huruf tanpa merusak tepi karakter
      const contrast = 45;
      const factor = (259 * (contrast + 255)) / (255 * (259 - contrast));

      for (let i = 0; i < d.length; i += 4) {
        const gray = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];

        // Normal (Plat Putih / Plat Kuning)
        const cNorm = Math.max(0, Math.min(255, factor * (gray - 128) + 128));
        d[i] = cNorm;
        d[i + 1] = cNorm;
        d[i + 2] = cNorm;

        // Inverted (Plat Hitam dengan tulisan putih)
        const invGray = 255 - gray;
        const cInv = Math.max(0, Math.min(255, factor * (invGray - 128) + 128));
        inv[i] = cInv;
        inv[i + 1] = cInv;
        inv[i + 2] = cInv;
        inv[i + 3] = 255;
      }

      normalCtx.putImageData(imgData, 0, 0);
      invertCtx.putImageData(invData, 0, 0);
    } catch {
      invertCtx.drawImage(normalCanvas, 0, 0);
    }

    return { normalCanvas, invertedCanvas };
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

    // Langsung otomatis kirim hasil jepretan ke form setelah efek jepret singkat (350ms)
    setTimeout(() => {
      stopCameraHardware();
      onDetected(plate);
      onClose();
    }, 350);
  };

  // 5. Loop Auto-Scan Kontinu -> TIDAK AKAN BERHENTI sampai plat terdeteksi atau modal ditutup
  useEffect(() => {
    if (!isOpen || !isWorkerReady || manualMode) return;

    let timerId: ReturnType<typeof setTimeout> | null = null;
    let isCancelled = false;
    isDetectedRef.current = false;

    const processNextFrame = async () => {
      if (isCancelled || isDetectedRef.current) return;

      // PENTING: Jika kamera masih proses inisialisasi (getUserMedia), jadwalkan ulang, JANGAN return mati!
      if (
        !isScanningRef.current ||
        !workerRef.current ||
        !videoRef.current ||
        videoRef.current.readyState < 2
      ) {
        timerId = setTimeout(processNextFrame, 200);
        return;
      }

      const canvases = capturePlateCanvases();
      if (!canvases) {
        timerId = setTimeout(processNextFrame, 200);
        return;
      }

      setIsProcessingFrame(true);

      try {
        // Pass 1: Scan gambar normal (Plat Putih / Plat Kuning)
        const resNormal = await workerRef.current.recognize(canvases.normalCanvas);
        const textNormal = resNormal?.data?.text || '';
        const plateFromNormal = extractIndonesianPlate(textNormal);

        if (plateFromNormal && !isDetectedRef.current && !isCancelled) {
          triggerAutoSnap(plateFromNormal, canvases.normalCanvas);
          return;
        }

        // Pass 2: Scan gambar inverted (Plat Hitam tulisan Putih)
        if (!isDetectedRef.current && !isCancelled && workerRef.current) {
          const resInv = await workerRef.current.recognize(canvases.invertedCanvas);
          const textInv = resInv?.data?.text || '';
          const plateFromInv = extractIndonesianPlate(textInv);

          if (plateFromInv && !isDetectedRef.current && !isCancelled) {
            triggerAutoSnap(plateFromInv, canvases.normalCanvas);
            return;
          }

          const combinedPreview = (textNormal.trim() || textInv.trim()).replace(/\s+/g, ' ');
          if (combinedPreview) {
            setRawOcrPreview(combinedPreview);
          }
        }
      } catch (err) {
        console.warn('OCR frame recognition error:', err);
      } finally {
        if (!isCancelled) {
          setIsProcessingFrame(false);
        }
      }

      if (!isCancelled && !isDetectedRef.current) {
        timerId = setTimeout(processNextFrame, 180);
      }
    };

    timerId = setTimeout(processNextFrame, 200);

    return () => {
      isCancelled = true;
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
    const canvases = capturePlateCanvases();
    if (!canvases) {
      setIsProcessingFrame(false);
      setManualMode(true);
      return;
    }

    try {
      if (workerRef.current) {
        const res1 = await workerRef.current.recognize(canvases.normalCanvas);
        const plate1 = extractIndonesianPlate(res1?.data?.text || '');
        if (plate1) {
          triggerAutoSnap(plate1, canvases.normalCanvas);
          return;
        }
        const res2 = await workerRef.current.recognize(canvases.invertedCanvas);
        const plate2 = extractIndonesianPlate(res2?.data?.text || '');
        if (plate2) {
          triggerAutoSnap(plate2, canvases.normalCanvas);
          return;
        }
        setManualText(
          (res1?.data?.text || res2?.data?.text || '').trim().replace(/\s+/g, ' ')
        );
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
