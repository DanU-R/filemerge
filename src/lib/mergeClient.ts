import { mergeDocuments } from './pdfMerge'
import { decodeImageForPdf } from './imageDecode'
import type { MergeFailure, MergeMessage, MergeSource } from './types'

export interface RunMergeOptions {
  sources: MergeSource[]
  outputName: string
  onProgress?: (index: number, total: number, name: string) => void
}

function isWorkerAvailable(): boolean {
  return typeof Worker !== 'undefined'
}

export interface MergeOutcome {
  bytes: Uint8Array
  outputName: string
  pages: number
  failures: MergeFailure[]
}

/**
 * Jalankan merge di Web Worker (UI tetap responsif). Bila Worker tidak
 * tersedia/gagal dimuat, fallback ke main thread dengan kontrak yang sama.
 */
export async function runMerge(opts: RunMergeOptions): Promise<MergeOutcome> {
  if (!isWorkerAvailable()) {
    return runOnMainThread(opts)
  }
  try {
    return await runInWorker(opts)
  } catch (err) {
    if (err instanceof WorkerUnavailableError) return runOnMainThread(opts)
    throw err
  }
}

class WorkerUnavailableError extends Error {}

function runInWorker(opts: RunMergeOptions): Promise<MergeOutcome> {
  return new Promise((resolve, reject) => {
    let worker: Worker
    try {
      worker = new Worker(new URL('./merge.worker.ts', import.meta.url), { type: 'module' })
    } catch {
      reject(new WorkerUnavailableError('worker-init-failed'))
      return
    }

    let settled = false
    const finish = (fn: () => void) => {
      if (settled) return
      settled = true
      worker.terminate()
      fn()
    }

    worker.onmessage = (event: MessageEvent<MergeMessage>) => {
      const msg = event.data
      if (msg.type === 'progress') opts.onProgress?.(msg.index, msg.total, msg.name)
      else if (msg.type === 'done')
        finish(() =>
          resolve({
            bytes: msg.bytes,
            outputName: msg.outputName,
            pages: msg.pages,
            failures: msg.failures,
          }),
        )
      else if (msg.type === 'error') finish(() => reject(new Error(msg.message)))
    }
    worker.onerror = () => finish(() => reject(new WorkerUnavailableError('worker-runtime')))
    worker.postMessage({ sources: opts.sources, outputName: opts.outputName })
  })
}

async function runOnMainThread(opts: RunMergeOptions): Promise<MergeOutcome> {
  const result = await mergeDocuments(opts.sources, decodeImageForPdf, (p) => {
    opts.onProgress?.(p.index, p.total, p.name)
  })
  return {
    bytes: result.bytes,
    outputName: opts.outputName,
    pages: result.pages,
    failures: result.failures,
  }
}
