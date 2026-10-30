import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import ort from 'onnxruntime-node';
import jpeg from 'jpeg-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DIST_DIR = path.resolve(__dirname, '../dist');
const DET_MODEL_PATH = path.resolve(__dirname, './models/plate_det_yolov8n.onnx');
const ID_REC_MODEL_PATH = path.resolve(__dirname, './models/id_plate_rec_yolo11n.onnx');
const SVTR_REC_MODEL_PATH = path.resolve(__dirname, './models/plate_rec_svtr.onnx');

const PORT = Number(process.env.PORT || 80);
const API_BACKEND_HOST = '94.237.69.119';
const API_BACKEND_PORT = 8081;

const YOLO_CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

const SVTR_CHARS = [
  'blank',
  '0', '1', '2', '3', '4', '5', '6', '7', '8', '9',
  'A', 'B', 'C', 'D', 'D', 'E', 'F', 'G', 'H', 'I',
  'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S',
  'T', 'U', 'V', 'W', 'X', 'Y', 'Z',
];

const VALID_INDONESIAN_REGIONS = new Set([
  'BK', 'BB', 'BL', 'BM', 'BA', 'BP', 'BG', 'BN', 'BD', 'BE', 'BH',
  'A', 'B', 'D', 'E', 'F', 'T', 'Z', 'G', 'H', 'K', 'R', 'AA', 'AB', 'AD',
  'L', 'M', 'N', 'P', 'S', 'W', 'AE', 'AG',
  'DK', 'DR', 'EA', 'DH', 'EB', 'ED',
  'KB', 'KH', 'DA', 'KT', 'KU',
  'DB', 'DL', 'DM', 'DN', 'DT', 'DD', 'DC', 'DP', 'DW', 'DE', 'DG', 'PA', 'PB',
]);

export function parseIndonesianPlateDetails(rawText) {
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

      return {
        plate: `${rawPrefix} ${digits} ${suffix}`,
        charCount: totalLen,
        digitCount: digits.length,
        prefixLen: rawPrefix.length,
        suffixLen: suffix.length,
      };
    }
  }
  return null;
}

export function extractIndonesianPlate(rawText) {
  const res = parseIndonesianPlateDetails(rawText);
  return res ? res.plate : null;
}

function iou(a, b) {
  const xx1 = Math.max(a.x1, b.x1);
  const yy1 = Math.max(a.y1, b.y1);
  const xx2 = Math.min(a.x2, b.x2);
  const yy2 = Math.min(a.y2, b.y2);
  const w = Math.max(0, xx2 - xx1);
  const h = Math.max(0, yy2 - yy1);
  const inter = w * h;
  const areaA = (a.x2 - a.x1) * (a.y2 - a.y1);
  const areaB = (b.x2 - b.x1) * (b.y2 - b.y1);
  return inter / (areaA + areaB - inter + 1e-6);
}

function decodeSvtrCtcOutput(logits) {
  const timeSteps = 32;
  const numClasses = 38;
  let text = '';
  let prevIdx = 0;
  const charProbs = [];

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
      text += SVTR_CHARS[maxIdx] || '';
      charProbs.push(maxLogit);
    }
    prevIdx = maxIdx;
  }

  const avgConf =
    charProbs.length > 0
      ? charProbs.reduce((acc, v) => acc + v, 0) / charProbs.length
      : 0;

  return { text, confidence: avgConf };
}

let detSession = null;
let idRecSession = null;
let svtrRecSession = null;

