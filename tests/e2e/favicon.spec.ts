import { test, expect } from '@playwright/test'

const BASE = 'http://127.0.0.1:3100'

/**
 * Favicon harus berupa BERKAS, bukan ikon default browser.
 * Next menyajikan `src/app/icon.svg` dan `src/app/apple-icon.png` lewat
 * konvensi metadata, plus `public/favicon.ico` di root.
 */
test.describe('Favicon berbasis berkas', () => {
  test('HTML merujuk ikon, bukan hanya default', async ({ page }) => {
    await page.goto(BASE + '/')
    const icons = await page
      .locator('link[rel~="icon"], link[rel="apple-touch-icon"]')
      .evaluateAll((els) => els.map((e) => e.getAttribute('href')))
    expect(icons.length).toBeGreaterThan(0)
    // Minimal satu rujukan menuju berkas nyata (svg/ico/png).
    expect(icons.some((h) => /\.(svg|ico|png)$/.test(h ?? ''))).toBe(true)
    // Tidak boleh ada data: URL (itu tanda ikon tertanam, bukan berkas).
    expect(icons.every((h) => !(h ?? '').startsWith('data:'))).toBe(true)
  })

  test('/favicon.ico tersedia dan benar-benar ICO', async ({ request }) => {
    const res = await request.get(BASE + '/favicon.ico')
    expect(res.status()).toBe(200)
    const buf = Buffer.from(await res.body())
    // ICONDIR: reserved=0, type=1, count>=1
    expect(buf.readUInt16LE(0)).toBe(0)
    expect(buf.readUInt16LE(2)).toBe(1)
    expect(buf.readUInt16LE(4)).toBeGreaterThanOrEqual(1)
    // Tiap gambar harus PNG (magic bytes di offset yang tercatat).
    const count = buf.readUInt16LE(4)
    for (let i = 0; i < count; i++) {
      const off = buf.readUInt32LE(6 + i * 16 + 12)
      expect(buf.subarray(off, off + 8)).toEqual(
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      )
    }
  })

  test('ikon SVG dan apple-icon dapat diambil', async ({ request }) => {
    const svg = await request.get(BASE + '/icon.svg')
    expect(svg.status()).toBe(200)
    const body = await svg.text()
    expect(body).toContain('<svg')
    // Warna Percikan, bukan emoji.
    expect(body).toContain('#0E9F6E')
    expect(/\p{Extended_Pictographic}/u.test(body)).toBe(false)

    const apple = await request.get(BASE + '/apple-icon.png')
    expect(apple.status()).toBe(200)
    const png = Buffer.from(await apple.body())
    expect(png.subarray(0, 8)).toEqual(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    )
    // Dimensi 180x180 (IHDR).
    expect(png.readUInt32BE(16)).toBe(180)
    expect(png.readUInt32BE(20)).toBe(180)
  })

  test('ikon cukup kontras untuk ukuran kecil', async ({ request }) => {
    // Bukti tidak jadi "kotak hijau kosong": berkas SVG memuat bidang putih
    // besar (dokumen) dan aksen tangerine, bukan hanya latar hijau.
    const svg = await request.get(BASE + '/icon.svg')
    const body = await svg.text()
    expect(body).toContain('#FFFFFF')
    expect(body).toContain('#FF8A3D')
  })
})
