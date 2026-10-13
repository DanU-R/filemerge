# Deploy FileMerge ke Vercel (Frontend) + Prisma Postgres (Database)

> **STATUS: SUDAH LIVE**: https://filemerge-seven.vercel.app
> Project Vercel: `danu-rangganas-projects/filemerge` · repo GitHub ter-connect
> (auto-deploy tiap push ke `main`). Uji live lulus: landing, `/merge` (merge 2 PDF
> -> 3 halaman, urutan benar, **0 request ke server**), `/privacy`, 404.

Ringkas: **aplikasi di Vercel**, **database di Prisma Postgres**. Repo sudah disiapkan
agar dua jalur (Vercel dan Prisma Compute) tidak saling mengganggu.

## Ringkasan arsitektur

| Bagian | Tempat | Catatan |
|---|---|---|
| Frontend (Next.js) | **Vercel** | Build standar Vercel (tanpa `output: standalone`) |
| Database | **Prisma Postgres** | Connection string **pooled** (`pooled.db.prisma.io`) |
| Merge PDF/gambar | **Browser** | Tidak menyentuh server/DB sama sekali (Fase 1) |
| Prisma Compute | opsional/nonaktif | Workflow deploy Prisma dimatikan secara default |

## Perubahan yang sudah dilakukan di repo

1. **`next.config.ts`**: `output: "standalone"` hanya aktif di luar Vercel:
   ```ts
   const isVercel = !!process.env.VERCEL
   const nextConfig = { ...(isVercel ? {} : { output: "standalone" as const }), ... }
   ```
   Alasan: `standalone` adalah syarat Prisma Compute, tetapi di Vercel dapat memicu
   kegagalan build (Vercel punya pipeline sendiri).
2. **`.github/workflows/prisma-deploy.yml`**, dinonaktifkan secara default lewat
   guard `vars.PRISMA_DEPLOY_ENABLED == 'true'`. Jadi push ke GitHub **tidak**
   memunculkan check deploy yang gagal. Aktifkan kembali hanya jika mau memakai
   Prisma Compute.

## Langkah deploy (di sisi Anda: butuh akun Vercel)

1. **Import repo di Vercel**
   - Vercel Dashboard -> Add New -> Project -> import `DanU-R/filemerge`.
   - Framework preset: **Next.js** (terdeteksi otomatis).
   - Package manager: **Bun** (terdeteksi otomatis dari `bun.lock`).
   - **Root Directory**: biarkan default (root repo).
   - **Jangan** ubah Build Command. Default Vercel: `next build` (atau `bun run build`).
     Keduanya berfungsi: `build` = `prisma contract emit && next build`, dan
     `contract:emit` **tidak butuh `DATABASE_URL`** (sudah diuji).

2. **Set environment variable** (Project -> Settings -> Environment Variables)
   ```
   DATABASE_URL = <connection string pooled Prisma Postgres>
   ```
   Gunakan string **pooled** (`pooled.db.prisma.io`), Prisma Postgres sudah punya
   connection pooling bawaan untuk beban serverless Vercel.
   Tambahkan untuk **Production, Preview, dan Development**.
   **Jangan** commit nilai ini ke repo.

   > Alternatif: pakai integrasi Vercel Marketplace "Prisma Postgres", akan
   > mengisi `DATABASE_URL` otomatis.

3. **Deploy**: klik Deploy. Build akan menjalankan `contract:emit` lalu `next build`.

## Setelah deploy

- Buka URL produksi, cek `/`, `/merge`, `/privacy`.
- Uji merge: tambah 2 PDF -> Gabungkan -> unduh. Pastikan panel Network tidak
  menunjukkan upload isi file (merge berjalan lokal di browser).
- Jika nanti ada fitur yang memakai DB, verifikasi endpoint-nya (mis. `/api/users`).

## Catatan penting

- **Fase 1 tidak memakai database.** Aplikasi akan jalan penuh di Vercel meski
  `DATABASE_URL` belum diisi. DB baru relevan untuk Fase 2+ (akun & dokumen).
- **Jangan** menyalakan kembali `output: "standalone"` secara global, itu akan
  mengembalikan risiko kegagalan build di Vercel.
- Deploy dari GitHub: push ke `main` (atau PR) otomatis membuat deployment Vercel.
- Deploy manual: `vercel --prod` (butuh `vercel login` atau `VERCEL_TOKEN`).

## Pelajaran penting (lockfile)

`bun.lock` awalnya berisi URL ke mirror non-publik (`mirrors.tencentyun.com`),
sehingga `bun install` gagal `ConnectionRefused` di Vercel maupun GitHub Actions.
Perbaikan: tambahkan `.npmrc` (`registry=https://registry.npmjs.org/`) lalu
regenerate lockfile dengan registry resmi. **Jangan** commit lockfile yang memuat
URL registry lokal/mirror.
