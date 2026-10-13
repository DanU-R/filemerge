import type { Metadata } from 'next'
import MergeTool from '@/components/MergeTool'
import { getCurrentUser } from '@/lib/server/auth'
import { getDb } from '@/prisma/db'

export const metadata: Metadata = {
  title: 'PDF Merger — FileMerge',
  description: 'Gabungkan PDF dan gambar di browser tanpa login.',
}

export const dynamic = 'force-dynamic'

export interface CloudDoc {
  id: string
  displayName: string
  category: string
  sizeBytes: number
}

export default async function MergePage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  let cloudDocs: CloudDoc[] = []
  let presets: { id: string; name: string; items: unknown }[] = []
  let isAuthed = false
  const user = await getCurrentUser()
  if (user) {
    isAuthed = true
    const db = getDb()
    const docs = await db.orm.public.Document.where({ userId: user.id, status: 'READY' })
      .orderBy((d) => d.createdAt.desc())
      .all()
    cloudDocs = docs.map((d) => ({
      id: d.id,
      displayName: d.displayName,
      category: d.category,
      sizeBytes: d.sizeBytes,
    }))
    const presetRows = await db.orm.public.MergePreset.where({ userId: user.id })
      .orderBy((p) => p.createdAt.desc())
      .all()
    presets = presetRows.map((p) => ({ id: p.id, name: p.name, items: p.items }))
  }

  const { tab } = await searchParams
  // Tab yang boleh dibuka lewat URL (?tab=halaman). Bermanfaat untuk penautan langsung
  // dan supaya tes E2E tidak perlu mengklik bilah tab tiap kali.
  const ALLOWED = new Set(['gabungkan', 'halaman', 'dokumen'])
  const defaultTab = tab && ALLOWED.has(tab) ? tab : undefined

  return (
    <main className="page">
      <header className="page__head">
        <h1>PDF Merger</h1>
        <p>
          Tambahkan PDF/JPG/PNG, atur urutan dengan tombol naik/turun, lalu gabungkan. Semua
          diproses di browser kamu.
        </p>
      </header>
      <MergeTool
        cloudDocs={cloudDocs}
        presets={presets}
        isAuthed={isAuthed}
        defaultTab={defaultTab}
      />
    </main>
  )
}
