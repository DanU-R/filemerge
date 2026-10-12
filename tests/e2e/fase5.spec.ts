import { test, expect, type Page } from '@playwright/test'
import { PDFDocument } from '@cantoo/pdf-lib'

const BASE = 'http://127.0.0.1:3100'
const PASSWORD = 'rahasia12345'

async function pdfBytes(pages: number, w = 200): Promise<Buffer> {
  const doc = await PDFDocument.create()
  for (let i = 0; i < pages; i++) doc.addPage([w + i, 200])
  return Buffer.from(await doc.save())
}
async function pngBytes(): Promise<Buffer> {
  const doc = await PDFDocument.create()
  const png = await doc.embedPng(
    Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFElEQVR4nGP4z8DAAMIM////ZwAAHu8E/KPItPcAAAAASUVORK5CYII=',
      'base64',
    ),
  )
  // kembali ke PNG asli: ambil bytes dari embed tidak langsung; cukup pakai file PNG kecil statis
  void png
  return Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFElEQVR4nGP4z8DAAMIM////ZwAAHu8E/KPItPcAAAAASUVORK5CYII=',
    'base64',
  )
}
function mediaBoxes(bytes: Uint8Array): [number, number][] {
  const s = Buffer.from(bytes).toString('latin1')
  return [...s.matchAll(/\/MediaBox\s*\[\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\]/g)].map(
    (m) => [Number(m[3]), Number(m[4])],
  )
}
function uniqueEmail(tag: string) {
  return `${tag}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`
}
async function register(page: Page, email: string) {
  await page.goto(BASE + '/register')
  await page.fill('[data-testid="email"]', email)
  await page.fill('[data-testid="password"]', PASSWORD)
  await page.click('[data-testid="submit"]')
  await page.waitForURL('**/dashboard', { timeout: 30000 })
}
async function uploadDoc(page: Page, name: string, pages = 1) {
  const before = await page.locator('[data-testid="doc-item"]').count()
  await page.setInputFiles('[data-testid="doc-file"]', {
    name: `${name}.pdf`,
    mimeType: 'application/pdf',
    buffer: await pdfBytes(pages),
  })
  await page.fill('[data-testid="doc-name"]', name)
  await page.click('[data-testid="upload"]')
  await expect(page.locator('[data-testid="doc-item"]')).toHaveCount(before + 1, { timeout: 30000 })
}
async function mergedBytes(page: Page): Promise<Uint8Array> {
  const b64 = await page.evaluate(async () => {
    const a = document.querySelector('[data-testid="download"]') as HTMLAnchorElement
    const r = await fetch(a.href)
    const u = new Uint8Array(await r.arrayBuffer())
    let s = ''
    for (const x of u) s += String.fromCharCode(x)
    return btoa(s)
  })
  return new Uint8Array(Buffer.from(b64, 'base64'))
}

