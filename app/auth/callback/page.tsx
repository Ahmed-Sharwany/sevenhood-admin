'use client'

/**
 * /auth/callback — handles the magic link redirect from Supabase.
 * Supabase appends the session token to the URL; supabase-js picks it
 * up automatically on mount, exchanges it for a session, and we redirect.
 */

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function AuthCallback() {
  const router = useRouter()
  const [error, setError] = useState('')

  useEffect(() => {
    // Give supabase-js a moment to process the hash/token in the URL
    const timer = setTimeout(async () => {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()

      if (sessionError || !session) {
        setError('This login link is invalid or has expired. Please request a new one.')
        return
      }

      // Fetch the operator account record
      const { data: account } = await supabase
        .from('accounts')
        .select('id, full_name, email, role, company_name')
        .eq('email', session.user.email ?? '')
        .maybeSingle()

      if (account) {
        localStorage.setItem('sevenhood_user', JSON.stringify(account))
      }

      // Set session cookie for middleware
      document.cookie = 'sb_logged_in=1; path=/; max-age=86400; SameSite=Strict'

      router.replace('/')
    }, 500)

    return () => clearTimeout(timer)
  }, [router])

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-cream p-8">
        <div className="max-w-sm w-full text-center">
          <div className="text-4xl mb-4">⚠️</div>
          <h2 className="text-lg font-bold text-ink mb-2">Link expired</h2>
          <p className="text-slate text-sm mb-6">{error}</p>
          <a
            href="/login"
            className="inline-block bg-forest text-white rounded-xl px-6 py-3 text-sm font-semibold hover:bg-deep transition-colors"
          >
            Back to Login
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-cream">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-forest border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-slate text-sm font-medium">Signing you in…</p>
        <p className="text-fog text-xs mt-1">Just a moment</p>
      </div>
    </div>
  )
}
