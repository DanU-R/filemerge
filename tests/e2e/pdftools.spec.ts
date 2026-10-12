import { test, expect } from '@playwright/test'
import { PDFDocument } from '@cantoo/pdf-lib'

const BASE = 'http://127.0.0.1:3100'

async function pdfBytes(sizes: number[]): Promise<Buffer> {
  const d = await PDFDocument.create()
  for (const w of sizes) d.addPage([w, 200])
  return Buffer.from(await d.save())
}
/** Satu halaman per pasangan [lebar, tinggi] — untuk uji yang butuh ukuran eksplisit. */
async function pdfSized(pages: [number, number][]): Promise<Buffer> {
  const d = await PDFDocument.create()
  for (const [w, h] of pages) d.addPage([w, h])
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
    await pick(page, await pdfSized([[300, 400]]))
    await page.locator('[data-testid="page-rotate-90"]').first().click()
    await expect(page.locator('[data-testid="pdftools-page"]').first()).toContainText('90°')

    const dl = page.waitForEvent('download', { timeout: 40000 })
    await page.click('[data-testid="pdftools-apply"]')
    const d = await dl
    const stream = await d.createReadStream()
    const chunks: Buffer[] = []
    for await (const c of stream) chunks.push(Buffer.from(c))
    const s = Buffer.concat(chunks).toString('latin1')
    expect(s).toMatch(/\/Rotate\s+90/)
    // Halaman tidak hilang.
    expect([...s.matchAll(/\/Type\s*\/Page[^s]/g)].length).toBe(1)
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

  test('pratinjau halaman dirender (gambar nyata, bukan placeholder)', async ({ page }) => {
    await page.goto(BASE + '/merge')
    await pick(page, await pdfBytes([300, 300, 300]))
    await expect(page.locator('[data-testid="thumb-img"]')).toHaveCount(3, { timeout: 45000 })
    // Gambar harus benar-benar termuat dari blob pdf.js (bukan broken image).
    const sizes = await page.locator('[data-testid="thumb-img"]').evaluateAll((els) =>
      els.map((el) => (el as HTMLImageElement).naturalWidth),
    )
    expect(sizes.every((w) => w > 0)).toBe(true)
  })

  test('rotasi mengubah pratinjau secara visual (kotak bertukar + sudut berubah)', async ({ page }) => {
    await page.goto(BASE + '/merge')
    await pick(page, await pdfSized([[300, 400]]))
    await expect(page.locator('[data-testid="thumb-img"]')).toHaveCount(1, { timeout: 45000 })

    const before = await page.locator('[data-testid="thumb-img"]').first().evaluate((el) => {
      const r = el as HTMLImageElement
      return { w: r.width, h: r.height, transform: getComputedStyle(r).transform }
    })
    expect(before.h).toBeGreaterThan(before.w) // tegak

    await page.locator('[data-testid="page-rotate-90"]').first().click()
    await page.waitForFunction(
      (t) => {
        const el = document.querySelector('[data-testid="thumb-img"]') as HTMLImageElement
        return getComputedStyle(el).transform !== t
      },
      before.transform,
      { timeout: 10000 },
    )
    const after = await page.locator('[data-testid="thumb-img"]').first().evaluate((el) => {
      const r = el as HTMLImageElement
      return { w: r.width, h: r.height, transform: getComputedStyle(r).transform }
    })
    // Kotak bertukar: sekarang melintang
    expect(after.w).toBeGreaterThan(after.h)
    expect(after.transform).not.toBe(before.transform)
    await expect(page.locator('[data-testid="pdftools-page"]').first()).toContainText('90°')
  })

  test('susun ulang: tombol kiri/kanan mengubah urutan halaman pada hasil', async ({ page }) => {
    await page.goto(BASE + '/merge')
    // Dua halaman dengan lebar berbeda supaya urutan hasil bisa diperiksa.
    await pick(page, await pdfSized([
      [100, 300],
      [900, 300],
    ]), 'dua.pdf')
    await expect(page.locator('[data-testid="pdftools-page"]')).toHaveCount(2)
    await expect(page.locator('[data-testid="page-pos"]').first()).toHaveText('#1')

    // Geser halaman pertama ke kanan -> halaman 900 jadi posisi #1.
    await page.locator('[data-testid="page-down"]').first().click()
    await expect(page.locator('[data-testid="page-pos"]').first()).toHaveText('#1')
    const firstLabel = await page.locator('[data-testid="pdftools-page"]').first().textContent()
    expect(firstLabel).toContain('Hal 2')

    const dl = page.waitForEvent('download', { timeout: 40000 })
    await page.click('[data-testid="pdftools-apply"]')
    const d = await dl
    const stream = await d.createReadStream()
    const chunks: Buffer[] = []
    for await (const c of stream) chunks.push(Buffer.from(c))
    const s = Buffer.concat(chunks).toString('latin1')
    const widths = [...s.matchAll(/\/MediaBox\s*\[[^\]]*?([\d.]+)\s+([\d.]+)\s*\]/g)].map((m) =>
      Math.round(Number(m[1])),
    )
    expect(widths[0]).toBe(900) // halaman lebar sekarang lebih dulu
    expect(widths[1]).toBe(100)
    await expect(page.locator('[data-testid="pdftools-notice"]')).toContainText('urutan diubah')
  })

  test('susun ulang: drag handle tersedia & bisa mengubah urutan', async ({ page }) => {
    await page.goto(BASE + '/merge')
    await pick(page, await pdfSized([
      [100, 300],
      [900, 300],
    ]), 'dua.pdf')
    await expect(page.locator('[data-testid="page-drag-handle"]')).toHaveCount(2)

    // Drag halaman pertama ke posisi halaman kedua.
    const h = page.locator('[data-testid="page-drag-handle"]').first()
    const target = page.locator('[data-testid="pdftools-page"]').nth(1)
    // Pastikan kartu benar-benar terlihat di viewport sebelum menghitung koordinat,
    // kalau tidak boundingBox bisa bernilai negatif dan drag tidak terjadi.
    await target.scrollIntoViewIfNeeded()
    await page.evaluate(() => window.scrollBy(0, -80))
    const hb = (await h.boundingBox())!
    const tb = (await target.boundingBox())!
    expect(hb.y).toBeGreaterThanOrEqual(0)
    await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2)
    await page.mouse.down()
    await page.mouse.move(tb.x + tb.width / 2, tb.y + tb.height / 2, { steps: 15 })
    await page.mouse.move(tb.x + tb.width / 2 + 10, tb.y + tb.height / 2 + 6, { steps: 5 })
    await page.mouse.up()

    // Urutan berubah: halaman 2 kini di posisi pertama.
    await expect(page.locator('[data-testid="pdftools-page"]').first()).toContainText('Hal 2', {
      timeout: 10000,
    })
  })

  test('susun ulang + rotasi + hapus sekaligus tetap benar', async ({ page }) => {
    await page.goto(BASE + '/merge')
    await pick(page, await pdfSized([
      [100, 300],
      [200, 300],
      [900, 300],
    ]), 'tiga.pdf')

    // Hapus halaman 2 (tengah)
    await page.locator('[data-testid="page-delete"]').nth(1).click()
    // Geser halaman pertama ke kanan -> 200(terhapus dilewati?) cukup pastikan tidak crash
    await page.locator('[data-testid="page-down"]').first().click()
    // Putar halaman pertama yang tersisa
    await page.locator('[data-testid="page-rotate-90"]').first().click()

    const dl = page.waitForEvent('download', { timeout: 40000 })
    await page.click('[data-testid="pdftools-apply"]')
    const d = await dl
    const stream = await d.createReadStream()
    const chunks: Buffer[] = []
    for await (const c of stream) chunks.push(Buffer.from(c))
    const s = Buffer.concat(chunks).toString('latin1')
    expect([...s.matchAll(/\/Type\s*\/Page[^s]/g)].length).toBe(2)
    expect(s).toMatch(/\/Rotate\s+90/)
  })

  test('pratinjau gagal tetap tidak menghalangi editing (degradasi anggun)', async ({ page }) => {
    // Blokir worker pdf.js -> render gagal, editor harus tetap berfungsi.
    await page.route('**/pdf.worker.min.mjs', (r) => r.abort())
    await page.goto(BASE + '/merge')
    await pick(page, await pdfBytes([200, 200, 200]), 'tanpa-pratinjau.pdf')

    await expect(page.locator('[data-testid="thumbs-status"]')).toContainText(/tidak tersedia/i, {
      timeout: 45000,
    })
    // Inti tetap bisa dipakai: hapus halaman + unduh hasil.
    await page.locator('[data-testid="page-delete"]').first().click()
    await expect(page.locator('[data-testid="pdftools-summary"]')).toContainText('2 dipakai')
    const dl = page.waitForEvent('download', { timeout: 40000 })
    await page.click('[data-testid="pdftools-apply"]')
    const d = await dl
    const stream = await d.createReadStream()
    const chunks: Buffer[] = []
    for await (const c of stream) chunks.push(Buffer.from(c))
    expect([...Buffer.concat(chunks).toString('latin1').matchAll(/\/Type\s*\/Page[^s]/g)].length).toBe(2)
  })
})
