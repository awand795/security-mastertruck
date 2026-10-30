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
import * as ort from 'onnxruntime-web/wasm';

// Konfigurasi lokasi file WebAssembly ONNX Runtime di folder public/models/
ort.env.wasm.wasmPaths = '/models/';
ort.env.wasm.numThreads = 1;

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

// Cache session ONNX di memori + Persistent Browser CacheStorage agar buka pertama maupun berikutnya instan!
let cachedDetSession: ort.InferenceSession | null = null;
let cachedRecSession: ort.InferenceSession | null = null;
let sessionLoadPromise: Promise<{
  det: ort.InferenceSession;
  rec: ort.InferenceSession;
}> | null = null;

const MODEL_CACHE_NAME = 'kim3-anpr-models-v1';

const fetchCachedModelBuffer = async (url: string): Promise<Uint8Array> => {
  if (typeof window !== 'undefined' && 'caches' in window) {
    try {
      const cache = await window.caches.open(MODEL_CACHE_NAME);
      let response = await cache.match(url);
      if (!response) {
        response = await fetch(url, { cache: 'force-cache' });
        if (response.ok) {
          await cache.put(url, response.clone());
        }
      }
      if (response && response.ok) {
        const buf = await response.arrayBuffer();
        return new Uint8Array(buf);
      }
    } catch {
      /* fallback ke fetch biasa */
    }
  }
  const fallbackRes = await fetch(url, { cache: 'force-cache' });
  const buf = await fallbackRes.arrayBuffer();
  return new Uint8Array(buf);
};

export const ensureAnprSessions = async () => {
  if (cachedDetSession && cachedRecSession) {
    return { det: cachedDetSession, rec: cachedRecSession };
  }
  if (!sessionLoadPromise) {
    sessionLoadPromise = (async () => {
      const [detBuf, recBuf] = await Promise.all([
        fetchCachedModelBuffer('/models/plate_det_yolov8n.onnx'),
        fetchCachedModelBuffer('/models/plate_rec_svtr.onnx'),
      ]);
      const [det, rec] = await Promise.all([
        ort.InferenceSession.create(detBuf, {
          executionProviders: ['wasm'],
        }),
        ort.InferenceSession.create(recBuf, {
          executionProviders: ['wasm'],
        }),
      ]);
      cachedDetSession = det;
      cachedRecSession = rec;
      return { det, rec };
    })().catch((err) => {
      sessionLoadPromise = null;
      throw err;
    });
  }
  return sessionLoadPromise;
};

// Preload otomatis di background begitu halaman Pos Security dibuka (sebelum tombol kamera diklik)
if (typeof window !== 'undefined') {
  setTimeout(() => {
    ensureAnprSessions().catch(() => {});
  }, 300);
}

/**
 * Kamus karakter model SVTR26-Tiny (CTC index 0 = blank, 1..37 = 0-9 & A-Z)
 */
const SVTR_CHARS = [
  'blank',
  '0', '1', '2', '3', '4', '5', '6', '7', '8', '9',
  'A', 'B', 'C', 'D', 'D', 'E', 'F', 'G', 'H', 'I',
  'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S',
  'T', 'U', 'V', 'W', 'X', 'Y', 'Z',
];

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
 * Parser cerdas plat nomor Indonesia dari output CTC SVTR26-Tiny (contoh: "BI234WLG" -> "B 1234 WLG", "BK8210GI" -> "BK 8210 GI").
 */
