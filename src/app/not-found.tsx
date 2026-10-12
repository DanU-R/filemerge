import Link from 'next/link'

export default function NotFound() {
  return (
    <main className="page">
      <header className="page__head">
        <h1>404 — Halaman tidak ditemukan</h1>
        <p>Alamat yang kamu buka tidak tersedia.</p>
      </header>
      <p>
        <Link className="btn btn--primary" href="/">
          Kembali ke beranda
        </Link>
      </p>
    </main>
  )
}
