import type { Metadata } from 'next'
import MergeTool from '@/components/MergeTool'

export const metadata: Metadata = {
  title: 'PDF Merger — FileMerge',
  description: 'Gabungkan PDF dan gambar di browser tanpa login.',
}

export default function MergePage() {
  return (
    <main className="page">
      <header className="page__head">
        <h1>PDF Merger</h1>
        <p>
          Tambahkan PDF/JPG/PNG, atur urutan dengan tombol naik/turun, lalu gabungkan. Semua
          diproses di browser kamu.
        </p>
      </header>
      <MergeTool />
    </main>
  )
}
