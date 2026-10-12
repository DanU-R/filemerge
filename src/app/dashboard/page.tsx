import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import DocumentsManager from '@/components/DocumentsManager'
import { getCurrentUser } from '@/lib/server/auth'
import { getDb } from '@/prisma/db'
import { DOC_LIMITS } from '@/lib/server/docLimits'

export const metadata: Metadata = { title: 'Dashboard — FileMerge' }
export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const db = getDb()
  const docs = await db.orm.public.Document.where({ userId: user.id, status: 'READY' })
    .orderBy((d) => d.createdAt.desc())
    .all()
  const usedBytes = docs.reduce((s, d) => s + d.sizeBytes, 0)

  return (
    <main className="page">
      <p className="muted small" data-testid="whoami">
        Masuk sebagai {user.email}
      </p>
      <DocumentsManager
        initialDocs={docs.map((d) => ({
          id: d.id,
          displayName: d.displayName,
          category: d.category,
          sizeBytes: d.sizeBytes,
        }))}
        initialQuota={{
          usedBytes,
          maxBytes: DOC_LIMITS.MAX_TOTAL_BYTES,
          count: docs.length,
          maxCount: DOC_LIMITS.MAX_DOCS_PER_USER,
        }}
      />
    </main>
  )
}
