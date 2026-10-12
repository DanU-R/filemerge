import { applyPageEdits, inspectPdf, splitPdf, type PageEdit, type PageInfo } from './pageTools'
import { compressPdf } from './compressPdf'
import type { ToolsRequest, ToolsResponse } from './pageTools.worker'

/**
 * Klien alat PDF: jalankan di Web Worker agar UI tetap responsif, dengan
 * fallback main-thread bila Worker tidak tersedia. Isi dokumen tidak pernah
 * dikirim ke server.
 */

function workerAvailable(): boolean {
  return typeof Worker !== 'undefined'
}

let counter = 0

class WorkerUnavailableError extends Error {}

function callWorker(req: ToolsRequest): Promise<ToolsResponse> {
  return new Promise((resolve, reject) => {
    let worker: Worker
    try {
      worker = new Worker(new URL('./pageTools.worker.ts', import.meta.url), { type: 'module' })
    } catch {
      reject(new WorkerUnavailableError('init'))
      return
    }
    let settled = false
    const finish = (fn: () => void) => {
      if (settled) return
      settled = true
      worker.terminate()
      fn()
    }
    worker.onmessage = (e: MessageEvent<ToolsResponse>) => {
      if (e.data.id !== req.id) return
      finish(() => resolve(e.data))
    }
    worker.onerror = () => finish(() => reject(new WorkerUnavailableError('runtime')))

    // Kirim SALINAN lalu transfer buffer salinan. PDF asli dipakai berkali-kali
    // (inspect -> apply -> split/compress); mentransfer buffer aslinya akan
    // membuatnya detached dan operasi berikutnya gagal.
    let payload: ToolsRequest = req
    let transfer: Transferable[] = []
    if ('bytes' in req && req.bytes) {
      const copy = req.bytes.slice()
      payload = { ...req, bytes: copy } as ToolsRequest
      transfer = [copy.buffer]
    }
    worker.postMessage(payload, transfer)
  })
}

async function call<T extends ToolsResponse>(
  build: (id: number) => ToolsRequest,
  fallback: (req: ToolsRequest) => Promise<ToolsResponse>,
): Promise<T> {
  const id = ++counter
  const req = build(id)
  if (workerAvailable()) {
    try {
      const res = (await callWorker(req)) as T
      if (!res.ok) throw new Error(res.error)
      return res
    } catch (err) {
      if (!(err instanceof WorkerUnavailableError)) throw err
      // jatuh ke main thread
    }
  }
  const res = (await fallback(build(++counter))) as T
  if (!res.ok) throw new Error(res.error)
  return res
}

export async function inspectPdfBytes(bytes: Uint8Array): Promise<PageInfo[]> {
  const res = await call<Extract<ToolsResponse, { type: 'inspect' }>>(
    (id) => ({ id, type: 'inspect', bytes }),
    async (req) => {
      const r = req as Extract<ToolsRequest, { type: 'inspect' }>
      const { pages } = await inspectPdf(r.bytes)
      return { id: r.id, ok: true, type: 'inspect', pages }
    },
  )
  return res.pages
}

export async function applyEditsBytes(bytes: Uint8Array, edits: PageEdit[]): Promise<Uint8Array> {
  const res = await call<Extract<ToolsResponse, { type: 'applyEdits' }>>(
    (id) => ({ id, type: 'applyEdits', bytes, edits }),
    async (req) => {
      const r = req as Extract<ToolsRequest, { type: 'applyEdits' }>
      return { id: r.id, ok: true, type: 'applyEdits', bytes: await applyPageEdits(r.bytes, r.edits) }
    },
  )
  return res.bytes
}

export async function splitPdfBytes(
  bytes: Uint8Array,
  ranges: { from: number; to: number }[],
): Promise<Uint8Array[]> {
  const res = await call<Extract<ToolsResponse, { type: 'split' }>>(
    (id) => ({ id, type: 'split', bytes, ranges }),
    async (req) => {
      const r = req as Extract<ToolsRequest, { type: 'split' }>
      return { id: r.id, ok: true, type: 'split', parts: await splitPdf(r.bytes, r.ranges) }
    },
  )
  return res.parts
}

export interface CompressOutcome {
  bytes: Uint8Array
  originalBytes: number
  compressedBytes: number
  pages: number
  savedRatio: number
}

export async function compressPdfBytes(bytes: Uint8Array): Promise<CompressOutcome> {
  const res = await call<Extract<ToolsResponse, { type: 'compress' }>>(
    (id) => ({ id, type: 'compress', bytes }),
    async (req) => {
      const r = req as Extract<ToolsRequest, { type: 'compress' }>
      const c = await compressPdf(r.bytes)
      return {
        id: r.id,
        ok: true,
        type: 'compress',
        bytes: c.bytes,
        originalBytes: c.originalBytes,
        compressedBytes: c.compressedBytes,
        pages: c.pages,
        savedRatio: c.savedRatio,
      }
    },
  )
  return {
    bytes: res.bytes,
    originalBytes: res.originalBytes,
    compressedBytes: res.compressedBytes,
    pages: res.pages,
    savedRatio: res.savedRatio,
  }
}
