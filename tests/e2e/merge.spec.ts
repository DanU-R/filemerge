import { test, expect, type Page } from '@playwright/test'
import { PDFDocument } from '@cantoo/pdf-lib'
import { writeFileSync, rmSync } from 'node:fs'

/** Bangun PDF dengan ukuran halaman tertentu (untuk memverifikasi urutan). */
async function pdfWithPages(sizes: [number, number][]): Promise<Buffer> {
  const doc = await PDFDocument.create()
  for (const [w, h] of sizes) doc.addPage([w, h])
  return Buffer.from(await doc.save())
}

/** Baca urutan /MediaBox dari bytes PDF. */
function mediaBoxes(bytes: Uint8Array): [number, number][] {
  const s = Buffer.from(bytes).toString('latin1')
  const out: [number, number][] = []
  const re = /\/MediaBox\s*\[\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\]/g
  let m: RegExpExecArray | null
  while ((m = re.exec(s))) out.push([Number(m[3]), Number(m[4])])
  return out
}

/** Ambil dimensi image XObject dari bytes PDF (halaman pakai /MediaBox, bukan /Width). */
function imageDims(bytes: Uint8Array): [number, number][] {
  const s = Buffer.from(bytes).toString('latin1')
  const widths = [...s.matchAll(/\/Width\s+(\d+)/g)].map((m) => Number(m[1]))
  const heights = [...s.matchAll(/\/Height\s+(\d+)/g)].map((m) => Number(m[1]))
  return widths.map((w, i) => [w, heights[i] ?? 0])
}

function app1(orientation: number): Buffer {
  const exifHeader = [0x45, 0x78, 0x69, 0x66, 0x00, 0x00]
  const tiff = [
    0x49, 0x49, 0x2a, 0x00, 0x08, 0x00, 0x00, 0x00, 0x01, 0x00, 0x12, 0x01, 0x03, 0x00, 0x01,
    0x00, 0x00, 0x00, orientation, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  ]
  const payload = Buffer.from([...exifHeader, ...tiff])
  const size = payload.length + 2
  return Buffer.from([0xff, 0xe1, (size >> 8) & 0xff, size & 0xff, ...payload])
}

/** JPEG landscape nyata (dari canvas) + APP1 EXIF orientation. */
async function exifJpeg(page: Page, orientation: number, w = 60, h = 30): Promise<Buffer> {
  const b64 = await page.evaluate(
    async ([ww, hh]) => {
      const c = document.createElement('canvas')
      c.width = ww
      c.height = hh
      const ctx = c.getContext('2d')!
      ctx.fillStyle = '#3366cc'
      ctx.fillRect(0, 0, ww, hh)
      const blob: Blob = await new Promise((r) => c.toBlob((b) => r(b!), 'image/jpeg', 0.9))
      const buf = new Uint8Array(await blob.arrayBuffer())
      let s = ''
      for (const b of buf) s += String.fromCharCode(b)
      return btoa(s)
    },
    [w, h],
  )
  const jpeg = Buffer.from(b64, 'base64')
  return Buffer.concat([jpeg.subarray(0, 2), app1(orientation), jpeg.subarray(2)])
}

async function upload(page: Page, files: { name: string; mimeType: string; buffer: Buffer }[]) {
  await page.setInputFiles('[data-testid="file-input"]', files)
}

async function mergedBytes(page: Page): Promise<Uint8Array> {
  const b64 = await page.evaluate(async () => {
    const a = document.querySelector('[data-testid="download"]') as HTMLAnchorElement
    const res = await fetch(a.href)
    const buf = new Uint8Array(await res.arrayBuffer())
    let s = ''
    for (const b of buf) s += String.fromCharCode(b)
    return btoa(s)
  })
  return new Uint8Array(Buffer.from(b64, 'base64'))
}