async function initModels() {
  const t0 = Date.now();
  console.log('[ANPR Server] Loading YOLOv8n-Plate + Indonesian YOLO11n-OCR + SVTR26 into C++ Native ONNX Runtime...');
  [detSession, idRecSession, svtrRecSession] = await Promise.all([
    ort.InferenceSession.create(DET_MODEL_PATH),
    ort.InferenceSession.create(ID_REC_MODEL_PATH),
    ort.InferenceSession.create(SVTR_REC_MODEL_PATH),
  ]);

  // Warmup 1x agar request pertama dari kamera langsung cepat (<90ms)
  const dummyDet = new ort.Tensor('float32', new Float32Array(3 * 416 * 416), [1, 3, 416, 416]);
  const dummyIdRec = new ort.Tensor('float32', new Float32Array(3 * 640 * 640), [1, 3, 640, 640]);
  const dummySvtrRec = new ort.Tensor('float32', new Float32Array(3 * 32 * 128), [1, 3, 32, 128]);
  await detSession.run({ images: dummyDet });
  await idRecSession.run({ images: dummyIdRec });
  await svtrRecSession.run({ input: dummySvtrRec });

  const rssMb = Math.round(process.memoryUsage().rss / 1024 / 1024);
  console.log(`[ANPR Server] Ensemble Models Ready & Warmed Up in ${Date.now() - t0}ms (RAM RSS: ${rssMb} MB)`);
}

/**
 * Recognizer 1: Indonesian-Trained YOLO11n Character Detector (640x640)
 * Sangat akurat untuk font plat Indonesia (Plat Putih Korlantas termasuk huruf O bergaris tengah Ø,
 * Plat Kuning Truk, dan Plat Hitam), serta otomatis mengabaikan baris pajak (09.27) di bawah.
 */
async function recognizeWithIndonesianYolo11(rgba, W, H, x1, y1, cropW, cropH) {
  const rSize = 640;
  const rScale = Math.min(rSize / cropW, rSize / cropH);
  const rnw = Math.round(cropW * rScale);
  const rnh = Math.round(cropH * rScale);
  const rPadX = Math.floor((rSize - rnw) / 2);
  const rPadY = Math.floor((rSize - rnh) / 2);
  const planeSize = rSize * rSize;
  const inputRec = new Float32Array(3 * planeSize).fill(114 / 255.0);

  for (let y = 0; y < rnh; y++) {
    const sy = Math.min(H - 1, Math.max(0, y1 + Math.floor(y / rScale)));
    const dy = y + rPadY;
    for (let x = 0; x < rnw; x++) {
      const sx = Math.min(W - 1, Math.max(0, x1 + Math.floor(x / rScale)));
      const dx = x + rPadX;
      const idx = (sy * W + sx) * 4;
      const p = dy * rSize + dx;
      inputRec[p] = rgba[idx] / 255.0;
      inputRec[planeSize + p] = rgba[idx + 1] / 255.0;
      inputRec[2 * planeSize + p] = rgba[idx + 2] / 255.0;
    }
  }

  const rRes = await idRecSession.run({
    images: new ort.Tensor('float32', inputRec, [1, 3, rSize, rSize]),
  });
  const rOut = rRes.output0.data;
  const nAnchors = 8400;
  const boxes = [];

  for (let i = 0; i < nAnchors; i++) {
    let maxC = 0;
    let maxCls = -1;
    for (let c = 0; c < 36; c++) {
      const sc = rOut[(4 + c) * nAnchors + i];
      if (sc > maxC) {
        maxC = sc;
        maxCls = c;
      }
    }
    if (maxC >= 0.30) {
      const bx = rOut[i];
      const by = rOut[nAnchors + i];
      const bw = rOut[2 * nAnchors + i];
      const bh = rOut[3 * nAnchors + i];
      boxes.push({
        cx: bx,
        cy: by,
        w: bw,
        h: bh,
        x1: bx - bw / 2,
        y1: by - bh / 2,
        x2: bx + bw / 2,
        y2: by + bh / 2,
        conf: maxC,
        ch: YOLO_CHARS[maxCls],
      });
    }
  }

  boxes.sort((a, b) => b.conf - a.conf);
  const kept = [];
  for (const b of boxes) {
    if (!kept.some((k) => iou(k, b) > 0.45)) kept.push(b);
  }

  if (kept.length === 0) return null;

  // Filter hanya karakter baris utama (abaikan angka bulan-tahun 09•27 yang ukurannya lebih kecil di bawah)
  const maxH = Math.max(...kept.map((k) => k.h));
  const main = kept.filter((k) => k.h >= maxH * 0.55).sort((a, b) => a.cx - b.cx);
  if (main.length === 0) return null;

  const rawText = main.map((k) => k.ch).join('');
  const minConf = Math.min(...main.map((k) => k.conf));
  const avgConf = main.reduce((acc, k) => acc + k.conf, 0) / main.length;
  const parsed = parseIndonesianPlateDetails(rawText);
  if (!parsed) {
    return { rawText, plate: null, confidence: avgConf, minConf, score: 0 };
  }

  const idBonus = minConf >= 0.55 ? 0.25 : minConf >= 0.45 ? 0.10 : -0.15;
  return {
    source: 'yolo11-id',
    rawText,
    plate: parsed.plate,
    confidence: avgConf,
    minConf,
    charCount: parsed.charCount,
    digitCount: parsed.digitCount,
    score: avgConf + idBonus + parsed.charCount * 0.08,
  };
}