export const extractIndonesianPlate = (rawText: string): string | null => {
  if (!rawText) return null;

  const clean = rawText.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (clean.length < 4 || clean.length > 10) return null;

  // Coba dengan berbagai offset awal (0 atau 1 jika ada noise baut di depan)
  for (const startOffset of [0, 1]) {
    const sub = clean.slice(startOffset);
    if (sub.length < 4) continue;

    // Prioritaskan kode wilayah 2 huruf (BK, BB, BL, BM, dll.) lalu 1 huruf (B, D, F, L, dll.)
    for (const prefixLen of [2, 1]) {
      if (sub.length <= prefixLen + 1) continue;
      const rawPrefix = sub.slice(0, prefixLen);
      if (!VALID_INDONESIAN_REGIONS.has(rawPrefix)) continue;

      const rest = sub.slice(prefixLen);
      // Blok tengah: 1-4 angka (termasuk 'I'->'1', 'O'/'D'/'Q'->'0', 'B'->'8' jika menempel pada angka)
      // Blok akhir: 1-3 huruf seri (termasuk '0'->'O', '1'->'I', '8'->'B')
      const match = rest.match(/^([0-9OIBDQ]{1,4})([A-Z018]{1,3})/);
      if (!match) continue;

      const rawDigits = match[1];
      const rawSuffix = match[2];

      const digits = rawDigits
        .replace(/[ODQ]/g, '0')
        .replace(/I/g, '1')
        .replace(/B/g, '8');

      // Wajib memiliki setidaknya 1 digit angka asli atau panjang >= 2 digit dan tidak diawali 0
      if (!/^[1-9][0-9]{0,3}$/.test(digits)) continue;

      const suffix = rawSuffix
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
const mergeSimilarPlates = (plateA: string, plateB: string): string | null => {
  if (plateA === plateB) return plateA;

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
    } else if ((ca === 'G' && cb === 'C') || (ca === 'C' && cb === 'G')) {
      mergedSeri += 'G';
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

/**
 * Decode output tensor SVTR26-Tiny [1, 32, 38] menggunakan algoritma CTC Greedy + Softmax Probability
 */
const decodeSvtrCtcOutput = (logits: Float32Array): { text: string; confidence: number } => {
  const timeSteps = 32;
  const numClasses = 38;
  let text = '';
  let prevIdx = 0;
  const charProbs: number[] = [];

  for (let t = 0; t < timeSteps; t++) {
    const offset = t * numClasses;
    let maxLogit = -1e9;
    let maxIdx = 0;

    for (let c = 0; c < numClasses; c++) {
      const val = logits[offset + c];
      if (val > maxLogit) {
        maxLogit = val;
        maxIdx = c;
      }
    }

    if (maxIdx !== 0 && maxIdx !== prevIdx) {
      // Hitung softmax probability untuk karakter terpilih
      let sumExp = 0;
      for (let c = 0; c < numClasses; c++) {
        sumExp += Math.exp(logits[offset + c] - maxLogit);
      }
      const prob = 1 / sumExp;
      text += SVTR_CHARS[maxIdx] || '';
      charProbs.push(prob);
    }
    prevIdx = maxIdx;
  }

  const avgConf =
    charProbs.length > 0
      ? charProbs.reduce((acc, v) => acc + v, 0) / charProbs.length
      : 0;

  return { text, confidence: avgConf };
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

  const detCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const recCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const snapCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const recentCandidatesRef = useRef<Array<{ plate: string; confidence: number; time: number }>>([]);
  const countdownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoConfirmTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [isModelReady, setIsModelReady] = useState(false);
  const [statusText, setStatusText] = useState('Memuat model AI YOLOv8-Plate + SVTR...');
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

  // 2. Load Model Deep Learning ANPR (YOLOv8n-Efficient + SVTR26-Tiny)
  useEffect(() => {
    let isCancelled = false;

    if (isOpen) {
      setStatusText('Memuat model AI YOLOv8-Plate + SVTR...');
      ensureAnprSessions()
        .then(() => {
          if (!isCancelled) {
            setIsModelReady(true);
            setStatusText('AI ANPR Aktif — Arahkan ke plat nomor (jauh/dekat otomatis terdeteksi)');
          }
        })
        .catch((err) => {
          console.error('Failed to load ONNX ANPR models:', err);
          if (!isCancelled) {
            setStatusText('Gagal memuat model AI, gunakan tombol Manual');
          }
        });
    }

    return () => {
      isCancelled = true;
      clearPreviewTimers();
    };
  }, [isOpen]);

  // 3. Start Camera Hardware
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
   * 4. Jalankan YOLOv8n-Efficient (416x416) untuk mencari koordinat kotak plat nomor di seluruh layar kamera
   */
  const detectPlateBoxWithYolo = async (
    video: HTMLVideoElement,
    visibleX: number,
    visibleY: number,
    visibleW: number,
    visibleH: number
  ): Promise<{
    cropX: number;
    cropY: number;
    cropW: number;
    cropH: number;
    conf: number;
    boxNorm: DetectedBoxNormalized;
  } | null> => {
    if (!cachedDetSession) return null;

    if (!detCanvasRef.current) {
      detCanvasRef.current = document.createElement('canvas');
    }
    const canvas = detCanvasRef.current;
    const size = 416;
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;

    // Letterbox resize area visible video ke 416x416
    const scale = Math.min(size / visibleW, size / visibleH);
    const nw = Math.round(visibleW * scale);
    const nh = Math.round(visibleH * scale);
    const padX = Math.floor((size - nw) / 2);
    const padY = Math.floor((size - nh) / 2);

    ctx.fillStyle = 'rgb(114, 114, 114)';
    ctx.fillRect(0, 0, size, size);
    ctx.drawImage(video, visibleX, visibleY, visibleW, visibleH, padX, padY, nw, nh);

    const imgData = ctx.getImageData(0, 0, size, size).data;
    const floatData = new Float32Array(3 * size * size);
    const planeSize = size * size;

    for (let i = 0; i < planeSize; i++) {
      const idx = i * 4;
      floatData[i] = imgData[idx] / 255.0; // R
      floatData[planeSize + i] = imgData[idx + 1] / 255.0; // G
      floatData[2 * planeSize + i] = imgData[idx + 2] / 255.0; // B
    }

    const inputTensor = new ort.Tensor('float32', floatData, [1, 3, size, size]);
    const outMap = await cachedDetSession.run({ images: inputTensor });
    const outData = outMap.output0.data as Float32Array;
    const numAnchors = 3549;

    let bestConf = 0;
    let bestAnchor = -1;

    for (let i = 0; i < numAnchors; i++) {
      const conf = outData[4 * numAnchors + i];
      if (conf > bestConf) {
        bestConf = conf;
        bestAnchor = i;
      }
    }

    if (bestAnchor < 0 || bestConf < 0.22) {
      return null;
    }

    const cx = outData[0 * numAnchors + bestAnchor];
    const cy = outData[1 * numAnchors + bestAnchor];
    const w = outData[2 * numAnchors + bestAnchor];
    const h = outData[3 * numAnchors + bestAnchor];

    // Konversi kembali ke koordinat di dalam area visible video
    const relX1 = Math.max(0, (cx - w / 2 - padX) / scale);
    const relY1 = Math.max(0, (cy - h / 2 - padY) / scale);
    const relX2 = Math.min(visibleW, (cx + w / 2 - padX) / scale);
    const relY2 = Math.min(visibleH, (cy + h / 2 - padY) / scale);

    const cropW = Math.round(relX2 - relX1);
    const cropH = Math.round(relY2 - relY1);
    if (cropW < 24 || cropH < 10) return null;

    const cropX = Math.round(visibleX + relX1);
    const cropY = Math.round(visibleY + relY1);

    return {
      cropX,
      cropY,
      cropW,
      cropH,
      conf: bestConf,
      boxNorm: {
        leftPct: Math.max(2, Math.min(95, (relX1 / visibleW) * 100)),
        topPct: Math.max(2, Math.min(95, (relY1 / visibleH) * 100)),
        widthPct: Math.max(8, Math.min(96, (cropW / visibleW) * 100)),
        heightPct: Math.max(5, Math.min(80, (cropH / visibleH) * 100)),
        conf: bestConf,
      },
    };
  };

  /**
   * 5. Jalankan SVTR26-Tiny (128x32) untuk membaca karakter di dalam kotak plat yang ditemukan YOLOv8
   */
  const recognizePlateCropWithSvtr = async (
    video: HTMLVideoElement,
    cropX: number,
    cropY: number,
    cropW: number,
    cropH: number
  ): Promise<{ rawText: string; plate: string | null; confidence: number; snapshotUrl: string }> => {
    if (!cachedRecSession) {
      return { rawText: '', plate: null, confidence: 0, snapshotUrl: '' };
    }

    if (!recCanvasRef.current) {
      recCanvasRef.current = document.createElement('canvas');
    }
    if (!snapCanvasRef.current) {
      snapCanvasRef.current = document.createElement('canvas');
    }

    // Simpan snapshot tajam untuk preview
    const snapCanvas = snapCanvasRef.current;
    snapCanvas.width = Math.max(240, cropW);
    snapCanvas.height = Math.max(80, cropH);
    const snapCtx = snapCanvas.getContext('2d');
    let snapshotUrl = '';
    if (snapCtx) {
      snapCtx.drawImage(video, cropX, cropY, cropW, cropH, 0, 0, snapCanvas.width, snapCanvas.height);
      try {
        snapshotUrl = snapCanvas.toDataURL('image/jpeg', 0.9);
      } catch {
        /* ignore */
      }
    }

    const recW = 128;
    const recH = 32;
    const recCanvas = recCanvasRef.current;
    recCanvas.width = recW;
    recCanvas.height = recH;
    const recCtx = recCanvas.getContext('2d', { willReadFrequently: true });
    if (!recCtx) {
      return { rawText: '', plate: null, confidence: 0, snapshotUrl };
    }

    // Coba baca tinggi penuh (1.0) dan tinggi fokus baris utama (0.85 tanpa baris pajak)
    for (const hRatio of [1.0, 0.85]) {
      const effectiveH = Math.max(10, Math.round(cropH * hRatio));
      recCtx.drawImage(video, cropX, cropY, cropW, effectiveH, 0, 0, recW, recH);

      const imgData = recCtx.getImageData(0, 0, recW, recH).data;
      const planeSize = recW * recH;
      const floatData = new Float32Array(3 * planeSize);

      for (let i = 0; i < planeSize; i++) {
        const idx = i * 4;
        floatData[i] = (imgData[idx] / 255.0 - 0.5) / 0.5; // R
        floatData[planeSize + i] = (imgData[idx + 1] / 255.0 - 0.5) / 0.5; // G
        floatData[2 * planeSize + i] = (imgData[idx + 2] / 255.0 - 0.5) / 0.5; // B
      }

      const inputTensor = new ort.Tensor('float32', floatData, [1, 3, recH, recW]);
      const outMap = await cachedRecSession.run({ input: inputTensor });
      const logits = outMap.output.data as Float32Array;

      const { text, confidence } = decodeSvtrCtcOutput(logits);
      const parsedPlate = extractIndonesianPlate(text);
      if (parsedPlate) {
        return {
          rawText: text,
          plate: parsedPlate,
          confidence,
          snapshotUrl,
        };
      }
      if (hRatio === 1.0 && text) {
        setRawOcrPreview(text);
      }
    }

    return { rawText: '', plate: null, confidence: 0, snapshotUrl };
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

  /**
   * Evaluasi hasil bacaan SVTR26:
   * - Jika confidence tinggi (>= 0.82) dari deteksi kotak YOLOv8, langsung kunci!
   * - Atau jika cocok/mirip dengan bacaan sebelumnya dalam 3.5 detik terakhir, langsung kunci!
   */
  const registerCandidateHit = (
    plate: string,
    confidence: number,
    isFromYoloBox: boolean,
    snapshotUrl: string
  ): boolean => {
    const now = Date.now();
    const recent = recentCandidatesRef.current.filter((item) => now - item.time < 3500);

    // 1. Jika ditemukan langsung oleh YOLOv8-Plate Detector dengan confidence SVTR tinggi (>= 0.84), langsung jepret!
    if (isFromYoloBox && confidence >= 0.84) {
      recentCandidatesRef.current = [];
      startPreviewAndAutoSnap(plate, snapshotUrl);
      return true;
    }

    // 2. Cek apakah cocok atau beda tipis 'L' vs 'I' dengan frame sebelumnya
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

  // 6. Loop Real-Time YOLOv8 + SVTR26 ANPR
  useEffect(() => {
    if (!isOpen || !isModelReady || manualMode) return;

    let timerId: ReturnType<typeof setTimeout> | null = null;
    let isCancelled = false;

    const processNextFrame = async () => {
      if (isCancelled) return;

      const video = videoRef.current;
      if (
        isLockedPreviewRef.current ||
        !isScanningRef.current ||
        !cachedDetSession ||
        !cachedRecSession ||
        !video ||
        video.readyState < 2 ||
        !video.videoWidth ||
        !video.videoHeight
      ) {
        timerId = setTimeout(processNextFrame, 120);
        return;
      }

      setIsProcessingFrame(true);

      try {
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

        // Tahap 1: Cari kotak plat nomor dengan YOLOv8n-Efficient
        const detected = await detectPlateBoxWithYolo(
          video,
          visibleX,
          visibleY,
          visibleW,
          visibleH
        );

        if (detected && !isCancelled && !isLockedPreviewRef.current) {
          setTrackedBox(detected.boxNorm);

          // Tahap 2: Baca isi kotak plat yang ditemukan YOLOv8 menggunakan SVTR26-Tiny
          const recResult = await recognizePlateCropWithSvtr(
            video,
            detected.cropX,
            detected.cropY,
            detected.cropW,
            detected.cropH
          );

          if (recResult.plate && !isCancelled && !isLockedPreviewRef.current) {
            if (
              registerCandidateHit(
                recResult.plate,
                recResult.confidence,
                true,
                recResult.snapshotUrl
              )
            ) {
              return;
            }
          }
        } else if (!isCancelled && !isLockedPreviewRef.current) {
          setTrackedBox(null);

          // Fallback jika plat didekatkan sangat dekat memenuhi kotak tengah
          const fallbackW = Math.round(visibleW * 0.78);
          const fallbackH = Math.round(visibleH * 0.26);
          const fallbackX = Math.round(visibleX + (visibleW - fallbackW) / 2);
          const fallbackY = Math.round(visibleY + (visibleH - fallbackH) / 2);

          const recFallback = await recognizePlateCropWithSvtr(
            video,
            fallbackX,
            fallbackY,
            fallbackW,
            fallbackH
          );

          if (recFallback.plate && !isCancelled && !isLockedPreviewRef.current) {
            if (
              registerCandidateHit(
                recFallback.plate,
                recFallback.confidence,
                false,
                recFallback.snapshotUrl
              )
            ) {
              return;
            }
          }
        }
      } catch (err) {
        console.warn('ANPR ONNX inference error:', err);
      } finally {
        if (!isCancelled) {
          setIsProcessingFrame(false);
        }
      }

      if (!isCancelled) {
        timerId = setTimeout(processNextFrame, 60);
      }
    };

    timerId = setTimeout(processNextFrame, 100);

    return () => {
      isCancelled = true;
      if (timerId) clearTimeout(timerId);
    };
  }, [isOpen, isModelReady, manualMode]);

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
                AI ANPR Scanner (YOLOv8 + SVTR)
              </h3>
              <p className="truncate text-[10px] font-semibold text-status-green">
                Deteksi Otomatis Kotak Plat Nomor (Jauh / Dekat)
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
                    className="absolute inset-0 h-full w-full object-contain opacity-35"
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
                      : statusText}
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
              <span className="truncate">YOLOv8 + SVTR AI ANPR Aktif</span>
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
