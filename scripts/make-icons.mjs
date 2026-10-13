#!/usr/bin/env node
/**
 * Hasilkan berkas favicon dari src/app/icon.svg:
 *   public/favicon.ico (16/32/48 px, ICO container)
 *   src/app/apple-icon.png (180x180, iOS)
 *
 * ICO ditulis sendiri (header ICONDIR + entri PNG) supaya tidak perlu
 * dependensi tambahan; PNG dihasilkan sharp.
 *
 * Jalankan: node scripts/make-icons.mjs
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SVG = readFileSync(join(ROOT, 'src/app/icon.svg'))

const ICO_SIZES = [16, 32, 48]

async function renderPng(size) {
  return sharp(SVG, { density: 384 })
    .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png({ compressionLevel: 9 })
    .toBuffer()
}

/** Bungkus beberapa PNG ke dalam satu berkas .ico. */
function buildIco(images) {
  const count = images.length
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0) // reserved
  header.writeUInt16LE(1, 2) // type: 1 = icon
  header.writeUInt16LE(count, 4)

  const dir = Buffer.alloc(16 * count)
  let offset = 6 + 16 * count
  const parts = []

  images.forEach(({ size, data }, i) => {
    const o = i * 16
    dir.writeUInt8(size >= 256 ? 0 : size, o + 0) // width
    dir.writeUInt8(size >= 256 ? 0 : size, o + 1) // height
    dir.writeUInt8(0, o + 2) // palette
    dir.writeUInt8(0, o + 3) // reserved
    dir.writeUInt16LE(1, o + 4) // color planes
    dir.writeUInt16LE(32, o + 6) // bits per pixel
    dir.writeUInt32LE(data.length, o + 8)
    dir.writeUInt32LE(offset, o + 12)
    offset += data.length
    parts.push(data)
  })

  return Buffer.concat([header, dir, ...parts])
}

const images = []
for (const size of ICO_SIZES) {
  images.push({ size, data: await renderPng(size) })
}

mkdirSync(join(ROOT, 'public'), { recursive: true })
writeFileSync(join(ROOT, 'public/favicon.ico'), buildIco(images))

const apple = await sharp(SVG, { density: 384 })
  .resize(180, 180, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .png({ compressionLevel: 9 })
  .toBuffer()
writeFileSync(join(ROOT, 'src/app/apple-icon.png'), apple)

console.log(
  [
    `public/favicon.ico      ${images.map((i) => `${i.size}px`).join('/')}  ${buildIco(images).length} B`,
    `src/app/apple-icon.png  180x180  ${apple.length} B`,
  ].join('\n'),
)
