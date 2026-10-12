/// <reference lib="webworker" />
import { mergeDocuments } from './pdfMerge'
import { decodeImageForPdf } from './imageDecode'
import type { MergeMessage, MergeSource } from './types'

interface StartPayload {
  sources: MergeSource[]
  outputName: string
}

self.onmessage = async (event: MessageEvent<StartPayload>) => {
  const { sources, outputName } = event.data
  const post = (msg: MergeMessage) => (self as unknown as Worker).postMessage(msg)
  try {
    const result = await mergeDocuments(sources, decodeImageForPdf, (p) => {
      post({ type: 'progress', index: p.index, total: p.total, name: p.name })
    })
    post({
      type: 'done',
      bytes: result.bytes,
      outputName,
      pages: result.pages,
      failures: result.failures,
    })
  } catch (err) {
    post({ type: 'error', message: err instanceof Error ? err.message : String(err) })
  }
}
