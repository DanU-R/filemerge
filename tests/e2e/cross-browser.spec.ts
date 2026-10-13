import { test, expect, type Page } from '@playwright/test'
import { PDFDocument } from '@cantoo/pdf-lib'

async function pdfWithPages(sizes: [number, number][]): Promise<Buffer> {
  const doc = await PDFDocument.create()
  for (const [w, h] of sizes) doc.addPage([w, h])
  return Buffer.from(await doc.save())
}

function imageDims(bytes: Uint8Array): [number, number][] {
  const s = Buffer.from(bytes).toString('latin1')
  const widths = [...s.matchAll(/\/Width\s+(\d+)/g)].map((m) => Number(m[1]))
  const heights = [...s.matchAll(/\/Height\s+(\d+)/g)].map((m) => Number(m[1]))
  return widths.map((w, i) => [w, heights[i] ?? 0])
}

function app1(orientation: number): Buffer {
  const exifHeader = [0x45, 0x78, 0x69, 0x66, 0x00, 0x00]
  const tiff = [
    0x49, 0x49, 0x2a, 0x00, 0x08, 0x00, 0x00, 0x00, 0x01, 0x00, 0x12, 0x01, 0x03, 0x00, 0x01,
    0x00, 0x00, 0x00, orientation, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  ]
  const payload = Buffer.from([...exifHeader, ...tiff])
  const size = payload.length + 2
  return Buffer.from([0xff, 0xe1, (size >> 8) & 0xff, size & 0xff, ...payload])
}

async function exifJpeg(page: Page, orientation: number, w = 60, h = 30): Promise<Buffer> {
  const b64 = await page.evaluate(
    async ([ww, hh]) => {
      const c = document.createElement('canvas')
      c.width = ww
      c.height = hh
      const ctx = c.getContext('2d')!
      ctx.fillStyle = '#3366cc'
      ctx.fillRect(0, 0, ww, hh)
      const blob: Blob = await new Promise((r) => c.toBlob((b) => r(b!), 'image/jpeg', 0.9))
      const buf = new Uint8Array(await blob.arrayBuffer())
      let s = ''
      for (const b of buf) s += String.fromCharCode(b)
      return btoa(s)
    },
    [w, h],
  )
  const jpeg = Buffer.from(b64, 'base64')
  return Buffer.concat([jpeg.subarray(0, 2), app1(orientation), jpeg.subarray(2)])
}

async function mergedBytes(page: Page): Promise<Uint8Array> {
  const b64 = await page.evaluate(async () => {
    const a = document.querySelector('[data-testid="download"]') as HTMLAnchorElement
    const res = await fetch(a.href)
    const buf = new Uint8Array(await res.arrayBuffer())
    let s = ''
    for (const b of buf) s += String.fromCharCode(b)
    return btoa(s)
  })
  return new Uint8Array(Buffer.from(b64, 'base64'))
}

// Jalankan suite ini di setiap browser yang dikonfigurasi (chromium + firefox).
test.describe('FileMerge MVP: lintas browser', () => {
  test('merge PDF + gambar & EXIF orientation tegak', async ({ page }) => {
    await page.goto('/merge')
    await page.setInputFiles('[data-testid="file-input"]', [
      { name: 'a.pdf', mimeType: 'application/pdf', buffer: await pdfWithPages([[200, 200]]) },
      { name: 'foto.jpg', mimeType: 'image/jpeg', buffer: await exifJpeg(page, 6, 60, 30) },
    ])
    await expect(page.locator('[data-testid="queue-item"]')).toHaveCount(2)
    await page.click('[data-testid="merge"]')
    await expect(page.locator('[data-testid="result"]')).toHaveAttribute('data-result-id', '1')

    const bytes = await mergedBytes(page)
    const dims = imageDims(bytes)
    expect(dims.length).toBeGreaterThan(0)
    // EXIF 6 pada gambar 60x30 -> harus portrait (h > w)
    expect(dims[0][1]).toBeGreaterThan(dims[0][0])
    // Halaman: 1 PDF + 1 gambar
    const boxes = [...Buffer.from(bytes).toString('latin1').matchAll(/MediaBox/g)]
    expect(boxes.length).toBeGreaterThanOrEqual(2)
  })

  test('merge via main thread (fallback tanpa Web Worker)', async ({ page }) => {
    await page.addInitScript(() => {
      // Paksa fallback: hilangkan konstruktor Worker.
      delete (window as unknown as Record<string, unknown>).Worker
    })
    await page.goto('/merge')
    await page.setInputFiles('[data-testid="file-input"]', [
      {
        name: 'a.pdf',
        mimeType: 'application/pdf',
        buffer: await pdfWithPages([[200, 200], [200, 200]]),
      },
    ])
    await page.click('[data-testid="merge"]')
    await expect(page.locator('[data-testid="result"]')).toHaveAttribute('data-result-id', '1')
    const s = Buffer.from(await mergedBytes(page)).toString('latin1')
    expect([...s.matchAll(/MediaBox/g)].length).toBeGreaterThanOrEqual(2)
  })
})
