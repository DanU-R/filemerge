# Security Policy

## Akun & kata sandi
- Password disimpan sebagai hash **bcrypt**. Tidak ada reset via email (di luar cakupan,
  aplikasi single-user).
- **Lupa password?** Jalankan `bun run account:password <email> <password-baru>` pada
  lingkungan dengan `DATABASE_URL`. Perintah ini mengganti hash dan mencabut semua sesi lama.
- Selalu pakai HTTPS saat login; cookie sesi `HttpOnly` + `Secure` di produksi.

## Pemeliharaan storage
- `bun run storage:reconcile`: menuntaskan dokumen `PENDING_DELETION` dan melaporkan
  objek yatim (blob tanpa baris DB). Tambahkan `-- --purge` untuk menghapus objek yatim.
- Jalankan berkala (mis. bulanan) agar storage dan database tetap konsisten.
- Kegagalan hapus objek **dicatat di log**, tidak ditelan diam-diam; dokumen tetap
  berstatus `PENDING_DELETION` (tersembunyi dari UI) sampai berhasil dihapus.

## Melaporkan kerentanan
Jangan membuka issue publik untuk masalah keamanan. Laporkan secara privat ke pemelihara
proyek (lihat kontak di repositori) dengan menyertakan:
- Deskripsi masalah & dampaknya
- Langkah reproduksi
- Bukti (PoC) bila ada

Kami berusaha menanggapi dalam beberapa hari kerja.

## Model keamanan

**Yang dilindungi**
- Isolasi data antar-akun: setiap query dokumen terikat `userId`; dokumen milik pengguna
  lain mengembalikan 404.
- Password disimpan sebagai hash **bcrypt**; tidak pernah plaintext.
- Sesi: cookie **HttpOnly, Secure (produksi), SameSite=Lax**; token di tabel `Session`.
- File dokumen disimpan di object storage **privat**; akses hanya via endpoint
  terotorisasi (tidak ada URL publik).
- Validasi berkas berbasis **magic bytes**, bukan ekstensi.
- Nama file disanitasi; `storageKey` dibuat server (UUID), bukan dari nama file.
- Rate limiting dasar pada login/registrasi/unggah.
- Header keamanan (CSP, X-Content-Type-Options, HSTS, dll.) di semua route.

**Yang TIDAK dijamin**
- Dokumen di cloud **tidak dienkripsi end-to-end**. Operator layanan secara teknis dapat
  mengakses storage. Jangan unggah dokumen yang tidak ingin Anda percayakan ke operator.
- Tidak ada jaminan uptime atau backup otomatis. Data bergantung pada provider
  (Prisma Postgres, Vercel Blob).
- Rate limiting berjalan per-instance (serverless), bukan terpusat.

## Praktik untuk kontributor
- Jangan pernah menulis kredensial di kode, tes, atau log.
- Jangan menambahkan dependensi tanpa meninjau reputasi & lisensinya.
- Uji perubahan dengan menjalankan seluruh gate (lihat `CONTRIBUTING.md`).

## Kredensial
Semua rahasia hanya di `.env`/`.env.local` (gitignored) dan environment provider.
Tidak ada secret di bundle klien.
