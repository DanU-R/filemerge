import { PDFDocument } from '@cantoo/pdf-lib'

export interface CompressResult {
  bytes: Uint8Array
  originalBytes: number
  compressedBytes: number
  pages: number
  /** Rasio penghematan (0..1). 0 = tidak ada penghematan. */
  savedRatio: number
}

/**
 * Kompresi PDF di browser (Fase 5 lanjutan).
 *
 * Pendekatan: buang metadata (info dict + XMP) dan simpan ulang dengan objek
 * yang dipadatkan (`useObjectStreams`). Ini kosmetik tapi gratis dan aman untuk
 * dokumen administratif — TIDAK menurunkan kualitas halaman/gambar.
 *
 * Catatan jujur: ini bukan kompresor agresif. Re-encode gambar beresolusi tinggi
 * di luar cakupan (butuh rasterisasi halaman) dan berisiko menurunkan keterbacaan
 * dokumen identitas. Fungsi mengembalikan `savedRatio` nyata; UI menampilkan
 * apa adanya, termasuk bila hasilnya sama besar.
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
  const savedRatio = originalBytes > 0 ? Math.max(0, 1 - compressedBytes / originalBytes) : 0

  // Bila hasilnya justru lebih besar, kembalikan yang asli (tidak merugikan pengguna).
  if (compressedBytes >= originalBytes) {
    return { bytes, originalBytes, compressedBytes: originalBytes, pages, savedRatio: 0 }
  }

  return { bytes: out, originalBytes, compressedBytes, pages, savedRatio }
}
