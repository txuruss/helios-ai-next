import type { Metadata } from 'next'
import LoginForm from '@/components/auth/LoginForm'

export const metadata: Metadata = {
  title: 'Sign In — Helios AI',
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirectTo?: string; error?: string }>
}) {
  const params = await searchParams
  return (
    <LoginForm
      redirectTo={params.redirectTo}
      authError={params.error}
    />
  )
}
