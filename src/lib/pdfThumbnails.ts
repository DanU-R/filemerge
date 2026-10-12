'use client'

/**
 * Render thumbnail halaman PDF di browser (untuk preview visual di editor halaman).
 *
 * Renderer: pdf.js (`pdfjs-dist`). Dipakai **hanya untuk preview** — tidak ada
 * dokumen yang dikirim ke server. Kompresi tetap lossless (lihat compressPdf.ts).
 *
 * Worker pdf.js dimuat dari `/pdf.worker.min.mjs` (same-origin) supaya tidak
 * melanggar CSP `worker-src 'self' blob:` dan tidak butuh jaringan eksternal.
 * File itu disalin dari node_modules oleh `scripts/copy-pdfjs-worker.mjs`
 * (dijalankan pada `predev`/`prebuild`).
 */

export interface Thumbnail {
  index: number
  /** Object URL blob gambar. WAJIB di-revoke oleh pemanggil. */
  url: string
  /** Dimensi thumbnail (piksel), sudah memperhitungkan rotasi asal halaman. */
  width: number
  height: number
}

export interface RenderOptions {
  /** Lebar maksimum thumbnail dalam piksel. Default 200. */
  maxWidth?: number
  /** Jumlah halaman yang dirender paralel. Default 2 (hemat memori). */
  concurrency?: number
  /** Beri kesempatan UI bernapas antar halaman (ms). Default 0. */
  yieldMs?: number
}

export interface RenderDeps {
  /** Dipakai untuk pembersihan & pengujian. */
  createObjectUrl?: (blob: Blob) => string
}

let workerConfigured = false

async function getPdfjs() {
  const mod = await import('pdfjs-dist')
  if (!workerConfigured) {
    mod.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'
    workerConfigured = true
  }
  return mod
}

interface CanvasLike {
  canvas: OffscreenCanvas | HTMLCanvasElement
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D
  toBlob: (type: string, quality?: number) => Promise<Blob>
}

async function makeCanvas(w: number, h: number): Promise<CanvasLike> {
  const g = globalThis as unknown as { OffscreenCanvas?: typeof OffscreenCanvas }
  if (typeof g.OffscreenCanvas === 'function') {
    const canvas = new g.OffscreenCanvas(w, h)
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas 2D tidak tersedia.')
    return {
      canvas,
      ctx,
      toBlob: (type, quality) => canvas.convertToBlob({ type, quality }),
    }
  }
  if (typeof document === 'undefined') throw new Error('Canvas tidak tersedia di lingkungan ini.')
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D tidak tersedia.')
  return {
    canvas,
    ctx,
    toBlob: (type, quality) =>
      new Promise<Blob>((resolve, reject) =>
        canvas.toBlob(
          (b) => (b ? resolve(b) : reject(new Error('Gagal encode thumbnail.'))),
          type,
          quality,
        ),
      ),
  }
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

/**
 * Render thumbnail semua halaman. Mengembalikan daftar object URL;
 * pemanggil WAJIB memanggil `revokeThumbnails` saat komponen dilepas atau
 * bytes diganti, agar tidak ada kebocoran memori.
 */
export async function renderThumbnails(
  bytes: Uint8Array,
  opts: RenderOptions = {},
  deps: RenderDeps = {},
  onProgress?: (done: number, total: number) => void,
): Promise<Thumbnail[]> {
  const maxWidth = opts.maxWidth ?? 200
  const concurrency = Math.max(1, Math.min(opts.concurrency ?? 2, 4))
  const yieldMs = opts.yieldMs ?? 0
  const makeUrl = deps.createObjectUrl ?? ((b: Blob) => URL.createObjectURL(b))

  const pdfjs = await getPdfjs()
  // Salin bytes: pdf.js men-transfer buffer ke worker-nya, sehingga buffer asli
  // menjadi detached dan tidak bisa dipakai operasi lain (pelajaran dari bug
  // ArrayBuffer detached sebelumnya).
  const data = bytes.slice()
  const task = pdfjs.getDocument({ data })
  const doc = await task.promise
  const total = doc.numPages
  const results: Thumbnail[] = new Array(total)
  let done = 0

  const renderOne = async (pageNumber: number) => {
    const page = await doc.getPage(pageNumber)
    const base = page.getViewport({ scale: 1 })
    const scale = Math.min(maxWidth / base.width, 4)
    const viewport = page.getViewport({ scale })
    const { canvas, ctx, toBlob } = await makeCanvas(
      Math.max(1, Math.round(viewport.width)),
      Math.max(1, Math.round(viewport.height)),
    )

    // Latar putih: halaman transparan menjadi hitam bila tidak diisi.
    ctx.save()
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.restore()

    await page.render({
      canvas: canvas as never,
      canvasContext: ctx as never,
      viewport: viewport as never,
    }).promise

    const blob = await toBlob('image/jpeg', 0.72)
    results[pageNumber - 1] = {
      index: pageNumber - 1,
      url: makeUrl(blob),
      width: Math.round(viewport.width),
      height: Math.round(viewport.height),
    }
    page.cleanup()
    done += 1
    onProgress?.(done, total)
    if (yieldMs > 0) await sleep(yieldMs)
  }

  // Render berkelompok agar tidak memblokir UI terlalu lama.
  for (let i = 1; i <= total; i += concurrency) {
    const batch: Promise<void>[] = []
    for (let j = i; j < i + concurrency && j <= total; j++) batch.push(renderOne(j))
    await Promise.all(batch)
  }

  // Lepaskan sumber daya halaman lalu worker pdf.js.
  // pdf.js v6: `cleanup()` ada di document proxy; `destroy()` ada di loading task.
  await doc.cleanup().catch(() => {})
  await task.destroy()

  return results.filter(Boolean)
}

/** Revoke semua object URL thumbnail (wajib saat ganti dokumen / unmount). */
export function revokeThumbnails(thumbs: Thumbnail[] | null | undefined): void {
  if (!thumbs) return
  for (const t of thumbs) {
    try {
      URL.revokeObjectURL(t.url)
    } catch {
      /* sudah di-revoke */
    }
  }
}