/**
 * Recognizer 2: SVTR26-Tiny (128x32) dengan Multi-Band Crop (1.0 & 0.72)
 * Sangat kuat untuk plat yang jauh/resolusi kecil (seperti B 1234 WLG).
 */
async function recognizeWithSvtrMultiBand(rgba, W, H, x1, y1, cropW, cropH) {
  const recW = 128;
  const recH = 32;
  const planeSize = recW * recH;
  const inputRec = new Float32Array(3 * planeSize);
  const candidates = [];
  let fallbackRaw = '';

  for (const hRatio of [1.0, 0.72]) {
    const bh = Math.max(8, Math.round(cropH * hRatio));
    for (let y = 0; y < recH; y++) {
      const sy = Math.min(H - 1, Math.max(0, y1 + Math.floor(((y + 0.5) / recH) * bh)));
      for (let x = 0; x < recW; x++) {
        const sx = Math.min(W - 1, Math.max(0, x1 + Math.floor(((x + 0.5) / recW) * cropW)));
        const idx = (sy * W + sx) * 4;
        const p = y * recW + x;
        inputRec[p] = (rgba[idx] / 255.0 - 0.5) / 0.5;
        inputRec[planeSize + p] = (rgba[idx + 1] / 255.0 - 0.5) / 0.5;
        inputRec[2 * planeSize + p] = (rgba[idx + 2] / 255.0 - 0.5) / 0.5;
      }
    }

    const recRes = await svtrRecSession.run({
      input: new ort.Tensor('float32', inputRec, [1, 3, recH, recW]),
    });
    const logits = recRes.output.data;
    const { text, confidence } = decodeSvtrCtcOutput(logits);
    if (!fallbackRaw && text) fallbackRaw = text;

    const parsed = parseIndonesianPlateDetails(text);
    if (parsed) {
      candidates.push({
        source: `svtr-${hRatio}`,
        rawText: text,
        plate: parsed.plate,
        confidence,
        charCount: parsed.charCount,
        digitCount: parsed.digitCount,
        score: confidence + parsed.charCount * 0.08,
      });
    }
  }

  candidates.sort((a, b) => b.score - a.score);
  return candidates[0] || { rawText: fallbackRaw, plate: null, confidence: 0, score: 0 };
}

