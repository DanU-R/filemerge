import Link from 'next/link'
import { DocsIllustration } from '@/components/Illustration'

export default function NotFound() {
  return (
    <main className="page">
      <header className="page__head">
        <p className="page__eyebrow">404</p>
        <h1>Halaman tidak ditemukan</h1>
        <p>Alamat yang kamu buka tidak tersedia, atau sudah dipindahkan.</p>
      </header>

      <section className="band">
        <div>
          <h2>Mungkin salah ketik, atau tautannya sudah berubah.</h2>
          <p>
            Kamu bisa kembali ke beranda, langsung membuka alat penggabung, atau melihat kebijakan
            privasi.
          </p>
          <div className="hero__actions">
            <Link className="btn btn--primary" href="/">
              Kembali ke beranda
            </Link>
            <Link className="btn" href="/merge">
              Buka alat gabungkan
            </Link>
            <Link className="btn" href="/privacy">
              Info privasi
            </Link>
          </div>
        </div>
        <DocsIllustration className="band__art" />
      </section>
    </main>
  )
}
