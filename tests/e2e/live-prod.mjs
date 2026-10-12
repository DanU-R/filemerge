import { chromium } from '@playwright/test'
import { PDFDocument } from '@cantoo/pdf-lib'

const BASE = 'https://filemerge-seven.vercel.app'
const email = `live-${Date.now()}@example.com`
const password = 'rahasia12345'

async function pdfBytes(pages) {
  const doc = await PDFDocument.create()
  for (let i = 0; i < pages; i++) doc.addPage([200 + i, 200])
  return Buffer.from(await doc.save())
}
function mediaBoxes(bytes) {
  const s = Buffer.from(bytes).toString('latin1')
  return [...s.matchAll(/\/MediaBox\s*\[\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\]/g)].map(
    (m) => [Number(m[3]), Number(m[4])],
  )
}

const b = await chromium.launch()
const p = await b.newPage()
const out = {}
const errs = []
p.on('pageerror', (e) => errs.push(String(e).slice(0, 160)))

await p.goto(BASE + '/register', { waitUntil: 'domcontentloaded' })
await p.waitForLoadState('networkidle')
await p.waitForTimeout(2000)
await p.fill('[data-testid="email"]', email)
await p.fill('[data-testid="password"]', password)
await p.click('[data-testid="submit"]')
await p.waitForURL('**/dashboard', { timeout: 45000 })
out.registered = true

// upload 2 dokumen
for (const [name, pages] of [['CV Utama', 1], ['Ijazah', 2]]) {
  const before = await p.locator('[data-testid="doc-item"]').count()
  await p.setInputFiles('[data-testid="doc-file"]', {
    name: `${name}.pdf`,
    mimeType: 'application/pdf',
    buffer: await pdfBytes(pages),
  })
  await p.fill('[data-testid="doc-name"]', name)
  await p.click('[data-testid="upload"]')
  await p.waitForFunction(
    (n) => document.querySelectorAll('[data-testid="doc-item"]').length === n,
    before + 1,
    { timeout: 45000 },
  )
}
out.docCount = await p.locator('[data-testid="doc-item"]').count()
out.quota = await p.locator('[data-testid="quota"]').textContent()

// unduh dokumen (bukti Blob privat bisa diakses via endpoint terotorisasi)
const dlStatus = await p.evaluate(async () => {
  const a = document.querySelector('a[data-testid="download"]')
  const r = await fetch(a.href)
  return r.status
})
out.downloadStatus = dlStatus

// merge dari dokumen cloud + file lokal
await p.goto(BASE + '/merge')
await p.waitForLoadState('networkidle')
await p.waitForTimeout(2500)
await p.locator('[data-testid="cloud-add"]').first().click()
await p.waitForSelector('[data-testid="queue-item"]', { timeout: 45000 })
await p.setInputFiles('[data-testid="file-input"]', {
  name: 'lampiran.pdf',
  mimeType: 'application/pdf',
  buffer: await pdfBytes(2),
})
await p.click('[data-testid="merge"]')
await p.waitForSelector('[data-testid="result"]', { timeout: 60000 })
const b64 = await p.evaluate(async () => {
  const a = document.querySelector('[data-testid="download"]')
  const r = await fetch(a.href)
  const u = new Uint8Array(await r.arrayBuffer())
  let s = ''
  for (const x of u) s += String.fromCharCode(x)
  return btoa(s)
})
out.mergedPages = mediaBoxes(new Uint8Array(Buffer.from(b64, 'base64'))).length
out.pageErrors = errs
await b.close()
console.log(JSON.stringify(out, null, 1))
