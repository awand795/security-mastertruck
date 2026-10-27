/**
 * Format durasi kunjungan operasional menjadi format manusiawi:
 * Contoh: "2 jam 15 menit", "45 menit", atau "< 1 menit"
 */

export function formatDurationHuman(
  startTime?: string | null,
  endTime?: string | null,
  durasiJam?: number | null
): string {
  // 1. Jika durasiJam tersedia sebagai angka valid
  if (durasiJam !== undefined && durasiJam !== null && !isNaN(durasiJam) && durasiJam > 0) {
    const totalMinutes = Math.round(durasiJam * 60);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    if (hours > 0 && minutes > 0) {
      return `${hours} jam ${minutes} menit`;
    }
    if (hours > 0) {
      return `${hours} jam`;
    }
    return `${minutes} menit`;
  }

  // 2. Jika waktu_masuk dan waktu_keluar tersedia
  if (startTime) {
    try {
      const start = new Date(startTime).getTime();
      const end = endTime ? new Date(endTime).getTime() : Date.now();

      if (!isNaN(start) && !isNaN(end) && end >= start) {
        const diffMs = end - start;
        const totalMinutes = Math.floor(diffMs / (1000 * 60));
        const hours = Math.floor(totalMinutes / 60);
        const minutes = totalMinutes % 60;

        if (totalMinutes === 0) {
          return '< 1 menit';
        }
        if (hours > 0 && minutes > 0) {
          return `${hours} jam ${minutes} menit`;
        }
        if (hours > 0) {
          return `${hours} jam`;
        }
        return `${minutes} menit`;
      }
    } catch {
      // Fallback
    }
  }

  return '-';
}
