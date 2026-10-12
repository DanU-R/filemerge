// Seed FileMerge: tidak ada data awal yang diperlukan.
// `bun run db:seed` tetap valid sebagai no-op setelah perubahan contract.
async function main() {
  console.log('FileMerge: tidak ada seed (no-op).')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
