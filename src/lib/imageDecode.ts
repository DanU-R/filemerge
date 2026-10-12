import type { DecodedImage } from './types'

/**
 * Baca nilai EXIF Orientation (tag 0x0112) dari header JPEG tanpa dependensi.
 * Mengembalikan 1..8 (default 1 bila tidak ada).
 */
export function readExifOrientation(bytes: Uint8Array): number {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return 1
  let offset = 2
  while (offset + 4 <= bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset++
      continue
    }
    const marker = bytes[offset + 1]
    if (marker === 0xda || marker === 0xd9) break
    const size = (bytes[offset + 2] << 8) | bytes[offset + 3]
    if (size < 2) break
    if (marker === 0xe1) {
      const start = offset + 4
      const exifHeader = [0x45, 0x78, 0x69, 0x66, 0x00, 0x00] // "Exif\0\0"
      let isExif = true
      for (let i = 0; i < exifHeader.length; i++) {
        if (bytes[start + i] !== exifHeader[i]) {
          isExif = false
          break
        }
      }
      if (isExif) {
        const tiff = start + 6
        const little = bytes[tiff] === 0x49 && bytes[tiff + 1] === 0x49
        const read16 = (o: number) =>
          little ? bytes[o] | (bytes[o + 1] << 8) : (bytes[o] << 8) | bytes[o + 1]
        const read32 = (o: number) =>
          little
            ? bytes[o] | (bytes[o + 1] << 8) | (bytes[o + 2] << 16) | (bytes[o + 3] << 24)
            : (bytes[o] << 24) | (bytes[o + 1] << 16) | (bytes[o + 2] << 8) | bytes[o + 3]
        const ifd0 = tiff + read32(tiff + 4)
        const count = read16(ifd0)
        for (let e = 0; e < count; e++) {
          const entry = ifd0 + 2 + e * 12
          if (read16(entry) === 0x0112) return read16(entry + 8) || 1
        }
      }
    }
    offset += 2 + size
  }
  return 1
}

/** Info dasar JPEG dari marker SOF: dimensi piksel mentah + jumlah komponen. */
export function readJpegInfo(
  bytes: Uint8Array,
): { width: number; height: number; components: number } | null {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null
  let offset = 2
  while (offset + 4 <= bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset++
      continue
    }
    const marker = bytes[offset + 1]
    if (marker === 0xda || marker === 0xd9) break
    const size = (bytes[offset + 2] << 8) | bytes[offset + 3]
    if (size < 2) break
    // SOF0..SOF15 kecuali DHT(C4), JPG(C8), DAC(CC)
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      const h = (bytes[offset + 5] << 8) | bytes[offset + 6]
      const w = (bytes[offset + 7] << 8) | bytes[offset + 8]
      const components = bytes[offset + 9]
      return { width: w, height: h, components }
    }
    offset += 2 + size
  }
  return null
}

/** Dimensi piksel mentah JPEG (dari marker SOF), tanpa memperhitungkan EXIF. */
export function readJpegPixelSize(bytes: Uint8Array): { width: number; height: number } | null {
  const info = readJpegInfo(bytes)
  return info ? { width: info.width, height: info.height } : null
}

function orientationTransform(o: number, w: number, h: number) {
  switch (o) {
    case 2: return { a: -1, b: 0, c: 0, d: 1, e: w, f: 0 }
    case 3: return { a: -1, b: 0, c: 0, d: -1, e: w, f: h }
    case 4: return { a: 1, b: 0, c: 0, d: -1, e: 0, f: h }
    case 5: return { a: 0, b: 1, c: 1, d: 0, e: 0, f: 0 }
    case 6: return { a: 0, b: 1, c: -1, d: 0, e: h, f: 0 }
    case 7: return { a: 0, b: -1, c: -1, d: 0, e: h, f: w }
    case 8: return { a: 0, b: -1, c: 1, d: 0, e: 0, f: w }
    default: return { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }
  }
}

interface CanvasLike {
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D
  toBlob: () => Promise<Blob>
}

/** Canvas yang bekerja di main thread maupun Web Worker. */
async function makeCanvas(w: number, h: number): Promise<CanvasLike> {
  const g = globalThis as unknown as { OffscreenCanvas?: typeof OffscreenCanvas }
  if (typeof g.OffscreenCanvas === 'function') {
    const canvas = new g.OffscreenCanvas(w, h)
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas 2D tidak tersedia.')
    return { ctx, toBlob: () => canvas.convertToBlob({ type: 'image/png' }) }
  }
  if (typeof document === 'undefined') throw new Error('Canvas tidak tersedia di lingkungan ini.')
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D tidak tersedia.')
  return {
    ctx,
    toBlob: () =>
      new Promise<Blob>((resolve, reject) =>
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Gagal encode gambar.'))), 'image/png'),
      ),
  }
}

