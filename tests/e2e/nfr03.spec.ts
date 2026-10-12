import { test, expect, type Page } from '@playwright/test'
import { PDFDocument } from '@cantoo/pdf-lib'

const BASE = 'http://127.0.0.1:3100'
const PASSWORD = 'rahasia12345'

async function pdfBytes(pages = 1): Promise<Buffer> {
  const d = await PDFDocument.create()
  for (let i = 0; i < pages; i++) d.addPage([200, 200])
  return Buffer.from(await d.save())
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

test.describe('NFR-03 — retry & penanganan kegagalan', () => {
  test('upload gagal 500 sekali lalu berhasil (retry otomatis)', async ({ page }) => {
    await register(page, uniqueEmail('rt-up'))
    let n = 0
    await page.route('**/api/documents', (route) => {
      if (route.request().method() !== 'POST') return route.fallback()
      n += 1
      if (n === 1) {
        return route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'boom' }),
        })
      }
      return route.fallback()
    })

    await uploadDoc(page, 'CV Retry', 1)
    expect(n).toBeGreaterThanOrEqual(2) // membuktikan percobaan ulang terjadi
    await expect(page.locator('[data-testid="dash-notice"]')).toBeVisible()
  })

  test('upload gagal permanen (500 terus) memberi pesan jelas, tanpa crash', async ({ page }) => {
    await register(page, uniqueEmail('rt-fail'))
    await page.route('**/api/documents', (route) =>
      route.request().method() === 'POST'
        ? route.fulfill({
            status: 500,
            contentType: 'application/json',
            body: JSON.stringify({ error: 'Server sedang bermasalah.' }),
          })
        : route.fallback(),
    )
    await page.setInputFiles('[data-testid="doc-file"]', {
      name: 'x.pdf',
      mimeType: 'application/pdf',
      buffer: await pdfBytes(1),
    })
    await page.fill('[data-testid="doc-name"]', 'X')
    await page.click('[data-testid="upload"]')
    await expect(page.locator('[data-testid="dash-error"]')).toContainText('Server sedang bermasalah', {
      timeout: 40000,
    })
    await expect(page.locator('[data-testid="auth-form"]')).toHaveCount(0)
  })

  test('kesalahan permanen (413) TIDAK diulang — hanya 1 permintaan', async ({ page }) => {
    await register(page, uniqueEmail('rt-413'))
    let n = 0
    await page.route('**/api/documents', (route) => {
      if (route.request().method() !== 'POST') return route.fallback()
      n += 1
      return route.fulfill({
        status: 413,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Melebihi batas ukuran file.' }),
      })
    })
    await page.setInputFiles('[data-testid="doc-file"]', {
      name: 'big.pdf',
      mimeType: 'application/pdf',
      buffer: await pdfBytes(1),
    })
    await page.fill('[data-testid="doc-name"]', 'Big')
    await page.click('[data-testid="upload"]')
    await expect(page.locator('[data-testid="dash-error"]')).toContainText('batas ukuran', {
      timeout: 20000,
    })
    expect(n).toBe(1)
  })

  test('unduh dokumen berfungsi lewat tombol (retry-aware)', async ({ page }) => {
    await register(page, uniqueEmail('rt-dl'))
    await uploadDoc(page, 'KTP', 1)
    const dl = page.waitForEvent('download')
    await page.locator('[data-testid="download"]').first().click()
    const download = await dl
    expect(download.suggestedFilename()).toContain('KTP')
  })

  test('unduh gagal 500 sekali lalu berhasil', async ({ page }) => {
    await register(page, uniqueEmail('rt-dl2'))
    await uploadDoc(page, 'Ijazah', 1)
    let n = 0
    await page.route('**/api/documents/**', (route) => {
      if (route.request().method() !== 'GET') return route.fallback()
      n += 1
      if (n === 1) {
        return route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'boom' }),
        })
      }
      return route.fallback()
    })
    const dl = page.waitForEvent('download')
    await page.locator('[data-testid="download"]').first().click()
    const download = await dl
    expect(download.suggestedFilename()).toContain('Ijazah')
    expect(n).toBeGreaterThanOrEqual(2)
  })
})
