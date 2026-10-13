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
async function uploadDoc(page: Page, name: string) {
  const before = await page.locator('[data-testid="doc-item"]').count()
  await page.setInputFiles('[data-testid="doc-file"]', {
    name: `${name}.pdf`,
    mimeType: 'application/pdf',
    buffer: await pdfBytes(1),
  })
  await page.fill('[data-testid="doc-name"]', name)
  await page.click('[data-testid="upload"]')
  await expect(page.locator('[data-testid="doc-item"]')).toHaveCount(before + 1, {
    timeout: 30000,
  })
}

test.describe('Navbar', () => {
  test('sticky, punya logo, dan tautan berfungsi', async ({ page }) => {
    await page.goto(BASE + '/')
    const nav = page.locator('.nav')
    await expect(nav).toBeVisible()
    expect(await nav.evaluate((el) => getComputedStyle(el).position)).toBe('sticky')
    await expect(page.locator('.nav__brand svg')).toBeVisible()
    await expect(page.locator('.nav__brand')).toHaveText(/FileMerge/)
    // Font brand memakai Fredoka.
    expect(
      await page.locator('.nav__brand').evaluate((el) => getComputedStyle(el).fontFamily),
    ).toContain('Fredoka')

    await page.click('.nav__links a[href="/merge"]')
    await page.waitForURL('**/merge', { timeout: 20000 })
  })

  test('tanpa sesi: tautan Masuk tampil sebagai tombol utama', async ({ page }) => {
    await page.goto(BASE + '/')
    await expect(page.locator('.nav__cta')).toHaveAttribute('href', '/login')
    await expect(page.locator('.nav__links a[href="/dashboard"]')).toHaveCount(0)
  })

  test('dengan sesi: tautan Dokumen & Akun muncul, Masuk hilang', async ({ page }) => {
    await register(page, uniqueEmail('nav'))
    await expect(page.locator('.nav__links a[href="/dashboard"]')).toBeVisible()
    await expect(page.locator('.nav__links a[href="/settings"]')).toBeVisible()
    await expect(page.locator('.nav__cta')).toHaveCount(0)
  })
})

test.describe('Dashboard', () => {
  test('kuota jadi kartu dengan angka + bar kemajuan', async ({ page }) => {
    await register(page, uniqueEmail('dash'))
    const quota = page.locator('[data-testid="quota"]')
    await expect(quota).toContainText('/ 30 dokumen')

    const bar = page.locator('.quota__bar')
    await expect(bar).toHaveAttribute('role', 'progressbar')
    await expect(bar).toHaveAttribute('aria-valuemax', '30')
  })

  test('tiga kartu berjudul: Penyimpanan, Unggah, Daftar', async ({ page }) => {
    await register(page, uniqueEmail('dash2'))
    const titles = await page.locator('.dash .card__title').allTextContents()
    expect(titles).toEqual(['Penyimpanan', 'Unggah dokumen', 'Daftar dokumen'])
  })

  test('bar kuota bertambah setelah unggah', async ({ page }) => {
    await register(page, uniqueEmail('dash3'))
    const widthBefore = await page
      .locator('.quota__bar span')
      .evaluate((el) => (el as HTMLElement).style.width)
    await uploadDoc(page, 'Uji')
    const widthAfter = await page
      .locator('.quota__bar span')
      .evaluate((el) => (el as HTMLElement).style.width)
    expect(widthAfter).not.toBe(widthBefore)
    await expect(page.locator('[data-testid="quota"]')).toContainText('1')
  })

  test('keutuhan alur dokumen tetap jalan setelah penataan ulang', async ({ page }) => {
    await register(page, uniqueEmail('dash4'))
    await uploadDoc(page, 'CV Utama')
    await expect(page.locator('[data-testid="doc-item"]')).toHaveCount(1)
    // unduh, ganti nama, hapus tetap berfungsi
    await expect(page.locator('[data-testid="download"]')).toBeVisible()
    await expect(page.locator('[data-testid="replace"]')).toBeVisible()
    await expect(page.locator('[data-testid="delete"]')).toBeVisible()
  })
})

