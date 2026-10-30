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
 * Normalisasi karakter angka di blok tengah plat nomor:
 * HANYA mengizinkan konversi karakter yang benar-benar mirip angka (0/O/D/Q, 1/I, 8/B)
 * dan WAJIB mengandung minimal 1 digit angka asli agar huruf murni seperti "ETE" TIDAK PERNAH berubah jadi "E 7 E".
 */
const normalizeMiddleDigits = (rawDigits: string): string | null => {
  if (!/[0-9]/.test(rawDigits)) return null;

  const cleaned = rawDigits
    .replace(/[ODQ]/g, '0')
    .replace(/[IL]/g, '1')
    .replace(/B/g, '8');

  if (!/^[1-9][0-9]{0,3}$/.test(cleaned)) {
    return null;
  }
  return cleaned;
};

/**
 * Normalisasi karakter huruf di blok wilayah/seri belakang.
 * Catatan: Jangan paksa konversi agresif yang merusak huruf L/G/W, hanya 0->O dan 8->B.
 */
const normalizePlateLetters = (rawLetters: string): string => {
  return rawLetters
    .replace(/0/g, 'O')
    .replace(/8/g, 'B');
};

/**
 * Validasi dan bersihkan kode wilayah (mengabaikan gangguan baut di pinggir kiri misal "1BK" -> "BK").
 */
const resolveRegionCode = (rawPrefix: string): string | null => {
  const norm = normalizePlateLetters(rawPrefix).replace(/1/g, 'I');
  if (VALID_INDONESIAN_REGIONS.has(norm)) return norm;

  if (norm.length === 3) {
    const lastTwo = norm.slice(-2);
    if (VALID_INDONESIAN_REGIONS.has(lastTwo)) return lastTwo;
    const firstTwo = norm.slice(0, 2);
    if (VALID_INDONESIAN_REGIONS.has(firstTwo)) return firstTwo;
  }
  return null;
};

/**
 * Validasi kelayakan struktur plat nomor Indonesia hasil ANPR:
 * - Format: [1-2 Huruf Wilayah Resmi] [1-4 Angka] [1-3 Huruf Seri]
 * - Total panjang karakter bersih (tanpa spasi) minimal 5 karakter (contoh: BK 8210 GI = 8 karakter, B 1234 WLG = 8 karakter)
 *   sehingga noise bayangan pendek seperti "E 7 E" (3 karakter) otomatis ditolak 100%.
 */
const validateCandidatePlate = (
  rawWilayah: string,
  rawNomor: string,
  rawSeri: string
): string | null => {
  const wilayah = resolveRegionCode(rawWilayah);
  if (!wilayah) return null;

  const nomor = normalizeMiddleDigits(rawNomor);
  if (!nomor) return null;

  // Untuk seri belakang, hanya ubah '1' menjadi 'I' jika bukan bagian dari huruf utuh
  const seri = normalizePlateLetters(rawSeri).replace(/1/g, 'I');
  if (!/^[A-Z]{1,3}$/.test(seri)) return null;

  const totalCleanLen = wilayah.length + nomor.length + seri.length;
  if (totalCleanLen < 5) return null;

  if (wilayah.length === 1 && seri.length === 1 && nomor.length < 3) {
    return null;
  }

  return `${wilayah} ${nomor} ${seri}`;
};

/**
 * Ekstraksi plat nomor polisi Indonesia dari teks mentah ANPR/OCR.
 * Memprioritaskan pembacaan per baris sehingga baris tanggal pajak ("12 22" / "10 28") di bawah plat otomatis diabaikan.
 */
