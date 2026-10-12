import { describe, it, expect } from 'vitest'
import { PDFDocument } from '@cantoo/pdf-lib'
import { mergeDocuments, fitImageOnPage } from '../../src/lib/pdfMerge'
import { validateFile } from '../../src/lib/validate'
import { isOverFileLimit, wouldExceedTotal } from '../../src/lib/limits'
import type { DecodedImage, MergeSource } from '../../src/lib/types'

const PNG_1x1 = new Uint8Array(
  Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFElEQVR4nGP4z8DAAMIM////ZwAAHu8E/KPItPcAAAAASUVORK5CYII=',
    'base64',
  ),
)

async function pdfBytes(pages: number): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  for (let i = 0; i < pages; i++) doc.addPage([200, 200])
  return new Uint8Array(await doc.save())
}

function src(id: string, kind: 'pdf' | 'image', bytes: Uint8Array, name: string): MergeSource {
  return { id, kind, name, file: new Blob([bytes as unknown as BlobPart]) }
}

const decoder = async (): Promise<DecodedImage> => ({
  bytes: PNG_1x1,
  format: 'png',
  width: 100,
  height: 300,
  pages: 1,
})

describe('mergeDocuments', () => {
  it('merges PDF + image and counts total pages', async () => {
    const sources = [
      src('1', 'pdf', await pdfBytes(2), 'a.pdf'),
      src('2', 'image', PNG_1x1, 'b.png'),
    ]
    const r = await mergeDocuments(sources, decoder)
    expect(r.failures).toHaveLength(0)
    expect(r.pages).toBe(3)
    const check = await PDFDocument.load(r.bytes)
    expect(check.getPageCount()).toBe(3)
  })

  it('records a corrupt PDF as a failure without crashing', async () => {
    const sources = [
      src('1', 'pdf', new Uint8Array([1, 2, 3, 4, 5]), 'bad.pdf'),
      src('2', 'pdf', await pdfBytes(1), 'ok.pdf'),
    ]
    const r = await mergeDocuments(sources, decoder)
    expect(r.failures).toHaveLength(1)
    expect(r.failures[0].name).toBe('bad.pdf')
    expect(r.pages).toBe(1)
  })

  it('marks an empty file', async () => {
    const r = await mergeDocuments([src('1', 'pdf', new Uint8Array(), 'e.pdf')], decoder)
    expect(r.failures).toHaveLength(1)
    expect(r.failures[0].reason).toMatch(/kosong/i)
  })

  it('preserves queue order of pages', async () => {
    const r = await mergeDocuments(
      [
        src('a', 'pdf', await pdfBytes(1), 'first.pdf'),
        src('b', 'pdf', await pdfBytes(1), 'second.pdf'),
      ],
      decoder,
    )
    expect(r.pages).toBe(2)
  })
})

describe('fitImageOnPage', () => {
  it('preserves aspect ratio within A4', () => {
    const { width, height } = fitImageOnPage(100, 300)
    expect(width / height).toBeCloseTo(100 / 300, 3)
    expect(height).toBeLessThanOrEqual(841.89)
    expect(width).toBeLessThanOrEqual(595.28)
  })
})

describe('batas ukuran file', () => {
  it('menolak file tepat pada/di atas 50 MB (>=), menerima di bawahnya', () => {
    const MB = 1024 * 1024
    const pdf = new Uint8Array([0x25, 0x50, 0x44, 0x46])
    const meta = (size: number) => ({ name: 'a.pdf', type: 'application/pdf', size })
    expect(validateFile(meta(50 * MB), pdf).ok).toBe(false)
    expect(validateFile(meta(50 * MB - 1), pdf).ok).toBe(true)
    expect(isOverFileLimit(50 * MB)).toBe(true)
    expect(isOverFileLimit(50 * MB - 1)).toBe(false)
  })

  it('wouldExceedTotal membatasi total antrean 200 MB', () => {
    const MB = 1024 * 1024
    expect(wouldExceedTotal(199 * MB, 1 * MB)).toBe(false)
    expect(wouldExceedTotal(200 * MB, 1)).toBe(true)
  })
})
