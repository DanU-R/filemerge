import { describe, it, expect } from 'vitest'
import { PDFDocument } from '@cantoo/pdf-lib'
import { compressPdf } from '../../src/lib/compressPdf'

async function pdfWithMeta(pages: number, title: string): Promise<Uint8Array> {
  const d = await PDFDocument.create()
  for (let i = 0; i < pages; i++) d.addPage([595, 842])
  d.setTitle(title)
  d.setAuthor('FileMerge')
  d.setSubject('Dokumen contoh pengujian')
  d.setKeywords(['a', 'b', 'c'])
  d.setProducer('producer-long-name-here')
  d.setCreator('creator-long-name-here')
  return d.save()
}

describe('compressPdf', () => {
  it('menghasilkan PDF valid dengan jumlah halaman sama', async () => {
    const bytes = await pdfWithMeta(3, 'Judul yang cukup panjang untuk metadata')
    const r = await compressPdf(bytes)
    const loaded = await PDFDocument.load(r.bytes)
    expect(loaded.getPageCount()).toBe(3)
    expect(r.pages).toBe(3)
  })

  it('tidak pernah memperbesar output', async () => {
    const bytes = await pdfWithMeta(2, 'X')
    const r = await compressPdf(bytes)
    expect(r.compressedBytes).toBeLessThanOrEqual(r.originalBytes)
    expect(r.savedRatio).toBeGreaterThanOrEqual(0)
  })

  it('melaporkan savedRatio secara jujur (bisa 0)', async () => {
    const bytes = await pdfWithMeta(1, 'Y')
    const r = await compressPdf(bytes)
    expect(r.savedRatio).toBeGreaterThanOrEqual(0)
    expect(r.savedRatio).toBeLessThanOrEqual(1)
    // bytes yang dikembalikan selalu valid
    await expect(PDFDocument.load(r.bytes)).resolves.toBeTruthy()
  })
})