export const extractIndonesianPlate = (rawText: string): string | null => {
  if (!rawText) return null;

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

  const candidatesToCheck = [...lines, lines.join(' ')];

  for (const line of candidatesToCheck) {
    // 1. Pola dengan spasi (misal "B 1234 WLG", "BK 8210 GI", "BK 8210GI")
    const flexRegex = /(?:^|\s)([A-Z0-9]{1,3})\s+([0-9ODQILB]{1,4})\s*([A-Z0-9]{1,3})(?=\s|$)/g;
    let match: RegExpExecArray | null;
    while ((match = flexRegex.exec(line)) !== null) {
      const valid = validateCandidatePlate(match[1], match[2], match[3]);
      if (valid) return valid;
    }

    // 2. Pola rapat atau terpecah antar token (misal "B1234WLG" atau "BK8210GI")
    const compactTokens = line.split(/\s+/);
    for (let i = 0; i < compactTokens.length; i++) {
      const combos = [
        compactTokens[i],
        i + 1 < compactTokens.length ? `${compactTokens[i]}${compactTokens[i + 1]}` : '',
        i + 2 < compactTokens.length
          ? `${compactTokens[i]}${compactTokens[i + 1]}${compactTokens[i + 2]}`
          : '',
      ].filter((c) => c.length >= 5 && c.length <= 10);

      for (const token of combos) {
        for (const prefixLen of [2, 1, 3]) {
          if (token.length <= prefixLen + 2) continue;
          const rawPrefix = token.slice(0, prefixLen);
          const rest = token.slice(prefixLen);
          const restMatch = rest.match(/^([0-9ODQILB]{1,4})([A-Z0-9]{1,3})$/);
          if (restMatch) {
            const valid = validateCandidatePlate(rawPrefix, restMatch[1], restMatch[2]);
            if (valid) return valid;
          }
        }
      }
    }
  }

  return null;
};

const COUNTDOWN_DURATION_MS = 850;

