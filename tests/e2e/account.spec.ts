import { test, expect, type Page } from '@playwright/test'
import { PDFDocument } from '@cantoo/pdf-lib'

const BASE = 'http://127.0.0.1:3100'

async function pdfBytes(pages: number, w = 200): Promise<Buffer> {
  const doc = await PDFDocument.create()
  for (let i = 0; i < pages; i++) doc.addPage([w + i, 200])
  return Buffer.from(await doc.save())
}

function mediaBoxes(bytes: Uint8Array): [number, number][] {
  const s = Buffer.from(bytes).toString('latin1')
  return [...s.matchAll(/\/MediaBox\s*\[\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\]/g)].map(
    (m) => [Number(m[3]), Number(m[4])],
  )
}

function uniqueEmail(tag: string): string {
  return `${tag}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`
}
const PASSWORD = 'rahasia12345'

async function register(page: Page, email: string) {
  await page.goto(BASE + '/register')
  await page.fill('[data-testid="email"]', email)
  await page.fill('[data-testid="password"]', PASSWORD)
  await page.click('[data-testid="submit"]')
  await page.waitForURL('**/dashboard', { timeout: 30000 })
}

async function login(page: Page, email: string) {
  await page.goto(BASE + '/login')
  await page.fill('[data-testid="email"]', email)
  await page.fill('[data-testid="password"]', PASSWORD)
  await page.click('[data-testid="submit"]')
  await page.waitForURL('**/dashboard', { timeout: 30000 })
}

async function uploadDoc(page: Page, name: string, pages = 1, category = 'CV') {
  const before = await page.locator('[data-testid="doc-item"]').count()
  await page.setInputFiles('[data-testid="doc-file"]', {
    name: `${name}.pdf`,
    mimeType: 'application/pdf',
    buffer: await pdfBytes(pages),
  })
  await page.fill('[data-testid="doc-name"]', name)
  await page.selectOption('[data-testid="doc-category"]', category)
  await page.click('[data-testid="upload"]')
  // Tunggu sampai refresh server menampilkan dokumen baru.
  await expect(page.locator('[data-testid="doc-item"]')).toHaveCount(before + 1, {
    timeout: 30000,
  })
}

