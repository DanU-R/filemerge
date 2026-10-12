import { test, expect } from '@playwright/test'
import { PDFDocument } from '@cantoo/pdf-lib'

const BASE = 'http://127.0.0.1:3100'

async function pdfBytes(sizes: number[]): Promise<Buffer> {
  const d = await PDFDocument.create()
  for (const w of sizes) d.addPage([w, 200])
  return Buffer.from(await d.save())
}
function mediaBoxes(bytes: Uint8Array): [number, number][] {
  const s = Buffer.from(bytes).toString('latin1')
  return [...s.matchAll(/\/MediaBox\s*\[\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\]/g)].map(
    (m) => [Math.round(Number(m[3])), Math.round(Number(m[4]))],
  )
}
async function pick(page: import('@playwright/test').Page, buffer: Buffer, name = 'doc.pdf') {
  await page.setInputFiles('[data-testid="pdftools-input"]', {
    name,
    mimeType: 'application/pdf',
    buffer,
  })
  await expect(page.locator('[data-testid="pdftools-page"]').first()).toBeVisible({
    timeout: 30000,
  })
}
async function downloadedBytes(page: import('@playwright/test').Page): Promise<Uint8Array> {
  const dl = await page.waitForEvent('download', { timeout: 30000 })
  const stream = await dl.createReadStream()
  const chunks: Buffer[] = []
  for await (const c of stream) chunks.push(Buffer.from(c))
  return new Uint8Array(Buffer.concat(chunks))
}

test.describe('Fase 5 lanjutan — alat PDF (rotasi/hapus/split/kompres)', () => {
  test('menampilkan daftar halaman dengan ukuran', async ({ page }) => {
    await page.goto(BASE + '/merge')
    await pick(page, await pdfBytes([200, 300, 400]))
    await expect(page.locator('[data-testid="pdftools-page"]')).toHaveCount(3)
    await expect(page.locator('[data-testid="pdftools-summary"]')).toContainText('3 halaman')
  })

  test('hapus satu halaman lalu terapkan', async ({ page }) => {
    await page.goto(BASE + '/merge')
    await pick(page, await pdfBytes([200, 200, 200]))
    await page.locator('[data-testid="page-delete"]').nth(1).click()
    await expect(page.locator('[data-testid="page-deleted"]')).toHaveCount(1)
    await expect(page.locator('[data-testid="pdftools-summary"]')).toContainText('2 dipakai')

    const dl = page.waitForEvent('download', { timeout: 40000 })
    await page.click('[data-testid="pdftools-apply"]')
    const d = await dl
    expect(d.suggestedFilename()).toMatch(/\.pdf$/)
    expect(d.suggestedFilename()).not.toMatch(/\.pdf\.pdf$/)
    // Hasil harus punya 2 halaman (1 dari 3 dihapus).
    const stream = await d.createReadStream()
    const chunks: Buffer[] = []
    for await (const c of stream) chunks.push(Buffer.from(c))
    const s = Buffer.concat(chunks).toString('latin1')
    expect([...s.matchAll(/\/Type\s*\/Page[^s]/g)].length).toBe(2)
  })

  test('tolak saat semua halaman dihapus', async ({ page }) => {
    await page.goto(BASE + '/merge')
    await pick(page, await pdfBytes([200, 200]))
    for (const b of await page.locator('[data-testid="page-delete"]').all()) await b.click()
    await expect(page.locator('[data-testid="pdftools-summary"]')).toContainText('0 dipakai')
    await page.click('[data-testid="pdftools-apply"]')
    await expect(page.locator('[data-testid="pdftools-error"]')).toContainText('minimal 1 halaman')
  })

  test('rotasi tercatat dan diterapkan ke PDF hasil', async ({ page }) => {
    await page.goto(BASE + '/merge')
    await pick(page, await pdfBytes([200, 300]))
    await page.locator('[data-testid="page-rotate-90"]').first().click()
    await expect(page.locator('[data-testid="pdftools-page"]').first()).toContainText('+90°')

    const dl = page.waitForEvent('download', { timeout: 40000 })
    await page.click('[data-testid="pdftools-apply"]')
    const d = await dl
    const stream = await d.createReadStream()
    const chunks: Buffer[] = []
    for await (const c of stream) chunks.push(Buffer.from(c))
    const s = Buffer.concat(chunks).toString('latin1')
    expect(s).toMatch(/\/Rotate\s+90/)
    // Halaman tetap 2 (tidak ada yang hilang).
    expect([...s.matchAll(/\/Type\s*\/Page[^s]/g)].length).toBe(2)
  })

  test('pecah PDF menghasilkan tiap bagian (unduhan tidak hilang)', async ({ page }) => {
    await page.goto(BASE + '/merge')
    await pick(page, await pdfBytes([200, 200, 200, 200]), 'empat.pdf')
    await page.fill('[data-testid="split-ranges"]', '1-2, 4')
    const files: { name: string; bytes: Buffer }[] = []
    page.on('download', async (dl) => {
      const st = await dl.createReadStream()
      const chunks: Buffer[] = []
      for await (const c of st) chunks.push(Buffer.from(c))
      files.push({ name: dl.suggestedFilename(), bytes: Buffer.concat(chunks) })
    })
    await page.click('[data-testid="split-run"]')
    await expect(page.locator('[data-testid="pdftools-notice"]')).toContainText('2 file', {
      timeout: 40000,
    })
    await expect.poll(() => files.length, { timeout: 15000 }).toBe(2)
    const counts = files
      .map((f) => [...f.bytes.toString('latin1').matchAll(/\/Type\s*\/Page[^s]/g)].length)
      .sort()
    expect(counts).toEqual([1, 2])
    expect(files.every((f) => /\.pdf$/.test(f.name) && !/\.pdf\.pdf$/.test(f.name))).toBe(true)
  })

  test('rentang tidak valid memberi pesan jelas', async ({ page }) => {
    await page.goto(BASE + '/merge')
    await pick(page, await pdfBytes([200, 200]))
    await page.fill('[data-testid="split-ranges"]', 'abc')
    await page.click('[data-testid="split-run"]')
    await expect(page.locator('[data-testid="pdftools-error"]')).toContainText('tidak dikenali', {
      timeout: 30000,
    })
  })

  test('kompres PDF: nama benar, file valid, laporan jujur', async ({ page }) => {
    await page.goto(BASE + '/merge')
    await pick(page, await pdfBytes([200, 200, 200]), 'kompres.pdf')
    const dl = page.waitForEvent('download', { timeout: 40000 })
    await page.click('[data-testid="compress-run"]')
    const d = await dl
    expect(d.suggestedFilename()).toBe('kompres-kompres.pdf')
    const stream = await d.createReadStream()
    const chunks: Buffer[] = []
    for await (const c of stream) chunks.push(Buffer.from(c))
    // Hasil tetap PDF valid dengan jumlah halaman sama.
    expect([...Buffer.concat(chunks).toString('latin1').matchAll(/\/Type\s*\/Page[^s]/g)].length).toBe(3)
    await expect(page.locator('[data-testid="pdftools-notice"]')).toContainText(/hemat|penghematan/i)
  })

  test('file bukan PDF ditolak dengan pesan', async ({ page }) => {
    await page.goto(BASE + '/merge')
    await page.setInputFiles('[data-testid="pdftools-input"]', {
      name: 'palsu.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('bukan pdf sama sekali'),
    })
    await expect(page.locator('[data-testid="pdftools-error"]')).toContainText('tidak dikenali', {
      timeout: 30000,
    })
  })
})
