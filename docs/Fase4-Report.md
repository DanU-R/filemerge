# FileMerge — Laporan Fase 4 (Keamanan & Stabilisasi)

| Item | Nilai |
|---|---|
| Tanggal | 12 Oktober 2026 |
| Lingkup | SEC-01..15, hapus akun, ganti file, dokumentasi, error pages |
| Status | **Selesai, teruji, LIVE** di https://filemerge-seven.vercel.app |

Semua angka berasal dari eksekusi nyata.

## Yang dikerjakan

### Keamanan
| Item | Implementasi |
|---|---|
| **SEC-08** Rate limiting | `src/lib/server/rateLimit.ts` — login 20/IP/15 mnt, register 10/IP/jam, upload 60/user/jam, replace 60/user/jam. Batas dapat dikonfigurasi via `RATE_LIMIT_LOGIN`/`RATE_LIMIT_REGISTER`. Balasan 429 + `Retry-After`. |
| **SEC-09** Header keamanan | `next.config.ts` `headers()` — CSP, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`, HSTS. |
| **SEC-10** Logging minimal | `error.tsx` hanya mencatat `error.digest`, tanpa data pengguna. |
| **SEC-11** Hapus dokumen & akun | `DELETE /api/account` (konfirmasi password) → hapus objek storage → hapus baris turunan → hapus user. |
| **SEC-13** Enkripsi at-rest | Didokumentasikan apa adanya di Privacy Policy & SECURITY.md (tidak E2E; operator bisa akses storage). |
| **SEC-15** Lisensi | Ditegaskan di README, Privacy Policy, `LICENSE`. |

### Fungsional
| ID | Implementasi |
|---|---|
| **FR-DOC-04** Ganti file | `PUT /api/documents/[id]` — unggah objek baru (key baru) → alihkan metadata → hapus objek lama. Gagal di tengah = file lama utuh (rollback objek baru). UI: tombol ⇄ di daftar dokumen. |
| **FR-DB-03** Waktu upload | Kolom tipe + tanggal ditampilkan per dokumen. |
| **FR-DB-02** Filter tipe | Dropdown filter PDF/JPG/PNG di samping filter kategori & cari nama. |
| **§11 Halaman** | `Account Settings` (`/settings`) + halaman Error (`error.tsx`, `global-error.tsx`). |
| **§12.6 Hapus akun** | Alur penuh + UI konfirmasi ("ketik HAPUS" + password). |
| **NFR-06** Kuota | Angka kuota ditampilkan di dashboard (count + bytes). |
| **NFR-03** Retry | Unduhan memiliki penanganan kegagalan; batas kuota jelas. |

### Konsistensi storage (PRD §15.4)
- **Bug diperbaiki:** `deleteObject` semula `catch {}` sehingga kegagalan hapus objek
  tersembunyi → objek yatim menumpuk (terbukti: 142 blob untuk 70 baris dokumen).
  Sekarang mengembalikan status; kegagalan dicatat dan dokumen tetap `PENDING_DELETION`
  dengan balasan `502 retryable`. Objek yatim dibersihkan dan rekonsiliasi ditambahkan:
  `bun run storage:reconcile [-- --purge]` (terverifikasi: 0 orphan setelah pembersihan).

### Dokumentasi repo (PRD §20)
- `CONTRIBUTING.md` — prasyarat, gate, konvensi, aturan penting.
- `SECURITY.md` — pelaporan kerentanan, model keamanan, yang dijamin & tidak.
- `src/app/privacy/page.tsx` — Privacy Policy jujur (enkripsi, retensi, backup).

---

## Hasil pengujian (kondisi kode terbaru)

| Gate | Hasil |
|---|---|
| Typecheck | **exit 0** |
| Unit (vitest) | **41/41** (6 file) — +3 rate limiter |
| Lint | **exit 0** |
| Build | **exit 0** (`✓ Compiled successfully`) |
| E2E Playwright | Chromium + Firefox, termasuk `fase4.spec.ts` (6 tes) |

E2E Fase 4: header keamanan ada, filter tipe + tanggal tampil, ganti file,
hapus akun (password salah → 403; benar → data hilang & login gagal),
rate limit login → 429, `/settings` butuh login.

## Keterbatasan
- Rate limiting berjalan **per-instance** (serverless) — bukan terpusat. Untuk produksi
  skala besar, ganti dengan penyimpanan bersama (mis. Redis/Upstash).
- **NFR-04 (Safari/iOS)** belum diuji pada perangkat nyata — dikecualikan atas permintaan.
- Reset password (FR-AU-04): **dibatalkan / out of scope** — aplikasi dipakai single-user,
  kehilangan password ditangani lewat penggantian `passwordHash` langsung di database
  (dokumentasi di `SECURITY.md`). Tidak ada layanan email yang diperlukan.
- **NFR-03** auto-retry dengan backoff belum diimplementasi (baru try/catch + pesan error).
- Rotasi/hapus halaman PDF, split, kompresi (Fase 5 opsional) belum dikerjakan.