test.describe('Fase 2/3/4: akun & dokumen', () => {
  test('AC-08: registrasi, upload, dan lihat kembali dokumen', async ({ page }) => {
    const email = uniqueEmail('ac08')
    await register(page, email)
    await expect(page.locator('[data-testid="whoami"]')).toContainText(email)

    await uploadDoc(page, 'CV Utama', 1)
    await expect(page.locator('[data-testid="doc-item"]')).toHaveCount(1)
    // Kuota: 1 dari 30. Assert tahan-spasi + semantik progressbar, jangan
    // bergantung pada format teks persis ("1/30" vs "1 / 30").
    const quota = page.locator('[data-testid="quota"]')
    await expect(quota).toContainText('30')
    await expect(quota.locator('.quota__bar')).toHaveAttribute('aria-valuenow', '1')
    await expect(quota.locator('.quota__bar')).toHaveAttribute('aria-valuemax', '30')

    // Reload -> dokumen masih ada (persisten di DB).
    await page.reload()
    await expect(page.locator('[data-testid="doc-item"]')).toHaveCount(1)
  })

  test('AC-10: memilih dokumen tersimpan untuk merge (diproses lokal)', async ({ page }) => {
    await register(page, uniqueEmail('ac10'))
    await uploadDoc(page, 'Ijazah', 1)
    await uploadDoc(page, 'CV Lamaran', 2)

    await page.goto(BASE + '/merge?tab=dokumen')
    const cloud = page.locator('[data-testid="cloud-add"]')
    await expect(cloud).toHaveCount(2)

    // Ambil 1 dari cloud + 1 file lokal -> cek jumlah halaman hasil.
    await cloud.first().click()
    await expect(page.locator('[data-testid="queue-item"]')).toHaveCount(1)

    // Input file & tombol merge ada di tab "Gabungkan" -> pindah dulu.
    await page.click('[data-testid="tab-gabungkan"]')
    await page.setInputFiles('[data-testid="file-input"]', {
      name: 'lampiran.pdf',
      mimeType: 'application/pdf',
      buffer: await pdfBytes(2),
    })
    await expect(page.locator('[data-testid="queue-item"]')).toHaveCount(2)
    await page.click('[data-testid="merge"]')
    await expect(page.locator('[data-testid="result"]')).toHaveAttribute('data-result-id', '1')

    const b64 = await page.evaluate(async () => {
      const a = document.querySelector('[data-testid="download"]') as HTMLAnchorElement
      const r = await fetch(a.href)
      const u = new Uint8Array(await r.arrayBuffer())
      let s = ''
      for (const x of u) s += String.fromCharCode(x)
      return btoa(s)
    })
    expect(mediaBoxes(new Uint8Array(Buffer.from(b64, 'base64'))).length).toBeGreaterThanOrEqual(3)
  })

  test('AC-12: halaman dashboard & API menolak akses tanpa sesi', async ({ page, request }) => {
    await page.goto(BASE + '/dashboard')
    await expect(page).toHaveURL(/\/login$/)

    const res = await request.get(BASE + '/api/documents')
    expect(res.status()).toBe(401)
  })

  test('AC-11: pengguna B tidak bisa membaca/menghapus dokumen A', async ({ browser }) => {
    const ctxA = await browser.newContext()
    const ctxB = await browser.newContext()
    const a = await ctxA.newPage()
    const b = await ctxB.newPage()

    // A upload dokumen.
    await register(a, uniqueEmail('ac11a'))
    await uploadDoc(a, 'KTP Rahasia', 1)
    const href = await a.locator('[data-testid="download"]').first().getAttribute('data-href')
    const docId = href!.split('/').pop()!

    // B login lalu coba akses dokumen A.
    await register(b, uniqueEmail('ac11b'))
    const getB = await b.request.get(`${BASE}/api/documents/${docId}`)
    expect(getB.status()).toBe(404)
    const delB = await b.request.delete(`${BASE}/api/documents/${docId}`)
    expect(delB.status()).toBe(404)
    const patchB = await b.request.patch(`${BASE}/api/documents/${docId}`, {
      data: { displayName: 'dibajak' },
    })
    expect(patchB.status()).toBe(404)

    // Dokumen A tetap utuh & bisa diakses A.
    const getA = await a.request.get(`${BASE}/api/documents/${docId}`)
    expect(getA.status()).toBe(200)
    await expect(a.locator('[data-testid="doc-item"]')).toHaveCount(1)

    await ctxA.close()
    await ctxB.close()
  })

  test('upload: isi file tidak sesuai (magic bytes) ditolak', async ({ page }) => {
    await register(page, uniqueEmail('magic'))
    await page.setInputFiles('[data-testid="doc-file"]', {
      name: 'fake.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('ini bukan pdf'),
    })
    await page.fill('[data-testid="doc-name"]', 'palsu')
    await page.click('[data-testid="upload"]')
    await expect(page.locator('[data-testid="dash-error"]')).toContainText('tidak dikenali')
    await expect(page.locator('[data-testid="doc-item"]')).toHaveCount(0)
  })

  test('hapus dokumen: metadata & objek hilang', async ({ page }) => {
    await register(page, uniqueEmail('del'))
    await uploadDoc(page, 'Sertifikat', 1)
    await expect(page.locator('[data-testid="doc-item"]')).toHaveCount(1)

    page.on('dialog', (d) => d.accept())
    await page.locator('[data-testid="delete"]').first().click()
    await expect(page.locator('[data-testid="doc-item"]')).toHaveCount(0)
    await expect(page.locator('[data-testid="empty"]')).toBeVisible()
  })

  test('logout mengakhiri sesi', async ({ page }) => {
    await register(page, uniqueEmail('logout'))
    await page.click('[data-testid="logout"]')
    await page.waitForURL(BASE + '/')
    await page.goto(BASE + '/dashboard')
    await expect(page).toHaveURL(/\/login$/)
  })
})
