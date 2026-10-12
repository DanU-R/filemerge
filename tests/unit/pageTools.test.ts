import { describe, it, expect } from 'vitest'
import { PDFDocument } from '@cantoo/pdf-lib'
import { applyPageEdits, inspectPdf, parseRanges, resolvePageOrder, splitPdf } from '../../src/lib/pageTools'

async function makePdf(sizes: [number, number][]): Promise<Uint8Array> {
  const d = await PDFDocument.create()
  for (const [w, h] of sizes) d.addPage([w, h])
  return d.save()
}

function mediaBoxCount(bytes: Uint8Array): number {
  const s = Buffer.from(bytes).toString('latin1')
  return [...s.matchAll(/\/Type\s*\/Page[^s]/g)].length
}

describe('inspectPdf', () => {
  it('mengembalikan info tiap halaman (urutan & ukuran)', async () => {
    const bytes = await makePdf([
      [200, 300],
      [400, 500],
    ])
    const { pages } = await inspectPdf(bytes)
    expect(pages).toHaveLength(2)
    expect(pages[0]).toMatchObject({ index: 0, width: 200, height: 300, rotation: 0 })
    expect(pages[1]).toMatchObject({ index: 1, width: 400, height: 500 })
  })

  it('menukar lebar/tinggi untuk halaman rotasi 90', async () => {
    const d = await PDFDocument.create()
    const p = d.addPage([200, 400])
    p.setRotation({ type: 'degrees', angle: 90 } as never)
    const { pages } = await inspectPdf(await d.save())
    expect(pages[0].rotation).toBe(90)
    expect(pages[0].width).toBe(400)
    expect(pages[0].height).toBe(200)
  })
})

describe('resolvePageOrder', () => {
  it('urutan asal bila tidak ada order', () => {
    expect(resolvePageOrder([{}, {}, {}])).toEqual([0, 1, 2])
  })

  it('mengikuti order bila diberikan', () => {
    expect(resolvePageOrder([{ order: 2 }, { order: 0 }, { order: 1 }])).toEqual([1, 2, 0])
  })

  it('order sebagian diisi -> sisanya tetap di posisi asal', () => {
    expect(resolvePageOrder([{ order: 1 }, {}, { order: 0 }])).toEqual([2, 0, 1])
  })
})

describe('applyPageEdits — susun ulang', () => {
  it('membalik urutan 2 halaman', async () => {
    // Halaman berukuran berbeda supaya urutannya bisa diperiksa.
    const d = await PDFDocument.create()
    d.addPage([100, 100])
    d.addPage([900, 900])
    const bytes = await d.save()

    const out = await applyPageEdits(bytes, [{ order: 1 }, { order: 0 }])
    const s = Buffer.from(out).toString('latin1')
    const boxes = [...s.matchAll(/\/MediaBox\s*\[[^\]]*?([\d.]+)\s+([\d.]+)\s*\]/g)].map((m) =>
      Math.round(Number(m[1])),
    )
    // Halaman 900 sekarang lebih dulu.
    expect(boxes[0]).toBe(900)
    expect(boxes[1]).toBe(100)
  })

  it('urutan + rotasi + hapus digabung', async () => {
    const d = await PDFDocument.create()
    d.addPage([100, 100])
    d.addPage([200, 200])
    d.addPage([300, 300])
    const bytes = await d.save()

    // hapus halaman 2 (tengah), lalu tukar sisa: 300 dulu, 100 kemudian
    const out = await applyPageEdits(bytes, [
      { order: 1 },
      { deleted: true },
      { order: 0, rotate: 90 },
    ])
    const s = Buffer.from(out).toString('latin1')
    expect([...s.matchAll(/\/Type\s*\/Page[^s]/g)].length).toBe(2)
    const boxes = [...s.matchAll(/\/MediaBox\s*\[[^\]]*?([\d.]+)\s+([\d.]+)\s*\]/g)].map((m) =>
      Math.round(Number(m[1])),
    )
    expect(boxes[0]).toBe(300)
    expect(boxes[1]).toBe(100)
    expect(s).toMatch(/\/Rotate\s+90/)
  })

  it('mengabaikan halaman yang dihapus walau ada order', async () => {
    const bytes = await makePdf([
      [200, 200],
      [200, 200],
      [200, 200],
    ])
    const out = await applyPageEdits(bytes, [
      { order: 0, deleted: true },
      { order: 1 },
      { order: 2 },
    ])
    expect(mediaBoxCount(out)).toBe(2)
  })
})

describe('applyPageEdits', () => {
  it('menghapus halaman yang ditandai', async () => {
    const bytes = await makePdf([[200, 200], [200, 200], [200, 200]])
    const out = await applyPageEdits(bytes, [{}, { deleted: true }, {}])
    expect(mediaBoxCount(out)).toBe(2)
  })

  it('menerapkan rotasi 90 ke satu halaman', async () => {
    const bytes = await makePdf([[200, 300]])
    const out = await applyPageEdits(bytes, [{ rotate: 90 }])
    const s = Buffer.from(out).toString('latin1')
    expect(s).toMatch(/\/Rotate\s+90/)
  })

  it('rotasi 180 digabung dengan rotasi asal', async () => {
    const d = await PDFDocument.create()
    const p = d.addPage([200, 200])
    p.setRotation({ type: 'degrees', angle: 90 } as never)
    const out = await applyPageEdits(await d.save(), [{ rotate: 180 }])
    const s = Buffer.from(out).toString('latin1')
    expect(s).toMatch(/\/Rotate\s+270/)
  })

  it('menolak bila semua halaman dihapus', async () => {
    const bytes = await makePdf([[200, 200]])
    await expect(applyPageEdits(bytes, [{ deleted: true }])).rejects.toThrow(/minimal|tersisa/i)
  })

  it('tanpa perubahan tetap menghasilkan PDF valid', async () => {
    const bytes = await makePdf([[200, 200], [200, 200]])
    const out = await applyPageEdits(bytes, [{}, {}])
    expect(mediaBoxCount(out)).toBe(2)
  })
})

describe('splitPdf', () => {
  it('memecah sesuai rentang (1-based inklusif)', async () => {
    const bytes = await makePdf([[200, 200], [200, 200], [200, 200], [200, 200]])
    const parts = await splitPdf(bytes, [
      { from: 1, to: 2 },
      { from: 4, to: 4 },
    ])
    expect(parts).toHaveLength(2)
    expect(mediaBoxCount(parts[0])).toBe(2)
    expect(mediaBoxCount(parts[1])).toBe(1)
  })

  it('membatasi rentang yang melebihi jumlah halaman', async () => {
    const bytes = await makePdf([[200, 200], [200, 200]])
    const parts = await splitPdf(bytes, [{ from: 1, to: 99 }])
    expect(mediaBoxCount(parts[0])).toBe(2)
  })
})

describe('parseRanges', () => {
  it('mengurai "1-3, 5"', () => {
    expect(parseRanges('1-3, 5', 10)).toEqual([
      { from: 1, to: 3 },
      { from: 5, to: 5 },
    ])
  })

  it('menolak halaman di luar batas', () => {
    expect(() => parseRanges('9-12', 10)).toThrow(/di luar/)
  })

  it('menolak rentang terbalik', () => {
    expect(() => parseRanges('5-2', 10)).toThrow(/terbalik/)
  })

  it('menolak format tak dikenal', () => {
    expect(() => parseRanges('abc', 10)).toThrow(/tidak dikenali/)
    expect(() => parseRanges('', 10)).toThrow(/kosong/)
  })
})
