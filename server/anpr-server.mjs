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
const REC_MODEL_PATH = path.resolve(__dirname, './models/plate_rec_svtr.onnx');

const PORT = Number(process.env.PORT || 80);
const API_BACKEND_HOST = '94.237.69.119';
const API_BACKEND_PORT = 8081;

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

export function extractIndonesianPlate(rawText) {
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
let recSession = null;

async function initModels() {
  const t0 = Date.now();
  console.log('[ANPR Server] Loading YOLOv8n-Plate & SVTR26-Tiny into C++ ONNX Runtime...');
  [detSession, recSession] = await Promise.all([
    ort.InferenceSession.create(DET_MODEL_PATH),
    ort.InferenceSession.create(REC_MODEL_PATH),
  ]);

  // Warmup 1x agar request pertama dari kamera langsung cepat (<80ms)
  const dummyDet = new ort.Tensor('float32', new Float32Array(3 * 416 * 416), [1, 3, 416, 416]);
  const dummyRec = new ort.Tensor('float32', new Float32Array(3 * 32 * 128), [1, 3, 32, 128]);
  await detSession.run({ images: dummyDet });
  await recSession.run({ input: dummyRec });

  const rssMb = Math.round(process.memoryUsage().rss / 1024 / 1024);
  console.log(`[ANPR Server] Models Ready & Warmed Up in ${Date.now() - t0}ms (RAM RSS: ${rssMb} MB)`);
}

async function recognizeCrop(rgba, W, H, x1, y1, cropW, cropH) {
  const recW = 128;
  const recH = 32;
  const planeSize = recW * recH;
  const inputRec = new Float32Array(3 * planeSize);
  let bestRawText = '';

  for (const hRatio of [1.0, 0.85]) {
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

    const recRes = await recSession.run({
      input: new ort.Tensor('float32', inputRec, [1, 3, recH, recW]),
    });
    const logits = recRes.output.data;
    const { text, confidence } = decodeSvtrCtcOutput(logits);
    if (hRatio === 1.0 && text) bestRawText = text;

    const plate = extractIndonesianPlate(text);
    if (plate) {
      return { rawText: text, plate, confidence };
    }
  }

  return { rawText: bestRawText, plate: null, confidence: 0 };
}

async function runAnprOnJpegBuffer(jpgBuffer) {
  const decoded = jpeg.decode(jpgBuffer, { useTArray: true });
  const W = decoded.width;
  const H = decoded.height;
  const rgba = decoded.data;

  // 1. Letterbox 416x416 untuk YOLOv8n-Plate
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

      const rec = await recognizeCrop(rgba, W, H, x1, y1, cropW, cropH);
      return {
        plate: rec.plate,
        rawText: rec.rawText,
        confidence: rec.confidence,
        isFromYoloBox: true,
        box: boxNorm,
      };
    }
  }

  // Fallback jika plat didekatkan sangat dekat memenuhi kotak tengah
  const fbW = Math.round(W * 0.78);
  const fbH = Math.round(H * 0.28);
  const fbX = Math.round((W - fbW) / 2);
  const fbY = Math.round((H - fbH) / 2);
  const recFb = await recognizeCrop(rgba, W, H, fbX, fbY, fbW, fbH);

  return {
    plate: recFb.plate,
    rawText: recFb.rawText,
    confidence: recFb.confidence,
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

const server = http.createServer(async (req, res) => {
  const url = req.url || '/';

  // 1. Endpoint ANPR Server-Side (POST /anpr/detect)
  if (url.startsWith('/anpr/detect') && req.method === 'POST') {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', async () => {
      try {
        if (!detSession || !recSession) {
          res.writeHead(503, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, message: 'Model sedang pemanasan...' }));
          return;
        }
        const bodyStr = Buffer.concat(chunks).toString('utf8');
        const payload = JSON.parse(bodyStr);
        const base64Data = (payload.image || '').replace(/^data:image\/\w+;base64,/, '');
        if (!base64Data) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, message: 'Gambar kosong' }));
          return;
        }

        const jpgBuffer = Buffer.from(base64Data, 'base64');
        const result = await runAnprOnJpegBuffer(jpgBuffer);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, ...result }));
      } catch (err) {
        console.error('[ANPR Server] Error processing frame:', err.message);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, plate: null, rawText: '', confidence: 0, box: null }));
      }
    });
    return;
  }

  // 2. Proxy /api/* ke API Gateway 94.237.69.119:8081
  if (url.startsWith('/api/')) {
    const proxyReq = http.request(
      {
        hostname: API_BACKEND_HOST,
        port: API_BACKEND_PORT,
        path: url,
        method: req.method,
        headers: {
          ...req.headers,
          host: `${API_BACKEND_HOST}:${API_BACKEND_PORT}`,
        },
      },
      (proxyRes) => {
        res.writeHead(proxyRes.statusCode || 502, proxyRes.headers);
        proxyRes.pipe(res);
      }
    );
    proxyReq.on('error', (err) => {
      res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, message: 'Bad Gateway', error: err.message }));
    });
    req.pipe(proxyReq);
    return;
  }

  // 3. Serve Static Assets & SPA Fallback dari folder dist/
  const cleanPath = url.split('?')[0];
  let filePath = path.join(DIST_DIR, cleanPath === '/' ? 'index.html' : cleanPath);

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
    const rawBuf = fs.readFileSync(filePath);
    const acceptEncoding = req.headers['accept-encoding'] || '';

    const headers = {
      'Content-Type': contentType,
      'X-Frame-Options': 'SAMEORIGIN',
      'X-Content-Type-Options': 'nosniff',
    };
    if (ext !== '.html') {
      headers['Cache-Control'] = 'public, max-age=31536000, immutable';
    }

    if (
      acceptEncoding.includes('gzip') &&
      rawBuf.length > 2048 &&
      (ext === '.js' || ext === '.css' || ext === '.html')
    ) {
      headers['Content-Encoding'] = 'gzip';
      res.writeHead(200, headers);
      res.end(zlib.gzipSync(rawBuf));
    } else {
      res.writeHead(200, headers);
      res.end(rawBuf);
    }
  } catch {
    res.writeHead(404);
    res.end('Not found');
  }
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
