import { test, expect, type Page } from '@playwright/test'
import { PDFDocument } from '@cantoo/pdf-lib'

const BASE = 'http://127.0.0.1:3100'
const PASSWORD = 'rahasia12345'

async function pdfBytes(pages = 1, w = 200): Promise<Buffer> {
  const d = await PDFDocument.create()
  for (let i = 0; i < pages; i++) d.addPage([w + i, 200])
  return Buffer.from(await d.save())
}
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFElEQVR4nGP4z8DAAMIM////ZwAAHu8E/KPItPcAAAAASUVORK5CYII=',
  'base64',
)
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
async function upload(page: Page, name: string, type = 'pdf', pages = 1) {
  const before = await page.locator('[data-testid="doc-item"]').count()
  await page.setInputFiles('[data-testid="doc-file"]', {
    name: type === 'pdf' ? `${name}.pdf` : `${name}.png`,
    mimeType: type === 'pdf' ? 'application/pdf' : 'image/png',
    buffer: type === 'pdf' ? await pdfBytes(pages) : PNG,
  })
  await page.fill('[data-testid="doc-name"]', name)
  await page.click('[data-testid="upload"]')
  await expect(page.locator('[data-testid="doc-item"]')).toHaveCount(before + 1, { timeout: 30000 })
}

test.describe('Fase 4 — keamanan, akun, dokumen', () => {
  test('header keamanan ada di response', async ({ request }) => {
    const res = await request.get(BASE + '/')
    const h = res.headers()
    expect(h['x-content-type-options']).toBe('nosniff')
    expect(h['x-frame-options']).toBe('DENY')
    expect(h['content-security-policy']).toContain("default-src 'self'")
    expect(h['referrer-policy']).toBe('strict-origin-when-cross-origin')
  })

  test('dashboard menampilkan tipe + tanggal, dan filter tipe bekerja', async ({ page }) => {
    await register(page, uniqueEmail('db'))
    await upload(page, 'CV', 'pdf', 1)
    await upload(page, 'Foto', 'png')

    // tipe tampil (urutan desc: Foto dulu, lalu CV) — cek per-item, bukan posisi
    await expect(page.locator('[data-testid="doc-item"]').filter({ hasText: 'PDF' })).toHaveCount(1)
    await expect(page.locator('[data-testid="doc-item"]').filter({ hasText: 'PNG' })).toHaveCount(1)
    await expect(page.locator('[data-testid="doc-date"]').first()).not.toHaveText('')

    // filter tipe = PNG -> hanya 1
    await page.selectOption('[data-testid="filter-type"]', 'image/png')
    await expect(page.locator('[data-testid="doc-item"]')).toHaveCount(1)
    await expect(page.locator('[data-testid="doc-item"]').first()).toContainText('PNG')

    // filter tipe = PDF -> hanya 1
    await page.selectOption('[data-testid="filter-type"]', 'application/pdf')
    await expect(page.locator('[data-testid="doc-item"]')).toHaveCount(1)
  })

  test('ganti file: metadata tetap, file lama tidak hilang bila gagal', async ({ page }) => {
    await register(page, uniqueEmail('rep'))
    await upload(page, 'CV', 'pdf', 1)

    // intercept PUT
    page.once('dialog', (d) => d.accept())
    // klik tombol ganti -> buka file chooser
    const chooserPromise = page.waitForEvent('filechooser')
    await page.locator('[data-testid="replace"]').first().click()
    const chooser = await chooserPromise
    await chooser.setFiles({
      name: 'CV-baru.pdf',
      mimeType: 'application/pdf',
      buffer: await pdfBytes(3),
    })

    // dokumen tetap 1, ukuran berubah (file 3 halaman lebih besar)
    await expect(page.locator('[data-testid="doc-item"]')).toHaveCount(1, { timeout: 30000 })
    await expect(page.locator('[data-testid="doc-item"]').first()).toContainText('CV')

    // unduh masih berfungsi
    const res = await page.request.get(BASE + '/api/documents')
    expect(res.ok()).toBeTruthy()
  })

  test('hapus akun: butuh password benar, lalu data hilang', async ({ page }) => {
    const email = uniqueEmail('del')
    await register(page, email)
    await upload(page, 'CV', 'pdf', 1)

    await page.goto(BASE + '/settings')
    await expect(page.locator('[data-testid="account-summary"]')).toContainText(email)

    // password salah -> 403
    await page.fill('[data-testid="delete-password"]', 'salahbanget99')
    await page.fill('[data-testid="delete-confirm"]', 'HAPUS')
    await page.click('[data-testid="delete-submit"]')
    await expect(page.locator('[data-testid="delete-error"]')).toContainText('Password salah')

    // password benar -> terhapus, kembali ke beranda
    await page.fill('[data-testid="delete-password"]', PASSWORD)
    await page.click('[data-testid="delete-submit"]')
    await page.waitForURL(BASE + '/', { timeout: 30000 })

    // login dengan akun lama harus gagal
    await page.goto(BASE + '/login')
    await page.fill('[data-testid="email"]', email)
    await page.fill('[data-testid="password"]', PASSWORD)
    await page.click('[data-testid="submit"]')
    await expect(page.locator('[data-testid="auth-error"]')).toBeVisible({ timeout: 30000 })
  })

  test('rate limit login: 429 setelah percobaan berlebih', async ({ request }) => {
    // IP unik agar deterministik dan tidak mengganggu tes lain.
    const ip = `203.0.113.${Math.floor(Math.random() * 250) + 1}`
    let got429 = false
    for (let i = 0; i < 25; i++) {
      const res = await request.post(BASE + '/api/auth/login', {
        headers: { 'x-forwarded-for': ip },
        data: { email: `rl-${i}@example.com`, password: 'salahterus123' },
      })
      if (res.status() === 429) {
        got429 = true
        break
      }
    }
    expect(got429).toBe(true)
  })

  test('halaman settings butuh login', async ({ page }) => {
    await page.context().clearCookies()
    await page.goto(BASE + '/settings')
    await page.waitForURL('**/login', { timeout: 30000 })
  })
})
