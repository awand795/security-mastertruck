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
