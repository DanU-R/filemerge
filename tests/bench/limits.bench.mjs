import { chromium } from '@playwright/test'
import { PDFDocument } from '@cantoo/pdf-lib'
import { writeFileSync, mkdirSync, rmSync, statSync } from 'node:fs'

const SIZE = 2400
const TMP = '/tmp/fm-bench'

// JPEG ber-noise (sulit dikompres) -> PDF dasar realistis (~5 MB).
async function buildBasePdf() {
  const tmp = await chromium.launch()
  const p = await tmp.newPage()
  await p.setContent('<canvas id=c></canvas>')
  const b64 = await p.evaluate(
    async ([s]) => {
      const c = document.getElementById('c')
      c.width = s
      c.height = s
      const ctx = c.getContext('2d')
      const img = ctx.createImageData(s, s)
      for (let i = 0; i < img.data.length; i += 4) {
        img.data[i] = (Math.random() * 256) | 0
        img.data[i + 1] = (Math.random() * 256) | 0
        img.data[i + 2] = (Math.random() * 256) | 0
        img.data[i + 3] = 255
      }
      ctx.putImageData(img, 0, 0)
      const blob = await new Promise((r) => c.toBlob((b) => r(b), 'image/jpeg', 0.95))
      const u = new Uint8Array(await blob.arrayBuffer())
      let str = ''
      for (const x of u) str += String.fromCharCode(x)
      return btoa(str)
    },
    [SIZE],
  )
  await tmp.close()
  const jpeg = Buffer.from(b64, 'base64')
  const doc = await PDFDocument.create()
  const img = await doc.embedJpg(jpeg)
  const page = doc.addPage([595.28, 841.89])
  page.drawImage(img, { x: 0, y: 0, width: 595.28, height: 841.89 })
  return Buffer.from(await doc.save())
}

async function bench(basePath, count, targetMB) {
  const browser = await chromium.launch()
  const page = await browser.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 120)))
  await page.goto('http://127.0.0.1:3100/merge', { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(500)

  const files = Array.from({ length: count }, (_, i) => `${TMP}/doc-${i}.pdf`)
  await page.setInputFiles('[data-testid="file-input"]', files)
  let queued = 0
  try {
    await page.waitForFunction(
      (n) => document.querySelectorAll('[data-testid="queue-item"]').length === n,
      count,
      { timeout: 60000 },
    )
    queued = count
  } catch {
    queued = await page.locator('[data-testid="queue-item"]').count()
  }

  const heapBefore = await page.evaluate(() =>
    performance.memory ? performance.memory.usedJSHeapSize : 0,
  )
  const t0 = Date.now()
  let ok = false
  try {
    await page.click('[data-testid="merge"]')
    await page.waitForSelector('[data-testid="result"]', { timeout: 180000 })
    ok = true
  } catch {
    errors.push('merge-timeout')
  }
  const dur = Date.now() - t0
  const heapAfter = await page.evaluate(() =>
    performance.memory ? performance.memory.usedJSHeapSize : 0,
  )
  await browser.close()

  return {
    files: count,
    totalMB: targetMB,
    queued,
    ok,
    seconds: +(dur / 1000).toFixed(1),
    heapAfterMB: +(heapAfter / 1024 / 1024).toFixed(1),
    heapDeltaMB: +((heapAfter - heapBefore) / 1024 / 1024).toFixed(1),
    errors,
  }
}

const base = await buildBasePdf()
const baseMB = base.length / 1024 / 1024
mkdirSync(TMP, { recursive: true })
console.log('base pdf MB:', baseMB.toFixed(2))

const plan = [20, 60, 120, 200]
const results = []
for (const mb of plan) {
  const count = Math.max(1, Math.round(mb / baseMB))
  // Siapkan file di disk untuk iterasi ini.
  for (let i = 0; i < count; i++) writeFileSync(`${TMP}/doc-${i}.pdf`, base)
  const r = await bench(`${TMP}/doc-0.pdf`, count, +((baseMB * count).toFixed(1)))
  results.push(r)
  console.log('done', JSON.stringify(r))
  for (let i = 0; i < count; i++) rmSync(`${TMP}/doc-${i}.pdf`, { force: true })
}
console.log('BENCH=' + JSON.stringify(results, null, 1))
