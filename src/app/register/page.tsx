import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import AuthForm from '@/components/AuthForm'
import { getCurrentUser } from '@/lib/server/auth'

export const metadata: Metadata = { title: 'Daftar: FileMerge' }

export default async function RegisterPage() {
  const user = await getCurrentUser()
  if (user) redirect('/dashboard')
  return (
    <main className="page">
      <AuthForm mode="register" />
    </main>
  )
}