export const PlateOcrScannerModal: React.FC<PlateOcrScannerModalProps> = ({
  isOpen,
  onClose,
  onDetected,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const nativeDetectorRef = useRef<any>(null);
  const isScanningRef = useRef<boolean>(false);
  const isLockedPreviewRef = useRef<boolean>(false);
  const cropCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const invertCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Penyimpanan konsensus multi-frame: WAJIB terbaca identik minimal 2 frame berturut-turut
  const lastCandidateRef = useRef<{ plate: string; count: number; timestamp: number }>({
    plate: '',
    count: 0,
    timestamp: 0,
  });
  const countdownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoConfirmTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [isWorkerReady, setIsWorkerReady] = useState(false);
  const [workerStatusText, setWorkerStatusText] = useState('Menyiapkan mesin ANPR...');
  const [detectedPlate, setDetectedPlate] = useState<string | null>(null);
  const [candidateHint, setCandidateHint] = useState<string | null>(null);
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

  // 2. Inisialisasi Hardware Native TextDetector + ANPR Worker (PSM.SINGLE_BLOCK)
  useEffect(() => {
    let isCancelled = false;

    const initAnprEngine = async () => {
      try {
        setWorkerStatusText('Mengaktifkan sensor ANPR Plat Nomor...');

        const Win = window as any;
        if (typeof Win.TextDetector === 'function') {
          try {
            nativeDetectorRef.current = new Win.TextDetector();
          } catch {
            nativeDetectorRef.current = null;
          }
        }

        const worker = await createWorker('eng');
        if (isCancelled) {
          await worker.terminate();
          return;
        }

        // Gunakan PSM.SINGLE_BLOCK (6) agar baris utama ("B 1234 WLG") dan baris pajak ("12 22")
        // dipisahkan secara alami tanpa memotong kaki bawah huruf "L"
        await worker.setParameters({
          tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 ',
          tessedit_pageseg_mode: PSM.SINGLE_BLOCK,
        });

        workerRef.current = worker;
        setIsWorkerReady(true);
        setWorkerStatusText('Posisikan plat di dalam kotak — Otomatis Jepret saat fokus');
      } catch (err) {
        console.error('Failed to init ANPR worker:', err);
        if (!isCancelled) {
          setWorkerStatusText('Sensor kamera siap');
          setIsWorkerReady(true);
        }
      }
    };

    if (isOpen) {
      initAnprEngine();
    }

    return () => {
      isCancelled = true;
      clearPreviewTimers();
      if (workerRef.current) {
        workerRef.current.terminate().catch(() => {});
        workerRef.current = null;
      }
      setIsWorkerReady(false);
    };
  }, [isOpen]);

  // 3. Start Camera Hardware dengan Resolusi Tajam & Autofocus Kontinu
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
          width: { ideal: 1920, min: 1280 },
          height: { ideal: 1080, min: 720 },
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
          video: {
            facingMode: { ideal: mode },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });
        streamRef.current = fallbackStream;
        if (videoRef.current) {
          videoRef.current.srcObject = fallbackStream;
          await videoRef.current.play().catch(() => {});
        }
        isScanningRef.current = true;
      } catch (err2) {
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
   * 4. ANPR Stage 1: Full-Height Plate Box Cropping + Natural Contrast Preservation
   *    PENTING:
   *    - Mengambil 100% tinggi kotak panduan (TIDAK memotong 22% bawah) agar kaki horizontal bawah huruf "L"
   *      pada "B 1234 WLG" tidak pernah terpotong menjadi "I" ("WIG").
   *    - Menggunakan kontras lembut (contrast = 20) tanpa clipping ekstrem agar garis horizontal huruf di layar HP
   *      maupun plat asli tetap tebal dan utuh.
   */
  const captureAnprPlateCanvases = (): {
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

    // Ambil penuh area kotak target di layar (82% lebar x 30% tinggi) tanpa memotong bagian bawah huruf
    const boxW = Math.round(visibleW * 0.82);
    const boxH = Math.round(visibleH * 0.30);
    const boxX = Math.round(visibleX + (visibleW - boxW) / 2);
    const boxY = Math.round(visibleY + (visibleH - boxH) / 2);

    const targetW = 840;
    const targetH = Math.max(200, Math.round((boxH / boxW) * targetW));

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

      // Kontras halus (20) agar kaki horizontal huruf 'L', 'E', 'F' tidak menipis/hilang saat scan layar HP atau plat silau
      const contrast = 20;
      const factor = (259 * (contrast + 255)) / (255 * (259 - contrast));

      for (let i = 0; i < d.length; i += 4) {
        const gray = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];

        // Polarity 1: Plat Putih / Plat Kuning (tulisan gelap di atas latar terang)
        const cNorm = Math.max(0, Math.min(255, factor * (gray - 128) + 128));
        d[i] = cNorm;
        d[i + 1] = cNorm;
        d[i + 2] = cNorm;

        // Polarity 2: Plat Hitam seperti "B 1234 WLG" (tulisan putih di atas latar hitam -> dibalik jadi teks hitam di latar putih)
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

  /**
   * Mulai Preview 0.8 Detik dengan Progress Bar sebelum Auto-Jepret final.
   */
  const startPreviewAndAutoSnap = (plate: string, snapshotCanvas: HTMLCanvasElement) => {
    if (isLockedPreviewRef.current) return;
    isLockedPreviewRef.current = true;
    isScanningRef.current = false;
    setCandidateHint(null);

    try {
      setCapturedSnapshot(snapshotCanvas.toDataURL('image/jpeg', 0.9));
    } catch {
      /* ignore */
    }

    setIsShutterFlash(true);
    setTimeout(() => setIsShutterFlash(false), 160);

    setDetectedPlate(plate);
    setCountdownProgress(0);
    navigator.vibrate?.([50, 30, 70]);

    const startTime = Date.now();
    clearPreviewTimers();

    countdownTimerRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const pct = Math.min(100, Math.round((elapsed / COUNTDOWN_DURATION_MS) * 100));
      setCountdownProgress(pct);
    }, 40);

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
    lastCandidateRef.current = { plate: '', count: 0, timestamp: 0 };
    setDetectedPlate(null);
    setCandidateHint(null);
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

  /**
   * Evaluasi kandidat plat dengan Konsensus 2-Frame Wajib:
   * Tidak boleh langsung jepret di frame pertama saat kamera baru mengarah/fokus,
   * melainkan WAJIB terbaca identik minimal 2 frame berturut-turut!
   */
  const registerCandidateHit = (
    plate: string,
    _confidence: number,
    canvas: HTMLCanvasElement
  ): boolean => {
    const now = Date.now();
    const prev = lastCandidateRef.current;

    if (prev.plate === plate && now - prev.timestamp < 2500) {
      const nextCount = prev.count + 1;
      lastCandidateRef.current = { plate, count: nextCount, timestamp: now };
      if (nextCount >= 2) {
        startPreviewAndAutoSnap(plate, canvas);
        return true;
      }
    } else {
      lastCandidateRef.current = { plate, count: 1, timestamp: now };
      setCandidateHint(plate);
    }
    return false;
  };

  // 5. Loop ANPR Kontinu
  useEffect(() => {
    if (!isOpen || !isWorkerReady || manualMode) return;

    let timerId: ReturnType<typeof setTimeout> | null = null;
    let isCancelled = false;

    const processNextFrame = async () => {
      if (isCancelled) return;

      if (
        isLockedPreviewRef.current ||
        !isScanningRef.current ||
        !workerRef.current ||
        !videoRef.current ||
        videoRef.current.readyState < 2
      ) {
        timerId = setTimeout(processNextFrame, 200);
        return;
      }

      const canvases = captureAnprPlateCanvases();
      if (!canvases) {
        timerId = setTimeout(processNextFrame, 200);
        return;
      }

      setIsProcessingFrame(true);

      try {
        // Tahap A: Hardware-Accelerated Native TextDetector (jika didukung browser)
        if (nativeDetectorRef.current) {
          try {
            const blocks = await nativeDetectorRef.current.detect(canvases.normalCanvas);
            if (Array.isArray(blocks) && blocks.length > 0) {
              const joinedNative = blocks.map((b: any) => b.rawValue || '').join('\n');
              const nativePlate = extractIndonesianPlate(joinedNative);
              if (nativePlate && !isLockedPreviewRef.current && !isCancelled) {
                if (registerCandidateHit(nativePlate, 90, canvases.normalCanvas)) {
                  return;
                }
              }
            }
          } catch {
            /* fallback ke worker */
          }
        }

        // Tahap B: Scan Polarity 1 (Plat Putih & Plat Kuning)
        const resNormal = await workerRef.current.recognize(canvases.normalCanvas);
        const textNormal = resNormal?.data?.text || '';
        const confNormal = Number(resNormal?.data?.confidence ?? 0);
        const plateNormal = confNormal >= 55 ? extractIndonesianPlate(textNormal) : null;

        if (plateNormal && !isLockedPreviewRef.current && !isCancelled) {
          if (registerCandidateHit(plateNormal, confNormal, canvases.normalCanvas)) {
            return;
          }
        }

        // Tahap C: Scan Polarity 2 (Plat Hitam tulisan Putih seperti "B 1234 WLG")
        if (!isLockedPreviewRef.current && !isCancelled && workerRef.current) {
          const resInv = await workerRef.current.recognize(canvases.invertedCanvas);
          const textInv = resInv?.data?.text || '';
          const confInv = Number(resInv?.data?.confidence ?? 0);
          const plateInv = confInv >= 55 ? extractIndonesianPlate(textInv) : null;

          if (plateInv && !isLockedPreviewRef.current && !isCancelled) {
            if (registerCandidateHit(plateInv, confInv, canvases.normalCanvas)) {
              return;
            }
          }

          const bestText = (plateNormal || plateInv || textNormal.trim() || textInv.trim()).replace(
            /\s+/g,
            ' '
          );
          if (bestText && bestText.length >= 3) {
            setRawOcrPreview(bestText);
          }
        }
      } catch (err) {
        console.warn('ANPR frame recognition error:', err);
      } finally {
        if (!isCancelled) {
          setIsProcessingFrame(false);
        }
      }

      if (!isCancelled) {
        timerId = setTimeout(processNextFrame, 150);
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
      isLockedPreviewRef.current = false;
      lastCandidateRef.current = { plate: '', count: 0, timestamp: 0 };
      setDetectedPlate(null);
      setCandidateHint(null);
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
      aria-label="Scan Kamera Plat Nomor (ANPR)"
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
                ANPR Scanner Plat Nomor
              </h3>
              <p className="truncate text-[10px] font-semibold text-status-green">
                Deteksi Akurat 2-Frame + Preview 0.8 Detik Otomatis Jepret
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

        {/* Viewport Kamera dengan Overlay Proporsi Plat Nomor Indonesia */}
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

              {/* Bounding Box Proporsi Plat Nomor Indonesia (Lebar 82%, Tinggi 30%) */}
              <div
                className={`pointer-events-none absolute left-1/2 top-1/2 h-[30%] w-[82%] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-2xl border-2 transition-all duration-200 ${
                  detectedPlate
                    ? 'border-status-green bg-black/75 shadow-[0_0_40px_rgba(34,197,94,0.85)] scale-[1.03]'
                    : candidateHint
                    ? 'border-amber-400 bg-amber-500/10 shadow-[0_0_0_9999px_rgba(0,0,0,0.62)]'
                    : 'border-white/85 shadow-[0_0_0_9999px_rgba(0,0,0,0.62)]'
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

                {/* Laser scan line animation (jika belum terdeteksi) */}
                {!detectedPlate && (
                  <div className="absolute inset-x-2 top-0 h-0.5 bg-gradient-to-r from-transparent via-accent to-transparent shadow-[0_0_8px_rgba(234,88,12,0.8)] animate-[scanLaser_1.6s_ease-in-out_infinite]" />
                )}

                {/* Label Status & Preview 0.8 Detik di dalam kotak */}
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

                      {/* Progress Bar Countdown 0.8 Detik */}
                      <div className="h-1.5 w-4/5 overflow-hidden rounded-full bg-white/25">
                        <div
                          className="h-full bg-status-green transition-all duration-75"
                          style={{ width: `${countdownProgress}%` }}
                        />
                      </div>
                      <span className="text-[10px] font-bold tracking-wide text-emerald-300">
                        Otomatis gunakan plat ini...
                      </span>
                    </div>
                  ) : candidateHint ? (
                    <div className="flex flex-col items-center gap-1">
                      <span className="rounded-lg bg-amber-500/90 px-2.5 py-0.5 font-mono text-sm font-black tracking-widest text-black shadow">
                        {candidateHint}
                      </span>
                      <span className="text-[10px] font-bold text-amber-200 drop-shadow">
                        Tahan stabil sebentar — Memastikan akurasi...
                      </span>
                    </div>
                  ) : (
                    <span className="rounded-lg bg-black/50 px-2.5 py-1 font-mono text-[11px] font-bold tracking-wider text-white/95 backdrop-blur-xs">
                      Masukkan Seluruh Plat Nomor ke Dalam Kotak Ini
                    </span>
                  )}
                </div>
              </div>

              {/* Tombol Interaktif Saat Preview 0.8 Detik Muncul */}
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
                      ? `Memverifikasi frame ke-2: ${candidateHint}...`
                      : workerStatusText}
                  </span>
                </div>
                {rawOcrPreview && !detectedPlate && !candidateHint && (
                  <span className="max-w-[85%] truncate rounded-md bg-black/55 px-2 py-0.5 font-mono text-[10px] text-white/75 backdrop-blur-xs">
                    Bacaan sensor: {rawOcrPreview}
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
              <span className="truncate">ANPR Aktif (Verifikasi 2-Frame + Auto Jepret)</span>
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

      {/* Style laser animation */}
      <style>{`
        @keyframes scanLaser {
          0% { top: 8%; opacity: 0.25; }
          50% { top: 88%; opacity: 1; }
          100% { top: 8%; opacity: 0.25; }
        }
      `}</style>
    </div>,
    document.body
  );
};
