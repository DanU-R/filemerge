import { PDFDocument } from '@cantoo/pdf-lib'

export interface CompressResult {
  bytes: Uint8Array
  originalBytes: number
  compressedBytes: number
  pages: number
  /** Rasio penghematan (0..1). 0 = tidak ada penghematan. */
  savedRatio: number
  /** Metode yang benar-benar dipakai. */
  method: 'lossless' | 'none'
}

/**
 * Kompresi PDF di browser.
 *
 * Pendekatan: buang metadata (info dict + XMP) dan simpan ulang dengan object
 * streams (`useObjectStreams`). Penghematannya **kecil tapi pasti**, dan kualitas
 * halaman/gambar tidak tersentuh — penting untuk dokumen administratif (KTP,
 * ijazah) yang harus tetap terbaca dan teksnya tetap bisa dicari.
 *
 * Keputusan desain: kompresi agresif (rasterisasi halaman) sengaja TIDAK dipakai.
 * Cara itu memang memperkecil file jauh lebih banyak, tetapi (a) memerlukan
 * renderer halaman (pdf.js, dependency berat) dan (b) membuat teks tidak lagi
 * dapat dicari serta menurunkan ketajaman — kerugian nyata untuk dokumen
 * identitas. Fungsi ini melaporkan `savedRatio` apa adanya; bila tidak ada
 * penghematan, file asli dikembalikan.
 */
export async function compressPdf(
  bytes: Uint8Array,
  decrypt: (b: Uint8Array) => Promise<Uint8Array> = async (b) => b,
): Promise<CompressResult> {
  let doc: PDFDocument
  try {
    doc = await PDFDocument.load(bytes, { updateMetadata: false })
  } catch (err) {
    try {
      doc = await PDFDocument.load(await decrypt(bytes), { updateMetadata: false })
    } catch {
      throw err
    }
  }

  const pages = doc.getPageCount()

  // Hapus metadata untuk menghemat beberapa KB dan mengurangi jejak.
  try {
    doc.setTitle('')
    doc.setAuthor('')
    doc.setSubject('')
    doc.setKeywords([])
    doc.setProducer('')
    doc.setCreator('')
  } catch {
    /* sebagian build pdf-lib bisa menolak; abaikan. */
  }

  const out = await doc.save({ useObjectStreams: true })
  const originalBytes = bytes.length
  const compressedBytes = out.length

  // Bila hasilnya justru lebih besar, kembalikan yang asli (tidak merugikan pengguna).
  if (compressedBytes >= originalBytes) {
    return {
      bytes,
      originalBytes,
      compressedBytes: originalBytes,
      pages,
      savedRatio: 0,
      method: 'none',
    }
  }

  return {
    bytes: out,
    originalBytes,
    compressedBytes,
    pages,
    savedRatio: 1 - compressedBytes / originalBytes,
    method: 'lossless',
  }
}
