/**
 * Format storage key (murni, tanpa `server-only`) supaya dapat dipakai bersama
 * oleh abstraksi server (`src/lib/server/storage.ts`) dan skrip CLI
 * (`scripts/reconcile-storage.ts`). Satu sumber kebenaran untuk layout path.
 */

/** Namespace per pengguna -> isolasi di level path juga. */
export function storagePath(userId: string, key: string): string {
  return `u/${userId}/${key}`
}
