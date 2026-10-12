/**
 * Salin worker pdf.js ke `public/` agar dimuat same-origin.
 * Alasan: Worker dari CDN/URL eksternal akan diblokir CSP kita
 * (`worker-src 'self' blob:`) dan menambah dependensi jaringan.
 *
 * Dijalankan otomatis lewat `predev` dan `prebuild`.
 */
import { copyFileSync, existsSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

const src = resolve('node_modules/pdfjs-dist/build/pdf.worker.min.mjs')
const dest = resolve('public/pdf.worker.min.mjs')

if (!existsSync(src)) {
  console.error('pdfjs-dist worker tidak ditemukan. Jalankan: bun install')
  process.exit(1)
}

mkdirSync(dirname(dest), { recursive: true })
copyFileSync(src, dest)
console.log('pdf.js worker disalin ke public/pdf.worker.min.mjs')
