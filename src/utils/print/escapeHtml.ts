/**
 * Utilitas untuk meng-escape karakter HTML khusus.
 * WAJIB digunakan untuk semua nilai dinamis sebelum dimasukkan ke dalam template dokumen cetak,
 * mencegah serangan XSS atau pemutusan struktur HTML saat mencetak data tak terduga.
 */

const ESCAPE_MAP: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

export function escapeHtml(value?: string | number | null): string {
  if (value === null || value === undefined) {
    return '';
  }
  const str = String(value);
  return str.replace(/[&<>"']/g, (char) => ESCAPE_MAP[char] || char);
}