async function recognizeEnsemble(rgba, W, H, x1Tight, y1Tight, cropWTight, cropHTight) {
  // Tambahkan 5% margin untuk YOLO11-ID agar huruf paling kiri/kanan tidak pernah terpotong
  const padX = Math.round(cropWTight * 0.05);
  const padY = Math.round(cropHTight * 0.05);
  const x1Pad = Math.max(0, x1Tight - padX);
  const y1Pad = Math.max(0, y1Tight - padY);
  const x2Pad = Math.min(W, x1Tight + cropWTight + padX);
  const y2Pad = Math.min(H, y1Tight + cropHTight + padY);

  const [idRes, svtrRes] = await Promise.all([
    recognizeWithIndonesianYolo11(rgba, W, H, x1Pad, y1Pad, x2Pad - x1Pad, y2Pad - y1Pad),
    recognizeWithSvtrMultiBand(rgba, W, H, x1Tight, y1Tight, cropWTight, cropHTight),
  ]);

  const valid = [];
  if (idRes && idRes.plate) valid.push(idRes);
  if (svtrRes && svtrRes.plate) valid.push(svtrRes);

  if (valid.length > 0) {
    valid.sort((a, b) => b.score - a.score);
    return valid[0];
  }

  return {
    rawText: idRes?.rawText || svtrRes?.rawText || '',
    plate: null,
    confidence: 0,
  };
}

async function runAnprOnJpegBuffer(jpgBuffer) {
  const decoded = jpeg.decode(jpgBuffer, { useTArray: true });
  const W = decoded.width;
  const H = decoded.height;
  const rgba = decoded.data;

  // 1. Letterbox 416x416 untuk YOLOv8n-Plate Detector
  const size = 416;
  const scale = Math.min(size / W, size / H);
  const nw = Math.round(W * scale);
  const nh = Math.round(H * scale);
  const padX = Math.floor((size - nw) / 2);
  const padY = Math.floor((size - nh) / 2);

  const planeSize = size * size;
  const inputDet = new Float32Array(3 * planeSize).fill(114 / 255.0);

  for (let y = 0; y < nh; y++) {
    const sy = Math.min(H - 1, Math.floor(y / scale));
    const dy = y + padY;
    for (let x = 0; x < nw; x++) {
      const sx = Math.min(W - 1, Math.floor(x / scale));
      const dx = x + padX;
      const idx = (sy * W + sx) * 4;
      const p = dy * size + dx;
      inputDet[p] = rgba[idx] / 255.0;
      inputDet[planeSize + p] = rgba[idx + 1] / 255.0;
      inputDet[2 * planeSize + p] = rgba[idx + 2] / 255.0;
    }
  }

  const detRes = await detSession.run({
    images: new ort.Tensor('float32', inputDet, [1, 3, size, size]),
  });
  const detOut = detRes.output0.data;
  const numAnchors = 3549;

  let bestConf = 0;
  let bestAnchor = -1;
  for (let i = 0; i < numAnchors; i++) {
    const conf = detOut[4 * numAnchors + i];
    if (conf > bestConf) {
      bestConf = conf;
      bestAnchor = i;
    }
  }

  if (bestAnchor >= 0 && bestConf >= 0.20) {
    const cx = detOut[0 * numAnchors + bestAnchor];
    const cy = detOut[1 * numAnchors + bestAnchor];
    const w = detOut[2 * numAnchors + bestAnchor];
    const h = detOut[3 * numAnchors + bestAnchor];

    const x1 = Math.max(0, Math.round((cx - w / 2 - padX) / scale));
    const y1 = Math.max(0, Math.round((cy - h / 2 - padY) / scale));
    const x2 = Math.min(W, Math.round((cx + w / 2 - padX) / scale));
    const y2 = Math.min(H, Math.round((cy + h / 2 - padY) / scale));
    const cropW = x2 - x1;
    const cropH = y2 - y1;

    if (cropW >= 24 && cropH >= 10) {
      const boxNorm = {
        leftPct: Math.max(2, Math.min(95, (x1 / W) * 100)),
        topPct: Math.max(2, Math.min(95, (y1 / H) * 100)),
        widthPct: Math.max(8, Math.min(96, (cropW / W) * 100)),
        heightPct: Math.max(5, Math.min(80, (cropH / H) * 100)),
        conf: bestConf,
      };

      const rec = await recognizeEnsemble(rgba, W, H, x1, y1, cropW, cropH);
      return {
        plate: rec.plate,
        rawText: rec.rawText,
        confidence: rec.confidence,
        source: rec.source || null,
        isFromYoloBox: true,
        box: boxNorm,
      };
    }
  }

  // Fallback jika plat didekatkan sangat dekat memenuhi kotak tengah
  const fbW = Math.round(W * 0.78);
  const fbH = Math.round(H * 0.34);
  const fbX = Math.round((W - fbW) / 2);
  const fbY = Math.round((H - fbH) / 2);
  const recFb = await recognizeEnsemble(rgba, W, H, fbX, fbY, fbW, fbH);

  return {
    plate: recFb.plate,
    rawText: recFb.rawText,
    confidence: recFb.confidence,
    source: recFb.source || null,
    isFromYoloBox: false,
    box: null,
  };
}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

