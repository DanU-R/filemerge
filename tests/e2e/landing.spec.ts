import { test, expect } from '@playwright/test'

const BASE = 'http://127.0.0.1:3100'

test.describe('Landing — arah Percikan', () => {
  test('hero tampil dengan judul, ajakan, dan ilustrasi', async ({ page }) => {
    await page.goto(BASE + '/')

    await expect(page.locator('.hero h1')).toBeVisible()
    await expect(page.locator('.hero__lead')).toBeVisible()
    await expect(page.locator('.hero__art')).toBeVisible()
    // Ilustrasi harus benar-benar ter-render (punya ukuran), bukan svg kosong.
    const box = await page.locator('.hero__art').boundingBox()
    expect(box!.width).toBeGreaterThan(120)
    expect(box!.height).toBeGreaterThan(100)
  })

  test('tombol utama mengarah ke alat merge', async ({ page }) => {
    await page.goto(BASE + '/')
    const cta = page.locator('.hero__actions a').first()
    await expect(cta).toHaveText(/gabungkan/i)
    await cta.click()
    await page.waitForURL('**/merge', { timeout: 20000 })
    await expect(page.locator('[data-testid="tab-gabungkan"]')).toBeVisible()
  })

  test('bagian "Tiga langkah" berisi tiga langkah bernomor', async ({ page }) => {
    await page.goto(BASE + '/')
    await expect(page.locator('.steps > li')).toHaveCount(3)
    await expect(page.locator('.steps__num').first()).toHaveText('1')
  })

  test('daftar kemampuan berisi enam butir dengan ikon', async ({ page }) => {
    await page.goto(BASE + '/')
    await expect(page.locator('.cap')).toHaveCount(6)
    // Setiap butir punya ikon svg (bukan emoji).
    await expect(page.locator('.cap .cap__icon')).toHaveCount(6)
  })

  test('tidak memakai pola "kartu fitur seragam" yang dilarang', async ({ page }) => {
    await page.goto(BASE + '/')
    // Grid kartu seragam sudah diganti daftar berlabel.
    await expect(page.locator('.features')).toHaveCount(0)
  })

  test('band privasi tampil dengan ilustrasi perisai', async ({ page }) => {
    await page.goto(BASE + '/')
    await expect(page.locator('.band h2')).toContainText(/perangkat/i)
    await expect(page.locator('.band__art')).toBeVisible()
  })

  test('ajakan akhir punya tautan ke daftar akun', async ({ page }) => {
    await page.goto(BASE + '/')
    await expect(page.locator('.cta a[href="/register"]')).toBeVisible()
  })

  test('halaman ramah seluler: hero menumpuk di 375px', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 })
    await page.goto(BASE + '/')
    const cols = await page
      .locator('.hero')
      .evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(' ').length)
    expect(cols).toBe(1)
    await expect(page.locator('.hero h1')).toBeVisible()
  })

  test('ilustrasi dihias sebagai dekoratif (aria-hidden)', async ({ page }) => {
    await page.goto(BASE + '/')
    const hidden = await page
      .locator('.hero__art, .band__art')
      .evaluateAll((els) => els.every((e) => e.getAttribute('aria-hidden') === 'true'))
    expect(hidden).toBe(true)
  })

  test('font Percikan benar-benar dimuat di landing', async ({ page }) => {
    await page.goto(BASE + '/')
    await page.waitForFunction(() => document.fonts.status === 'loaded', { timeout: 20000 })
    const fonts = await page.evaluate(() => ({
      body: getComputedStyle(document.body).fontFamily,
      h1: getComputedStyle(document.querySelector('h1')!).fontFamily,
    }))
    expect(fonts.body).toContain('Nunito')
    expect(fonts.h1).toContain('Fredoka')
  })
})