/**
 * Decode gambar ke bitmap. Browser modern (Chrome/Firefox/Safari/Edge) sudah
 * menerapkan orientasi EXIF secara default, sehingga hasilnya tegak.
 */
async function decodeBitmap(file: Blob): Promise<ImageBitmap> {
  const anyGlobal = globalThis as unknown as {
    createImageBitmap?: (b: Blob) => Promise<ImageBitmap>
  }
  if (typeof anyGlobal.createImageBitmap === 'function') {
    try {
      return await anyGlobal.createImageBitmap(file)
    } catch {
      /* jatuh ke fallback <img> */
    }
  }
  return await decodeViaImageElement(file)
}

async function decodeViaImageElement(file: Blob): Promise<ImageBitmap> {
  const url = URL.createObjectURL(file)
  try {
    const img = document.createElement('img')
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve()
      img.onerror = () => reject(new Error('Gambar tidak dapat dibaca.'))
      img.src = url
    })
    const { ctx, toBlob } = await makeCanvas(img.naturalWidth, img.naturalHeight)
    ctx.drawImage(img, 0, 0)
    const blob = await toBlob()
    return await createImageBitmap(blob)
  } finally {
    URL.revokeObjectURL(url)
  }
}

/**
 * Decoder gambar untuk PDF:
 *  - PNG: byte asli dipertahankan (transparansi utuh).
 *  - JPEG orientasi 1: byte asli dipertahankan (tanpa re-encode).
 *  - JPEG dengan EXIF 2..8: diproses ke piksel tegak (browser menerapkan EXIF;
 *    bila browser tidak menerapkannya, transformasi manual dipakai sebagai fallback).
 */
export async function decodeImageForPdf(file: Blob): Promise<DecodedImage> {
  const buffer = new Uint8Array(await file.arrayBuffer())
  const isJpeg = buffer[0] === 0xff && buffer[1] === 0xd8
  const isPng =
    buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47

  if (!isJpeg && !isPng) throw new Error('Format gambar tidak didukung.')

  const orientation = isJpeg ? readExifOrientation(buffer) : 1
  const info = isJpeg ? readJpegInfo(buffer) : null
  // JPEG CMYK/YCCK (4 komponen) dapat salah render bila byte mentah di-embed.
  // Re-encode lewat canvas agar dikonversi ke RGB dengan benar.
  const isCmyk = !!info && info.components === 4

  // Jalur cepat: PNG, atau JPEG tanpa EXIF & bukan CMYK -> embed byte asli.
  if (isPng) {
    const bitmap = await decodeBitmap(file)
    const size = { width: bitmap.width, height: bitmap.height }
    bitmap.close?.()
    return { bytes: buffer, format: 'png', width: size.width, height: size.height, pages: 1 }
  }
  if (orientation === 1 && !isCmyk) {
    const bitmap = await decodeBitmap(file)
    const size = { width: bitmap.width, height: bitmap.height }
    bitmap.close?.()
    return { bytes: buffer, format: 'jpeg', width: size.width, height: size.height, pages: 1 }
  }

  // JPEG dengan EXIF dan/atau CMYK: decode (browser menerapkan orientasi &
  // konversi warna), lalu bake ke canvas.
  const bitmap = await decodeBitmap(file)
  const raw = readJpegPixelSize(buffer)
  const browserAppliedExif =
    !raw || !(raw.width === bitmap.width && raw.height === bitmap.height)

  if (!browserAppliedExif && orientation !== 1) {
    // Browser TIDAK menerapkan EXIF -> terapkan transformasi manual.
    const swap = orientation >= 5 && orientation <= 8
    const w = swap ? bitmap.height : bitmap.width
    const h = swap ? bitmap.width : bitmap.height
    const { ctx, toBlob } = await makeCanvas(w, h)
    const t = orientationTransform(orientation, bitmap.width, bitmap.height)
    ctx.setTransform(t.a, t.b, t.c, t.d, t.e, t.f)
    ctx.drawImage(bitmap, 0, 0)
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    bitmap.close?.()
    const blob = await toBlob()
    return { bytes: new Uint8Array(await blob.arrayBuffer()), format: 'png', width: w, height: h, pages: 1 }
  }

  // Browser sudah menerapkan EXIF: cukup re-encode agar tag EXIF tidak tersisa.
  const { ctx, toBlob } = await makeCanvas(bitmap.width, bitmap.height)
  ctx.drawImage(bitmap, 0, 0)
  const width = bitmap.width
  const height = bitmap.height
  bitmap.close?.()
  const blob = await toBlob()
  return { bytes: new Uint8Array(await blob.arrayBuffer()), format: 'png', width, height, pages: 1 }
}