test.describe('Pengaturan akun', () => {
  test('ringkasan tampil sebagai daftar berlabel', async ({ page }) => {
    await register(page, uniqueEmail('set'))
    await page.goto(BASE + '/settings')
    const summary = page.locator('[data-testid="account-summary"]')
    await expect(summary).toBeVisible()
    await expect(summary.locator('.summary__label')).toHaveCount(3)
    await expect(summary).toContainText('Dokumen')
    await expect(summary).toContainText('Preset')
  })

  test('kartu hapus akun bergaya bahaya dan tetap berfungsi', async ({ page }) => {
    await register(page, uniqueEmail('set2'))
    await page.goto(BASE + '/settings')
    const form = page.locator('[data-testid="delete-account-form"]')
    await expect(form).toBeVisible()
    await expect(page.locator('.card--danger')).toBeVisible()

    // Konfirmasi salah -> pesan error, akun tidak terhapus.
    await page.fill('[data-testid="delete-password"]', PASSWORD)
    await page.fill('[data-testid="delete-confirm"]', 'salah')
    await page.click('[data-testid="delete-submit"]')
    await expect(page.locator('[data-testid="delete-error"]')).toContainText('HAPUS')
  })
})

test.describe('Privasi', () => {
  test('dua kolom: daftar isi + teks, anchor menuju bagian', async ({ page }) => {
    await page.goto(BASE + '/privacy')
    await expect(page.locator('.toc')).toBeVisible()
    await expect(page.locator('.toc a')).toHaveCount(8)
    const cols = await page
      .locator('.prose-page')
      .evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(' ').length)
    expect(cols).toBe(2)

    // Semua anchor daftar isi harus menunjuk ke id yang benar-benar ada.
    const dangling = await page.evaluate(() =>
      [...document.querySelectorAll('.toc a')]
        .map((a) => a.getAttribute('href')!.slice(1))
        .filter((id) => !document.getElementById(id)),
    )
    expect(dangling).toEqual([])
  })

  test('menumpuk jadi satu kolom di seluler', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 })
    await page.goto(BASE + '/privacy')
    const cols = await page
      .locator('.prose-page')
      .evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(' ').length)
    expect(cols).toBe(1)
  })
})

test.describe('Halaman 404', () => {
  test('menampilkan ilustrasi + tautan pemulihan', async ({ page }) => {
    const res = await page.goto(BASE + '/halaman-yang-tidak-ada')
    expect(res!.status()).toBe(404)
    await expect(page.locator('h1')).toHaveText(/tidak ditemukan/i)
    await expect(page.locator('.band__art')).toBeVisible()
    // Persempit ke area pemulihan: logo di navbar juga memakai href="/".
    const actions = page.locator('.band .hero__actions')
    await expect(actions.locator('a[href="/"]')).toBeVisible()
    await expect(actions.locator('a[href="/merge"]')).toBeVisible()
  })
})

test.describe('Bahasa: tidak ada em dash di teks yang tampak', () => {
  for (const path of ['/', '/merge', '/login', '/register', '/privacy']) {
    test(`${path} bersih dari em dash`, async ({ page }) => {
      await page.goto(BASE + path)
      const n = await page.evaluate(
        () => (document.body.innerText.match(/\u2014/g) || []).length,
      )
      expect(n, 'em dash ditemukan di teks yang tampak').toBe(0)
    })
  }

  test('judul dokumen memakai titik dua, bukan em dash', async ({ page }) => {
    for (const [path, expectStart] of [
      ['/', 'FileMerge:'],
      ['/merge', 'PDF Merger:'],
      ['/login', 'Masuk:'],
      ['/privacy', 'Kebijakan Privasi:'],
    ] as const) {
      await page.goto(BASE + path)
      const title = await page.title()
      expect(title).not.toContain('\u2014')
      expect(title).toContain(expectStart)
    }
  })
})
