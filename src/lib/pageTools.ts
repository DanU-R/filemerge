import { PDFDocument, degrees } from '@cantoo/pdf-lib'

/**
 * Operasi per-halaman PDF (Fase 5 lanjutan): inspeksi, rotasi, hapus, split.
 * Semua di browser — isi dokumen tidak pernah dikirim ke server.
 */

export interface PageInfo {
  /** Indeks 0-based pada dokumen asli. */
  index: number
  /** Lebar efektif (setelah rotasi). */
  width: number
  height: number
  /** Rotasi halaman dari file (derajat, kelipatan 90). */
  rotation: number
}

/** Perubahan yang diinginkan pengguna untuk tiap halaman. */
export interface PageEdit {
  /** Putaran tambahan yang diterapkan: 0/90/180/270. */
  rotate?: number
  /** Bila true, halaman dibuang dari hasil. */
  deleted?: boolean
  /** Posisi baru halaman (indeks 0-based pada dokumen asal). Bila diisi, urutan mengikuti ini. */
  order?: number
}

export interface PdfWithPages {
  doc: PDFDocument
  pages: PageInfo[]
}

/** Urutan hasil akhir: pakai `order` bila ada, jika tidak urutan asal. */
export function resolvePageOrder(edits: PageEdit[]): number[] {
  const hasOrder = edits.some((e) => typeof e?.order === 'number')
  if (!hasOrder) return edits.map((_, i) => i)
  return edits
    .map((e, i) => ({ i, order: e?.order ?? i }))
    .sort((a, b) => a.order - b.order)
    .map((x) => x.i)
}

/**
 * Muat PDF dan kembalikan info tiap halaman.
 * `decrypt` dipakai untuk PDF terproteksi (lihat mergeClient).
 */
export async function inspectPdf(
  bytes: Uint8Array,
  decrypt: (b: Uint8Array) => Promise<Uint8Array> = async (b) => b,
): Promise<PdfWithPages> {
  let doc: PDFDocument
  try {
    doc = await PDFDocument.load(bytes)
  } catch (err) {
    try {
      doc = await PDFDocument.load(await decrypt(bytes))
    } catch {
      throw err
    }
  }
  const pages = doc.getPages().map((p, index) => {
    const rotation = p.getRotation().angle % 360
    // Ukuran efektif: bila rotasi 90/270, tampilan lebar/tinggi bertukar.
    const swapped = rotation === 90 || rotation === 270
    const w = p.getWidth()
    const h = p.getHeight()
    return {
      index,
      width: swapped ? h : w,
      height: swapped ? w : h,
      rotation,
    }
  })
  return { doc, pages }
}

/**
 * Terapkan rotasi/hapus/susun-ulang ke halaman lalu kembalikan bytes PDF baru.
 * Halaman yang ditandai `deleted` dibuang. Urutan hasil mengikuti `order` bila
 * diberikan (untuk fitur susun ulang), jika tidak urutan asal dipertahankan.
 * Melempar bila semua halaman dibuang.
 */
export async function applyPageEdits(
  bytes: Uint8Array,
  edits: PageEdit[],
  decrypt: (b: Uint8Array) => Promise<Uint8Array> = async (b) => b,
): Promise<Uint8Array> {
  const { doc } = await inspectPdf(bytes, decrypt)
  const pages = doc.getPages()

  // 1) Terapkan rotasi dulu (mutasi pada dokumen sumber), lalu tentukan halaman
  //    yang disimpan menurut urutan yang diminta.
  const order = resolvePageOrder(edits)
  const keep: number[] = []

  order.forEach((i) => {
    const page = pages[i]
    if (!page) return
    if (edits[i]?.deleted) return
    if (edits[i]?.rotate) {
      const current = page.getRotation().angle
      page.setRotation(degrees(((current + edits[i].rotate!) % 360 + 360) % 360))
    }
    keep.push(i)
  })

  if (keep.length === 0) throw new Error('Tidak ada halaman yang tersisa.')

  const rotated = edits.some((e) => e?.rotate)
  const reordered = order.some((v, i) => v !== i)
  if (keep.length === pages.length && !rotated && !reordered) {
    // Tidak ada perubahan berarti — tetap normalisasi via save.
    return doc.save()
  }

  // 2) Susun dokumen baru mengikuti urutan hasil.
  const out = await PDFDocument.create()
  const copied = await out.copyPages(doc, keep)
  copied.forEach((p) => out.addPage(p))
  return out.save()
}

/**
 * Pecah PDF menjadi beberapa dokumen berdasarkan rentang halaman (1-based, inklusif).
 * Tiap rentang menghasilkan satu PDF.
 */
export async function splitPdf(
  bytes: Uint8Array,
  ranges: { from: number; to: number }[],
  decrypt: (b: Uint8Array) => Promise<Uint8Array> = async (b) => b,
): Promise<Uint8Array[]> {
  const { doc, pages } = await inspectPdf(bytes, decrypt)
  const total = pages.length
  const results: Uint8Array[] = []

  for (const r of ranges) {
    const from = Math.max(1, Math.min(r.from, total))
    const to = Math.max(from, Math.min(r.to, total))
    const idx: number[] = []
    for (let i = from; i <= to; i++) idx.push(i - 1)
    if (idx.length === 0) continue
    const out = await PDFDocument.create()
    const copied = await out.copyPages(doc, idx)
    copied.forEach((p) => out.addPage(p))
    results.push(await out.save())
  }

  return results
}

/**
 * Uraikan spesifikasi rentang dari input pengguna, mis. "1-3, 5, 7-9".
 * Mengembalikan daftar rentang valid; melempar bila sintaks tidak dikenali.
 */
export function parseRanges(spec: string, total: number): { from: number; to: number }[] {
  const parts = spec
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  if (parts.length === 0) throw new Error('Rentang kosong.')

  const out: { from: number; to: number }[] = []
  for (const part of parts) {
    const m = /^(\d+)\s*-\s*(\d+)$/.exec(part)
    if (m) {
      const from = Number(m[1])
      const to = Number(m[2])
      if (from < 1 || to < 1 || from > total || to > total) {
        throw new Error(`Rentang ${part} di luar 1-${total}.`)
      }
      if (from > to) throw new Error(`Rentang ${part} terbalik.`)
      out.push({ from, to })
      continue
    }
    const single = /^(\d+)$/.exec(part)
    if (single) {
      const n = Number(single[1])
      if (n < 1 || n > total) throw new Error(`Halaman ${n} di luar 1-${total}.`)
      out.push({ from: n, to: n })
      continue
    }
    throw new Error(`Format rentang tidak dikenali: "${part}".`)
  }
  return out
}