function serveStaticFile(req, res) {
  const urlPath = req.url.split('?')[0];
  let filePath = path.join(DIST_DIR, urlPath === '/' ? 'index.html' : urlPath);

  if (!filePath.startsWith(DIST_DIR)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(DIST_DIR, 'index.html');
  }

  try {
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    const isHtml = ext === '.html';
    const raw = fs.readFileSync(filePath);

    const headers = {
      'Content-Type': contentType,
      'Cache-Control': isHtml ? 'no-cache' : 'public, max-age=31536000, immutable',
    };

    const acceptEncoding = req.headers['accept-encoding'] || '';
    if (
      acceptEncoding.includes('gzip') &&
      (ext === '.js' || ext === '.css' || ext === '.html' || ext === '.svg')
    ) {
      headers['Content-Encoding'] = 'gzip';
      res.writeHead(200, headers);
      res.end(zlib.gzipSync(raw));
      return;
    }

    res.writeHead(200, headers);
    res.end(raw);
  } catch (err) {
    res.writeHead(500);
    res.end('Internal Server Error');
  }
}

function proxyApiRequest(req, res) {
  const options = {
    hostname: API_BACKEND_HOST,
    port: API_BACKEND_PORT,
    path: req.url,
    method: req.method,
    headers: {
      ...req.headers,
      host: `${API_BACKEND_HOST}:${API_BACKEND_PORT}`,
    },
  };

  const proxyReq = http.request(options, (proxyRes) => {
    res.writeHead(proxyRes.statusCode || 502, proxyRes.headers);
    proxyRes.pipe(res, { end: true });
  });

  proxyReq.on('error', (err) => {
    res.writeHead(502, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Bad Gateway', message: err.message }));
  });

  req.pipe(proxyReq, { end: true });
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'POST' && req.url === '/anpr/detect') {
    const chunks = [];
    let totalLen = 0;

    req.on('data', (chunk) => {
      totalLen += chunk.length;
      if (totalLen <= 5 * 1024 * 1024) {
        chunks.push(chunk);
      }
    });

    req.on('end', async () => {
      try {
        const bodyStr = Buffer.concat(chunks).toString('utf8');
        const payload = JSON.parse(bodyStr);
        const b64 = (payload.image || '').replace(/^data:image\/\w+;base64,/, '');
        if (!b64 || !detSession || !idRecSession || !svtrRecSession) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, plate: null }));
          return;
        }

        const jpgBuffer = Buffer.from(b64, 'base64');
        const result = await runAnprOnJpegBuffer(jpgBuffer);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, ...result }));
      } catch (err) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, plate: null, error: err.message }));
      }
    });
    return;
  }

  if (req.url.startsWith('/api/')) {
    proxyApiRequest(req, res);
    return;
  }

  serveStaticFile(req, res);
});

initModels()
  .then(() => {
    server.listen(PORT, '0.0.0.0', () => {
      console.log(`[ANPR Server] Listening on http://0.0.0.0:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('[ANPR Server] Failed to initialize models:', err);
    process.exit(1);
  });
