import { PDFDocument } from '@cantoo/pdf-lib'
import type { DecodedImage, ImageDecoder, MergeFailure, MergeProgress, MergeSource } from './types'
import { A4, IMAGE_MARGIN } from './limits'
import {
  type PageSettings,
  DEFAULT_PAGE_SETTINGS,
  resolvePageSize,
} from './pageSettings'

export type { MergeFailure }

export interface MergeResult {
  bytes: Uint8Array
  failures: MergeFailure[]
  pages: number
}

function describeError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err)
  if (/encrypt|password|Encrypted/i.test(msg)) return 'PDF terenkripsi (butuh password).'
  if (/No PDF header|Invalid PDF|Failed to parse|Expected instance/i.test(msg)) {
    return 'File PDF rusak atau bukan PDF valid.'
  }
  return `Gagal diproses: ${msg}`
}

/** Hitung ukuran gambar agar muat di halaman dengan proporsi benar (fit-to-page). */
export function fitImageOnPage(
  imgW: number,
  imgH: number,
  page: { width: number; height: number } = A4,
  margin: number = IMAGE_MARGIN,
): { width: number; height: number } {
  const maxW = page.width - margin * 2
  const maxH = page.height - margin * 2
  if (imgW <= 0 || imgH <= 0) return { width: maxW, height: maxH }
  const scale = Math.min(maxW / imgW, maxH / imgH, 1)
  return { width: imgW * scale, height: imgH * scale }
}

async function appendPdf(
  target: PDFDocument,
  bytes: Uint8Array,
  decrypt: (b: Uint8Array) => Promise<Uint8Array>,
): Promise<number> {
  let src: PDFDocument
  try {
    src = await PDFDocument.load(bytes)
  } catch (err) {
    // Coba sekali lagi dengan dekripsi (PDF terproteksi pemilik/kosong password).
    try {
      const plain = await decrypt(bytes)
      src = await PDFDocument.load(plain)
    } catch {
      throw err
    }
  }
  const copied = await target.copyPages(src, src.getPageIndices())
  copied.forEach((p) => target.addPage(p))
  return copied.length
}

async function appendImage(
  target: PDFDocument,
  decoded: DecodedImage,
  settings: PageSettings,
): Promise<number> {
  const pageSize = resolvePageSize(settings, decoded.width, decoded.height)
  const page = target.addPage([pageSize.width, pageSize.height])
  const embedded =
    decoded.format === 'png'
      ? await target.embedPng(decoded.bytes)
      : await target.embedJpg(decoded.bytes)
  const { width, height } = fitImageOnPage(decoded.width, decoded.height, pageSize, settings.margin)
  page.drawImage(embedded, {
    x: (pageSize.width - width) / 2,
    y: (pageSize.height - height) / 2,
    width,
    height,
  })
  return decoded.pages
}

/**
 * Gabungkan sumber sesuai urutan antrean. File bermasalah dicatat di `failures`
 * dan dilewati. Aplikasi tidak crash. `decodeImage` di-inject agar dapat diuji
 * tanpa DOM.
 */
export async function mergeDocuments(
  sources: MergeSource[],
  decodeImage: ImageDecoder,
  onProgress?: (p: MergeProgress) => void,
  decrypt: (b: Uint8Array) => Promise<Uint8Array> = async (b) => b,
  settings: PageSettings = DEFAULT_PAGE_SETTINGS,
): Promise<MergeResult> {
  const target = await PDFDocument.create()
  const failures: MergeFailure[] = []
  let pages = 0

  for (let i = 0; i < sources.length; i++) {
    const src = sources[i]
    onProgress?.({ index: i, total: sources.length, name: src.name })
    try {
      const bytes = new Uint8Array(await src.file.arrayBuffer())
      if (bytes.length === 0) {
        failures.push({ id: src.id, name: src.name, reason: 'File kosong (0 byte).' })
        continue
      }
      if (src.kind === 'pdf') {
        pages += await appendPdf(target, bytes, decrypt)
      } else {
        const decoded = await decodeImage(src.file)
        pages += await appendImage(target, decoded, settings)
      }
    } catch (err) {
      failures.push({ id: src.id, name: src.name, reason: describeError(err) })
    }
  }

  const bytes = await target.save()
  return { bytes, failures, pages }
}
