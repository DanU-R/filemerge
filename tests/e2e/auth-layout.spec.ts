import { test, expect } from '@playwright/test'

const BASE = 'http://127.0.0.1:3100'

test.describe('Halaman auth: tata letak', () => {
  for (const [path, heading] of [
    ['/login', /masuk/i],
    ['/register', /buat akun/i],
  ] as const) {
    test(`${path}: dua kolom terisi penuh, bukan kartu kecil di tengah`, async ({ page }) => {
      await page.goto(BASE + path)

      await expect(page.locator('.auth-shell')).toBeVisible()
      await expect(page.locator('.auth-aside')).toBeVisible()
      await expect(page.locator('.auth-card')).toBeVisible()
      await expect(page.locator('.auth-card h1')).toHaveText(heading)

      // Dua kolom berdampingan di desktop.
      const cols = await page
        .locator('.auth-shell')
        .evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(' ').length)
      expect(cols).toBe(2)

      // Kartu form tidak dipaksa setinggi panel kiri (kalau dipaksa, isinya
      // akan menyisakan rongga besar di dalam kartu).
      const [asideH, cardH] = await page.evaluate(() => {
        const a = document.querySelector('.auth-aside')!.getBoundingClientRect().height
        const c = document.querySelector('.auth-card')!.getBoundingClientRect().height
        return [a, c]
      })
      expect(cardH).toBeGreaterThan(380)
      expect(cardH).toBeLessThan(asideH + 1)

      // Sisa ruang di dalam kartu wajar (< 160px), bukan separuh kartu kosong.
      const slack = await page.evaluate(() => {
        const card = document.querySelector('.auth-card') as HTMLElement
        const cs = getComputedStyle(card)
        const content = [...card.children].reduce(
          (s, el) => s + el.getBoundingClientRect().height,
          0,
        )
        return card.getBoundingClientRect().height - content - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom)
      })
      expect(slack).toBeLessThan(160)
    })
  }

  test('label tidak memakan tinggi berlebih (regresi flex-basis 220px)', async ({ page }) => {
    // Pernah terjadi: `.field { flex: 1 1 220px }` dipakai juga di kontainer
    // vertikal, sehingga flex-basis menjadi TINGGI 220px. Akibatnya label hanya
    // berisi input ~43px tapi memakan 220px -> celah ~190px antar input.
    await page.goto(BASE + '/login')

    const m = await page.evaluate(() => {
      const email = document.querySelector('[data-testid="email"]')!
      const pass = document.querySelector('[data-testid="password"]')!
      const label = email.closest('label')!.getBoundingClientRect()
      const er = email.getBoundingClientRect()
      const pr = pass.getBoundingClientRect()
      return {
        labelH: label.height,
        inputH: er.height,
        gap: pr.top - er.bottom,
      }
    })

    // Tinggi label ≈ input + teks label; bukan 220px.
    expect(m.labelH).toBeLessThan(m.inputH + 60)
    // Jarak antar input wajar (hanya teks label + gap), bukan ratusan piksel.
    expect(m.gap).toBeLessThan(60)
    expect(m.gap).toBeGreaterThan(0)
  })

  test('semua .field punya tinggi alami di setiap halaman', async ({ page }) => {
    for (const path of ['/login', '/register', '/merge']) {
      await page.goto(BASE + path)
      const tallest = await page.evaluate(() =>
        Math.max(
          0,
          ...[...document.querySelectorAll('.field')].map(
            (e) => e.getBoundingClientRect().height,
          ),
        ),
      )
      // 220px adalah gejala bug; 101px masih wajar untuk label + bantuan.
      expect(tallest, `.field tertinggi di ${path} = ${tallest}px`).toBeLessThan(150)
    }
  })

  test('login: input, tombol selebar kartu, pemisah, tautan daftar', async ({ page }) => {
    await page.goto(BASE + '/login')
    await expect(page.locator('.auth-card input')).toHaveCount(2)
    await expect(page.locator('.auth-divider')).toBeVisible()
    await expect(page.locator('.auth-switch a[href="/register"]')).toBeVisible()

    const [btnW, cardInner] = await page.evaluate(() => {
      const b = document.querySelector('[data-testid="submit"]')!.getBoundingClientRect().width
      const c = document.querySelector('.auth-card')!.getBoundingClientRect().width
      return [b, c - 56]
    })
    expect(Math.abs(btnW - cardInner)).toBeLessThan(6)
  })

  test('register: ada bantuan minimal 8 karakter', async ({ page }) => {
    await page.goto(BASE + '/register')
    await expect(page.locator('.field__help')).toContainText('8 karakter')
  })

  test('panel kiri menampilkan manfaat + ilustrasi', async ({ page }) => {
    await page.goto(BASE + '/login')
    await expect(page.locator('.auth-benefits li')).toHaveCount(3)
    await expect(page.locator('.auth-aside__art')).toBeVisible()
    const hidden = await page
      .locator('.auth-aside__art')
      .evaluate((el) => el.getAttribute('aria-hidden'))
    expect(hidden).toBe('true')
  })

  test('menumpuk jadi satu kolom di 375px', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 })
    await page.goto(BASE + '/login')
    const cols = await page
      .locator('.auth-shell')
      .evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(' ').length)
    expect(cols).toBe(1)
    await expect(page.locator('.auth-card')).toBeVisible()
  })

  test('ganti mode: tautan login <-> register bekerja', async ({ page }) => {
    await page.goto(BASE + '/login')
    await page.click('.auth-switch a[href="/register"]')
    await page.waitForURL('**/register', { timeout: 20000 })
    await expect(page.locator('.auth-card h1')).toHaveText(/buat akun/i)

    await page.click('.auth-switch a[href="/login"]')
    await page.waitForURL('**/login', { timeout: 20000 })
    await expect(page.locator('.auth-card h1')).toHaveText(/masuk/i)
  })
})
