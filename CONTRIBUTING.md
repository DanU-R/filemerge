# Contributing ke FileMerge

Terima kasih sudah mau berkontribusi. Dokumen ini menjelaskan cara menjalankan,
menguji, dan mengirim perubahan.

## Prasyarat
- Node.js 24+
- [Bun](https://bun.sh) 1.3.x (`packageManager` di `package.json`)

## Menyiapkan lingkungan
```bash
bun install
cp .env.example .env          # isi DATABASE_URL + BLOB_READ_WRITE_TOKEN
bun run contract:emit
bun run db:init               # apply schema ke database Anda
bun run dev
```
Fitur tanpa akun (merge) berjalan tanpa `.env`.

## Sebelum mengirim PR: semua gate harus hijau
```bash
bun run typecheck    # tsc --noEmit
bun run lint         # eslint
bun run test         # unit (vitest)
bun run build        # contract:emit && next build
bun run test:e2e     # e2e (playwright: chromium + firefox)
```

## Konvensi kode
- TypeScript strict; tanpa `any` yang tidak perlu.
- Logika murni (tanpa DOM) taruh di `src/lib/`; yang butuh server di `src/lib/server/`.
- Kode server memakai `import 'server-only'`.
- Nama file: `kebab-case` untuk modul, `PascalCase` untuk komponen React.
- Komentar & pesan UI dalam bahasa Indonesia, ringkas dan jelas.

## Aturan penting
- **Jangan** menaruh isi dokumen ke server saat merge (merge berjalan di browser).
- **Jangan** commit `.env`/`.env.local` atau kredensial apa pun.
- **Jangan** mengubah `next.config.ts` (guard `VERCEL`), `module.ts`, `src/service.ts`,
  `prisma-composer.config.ts`, `prisma.config.ts`, `bunfig.toml`, atau script
  `build`/`start`/`db:*`/`compute:*` tanpa alasan teknis yang jelas.
- Perubahan schema: `contract:emit` → `migration plan` → `db:update`. Sertakan migrasi.
- Jaga isolasi data: setiap query dokumen **wajib** terikat `userId`.

## Alur PR
1. Buat branch dari `main`.
2. Kerjakan perubahan + tes yang relevan.
3. Pastikan semua gate hijau.
4. Buka PR dengan deskripsi: apa, kenapa, cara uji.
