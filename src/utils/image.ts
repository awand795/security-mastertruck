/**
 * Helper untuk menormalkan sumber gambar (foto_data dari backend).
 * Menangani:
 * 1. URL http/https atau data:image/
 * 2. Postgres bytea hex string (\xffd8... atau \\xffd8...)
 * 3. Base64 murni tanpa prefix data:image
 */
export const formatPhotoUrl = (raw?: string | null): string => {
  if (!raw) return '';

  const trimmed = raw.trim();

  // Sudah format data URL atau URL publik
  if (
    trimmed.startsWith('data:image/') ||
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('/') ||
    trimmed.startsWith('blob:')
  ) {
    return trimmed;
  }

  // Deteksi Postgres BYTEA hex: dimulai dengan \x atau \\x
  let hex = trimmed;
  if (hex.startsWith('\\\\x') || hex.startsWith('\\x')) {
    hex = hex.replace(/^\\\\x|^\\x/, '');
  } else if (hex.startsWith('x') && /^[0-9a-fA-F]+$/.test(hex.slice(1, 20))) {
    hex = hex.slice(1);
  }

  // Jika string merupakan rangkaian hex murni (contoh JPEG ffd8ffe0... atau PNG 89504e47...)
  if (/^[0-9a-fA-F]+$/.test(hex.slice(0, 100))) {
    try {
      const match = hex.match(/.{1,2}/g);
      if (match) {
        const u8 = new Uint8Array(match.map((byte) => parseInt(byte, 16)));
        let binary = '';
        const len = u8.byteLength;
        // Chunk processing agar tidak stack overflow pada gambar besar
        const chunkSize = 8192;
        for (let i = 0; i < len; i += chunkSize) {
          const chunk = u8.subarray(i, Math.min(i + chunkSize, len));
          binary += String.fromCharCode.apply(null, Array.from(chunk));
        }
        const b64 = window.btoa(binary);
        const lowerHex = hex.slice(0, 8).toLowerCase();
        let mime = 'image/jpeg';
        if (lowerHex.startsWith('89504e47')) mime = 'image/png';
        else if (lowerHex.startsWith('47494638')) mime = 'image/gif';
        else if (lowerHex.startsWith('52494646')) mime = 'image/webp';

        return `data:${mime};base64,${b64}`;
      }
    } catch (err) {
      console.error('Error converting bytea hex to image data URL:', err);
    }
  }

  // Jika raw base64 tanpa prefix
  return `data:image/jpeg;base64,${trimmed}`;
};
