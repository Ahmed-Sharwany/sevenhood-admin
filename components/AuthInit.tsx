'use client'

/**
 * AuthInit — mounted once in the root layout.
 * Validates the Supabase session on every page load.
 * If the session has expired, clears the cookie and redirects to /login.
 */

import { useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function AuthInit() {
  const router   = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    if (pathname === '/login') return

    // Check current session validity
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        // Session expired or missing — clear cookie and redirect
        document.cookie = 'sb_logged_in=; path=/; max-age=0; SameSite=Strict'
        router.replace('/login')
      }
    })

    // Keep listening for sign-out events (e.g. token revoked)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === 'SIGNED_OUT' || (!session && event !== 'INITIAL_SESSION')) {
          document.cookie = 'sb_logged_in=; path=/; max-age=0; SameSite=Strict'
          localStorage.removeItem('sevenhood_user')
          if (pathname !== '/login') router.replace('/login')
        }
        // Refresh the cookie lifetime on every token refresh
        if (event === 'TOKEN_REFRESHED' && session) {
          document.cookie = 'sb_logged_in=1; path=/; max-age=86400; SameSite=Strict'
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [pathname, router])

  return null
}
