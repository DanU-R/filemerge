import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Kebijakan Privasi — FileMerge' }

export default function PrivacyPage() {
  return (
    <main className="page">
      <header className="page__head">
        <h1>Kebijakan Privasi</h1>
        <p>Ditulis apa adanya — tanpa klaim berlebihan.</p>
      </header>
      <section className="prose">
        <h2>Penggabungan berjalan di perangkat Anda</h2>
        <p>
          Penggabungan PDF dan gambar berjalan sepenuhnya di browser Anda. Isi dokumen{' '}
          <strong>tidak dikirim ke server</strong> saat merge, dan hasil merge tidak disimpan di
          server.
        </p>

        <h2>Dokumen tersimpan (opsional, perlu akun)</h2>
        <p>Bila Anda membuat akun dan mengunggah dokumen, kami menyimpan:</p>
        <ul>
          <li>
            <strong>Metadata</strong> (email, nama dokumen, kategori, ukuran, waktu) di database
            (Prisma Postgres).
          </li>
          <li>
            <strong>File dokumen</strong> di penyimpanan objek privat (Vercel Blob). File tidak
            dapat diakses publik; hanya bisa diunduh melalui endpoint terotorisasi milik akun Anda.
          </li>
        </ul>

        <h2>Enkripsi — jujur apa adanya</h2>
        <p>
          Dokumen <strong>tidak dienkripsi end-to-end</strong>. Provider penyimpanan mengenkripsi
          data saat tersimpan (at-rest) sesuai kebijakan mereka, tetapi operator layanan secara
          teknis <strong>dapat</strong> mengakses file. Jika butuh kerahasiaan mutlak, jangan
          unggah dokumen tersebut — gunakan fitur merge tanpa akun.
        </p>

        <h2>Kontrol data Anda</h2>
        <ul>
          <li>Anda dapat mengunduh, mengganti, dan menghapus dokumen kapan saja.</li>
          <li>
            Anda dapat menghapus akun beserta seluruh dokumen dan metadata melalui halaman{' '}
            <em>Account Settings</em>.
          </li>
        </ul>

        <h2>Backup & ketersediaan</h2>
        <p>
          Tidak ada jaminan backup otomatis atau uptime tertentu. Data bergantung pada provider.
          Sediakan salinan sendiri untuk dokumen penting.
        </p>

        <h2>Retensi</h2>
        <p>
          Dokumen disimpan sampai Anda menghapusnya atau menghapus akun. Kebijakan akun tidak aktif
          akan diumumkan jelas bila diterapkan.
        </p>

        <h2>Log</h2>
        <p>
          Kami tidak mencatat nama file atau isi dokumen dalam log. Logging dibatasi pada kesalahan
          teknis tanpa data sensitif.
        </p>

        <h2>Lisensi</h2>
        <p>Lisensi MIT berlaku untuk kode, bukan izin mempublikasikan dokumen pengguna.</p>
      </section>
    </main>
  )
}
