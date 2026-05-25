'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function LoginPage() {
  const router  = useRouter()
  const [step, setStep]       = useState<'email' | 'sent'>('email')
  const [email, setEmail]     = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')
  const [countdown, setCountdown] = useState(0)

  // Redirect away if already logged in
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) router.replace('/')
    })
  }, [router])

  // Countdown timer for resend
  useEffect(() => {
    if (countdown <= 0) return
    const t = setTimeout(() => setCountdown(c => c - 1), 1000)
    return () => clearTimeout(t)
  }, [countdown])

  // ── Step 1: Send Magic Link ───────────────────────────────────────────────

  async function handleSendLink(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const cleanEmail = email.toLowerCase().trim()

    // Check if email is registered as an operator account
    const { data: account } = await supabase
      .from('accounts')
      .select('id, is_active')
      .eq('email', cleanEmail)
      .maybeSingle()

    if (!account) {
      setError('This email is not registered as an operator account. Contact your administrator.')
      setLoading(false)
      return
    }
    if (!account.is_active) {
      setError('This account has been deactivated. Contact your administrator.')
      setLoading(false)
      return
    }

    const callbackUrl = `${window.location.origin}/auth/callback`

    const { error: otpError } = await supabase.auth.signInWithOtp({
      email: cleanEmail,
      options: {
        shouldCreateUser: true,
        emailRedirectTo: callbackUrl,
      },
    })

    if (otpError) {
      setError(otpError.message)
      setLoading(false)
      return
    }

    setStep('sent')
    setCountdown(60)
    setLoading(false)
  }

  async function handleResend() {
    if (countdown > 0) return
    setLoading(true)
    setError('')
    const callbackUrl = `${window.location.origin}/auth/callback`
    const { error: otpError } = await supabase.auth.signInWithOtp({
      email: email.toLowerCase().trim(),
      options: { shouldCreateUser: true, emailRedirectTo: callbackUrl },
    })
    if (otpError) setError(otpError.message)
    setCountdown(60)
    setLoading(false)
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen flex">

      {/* ── Left panel ──────────────────────────────────────────────────── */}
      <div className="hidden lg:flex lg:w-2/5 bg-forest flex-col justify-between p-12 relative overflow-hidden">
        {/* Decorative circles */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-gold/10 rounded-full -translate-y-1/2 translate-x-1/2 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-56 h-56 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2 pointer-events-none" />

        {/* Logo */}
        <div className="relative">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gold rounded-xl flex items-center justify-center text-white font-bold text-lg">▦</div>
            <div>
              <div className="text-white text-xl font-bold tracking-wide">Sevenhood</div>
              <div className="text-white/40 text-xs tracking-[0.25em] uppercase">Operator Console</div>
            </div>
          </div>
        </div>

        {/* Feature list */}
        <div className="relative space-y-5">
          <p className="text-white/60 text-sm mb-6">Everything you need to manage premium residential communities.</p>
          {[
            { icon: '🏗️', title: 'Portfolio Management',   desc: 'Projects, buildings, units in one place' },
            { icon: '📅', title: 'Smart Booking System',    desc: 'Amenity reservations with conflict prevention' },
            { icon: '🔧', title: 'Operations Control',      desc: 'Tickets, providers, visitors — all connected' },
            { icon: '👥', title: 'Resident Engagement',     desc: 'Community, events, announcements' },
            { icon: '✨', title: 'AI Interior Design',      desc: 'Resident design requests, powered by AI' },
          ].map(f => (
            <div key={f.title} className="flex items-start gap-3.5">
              <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center text-base shrink-0">
                {f.icon}
              </div>
              <div>
                <div className="text-white text-sm font-semibold">{f.title}</div>
                <div className="text-white/40 text-xs mt-0.5">{f.desc}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="relative">
          <div className="text-white/50 text-2xl font-light" dir="rtl">سابع جار</div>
          <div className="text-white/20 text-xs mt-1.5">Sevenhood v2.0 · KSA PropTech Platform</div>
        </div>
      </div>

      {/* ── Right panel ─────────────────────────────────────────────────── */}
      <div className="flex-1 flex items-center justify-center p-8 bg-white">
        <div className="w-full max-w-md">

          {/* Mobile logo */}
          <div className="flex lg:hidden items-center gap-2 mb-8">
            <div className="w-8 h-8 bg-forest rounded-lg flex items-center justify-center text-white font-bold text-sm">▦</div>
            <span className="font-bold text-ink">Sevenhood</span>
          </div>

          {/* ── Email step ─────────────────────────────────────────────── */}
          {step === 'email' && (
            <>
              <div className="mb-8">
                <h1 className="text-2xl font-bold text-ink">Welcome back</h1>
                <p className="text-slate text-sm mt-2">
                  Enter your operator email to receive a secure login link.
                </p>
              </div>

              {error && <ErrorBanner message={error} />}

              <form onSubmit={handleSendLink} className="space-y-5">
                <div>
                  <label className="block text-xs font-semibold text-slate mb-1.5 uppercase tracking-wide">
                    Email Address
                  </label>
                  <input
                    type="email"
                    required
                    autoFocus
                    autoComplete="email"
                    placeholder="you@company.com"
                    value={email}
                    onChange={e => { setEmail(e.target.value); setError('') }}
                    className="w-full border-2 border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-forest transition-colors"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading || !email.trim()}
                  className="w-full bg-forest text-white rounded-xl py-3 text-sm font-semibold hover:bg-deep transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {loading
                    ? <><Spinner />Sending link...</>
                    : 'Send Login Link →'
                  }
                </button>
              </form>

              <p className="mt-8 text-center text-xs text-fog">
                Don&apos;t have access?{' '}
                <span className="text-slate">Contact your administrator to add your account.</span>
              </p>
            </>
          )}

          {/* ── Link sent step ─────────────────────────────────────────── */}
          {step === 'sent' && (
            <>
              <button
                onClick={() => { setStep('email'); setError('') }}
                className="flex items-center gap-1.5 text-slate text-sm mb-7 hover:text-ink transition-colors"
              >
                ← Back
              </button>

              <div className="text-center py-4">
                {/* Animated envelope */}
                <div className="w-20 h-20 bg-forest/10 rounded-3xl flex items-center justify-center text-4xl mb-6 mx-auto">
                  📧
                </div>

                <h1 className="text-2xl font-bold text-ink mb-3">Check your email</h1>
                <p className="text-slate text-sm mb-1">
                  We sent a login link to
                </p>
                <p className="font-semibold text-ink text-sm mb-6">{email}</p>

                {/* Steps */}
                <div className="bg-forest/5 rounded-2xl p-5 text-left space-y-3 mb-6">
                  {[
                    { n: '1', text: 'Open the email from Sevenhood' },
                    { n: '2', text: 'Click the "Log In" link inside' },
                    { n: '3', text: "You'll be signed in automatically" },
                  ].map(s => (
                    <div key={s.n} className="flex items-center gap-3">
                      <div className="w-6 h-6 rounded-full bg-forest text-white text-xs font-bold flex items-center justify-center shrink-0">
                        {s.n}
                      </div>
                      <span className="text-sm text-ink">{s.text}</span>
                    </div>
                  ))}
                </div>

                <p className="text-xs text-fog mb-4">
                  The link expires in 1 hour. Check your spam folder if you don&apos;t see it.
                </p>

                {error && <ErrorBanner message={error} />}

                {countdown > 0 ? (
                  <p className="text-xs text-fog">
                    Resend available in{' '}
                    <span className="font-semibold text-slate tabular-nums">{countdown}s</span>
                  </p>
                ) : (
                  <button
                    onClick={handleResend}
                    disabled={loading}
                    className="text-sm text-forest hover:text-deep font-semibold underline underline-offset-2 disabled:opacity-50"
                  >
                    {loading ? 'Sending...' : 'Resend login link'}
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Small helper components ────────────────────────────────────────────────

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="mb-4 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700 flex items-start gap-2.5">
      <span className="shrink-0 mt-0.5">⚠️</span>
      <span>{message}</span>
    </div>
  )
}

function Spinner() {
  return (
    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
  )
}
