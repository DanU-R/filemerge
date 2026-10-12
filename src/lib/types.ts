export type SourceKind = 'pdf' | 'image'

export interface QueueItem {
  id: string
  file: File
  name: string
  kind: SourceKind
  size: number
  /** Bila item berasal dari dokumen tersimpan (Fase 3), simpan id-nya untuk preset. */
  cloudId?: string
}

export interface MergeSource {
  id: string
  kind: SourceKind
  name: string
  file: Blob
}

export interface DecodedImage {
  bytes: Uint8Array
  format: 'png' | 'jpeg'
  width: number
  height: number
  /** Jumlah halaman yang dihasilkan (1 untuk gambar; memungkinkan GIF/multi-frame di masa depan). */
  pages: number
}

export type ImageDecoder = (file: Blob) => Promise<DecodedImage>

export interface MergeProgress {
  index: number
  total: number
  name: string
}

export interface MergeFailure {
  id: string
  name: string
  reason: string
}

export type MergeMessage =
  | { type: 'progress'; index: number; total: number; name: string }
  | {
      type: 'done'
      bytes: Uint8Array
      outputName: string
      pages: number
      failures: MergeFailure[]
    }
  | { type: 'error'; message: string }
