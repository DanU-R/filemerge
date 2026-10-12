import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import Link from 'next/link'
import './globals.css'
import { getCurrentUser } from '@/lib/server/auth'

export const metadata: Metadata = {
  title: 'FileMerge — Gabungkan PDF & gambar',
  description:
    'Gabungkan PDF dan gambar menjadi satu berkas, diproses di browser tanpa login.',
}

export default async function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  let user = null
  try {
    user = await getCurrentUser()
  } catch {
    user = null
  }

  return (
    <html lang="id">
      <body>
        <a className="skip-link" href="#konten">
          Lompat ke konten
        </a>
        <nav className="nav" aria-label="Navigasi utama">
          <Link className="nav__brand" href="/">
            FileMerge
          </Link>
          <span className="nav__links">
            <Link href="/merge">Merge</Link>
            {user ? (
              <Link href="/dashboard">Dashboard</Link>
            ) : (
              <Link href="/login">Masuk</Link>
            )}
            <Link href="/privacy">Privasi</Link>
          </span>
        </nav>
        <div id="konten">{children}</div>
        <footer className="footer">
          <p>
            FileMerge · MIT · Penggabungan diproses lokal di browser. Bukan pengganti backup.
          </p>
        </footer>
      </body>
    </html>
  )
}
