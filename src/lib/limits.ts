/**
 * Batas operasional Fase 1 (merge di browser).
 *
 * Nilai awal bersifat konservatif dan diverifikasi lewat uji nyata di
 * Chromium headless (lihat docs/Fase1-Report.md). Semua angka dalam byte.
 */
export const LIMITS = {
  /** Ukuran maksimum satu file yang diterima antrean. */
  MAX_FILE_BYTES: 50 * 1024 * 1024, // 50 MB
  /** Total ukuran antrean yang masih diproses. */
  MAX_TOTAL_BYTES: 200 * 1024 * 1024, // 200 MB
  /** Jumlah maksimum file dalam satu antrean. */
  MAX_FILES: 50,
  /** Ambang peringatan memori (peringatan, bukan penolakan). */
  WARN_TOTAL_BYTES: 120 * 1024 * 1024, // 120 MB
} as const

export const A4 = { width: 595.28, height: 841.89 } as const
export const IMAGE_MARGIN = 24

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '0 B'
  if (bytes < 1024) return `${bytes} B`
  const units = ['KB', 'MB', 'GB']
  let value = bytes / 1024
  let i = 0
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024
    i++
  }
  return `${value.toFixed(value >= 10 || i === 0 ? 0 : 1)} ${units[i]}`
}

export function isOverFileLimit(size: number): boolean {
  return size >= LIMITS.MAX_FILE_BYTES
}

export function wouldExceedTotal(currentTotal: number, incoming: number): boolean {
  return currentTotal + incoming > LIMITS.MAX_TOTAL_BYTES
}