test.describe('Fase 5 — pengaturan halaman, drag-drop, preset', () => {
  test('pengaturan halaman: Letter landscape diterapkan ke gambar', async ({ page }) => {
    await page.goto(BASE + '/merge')
    await page.setInputFiles('[data-testid="file-input"]', {
      name: 'foto.png',
      mimeType: 'image/png',
      buffer: await pngBytes(),
    })
    await expect(page.locator('[data-testid="queue-item"]')).toHaveCount(1)

    await page.selectOption('[data-testid="page-size"]', 'Letter')
    await page.selectOption('[data-testid="page-orientation"]', 'landscape')
    await page.fill('[data-testid="output-name"]', 'hasil')
    await page.click('[data-testid="merge"]')
    await expect(page.locator('[data-testid="result"]')).toHaveAttribute('data-result-id', '1')

    const boxes = mediaBoxes(await mergedBytes(page))
    expect(boxes.length).toBe(1)
    // Letter landscape = 792 x 612
    expect(Math.round(boxes[0][0])).toBe(792)
    expect(Math.round(boxes[0][1])).toBe(612)
  })

  test('pengaturan halaman: "Sesuai gambar" memakai ukuran gambar + margin', async ({ page }) => {
    await page.goto(BASE + '/merge')
    await page.setInputFiles('[data-testid="file-input"]', {
      name: 'foto.png',
      mimeType: 'image/png',
      buffer: await pngBytes(),
    })
    await page.selectOption('[data-testid="page-size"]', 'fit')
    await page.selectOption('[data-testid="page-margin"]', '24')
    await page.click('[data-testid="merge"]')
    await expect(page.locator('[data-testid="result"]')).toHaveAttribute('data-result-id', '1')
    const boxes = mediaBoxes(await mergedBytes(page))
    // gambar 2x2 px + margin 24 pt -> 50 x 50
    expect(Math.round(boxes[0][0])).toBe(50)
    expect(Math.round(boxes[0][1])).toBe(50)
  })

  test('drag handle tersedia untuk mengubah urutan', async ({ page }) => {
    await page.goto(BASE + '/merge')
    await page.setInputFiles('[data-testid="file-input"]', [
      { name: 'a.pdf', mimeType: 'application/pdf', buffer: await pdfBytes(1, 200) },
      { name: 'b.pdf', mimeType: 'application/pdf', buffer: await pdfBytes(1, 300) },
    ])
    await expect(page.locator('[data-testid="queue-item"]')).toHaveCount(2)
    await expect(page.locator('[data-testid="drag-handle"]')).toHaveCount(2)
  })

  test('preset: simpan susunan dokumen akun, lalu terapkan kembali', async ({ page }) => {
    await register(page, uniqueEmail('preset'))
    await uploadDoc(page, 'CV', 1)
    await uploadDoc(page, 'Ijazah', 2)

    await page.goto(BASE + '/merge')
    // tambah 2 dokumen dari akun ke antrean
    await page.locator('[data-testid="cloud-add"]').nth(0).click()
    await expect(page.locator('[data-testid="queue-item"]')).toHaveCount(1)
    await page.locator('[data-testid="cloud-add"]').nth(1).click()
    await expect(page.locator('[data-testid="queue-item"]')).toHaveCount(2)

    // simpan sebagai preset
    await page.fill('[data-testid="preset-name"]', 'Lamaran')
    await page.click('[data-testid="preset-save"]')
    await expect(page.locator('[data-testid="preset-apply"]')).toContainText('Lamaran', {
      timeout: 30000,
    })

    // bersihkan antrean
    await page.click('button:has-text("Bersihkan")')
    await expect(page.locator('[data-testid="queue-item"]')).toHaveCount(0)

    // terapkan preset -> antrean kembali terisi
    await page.locator('[data-testid="preset-apply"]').first().click()
    await expect(page.locator('[data-testid="queue-item"]')).toHaveCount(2, { timeout: 30000 })

    // merge hasilnya
    await page.click('[data-testid="merge"]')
    await expect(page.locator('[data-testid="result"]')).toHaveAttribute('data-result-id', '1')
    expect(mediaBoxes(await mergedBytes(page)).length).toBe(3)
  })

  test('preset: isolasi — pengguna lain tidak melihat preset', async ({ browser }) => {
    const a = await (await browser.newContext()).newPage()
    await register(a, uniqueEmail('pr-a'))
    await uploadDoc(a, 'Doc A', 1)
    await a.goto(BASE + '/merge')
    await a.locator('[data-testid="cloud-add"]').first().click()
    await expect(a.locator('[data-testid="queue-item"]')).toHaveCount(1)
    await a.fill('[data-testid="preset-name"]', 'PunyaA')
    await a.click('[data-testid="preset-save"]')
    await expect(a.locator('[data-testid="preset-apply"]')).toContainText('PunyaA')

    const b = await (await browser.newContext()).newPage()
    await register(b, uniqueEmail('pr-b'))
    await b.goto(BASE + '/merge')
    await expect(b.locator('[data-testid="preset-apply"]')).toHaveCount(0)
  })
})
