/** Pengaturan halaman hasil merge (Fase 5). Nilai margin dalam poin (pt). */

export type PageSizeKey = 'A4' | 'Letter' | 'fit'
export type Orientation = 'portrait' | 'landscape'

export interface PageSettings {
  pageSize: PageSizeKey
  orientation: Orientation
  /** Margin dalam pt (0–72). Diabaikan bila pageSize = 'fit'. */
  margin: number
}

export const DEFAULT_PAGE_SETTINGS: PageSettings = {
  pageSize: 'A4',
  orientation: 'portrait',
  margin: 24,
}

export const PAGE_SIZES: Record<'A4' | 'Letter', { width: number; height: number }> = {
  A4: { width: 595.28, height: 841.89 },
  Letter: { width: 612, height: 792 },
}

export const PAGE_SIZE_OPTIONS: { value: PageSizeKey; label: string }[] = [
  { value: 'A4', label: 'A4' },
  { value: 'Letter', label: 'Letter' },
  { value: 'fit', label: 'Sesuai gambar' },
]

export const ORIENTATION_OPTIONS: { value: Orientation; label: string }[] = [
  { value: 'portrait', label: 'Tegak (portrait)' },
  { value: 'landscape', label: 'Mendatar (landscape)' },
]

export const MARGIN_OPTIONS = [0, 12, 24, 36, 48] as const

/** Ukuran halaman untuk satu gambar, sudah menerapkan orientasi. */
export function resolvePageSize(
  settings: PageSettings,
  imgW: number,
  imgH: number,
): { width: number; height: number } {
  if (settings.pageSize === 'fit') {
    const m = settings.margin
    return { width: Math.max(1, imgW + m * 2), height: Math.max(1, imgH + m * 2) }
  }
  const base = PAGE_SIZES[settings.pageSize]
  return settings.orientation === 'landscape'
    ? { width: base.height, height: base.width }
    : { width: base.width, height: base.height }
}

export function normalizePageSettings(input: Partial<PageSettings> | undefined): PageSettings {
  const s = { ...DEFAULT_PAGE_SETTINGS, ...(input ?? {}) }
  return {
    pageSize: (['A4', 'Letter', 'fit'] as const).includes(s.pageSize) ? s.pageSize : 'A4',
    orientation: (['portrait', 'landscape'] as const).includes(s.orientation)
      ? s.orientation
      : 'portrait',
    margin: Math.min(72, Math.max(0, Math.round(Number(s.margin) || 0))),
  }
}
