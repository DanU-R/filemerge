import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import DeleteAccount from '@/components/DeleteAccount'
import { getCurrentUser } from '@/lib/server/auth'
import { accountSummary } from '@/lib/server/account'

export const metadata: Metadata = { title: 'Pengaturan Akun: FileMerge' }
export const dynamic = 'force-dynamic'

export default async function SettingsPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const summary = await accountSummary(user.id)
  if (!summary) redirect('/login')

  return (
    <main className="page">
      <header className="page__head">
        <h1>Account Settings</h1>
        <p>Kelola akun Anda.</p>
      </header>

      <section className="cloud" data-testid="account-summary">
        <h2 className="cloud__title">Ringkasan</h2>
        <ul>
          <li>Email: {summary.email}</li>
          <li>Dokumen: {summary.documentCount}</li>
          <li>Preset: {summary.presetCount}</li>
        </ul>
        <p>
          <Link className="btn btn--small" href="/dashboard">
            Ke My Documents
          </Link>
        </p>
      </section>

      <DeleteAccount
        email={summary.email}
        documentCount={summary.documentCount}
        presetCount={summary.presetCount}
      />
    </main>
  )
}
