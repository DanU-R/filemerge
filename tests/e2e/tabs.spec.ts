import { test, expect } from '@playwright/test'
import { PDFDocument } from '@cantoo/pdf-lib'

const BASE = 'http://127.0.0.1:3100'

async function pdfBytes(pages: number, w = 200): Promise<Buffer> {
  const d = await PDFDocument.create()
  for (let i = 0; i < pages; i++) d.addPage([w, i * 10 + 200])
  return Buffer.from(await d.save())
}

const TAB_GABUNG = '[data-testid="tab-gabungkan"]'
const TAB_HALAMAN = '[data-testid="tab-halaman"]'
const PANEL_GABUNG = '[data-testid="panel-gabungkan"]'
const PANEL_HALAMAN = '[data-testid="panel-halaman"]'

test.describe('Tab /merge: organisasi bagian', () => {
  test('default membuka tab "Gabungkan", tab lain tersembunyi', async ({ page }) => {
    await page.goto(BASE + '/merge')

    await expect(page.locator(TAB_GABUNG)).toHaveAttribute('aria-selected', 'true')
    await expect(page.locator(TAB_HALAMAN)).toHaveAttribute('aria-selected', 'false')
    await expect(page.locator(PANEL_GABUNG)).toBeVisible()
    await expect(page.locator(PANEL_HALAMAN)).toBeHidden()

    // Kontrol inti tab Gabungkan tersedia.
    await expect(page.locator('[data-testid="file-input"]')).toBeAttached()
    await expect(page.locator('[data-testid="output-name"]')).toBeVisible()
    await expect(page.locator('[data-testid="merge"]')).toBeVisible()
    await expect(page.locator('[data-testid="page-size"]')).toBeVisible()
  })

  test('tab "Dokumen & preset" tidak muncul tanpa sesi', async ({ page }) => {
    await page.goto(BASE + '/merge')
    await expect(page.locator('[data-testid="tab-dokumen"]')).toHaveCount(0)
  })

  test('klik tab memindahkan panel dan mengganti petunjuk', async ({ page }) => {
    await page.goto(BASE + '/merge')
    const hint = page.locator('[data-testid="tab-hint"]')
    const firstHint = await hint.textContent()

    await page.click(TAB_HALAMAN)
    await expect(page.locator(PANEL_HALAMAN)).toBeVisible()
    await expect(page.locator(PANEL_GABUNG)).toBeHidden()
    await expect(page.locator('[data-testid="pdftools-input"]')).toBeAttached()
    await expect(hint).not.toHaveText(firstHint ?? '')

    await page.click(TAB_GABUNG)
    await expect(page.locator(PANEL_GABUNG)).toBeVisible()
    await expect(page.locator(PANEL_HALAMAN)).toBeHidden()
    await expect(hint).toHaveText(firstHint ?? '')
  })

  test('?tab=halaman membuka tab itu langsung', async ({ page }) => {
    await page.goto(BASE + '/merge?tab=halaman')
    await expect(page.locator(TAB_HALAMAN)).toHaveAttribute('aria-selected', 'true')
    await expect(page.locator(PANEL_HALAMAN)).toBeVisible()
    await expect(page.locator(PANEL_GABUNG)).toBeHidden()
  })

  test('?tab=<sampah> diabaikan, kembali ke tab pertama', async ({ page }) => {
    await page.goto(BASE + '/merge?tab=ngawur')
    await expect(page.locator(TAB_GABUNG)).toHaveAttribute('aria-selected', 'true')
    await expect(page.locator(PANEL_GABUNG)).toBeVisible()
  })

  test('semua kontrol tetap ada di DOM meski panelnya tersembunyi', async ({ page }) => {
    await page.goto(BASE + '/merge?tab=halaman')
    // Panel gabungkan disembunyikan secara visual, tetapi kontrolnya masih ter-mount.
    await expect(page.locator(PANEL_GABUNG)).toBeHidden()
    await expect(page.locator('[data-testid="file-input"]')).toBeAttached()
    await expect(page.locator('[data-testid="output-name"]')).toBeAttached()
    await expect(page.locator('[data-testid="merge"]')).toBeAttached()
    await expect(page.locator('[data-testid="empty"]')).toBeAttached()
  })

  test('keadaan antrean bertahan saat berpindah tab', async ({ page }) => {
    await page.goto(BASE + '/merge')
    await page.setInputFiles('[data-testid="file-input"]', {
      name: 'bertahan.pdf',
      mimeType: 'application/pdf',
      buffer: await pdfBytes(2),
    })
    await expect(page.locator('[data-testid="queue-item"]')).toHaveCount(1)

    await page.click(TAB_HALAMAN)
    await expect(page.locator(PANEL_HALAMAN)).toBeVisible()

    await page.click(TAB_GABUNG)
    // Antrean tidak hilang -> panel tidak di-unmount saat disembunyikan.
    await expect(page.locator('[data-testid="queue-item"]')).toHaveCount(1)
    await expect(page.locator('[data-testid="output-name"]')).toHaveValue('hasil-gabung')
  })

  test('bilah tab dapat dinavigasi dengan keyboard', async ({ page }) => {
    await page.goto(BASE + '/merge')
    await expect(page.locator(TAB_GABUNG)).toHaveAttribute('aria-selected', 'true')

    await page.locator(TAB_GABUNG).focus()
    await page.keyboard.press('ArrowRight')
    await expect(page.locator(TAB_HALAMAN)).toHaveAttribute('aria-selected', 'true')
    await expect(page.locator(PANEL_HALAMAN)).toBeVisible()
    // Fokus ikut berpindah ke tab yang aktif.
    await expect(page.locator(TAB_HALAMAN)).toBeFocused()

    await page.keyboard.press('ArrowLeft')
    await expect(page.locator(TAB_GABUNG)).toHaveAttribute('aria-selected', 'true')

    await page.keyboard.press('End')
    await expect(page.locator(TAB_HALAMAN)).toHaveAttribute('aria-selected', 'true')
    await page.keyboard.press('Home')
    await expect(page.locator(TAB_GABUNG)).toHaveAttribute('aria-selected', 'true')
  })

  test('semantik ARIA tab lengkap', async ({ page }) => {
    await page.goto(BASE + '/merge')
    const tablist = page.locator('[role="tablist"]')
    await expect(tablist).toHaveCount(1)
    await expect(page.locator('[role="tab"]')).toHaveCount(2)
    await expect(page.locator('[role="tabpanel"]')).toHaveCount(2)

    // Setiap tab mengendalikan panel yang benar.
    const controls = await page.locator(TAB_GABUNG).getAttribute('aria-controls')
    expect(controls).toBeTruthy()
    await expect(page.locator(`#${controls}`)).toHaveCount(1)
  })

  test('halaman jadi lebih pendek: hanya satu panel tampil sekaligus', async ({ page }) => {
    await page.goto(BASE + '/merge')
    const visible = await page
      .locator('[role="tabpanel"]')
      .evaluateAll((els) => els.filter((e) => !(e as HTMLElement).hidden).length)
    expect(visible).toBe(1)
  })
})
