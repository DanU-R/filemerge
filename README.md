# FileMerge

Aplikasi web open-source (MIT) untuk **menggabungkan PDF dan gambar menjadi satu PDF**,
dengan opsi **menyimpan dokumen pribadi** (CV, KTP, KK, ijazah, sertifikat) di akun
pengguna agar bisa dipakai ulang tanpa upload berulang.

**Live:** https://filemerge-seven.vercel.app

## Cara kerjanya

| Bagian | Tempat | Catatan |
|---|---|---|
| Penggabungan PDF/gambar | **Browser** (Web Worker + `@cantoo/pdf-lib`) | Isi dokumen **tidak dikirim ke server** |
| Frontend / API | **Vercel** (Next.js 16 App Router) | |
| Metadata (akun, daftar dokumen) | **Prisma Postgres** | Tidak menyimpan isi file |
| File dokumen | **Vercel Blob** (private) | Diunduh via endpoint terotorisasi |

## Fitur

**Tanpa akun (publik)**
- Gabung banyak PDF + gambar (JPG/JPEG/PNG) jadi satu PDF.
- Urutkan dengan **drag-and-drop** atau tombol naik/turun (aksesibilitas).
- **Pengaturan halaman:** ukuran (A4 / Letter / sesuai gambar), orientasi, margin.
- **Alat PDF:** **susun ulang urutan halaman** (drag-and-drop atau tombol ←/→),
  putar/hapus halaman, **pecah (split)** berdasarkan rentang, **kompres**.
  Editor menampilkan **pratinjau visual tiap halaman** (thumbnail asli); rotasi dan
  urutan terlihat langsung.
- Orientasi EXIF diterapkan ke piksel; JPEG CMYK dikonversi ke RGB.
- Validasi berbasis konten (magic bytes), bukan ekstensi.
- PDF rusak/terenkripsi/kosong ditandai tanpa membuat aplikasi crash.
- Batas: 50 MB/file, 200 MB total, 50 file.

**Dengan akun**
- Registrasi & login (email + password, hash bcrypt, sesi cookie HttpOnly).
- **Rate limiting** login/registrasi/unggah (SEC-08) + **header keamanan** CSP/HSTS (SEC-09).
- Upload dokumen dengan nama + kategori (CV, Identitas, Pendidikan, Sertifikat, Lainnya).
- Daftar, cari, filter kategori **dan tipe**, ganti nama, **ganti file**, unduh, hapus.
- Info ukuran + **tanggal upload** per dokumen.
- Kuota: 20 MB/file, 30 dokumen, 100 MB total per akun.
- Pilih dokumen tersimpan untuk digabung (diunduh ke browser, diproses lokal).
- **Preset susunan** — simpan urutan dokumen (mis. "Lamaran Kerja") dan terapkan kembali.
- Isolasi data antar-akun (dokumen orang lain -> 404).
- **Account Settings** — ringkasan akun + **hapus akun** beserta semua data (konfirmasi password).

> Aplikasi ini dipakai **single-user**. Tidak ada reset password via email. Bila lupa
> password: `bun run account:password <email> <password-baru>` (mengganti hash dan
> mencabut semua sesi lama). Lihat [`SECURITY.md`](SECURITY.md).

**Pengaturan halaman saat merge**
- Ukuran **A4 / Letter / Sesuai gambar**, orientasi tegak/mendatar, margin 0–48pt.

## Menjalankan lokal

Prasyarat: Node.js 24+ dan [Bun](https://bun.sh) 1.3.x.

```bash
bun install
cp .env.example .env      # isi DATABASE_URL (Prisma Postgres) + BLOB_READ_WRITE_TOKEN
bun run contract:emit     # generate tipe dari contract.prisma
bun run db:init           # apply schema ke database
bun run dev               # http://localhost:3000
```

> Fitur tanpa akun berjalan tanpa `.env`. Akun & dokumen butuh `DATABASE_URL` dan
> `BLOB_READ_WRITE_TOKEN`.

## Perintah

```bash
bun run dev          # dev server
bun run build        # contract:emit && next build
bun run start        # jalankan build standalone
bun run typecheck    # tsc --noEmit
bun run lint         # eslint
bun run test         # unit test (vitest)
bun run test:e2e     # e2e (playwright: chromium + firefox)
bun run bench:limits # benchmark batas file merge
```

## Struktur

```
src/app/            halaman: /, /merge, /login, /register, /dashboard, /privacy
src/app/api/        route handlers: auth (register/login/logout/me), documents
src/components/     MergeTool (merger), AuthForm, DocumentsManager
src/lib/            logika murni: limits, sanitize, validate, pdfMerge, imageDecode
src/lib/server/     auth (sesi), storage (Blob), docLimits
src/prisma/         contract.prisma + client Prisma 8
tests/unit|e2e|bench
```

## Database & contract (Prisma 8)

Repo memakai **Prisma 8 contract-first** (bukan `schema.prisma` + `@prisma/client`):

```bash
bun run contract:emit                          # src/prisma/contract.prisma -> contract.json/.d.ts
bun run migration:plan --name <perubahan>      # tulis migrasi
bun run db:init                                # apply awal + sign
bun run db:update                              # apply perubahan
```

Catatan Prisma 8 RC: `cuid()` belum ada (pakai `uuid()`/`nanoid()`), `$extends` belum ada,
dan kolom `timestamptz` memerlukan nilai `Temporal.Instant` (polyfill Temporal dimuat di
`src/prisma/db.ts`).

## Deploy

Lihat [`docs/Deploy-Vercel.md`](docs/Deploy-Vercel.md). Ringkas: Vercel (framework Next.js,
package manager Bun), set env `DATABASE_URL` + `BLOB_READ_WRITE_TOKEN` di Project Settings.
`next.config.ts` menyalakan `output: "standalone"` hanya di luar Vercel.

## Dokumen

- [`docs/FileMerge-PRD-v0.3.md`](docs/FileMerge-PRD-v0.3.md) — PRD + arsitektur
- [`docs/Fase1-Report.md`](docs/Fase1-Report.md) — laporan & audit Fase 1
- [`docs/Fase2-4-Report.md`](docs/Fase2-4-Report.md) — laporan Fase 0, 2, 3, 4
- [`docs/Fase5-Report.md`](docs/Fase5-Report.md) — laporan Fase 5
- [`docs/Fase4-Report.md`](docs/Fase4-Report.md) — laporan Fase 4 (keamanan)
- [`docs/Fase6-Report.md`](docs/Fase6-Report.md) — laporan Fase 6 (alat PDF lanjutan)
- [`CONTRIBUTING.md`](CONTRIBUTING.md) — panduan kontribusi
- [`SECURITY.md`](SECURITY.md) — kebijakan keamanan
- [`docs/Deploy-Vercel.md`](docs/Deploy-Vercel.md) — panduan deploy

## Lisensi

MIT — berlaku untuk kode saja, bukan izin mempublikasikan dokumen pengguna.
