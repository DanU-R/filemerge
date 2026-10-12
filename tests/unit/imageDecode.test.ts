import { describe, it, expect } from 'vitest'
import { readExifOrientation, readJpegPixelSize, readJpegInfo } from '../../src/lib/imageDecode'

/** Bangun JPEG minimal dengan APP1/EXIF berisi satu entri Orientation. */
function exifJpeg(orientation: number): Uint8Array {
  return new Uint8Array([
    0xff, 0xd8,
    0xff, 0xe1, 0x00, 0x22,
    0x45, 0x78, 0x69, 0x66, 0x00, 0x00, // "Exif\0\0"
    0x49, 0x49, 0x2a, 0x00, // "II", 42 (little-endian)
    0x08, 0x00, 0x00, 0x00, // IFD0 offset = 8
    0x01, 0x00, // 1 entry
    0x12, 0x01, 0x03, 0x00, 0x01, 0x00, 0x00, 0x00, orientation, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, // next IFD = 0
    0xff, 0xd9,
  ])
}

describe('readExifOrientation', () => {
  it('reads orientation 6 (portrait phone photo)', () => {
    expect(readExifOrientation(exifJpeg(6))).toBe(6)
  })

  it('reads orientation 8', () => {
    expect(readExifOrientation(exifJpeg(8))).toBe(8)
  })

  it('reads orientation 3 (180)', () => {
    expect(readExifOrientation(exifJpeg(3))).toBe(3)
  })

  it('defaults to 1 when there is no EXIF', () => {
    expect(readExifOrientation(new Uint8Array([0xff, 0xd8, 0xff, 0xd9]))).toBe(1)
    expect(readExifOrientation(new Uint8Array([0x89, 0x50, 0x4e, 0x47]))).toBe(1)
    expect(readExifOrientation(new Uint8Array())).toBe(1)
  })
})

describe('readJpegPixelSize', () => {
  it('reads width/height from the SOF0 marker', () => {
    // SOF0: FF C0, len 0x0011, precision 08, height 0x001E=30, width 0x003C=60
    const jpeg = new Uint8Array([
      0xff, 0xd8,
      0xff, 0xc0, 0x00, 0x11, 0x08, 0x00, 0x1e, 0x00, 0x3c, 0x03, 0x01, 0x11, 0x00, 0x02, 0x11, 0x00, 0x03, 0x11, 0x00,
      0xff, 0xd9,
    ])
    expect(readJpegPixelSize(jpeg)).toEqual({ width: 60, height: 30 })
  })

  it('returns null for non-JPEG input', () => {
    expect(readJpegPixelSize(new Uint8Array([0x89, 0x50, 0x4e, 0x47]))).toBe(null)
  })
})

describe('readJpegInfo (deteksi CMYK)', () => {
  it('membaca 3 komponen untuk JPEG RGB', () => {
    const jpeg = new Uint8Array([
      0xff, 0xd8,
      0xff, 0xc0, 0x00, 0x11, 0x08, 0x00, 0x1e, 0x00, 0x3c, 0x03, 0x01, 0x11, 0x00, 0x02, 0x11, 0x00, 0x03, 0x11, 0x00,
      0xff, 0xd9,
    ])
    expect(readJpegInfo(jpeg)?.components).toBe(3)
  })

  it('membaca 4 komponen untuk JPEG CMYK', () => {
    const jpeg = new Uint8Array([
      0xff, 0xd8,
      0xff, 0xc0, 0x00, 0x14, 0x08, 0x00, 0x1e, 0x00, 0x3c, 0x04, 0x01, 0x11, 0x00, 0x02, 0x11, 0x00, 0x03, 0x11, 0x00, 0x04, 0x11, 0x00,
      0xff, 0xd9,
    ])
    const info = readJpegInfo(jpeg)
    expect(info?.components).toBe(4)
    expect(info?.width).toBe(60)
    expect(info?.height).toBe(30)
  })
})
