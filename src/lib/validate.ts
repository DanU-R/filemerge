import { isOverFileLimit } from './limits'

export type DetectedKind = 'pdf' | 'jpeg' | 'png'

const PDF_MAGIC = [0x25, 0x50, 0x44, 0x46] // %PDF
const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
const JPEG_MAGIC = [0xff, 0xd8, 0xff]

function startsWith(bytes: Uint8Array, magic: number[]): boolean {
  if (bytes.length < magic.length) return false
  for (let i = 0; i < magic.length; i++) if (bytes[i] !== magic[i]) return false
  return true
}

/** Deteksi tipe dari magic bytes (isi), bukan ekstensi. */
export function detectKind(bytes: Uint8Array): DetectedKind | null {
  if (startsWith(bytes, PDF_MAGIC)) return 'pdf'
  if (startsWith(bytes, PNG_MAGIC)) return 'png'
  if (startsWith(bytes, JPEG_MAGIC)) return 'jpeg'
  return null
}

export interface FileMeta {
  name: string
  type: string
  size: number
}

export type ValidationResult =
  | { ok: true; kind: 'pdf' | 'image' }
  | { ok: false; reason: string }

/**
 * Validasi berbasis konten. `head` = beberapa byte pertama file.
 * File berekstensi .pdf yang isinya bukan PDF akan ditolak.
 */
export function validateFile(meta: FileMeta, head: Uint8Array): ValidationResult {
  if (meta.size === 0) {
    return { ok: false, reason: 'File kosong (0 byte).' }
  }
  if (isOverFileLimit(meta.size)) {
    return { ok: false, reason: 'Melebihi batas ukuran file.' }
  }

  const detected = detectKind(head)
  if (detected === null) {
    return { ok: false, reason: 'Isi file tidak dikenali (bukan PDF/JPG/PNG).' }
  }

  const lower = meta.name.toLowerCase()
  const extPdf = lower.endsWith('.pdf')
  const extJpg = lower.endsWith('.jpg') || lower.endsWith('.jpeg')
  const extPng = lower.endsWith('.png')

  // Ekstensi harus cocok dengan isi -> cegah .pdf berisi konten lain.
  if (detected === 'pdf' && !extPdf) {
    return { ok: false, reason: 'Isi PDF tetapi ekstensi bukan .pdf.' }
  }
  if (detected === 'jpeg' && !extJpg) {
    return { ok: false, reason: 'Isi JPEG tetapi ekstensi bukan .jpg/.jpeg.' }
  }
  if (detected === 'png' && !extPng) {
    return { ok: false, reason: 'Isi PNG tetapi ekstensi bukan .png.' }
  }

  return { ok: true, kind: detected === 'pdf' ? 'pdf' : 'image' }
}
