import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Kebijakan Privasi: FileMerge' }

/** Daftar isi + anchor; id harus sama dengan <h2 id> di bawah. */
const SECTIONS = [
  { id: 'perangkat', label: 'Penggabungan di perangkat Anda' },
  { id: 'tersimpan', label: 'Dokumen tersimpan' },
  { id: 'enkripsi', label: 'Enkripsi' },
  { id: 'kontrol', label: 'Kontrol data Anda' },
  { id: 'backup', label: 'Backup & ketersediaan' },
  { id: 'retensi', label: 'Retensi' },
  { id: 'log', label: 'Log' },
  { id: 'lisensi', label: 'Lisensi' },
]

export default function PrivacyPage() {
  return (
    <main className="page">
      <header className="page__head">
        <p className="page__eyebrow">Privasi</p>
        <h1>Kebijakan Privasi</h1>
        <p>Ditulis apa adanya, tanpa klaim berlebihan.</p>
      </header>

      <div className="prose-page">
        <nav className="toc" aria-label="Daftar isi">
          <p className="toc__title">Isi</p>
          <ol>
            {SECTIONS.map((s) => (
              <li key={s.id}>
                <a href={`#${s.id}`}>{s.label}</a>
              </li>
            ))}
          </ol>
        </nav>

        <section className="prose">
          <h2 id="perangkat">Penggabungan berjalan di perangkat Anda</h2>
          <p>
            Penggabungan PDF dan gambar berjalan sepenuhnya di browser Anda. Isi dokumen{' '}
            <strong>tidak dikirim ke server</strong> saat merge, dan hasil merge tidak disimpan di
            server.
          </p>

          <h2 id="tersimpan">Dokumen tersimpan (opsional, perlu akun)</h2>
          <p>Bila Anda membuat akun dan mengunggah dokumen, kami menyimpan:</p>
          <ul>
            <li>
              <strong>Metadata</strong> (email, nama dokumen, kategori, ukuran, waktu) di database
              (Prisma Postgres).
            </li>
            <li>
              <strong>File dokumen</strong> di penyimpanan objek privat (Vercel Blob). File tidak
              dapat diakses publik; hanya bisa diunduh melalui endpoint terotorisasi milik akun
              Anda.
            </li>
          </ul>

          <h2 id="enkripsi">Enkripsi: jujur apa adanya</h2>
          <p>
            Dokumen <strong>tidak dienkripsi end-to-end</strong>. Provider penyimpanan mengenkripsi
            data saat tersimpan (at-rest) sesuai kebijakan mereka, tetapi operator layanan secara
            teknis <strong>dapat</strong> mengakses file. Jika butuh kerahasiaan mutlak, jangan
            unggah dokumen tersebut. Gunakan fitur merge tanpa akun.
          </p>

          <h2 id="kontrol">Kontrol data Anda</h2>
          <ul>
            <li>Anda dapat mengunduh, mengganti, dan menghapus dokumen kapan saja.</li>
            <li>
              Anda dapat menghapus akun beserta seluruh dokumen dan metadata melalui halaman{' '}
              <a href="/settings">Pengaturan akun</a>.
            </li>
          </ul>

          <h2 id="backup">Backup & ketersediaan</h2>
          <p>
            Tidak ada jaminan backup otomatis atau uptime tertentu. Data bergantung pada provider.
            Sediakan salinan sendiri untuk dokumen penting.
          </p>

          <h2 id="retensi">Retensi</h2>
          <p>
            Dokumen disimpan sampai Anda menghapusnya atau menghapus akun. Kebijakan akun tidak
            aktif akan diumumkan jelas bila diterapkan.
          </p>

          <h2 id="log">Log</h2>
          <p>
            Kami tidak mencatat nama file atau isi dokumen dalam log. Logging dibatasi pada
            kesalahan teknis tanpa data sensitif.
          </p>

          <h2 id="lisensi">Lisensi</h2>
          <p>Lisensi MIT berlaku untuk kode, bukan izin mempublikasikan dokumen pengguna.</p>
        </section>
      </div>
    </main>
  )
}
