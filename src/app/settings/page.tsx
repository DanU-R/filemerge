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
        <p className="page__eyebrow">Akun</p>
        <h1>Pengaturan akun</h1>
        <p>Ringkasan data yang tersimpan, dan pilihan menghapus akun.</p>
      </header>

      <section className="card" data-testid="account-summary">
        <div className="card__head">
          <div>
            <h2 className="card__title">Ringkasan</h2>
            <p className="card__sub">Data yang tersimpan di akun ini.</p>
          </div>
        </div>

        <ul className="summary">
          <li className="summary__item">
            <span className="summary__label">Email</span>
            <span className="summary__value">{summary.email}</span>
          </li>
          <li className="summary__item">
            <span className="summary__label">Dokumen</span>
            <span className="summary__value">{summary.documentCount}</span>
          </li>
          <li className="summary__item">
            <span className="summary__label">Preset</span>
            <span className="summary__value">{summary.presetCount}</span>
          </li>
        </ul>

        <div className="hero__actions">
          <Link className="btn" href="/dashboard">
            Buka dokumen saya
          </Link>
          <Link className="btn" href="/merge">
            Gabungkan berkas
          </Link>
        </div>
      </section>

      <DeleteAccount
        email={summary.email}
        documentCount={summary.documentCount}
        presetCount={summary.presetCount}
      />
    </main>
  )
}
