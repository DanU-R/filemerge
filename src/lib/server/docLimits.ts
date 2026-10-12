/** Batas dokumen tersimpan (Fase 2). Berbeda dari batas merge di browser. */
export const DOC_LIMITS = {
  /** Ukuran maksimum satu dokumen yang diunggah. */
  MAX_FILE_BYTES: 20 * 1024 * 1024, // 20 MB
  /** Jumlah maksimum dokumen per pengguna. */
  MAX_DOCS_PER_USER: 30,
  /** Total ukuran dokumen per pengguna. */
  MAX_TOTAL_BYTES: 100 * 1024 * 1024, // 100 MB
} as const

export const DOC_CATEGORIES = [
  'CV',
  'IDENTITAS',
  'PENDIDIKAN',
  'SERTIFIKAT',
  'LAINNYA',
] as const

export type DocCategoryValue = (typeof DOC_CATEGORIES)[number]

export const CATEGORY_LABELS: Record<DocCategoryValue, string> = {
  CV: 'CV',
  IDENTITAS: 'Identitas',
  PENDIDIKAN: 'Pendidikan',
  SERTIFIKAT: 'Sertifikat',
  LAINNYA: 'Lainnya',
}
