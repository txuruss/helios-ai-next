'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { loginSchema, signupSchema } from '@/lib/validation/schemas'
import type { ActionState } from '@/types'

export async function login(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    console.error('[login] Missing Supabase env vars — check NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY')
    return { error: 'Server configuration error. Contact support.' }
  }

  const parsed = loginSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  })

  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? 'Invalid input.' }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  })

  if (error) {
    console.error('[login] Supabase auth error:', error.message, '| status:', error.status)

    const msg = error.message.toLowerCase()
    if (msg.includes('invalid login credentials') || msg.includes('invalid email or password')) {
      return { error: 'Invalid email or password.' }
    }
    if (msg.includes('email not confirmed') || msg.includes('email_not_confirmed')) {
      return { error: 'Please confirm your email address. Check your inbox for a confirmation link.' }
    }
    if (msg.includes('too many requests') || error.status === 429) {
      return { error: 'Too many sign-in attempts. Please wait a moment and try again.' }
    }
    return { error: 'Sign in failed. Please try again.' }
  }

  const redirectTo = formData.get('redirectTo') as string | null
  redirect(redirectTo && redirectTo.startsWith('/') ? redirectTo : '/dashboard')
}

export async function signup(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = signupSchema.safeParse({
    email:    formData.get('email'),
    password: formData.get('password'),
    name:     formData.get('name'),
  })

  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? 'Invalid input.' }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.signUp({
    email:    parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { full_name: parsed.data.name },
      emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`,
    },
  })

  if (error) {
    if (error.message.toLowerCase().includes('already registered')) {
      return { error: 'An account with this email already exists.' }
    }
    return { error: 'Sign up failed. Please try again.' }
  }

  // If email confirmation is disabled in Supabase, user is logged in immediately.
  // Otherwise show a success message so they check their inbox.
  return {
    success:
      'Account created! Check your email to confirm your address, then sign in.',
  }
}

export async function logout() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}
