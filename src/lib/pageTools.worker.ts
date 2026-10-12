/// <reference lib="webworker" />
import { applyPageEdits, inspectPdf, splitPdf, type PageEdit } from './pageTools'
import { compressPdf } from './compressPdf'

export type ToolsRequest =
  | { id: number; type: 'inspect'; bytes: Uint8Array }
  | { id: number; type: 'applyEdits'; bytes: Uint8Array; edits: PageEdit[] }
  | { id: number; type: 'split'; bytes: Uint8Array; ranges: { from: number; to: number }[] }
  | { id: number; type: 'compress'; bytes: Uint8Array }

export type ToolsResponse =
  | { id: number; ok: true; type: 'inspect'; pages: { index: number; width: number; height: number; rotation: number }[] }
  | { id: number; ok: true; type: 'applyEdits'; bytes: Uint8Array }
  | { id: number; ok: true; type: 'split'; parts: Uint8Array[] }
  | {
      id: number
      ok: true
      type: 'compress'
      bytes: Uint8Array
      originalBytes: number
      compressedBytes: number
      pages: number
      savedRatio: number
    }
  | { id: number; ok: false; error: string }

const post = (msg: ToolsResponse) => (self as unknown as Worker).postMessage(msg)

self.onmessage = async (event: MessageEvent<ToolsRequest>) => {
  const req = event.data
  try {
    if (req.type === 'inspect') {
      const { pages } = await inspectPdf(req.bytes)
      post({ id: req.id, ok: true, type: 'inspect', pages })
      return
    }
    if (req.type === 'applyEdits') {
      const bytes = await applyPageEdits(req.bytes, req.edits)
      post({ id: req.id, ok: true, type: 'applyEdits', bytes })
      return
    }
    if (req.type === 'split') {
      const parts = await splitPdf(req.bytes, req.ranges)
      post({ id: req.id, ok: true, type: 'split', parts })
      return
    }
    if (req.type === 'compress') {
      const r = await compressPdf(req.bytes)
      post({
        id: req.id,
        ok: true,
        type: 'compress',
        bytes: r.bytes,
        originalBytes: r.originalBytes,
        compressedBytes: r.compressedBytes,
        pages: r.pages,
        savedRatio: r.savedRatio,
      })
      return
    }
  } catch (err) {
    post({ id: req.id, ok: false, error: err instanceof Error ? err.message : String(err) })
  }
}