test.describe('FileMerge MVP: Fase 1', () => {
  test('AC-01/AC-03/AC-04: merge PDFs, urutan benar, unduh nama kustom', async ({ page }) => {
    await page.goto('/merge')
    const a = await pdfWithPages([[200, 200], [200, 200]])
    const b = await pdfWithPages([[300, 400]])

    await upload(page, [
      { name: 'a.pdf', mimeType: 'application/pdf', buffer: a },
      { name: 'b.pdf', mimeType: 'application/pdf', buffer: b },
    ])
    await expect(page.locator('[data-testid="queue-item"]')).toHaveCount(2)

    // Urutan awal: a,a,b
    await page.fill('[data-testid="output-name"]', 'lamaran-kerja')
    const result = page.locator('[data-testid="result"]')
    await page.click('[data-testid="merge"]')
    await expect(result).toHaveAttribute('data-result-id', '1')

    let bytes = await mergedBytes(page)
    expect(mediaBoxes(bytes)).toEqual([
      [200, 200],
      [200, 200],
      [300, 400],
    ])

    // Geser b ke paling atas (naik 1x)
    await page.click('[data-testid="queue-item"] >> nth=1 >> button[aria-label^="Naikkan"]')
    await page.click('[data-testid="merge"]')
    await expect(result).toHaveAttribute('data-result-id', '2')
    bytes = await mergedBytes(page)
    expect(mediaBoxes(bytes)).toEqual([
      [300, 400],
      [200, 200],
      [200, 200],
    ])

    const dl = page.locator('[data-testid="download"]')
    await expect(dl).toHaveAttribute('download', 'lamaran-kerja.pdf')
  })

  test('AC-02: JPEG EXIF orientation 6 tidak terputar (hasil portrait)', async ({ page }) => {
    await page.goto('/merge')
    const jpeg = await exifJpeg(page, 6, 60, 30) // landscape di disk, harus jadi portrait
    await upload(page, [{ name: 'foto.jpg', mimeType: 'image/jpeg', buffer: jpeg }])
    await page.click('[data-testid="merge"]')
    await expect(page.locator('[data-testid="result"]')).toBeVisible()

    const bytes = await mergedBytes(page)
    const dims = imageDims(bytes)
    expect(dims.length).toBeGreaterThan(0)
    const [w, h] = dims[0]
    expect(h).toBeGreaterThan(w) // portrait setelah rotasi diterapkan
  })

  test('AC-02b: JPEG tanpa EXIF tetap benar (landscape)', async ({ page }) => {
    await page.goto('/merge')
    const b64 = await page.evaluate(async () => {
      const c = document.createElement('canvas')
      c.width = 80
      c.height = 40
      const ctx = c.getContext('2d')!
      ctx.fillStyle = '#aa3333'
      ctx.fillRect(0, 0, 80, 40)
      const blob: Blob = await new Promise((r) => c.toBlob((b) => r(b!), 'image/jpeg', 0.9))
      const buf = new Uint8Array(await blob.arrayBuffer())
      let s = ''
      for (const b of buf) s += String.fromCharCode(b)
      return btoa(s)
    })
    await upload(page, [
      { name: 'tanpa-exif.jpg', mimeType: 'image/jpeg', buffer: Buffer.from(b64, 'base64') },
    ])
    await page.click('[data-testid="merge"]')
    await expect(page.locator('[data-testid="result"]')).toBeVisible()
    const dims = imageDims(await mergedBytes(page))
    expect(dims[0][0]).toBeGreaterThan(dims[0][1]) // landscape dipertahankan
  })

  test('AC-05: merge tidak mengirim isi file ke server', async ({ page }) => {
    const posts: string[] = []
    page.on('request', (req) => {
      if (req.method() === 'POST' || /\/api\//.test(req.url())) posts.push(`${req.method()} ${req.url()}`)
    })
    await page.goto('/merge')
    await upload(page, [
      {
        name: 'a.pdf',
        mimeType: 'application/pdf',
        buffer: await pdfWithPages([[200, 200]]),
      },
    ])
    await page.click('[data-testid="merge"]')
    await expect(page.locator('[data-testid="result"]')).toBeVisible()
    expect(posts).toEqual([])
  })

  test('AC-06: file terenkripsi/rusak/kosong ditandai tanpa crash', async ({ page }) => {
    await page.goto('/merge')
    const encrypted = Buffer.from(
      '%PDF-1.4\n1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n2 0 obj << /Type /Pages /Kids [] /Count 0 >> endobj\n3 0 obj << /Filter /Standard /V 1 /R 2 /O (x) /U (x) /P -1 >> endobj\ntrailer << /Root 1 0 R /Encrypt 3 0 R /Size 4 >>\n%%EOF',
    )
    const corruptWithHeader = Buffer.concat([
      Buffer.from('%PDF-1.4\n'),
      Buffer.from([0x00, 0x11, 0x22, 0x33, 0x44, 0x55, 0x66, 0x77]),
    ])
    const ok = await pdfWithPages([[200, 200]])

    await upload(page, [
      { name: 'enc.pdf', mimeType: 'application/pdf', buffer: encrypted },
      { name: 'bad.pdf', mimeType: 'application/pdf', buffer: corruptWithHeader },
      { name: 'kosong.pdf', mimeType: 'application/pdf', buffer: Buffer.alloc(0) },
      { name: 'ok.pdf', mimeType: 'application/pdf', buffer: ok },
    ])

    // File kosong ditandai saat intake (ditolak sebelum antrean).
    await expect(page.locator('[data-testid="errors"]')).toContainText('kosong.pdf')

    await page.click('[data-testid="merge"]')
    await expect(page.locator('[data-testid="result"]')).toBeVisible()
    const failures = page.locator('[data-testid="failures"]')
    await expect(failures).toContainText('enc.pdf')
    await expect(failures).toContainText('bad.pdf')

    // Aplikasi tidak crash: toolbar/antrean masih berfungsi dan header halaman tetap ada.
    // (Assertion ini sengaja tidak bergantung pada teks judul tertentu.)
    await expect(page.locator('.page__head h1')).toBeVisible()
    await expect(page.locator('[data-testid="file-input"]')).toBeAttached()

    // Masih bisa merge file valid berikutnya.
    await page.click('button:has-text("Bersihkan")')
    await upload(page, [{ name: 'ok2.pdf', mimeType: 'application/pdf', buffer: ok }])
    await page.click('[data-testid="merge"]')
    await expect(page.locator('[data-testid="result"]')).toBeVisible()
  })

  test('AC-07: berfungsi di viewport mobile (375px)', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 720 })
    await page.goto('/merge')
    await upload(page, [
      {
        name: 'a.pdf',
        mimeType: 'application/pdf',
        buffer: await pdfWithPages([[200, 200], [200, 200]]),
      },
    ])
    await expect(page.locator('[data-testid="queue-item"]')).toHaveCount(1)
    await page.click('[data-testid="merge"]')
    await expect(page.locator('[data-testid="result"]')).toBeVisible()
    const boxes = mediaBoxes(await mergedBytes(page))
    expect(boxes).toHaveLength(2)
  })

  test('validasi intake: .pdf berisi konten lain ditolak', async ({ page }) => {
    await page.goto('/merge')
    await upload(page, [
      {
        name: 'fake.pdf',
        mimeType: 'application/pdf',
        buffer: Buffer.from('bukan pdf sama sekali'),
      },
    ])
    await expect(page.locator('[data-testid="errors"]')).toContainText('fake.pdf')
    await expect(page.locator('[data-testid="queue-item"]')).toHaveCount(0)
  })

  test('menolak file melebihi batas 50 MB dengan pesan jelas', async ({ page }) => {
    const big = '/tmp/fm-big-51mb.pdf'
    writeFileSync(big, Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.alloc(51 * 1024 * 1024, 0x20)]))
    try {
      await page.goto('/merge')
      await page.setInputFiles('[data-testid="file-input"]', big)
      await expect(page.locator('[data-testid="errors"]')).toContainText('batas ukuran')
      await expect(page.locator('[data-testid="queue-item"]')).toHaveCount(0)
    } finally {
      rmSync(big, { force: true })
    }
  })

  test('AC-02c: PNG transparan menjadi halaman (dipertahankan)', async ({ page }) => {
    await page.goto('/merge')
    const pngB64 = await page.evaluate(async () => {
      const c = document.createElement('canvas')
      c.width = 40
      c.height = 40
      const ctx = c.getContext('2d')!
      ctx.clearRect(0, 0, 40, 40)
      ctx.fillStyle = 'rgba(255,0,0,0.5)'
      ctx.fillRect(10, 10, 20, 20)
      const blob: Blob = await new Promise((r) => c.toBlob((b) => r(b!), 'image/png'))
      const u = new Uint8Array(await blob.arrayBuffer())
      let s = ''
      for (const b of u) s += String.fromCharCode(b)
      return btoa(s)
    })
    await upload(page, [
      { name: 'transparan.png', mimeType: 'image/png', buffer: Buffer.from(pngB64, 'base64') },
    ])
    await page.click('[data-testid="merge"]')
    await expect(page.locator('[data-testid="result"]')).toHaveAttribute('data-result-id', '1')
    const s = Buffer.from(await mergedBytes(page)).toString('latin1')
    expect(s).toMatch(/\/Subtype \/Image/)
    expect(s).toMatch(/\/Width 40/)
  })

  test('batas 50 file: kelebihan ditolak, tepat 50 diterima', async ({ page }) => {
    await page.goto('/merge')
    const one = await pdfWithPages([[200, 200]])
    const files = Array.from({ length: 51 }, (_, i) => ({
      name: `d-${i}.pdf`,
      mimeType: 'application/pdf',
      buffer: one,
    }))
    await upload(page, files)
    await expect(page.locator('[data-testid="queue-item"]')).toHaveCount(50)
    await expect(page.locator('[data-testid="errors"]')).toContainText('antrean penuh')
  })

  test('regresi: dua pemanggilan addFiles beruntun tidak saling menimpa', async ({ page }) => {
    await page.goto('/merge')
    const a = await pdfWithPages([[200, 200]])
    const b = await pdfWithPages([[300, 300]])
    // Dua batch beruntun (input lalu drop) dalam waktu dekat.
    await upload(page, [{ name: 'a.pdf', mimeType: 'application/pdf', buffer: a }])
    await upload(page, [{ name: 'b.pdf', mimeType: 'application/pdf', buffer: b }])
    await expect(page.locator('[data-testid="queue-item"]')).toHaveCount(2)
  })

  test('aksesibilitas: skip-link, fokus keyboard, dan tombol urutan berlabel', async ({ page }) => {
    await page.goto('/merge')
    // Skip-link dapat difokuskan dan mengarah ke #konten.
    const skip = page.locator('a.skip-link')
    await expect(skip).toHaveAttribute('href', '#konten')
    await skip.focus()
    await expect(skip).toBeFocused()

    await upload(page, [
      {
        name: 'a.pdf',
        mimeType: 'application/pdf',
        buffer: await pdfWithPages([[200, 200]]),
      },
      {
        name: 'b.pdf',
        mimeType: 'application/pdf',
        buffer: await pdfWithPages([[200, 200]]),
      },
    ])
    // Tombol urutan punya aria-label yang dapat dibaca screen reader.
    await expect(
      page.locator('[data-testid="queue-item"] >> nth=1 >> button[aria-label^="Naikkan"]'),
    ).toBeVisible()
    // Nama hasil punya label aksesibel.
    await expect(page.locator('[data-testid="output-name"]')).toHaveAttribute(
      'aria-label',
      'Nama file hasil',
    )
  })
})
