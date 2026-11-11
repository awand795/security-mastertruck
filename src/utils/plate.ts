/**
 * Normalisasi plat untuk API / database: tanpa spasi.
 * Contoh: "bk 1234 abc" -> "BK1234ABC"
 */
export const normalizePlate = (value: string): string =>
  (value || '').toUpperCase().replace(/\s+/g, '');

/**
 * Format plat untuk tampilan / input: diberi spasi.
 * Contoh: "BK1234ABC" -> "BK 1234 ABC"
 * Nilai yang dikirim ke API tetap memakai normalizePlate().
 */
export const formatPlate = (value: string): string => {
  const clean = (value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!clean) return '';

  const match = clean.match(/^([A-Z]{1,2})(\d{1,4})([A-Z]{0,3})$/);
  if (match) {
    return [match[1], match[2], match[3]].filter(Boolean).join(' ');
  }

  const groups = clean.match(/[A-Z]+|\d+/g);
  return groups ? groups.join(' ') : clean;
};

/**
 * Validasi plat nomor standar Indonesia:
 * - 1-2 huruf kode wilayah (e.g. B, BK, D, L, AB)
 * - 1-4 angka nomor registrasi (1 s/d 9999)
 * - 1-3 huruf seri sub-wilayah (e.g. A, XY, TQR)
 * Contoh valid: "B 2156 TQR", "BK 8899 XY", "D 1 A"
 * Contoh tidak valid: "BK 7", "asdasd", "12345"
 */
export const isValidPlate = (value?: string | null): boolean => {
  if (!value) return false;
  const clean = value.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!clean) return false;
  return /^[A-Z]{1,2}\d{1,4}[A-Z]{1,3}$/.test(clean);
};

export const PLATE_STANDARD_ERROR_MESSAGE =
  'Format plat tidak sesuai standar Indonesia (Contoh: B 1234 ABC atau BK 8899 XY).';

