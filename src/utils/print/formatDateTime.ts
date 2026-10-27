/**
 * Format tanggal dan waktu konsisten untuk dokumen operasional security:
 * Contoh: "27 Okt 2026, 14:35 WIB"
 * Toleran terhadap format string backend; jika tidak dapat diparse, tampilkan apa adanya.
 */

const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
  'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'
];

export function formatDateTime(dateStr?: string | number | null): string {
  if (!dateStr) return '-';

  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) {
      // Jika format custom string seperti '2026-10-27 14:35:00'
      if (typeof dateStr === 'string' && dateStr.includes(' ')) {
        const parts = dateStr.split(' ');
        const datePart = parts[0];
        const timePart = parts[1];
        const sub = new Date(`${datePart}T${timePart}`);
        if (!isNaN(sub.getTime())) {
          return formatNativeDate(sub);
        }
      }
      return String(dateStr);
    }
    return formatNativeDate(d);
  } catch {
    return String(dateStr);
  }
}

function formatNativeDate(d: Date): string {
  const day = d.getDate();
  const month = MONTH_NAMES[d.getMonth()] || '';
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');

  return `${day} ${month} ${year}, ${hours}:${minutes} WIB`;
}

/**
 * Format tanggal singkat saja: "27 Okt 2026"
 */
export function formatDateOnly(dateStr?: string | number | null): string {
  if (!dateStr) return '-';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return String(dateStr);
    const day = d.getDate();
    const month = MONTH_NAMES[d.getMonth()] || '';
    const year = d.getFullYear();
    return `${day} ${month} ${year}`;
  } catch {
    return String(dateStr);
  }
}
