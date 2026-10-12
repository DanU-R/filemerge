/**
 * Ganti password akun secara lokal (tanpa layanan email).
 *
 * Dipakai karena FR-AU-04 (reset password via email) berada di luar cakupan:
 * aplikasi dijalankan single-user. Jalankan di lingkungan yang punya
 * DATABASE_URL (.env), lalu login dengan password baru.
 *
 * Penggunaan:
 *   bun run account:password <email> <password-baru>
 *
 * Catatan: password muncul di riwayat shell. Untuk menghindarinya, jalankan
 * di shell yang tidak menyimpan history atau bersihkan setelahnya.
 */
import { getDb } from '../src/prisma/db'
import { hashPassword, normalizeEmail } from '../src/lib/password'

async function main() {
  const [emailArg, password] = process.argv.slice(2)

  if (!emailArg || !password) {
    console.error('Penggunaan: bun run account:password <email> <password-baru>')
    process.exit(1)
  }
  if (password.length < 8) {
    console.error('Password minimal 8 karakter.')
    process.exit(1)
  }

  const email = normalizeEmail(emailArg)
  const db = getDb()

  const user = await db.orm.public.User.where({ email }).first()
  if (!user) {
    console.error(`Akun dengan email ${email} tidak ditemukan.`)
    process.exit(1)
  }

  const passwordHash = await hashPassword(password)
  await db.orm.public.User.where({ id: user.id }).update({ passwordHash })

  // Cabut semua sesi lama agar sesi yang tersimpan tidak lagi valid.
  await db.orm.public.Session.where({ userId: user.id }).delete()

  console.log(`Password untuk ${email} berhasil diperbarui. Semua sesi lama dicabut.`)
  process.exit(0)
}

main().catch((err) => {
  console.error('Gagal memperbarui password:', err instanceof Error ? err.message : err)
  process.exit(1)
})
