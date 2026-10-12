# FileMerge — Laporan Fase 0, 2, 3, 4

| Item | Nilai |
|---|---|
| Tanggal | 12 Oktober 2026 |
| Lingkup | Akun, penyimpanan dokumen, integrasi merge, keamanan |
| Status | **Selesai, teruji, LIVE** di https://filemerge-seven.vercel.app |

Semua angka di bawah berasal dari eksekusi nyata.

---

## Fase 0 — Validasi platform (selesai)

| Keputusan | Hasil | Dasar |
|---|---|---|
| Database | **Prisma Postgres** (pooled) | Koneksi terbukti; `db verify` OK |
| Hosting app | **Vercel** | Deploy sukses + auto-deploy on push |
| Storage file | **Vercel Blob (private)** | Store `filemerge-docs` dibuat, terhubung ke project |
| Auth | **Self-managed session** (bcrypt + cookie HttpOnly + tabel Session) | Menghindari risiko adapter pihak ketiga vs Prisma 8 RC |

Fakta yang memengaruhi desain (terverifikasi):
- Prisma 8 RC: `cuid()` **tidak ada** → pakai `uuid()`; `$extends` tidak ada; kode error P2002 tidak ada.
- Kolom `timestamptz` memerlukan nilai **`Temporal.Instant`**, bukan `Date` JS → polyfill Temporal dimuat di `src/prisma/db.ts`.
- `bun.lock` dari mirror lokal pernah mematahkan build cloud → `.npmrc` + lockfile registry resmi.
- Kuota free: Prisma Postgres 1.01 GB / 200k operasi; Vercel Blob 1 GB / 2k write per bulan.

---

## Fase 2 — Akun & penyimpanan (selesai)

**Skema (Prisma 8 contract-first)** — `src/prisma/contract.prisma`:
- `User(id uuid, email unique, passwordHash)`
- `Session(id uuid, userId → User cascade, expiresAt)`
- `Document(id uuid, userId → User cascade, displayName, category enum, mimeType, sizeBytes, storageKey unique, status enum)`
- Enum `DocCategory` (CV/IDENTITAS/PENDIDIKAN/SERTIFIKAT/LAINNYA), `DocStatus`.

Migrasi di-reset ke init bersih (DB masih kosong, pre-launch) — menghindari backfill
tidak perlu dari schema demo lama.

**Implementasi:**
- `POST /api/auth/register`, `/login`, `/logout`, `GET /me` — validasi Zod, hash bcrypt (cost 10), pesan login seragam (tidak membocorkan email terdaftar).
- `GET/POST /api/documents`, `GET/PATCH/DELETE /api/documents/[id]`.
- Upload: validasi magic bytes, batas 20 MB/file, kuota 30 dokumen & 100 MB/akun, `storageKey` UUID dibuat server, nama disanitasi.
- Penyimpanan: abstraksi `src/lib/server/storage.ts` (Vercel Blob private).
- UI: `/register`, `/login`, `/dashboard` (unggah, daftar, cari, filter, ganti nama, unduh, hapus, kuota).
- Nav layout menyesuaikan status login.

## Fase 3 — Integrasi dokumen tersimpan (selesai)

- `/merge` menampilkan panel "Pilih dari dokumen saya" (dokumen READY milik pengguna).
- Klik → dokumen diunduh ke browser via endpoint terotorisasi → masuk antrean → diproses **lokal** (tetap nol upload isi file ke server saat merge).

## Fase 4 — Keamanan & stabilisasi (selesai)

- **Isolasi data:** setiap query dokumen terikat `userId`; dokumen milik pengguna lain → **404** (bukan 403) agar keberadaan tidak bocor.
- **Guard:** `/dashboard` tanpa sesi → redirect `/login` (307); API tanpa sesi → **401**.
- **Cookie:** HttpOnly, Secure (produksi), SameSite=Lax.
- **Hapus aman:** tandai `PENDING_DELETION` → hapus objek → hapus baris (idempoten).
- **Upload aman:** objek dihapus bila pembuatan metadata gagal (tanpa objek yatim).
- Tidak ada secret di bundle klien; `.env*` diabaikan git; secret hanya di server/env.

---

## Hasil pengujian (kondisi kode terbaru)

| Gate | Hasil |
|---|---|
| Typecheck (`tsc --noEmit`) | **exit 0** |
| Unit (vitest) | **30/30** |
| Lint (eslint) | **exit 0** |
| Build | **exit 0** (13 route) |
| E2E Playwright | **42/42** (21 tes × Chromium + Firefox) |

Cakupan E2E baru (Fase 2/3/4):
- AC-08 registrasi + upload + persistensi, AC-10 merge dokumen tersimpan,
- AC-11 isolasi antar-akun (B gagal GET/DELETE/PATCH dokumen A; A tetap utuh),
- AC-12 dashboard/API tanpa sesi ditolak, magic bytes ditolak, hapus dokumen, logout.

## Verifikasi produksi (live)

Diuji langsung terhadap https://filemerge-seven.vercel.app:
- Register **201**, upload 2 dokumen, kuota tampil `2/30 · 1 KB / 100 MB`.
- Unduh dokumen privat: **200** (isi byte sesuai).
- Merge 1 dokumen tersimpan + 1 file lokal → **4 halaman**, 0 error.
- `/dashboard` tanpa sesi → 307 ke `/login`; `/api/documents` tanpa sesi → 401.

Catatan: request pertama setelah idle kena cold start serverless (tombol perlu
"ter-hidrasi"); aktif setelah ~1–2 detik.

---

## Yang belum dikerjakan

- **Fase 5 (lanjutan, opsional):** preset susunan, riwayat, split, rotasi/hapus halaman,
  kompresi, drag-and-drop berbasis library. Belum ada requirement rinci.
- **Safari/iOS** belum diuji pada perangkat nyata (Chromium + Firefox lulus).
