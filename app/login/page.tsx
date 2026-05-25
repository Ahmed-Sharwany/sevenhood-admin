'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function LoginPage() {
  const router = useRouter()
  const [step, setStep]       = useState<'email' | 'otp'>('email')
  const [email, setEmail]     = useState('')
  const [otp, setOtp]         = useState(['', '', '', '', '', ''])
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')
  const [countdown, setCountdown] = useState(0)
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])

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

  // ── Step 1: Send OTP ──────────────────────────────────────────────────────

  async function handleSendOTP(e: React.FormEvent) {
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

    const { error: otpError } = await supabase.auth.signInWithOtp({
      email: cleanEmail,
      options: { shouldCreateUser: true },
    })

    if (otpError) {
      setError(otpError.message)
      setLoading(false)
      return
    }

    setStep('otp')
    setCountdown(60)
    setLoading(false)
    // Focus first OTP box on next tick
    setTimeout(() => inputRefs.current[0]?.focus(), 50)
  }

  // ── Step 2: Verify OTP ────────────────────────────────────────────────────

  async function handleVerifyOTP(e: React.FormEvent) {
    e.preventDefault()
    const code = otp.join('')
    if (code.length !== 6) {
      setError('Please enter the complete 6-digit code.')
      return
    }
    setError('')
    setLoading(true)

    const { error: verifyError } = await supabase.auth.verifyOtp({
      email: email.toLowerCase().trim(),
      token: code,
      type: 'email',
    })

    if (verifyError) {
      setError('Invalid or expired code. Please try again.')
      setOtp(['', '', '', '', '', ''])
      setTimeout(() => inputRefs.current[0]?.focus(), 50)
      setLoading(false)
      return
    }

    // Fetch full account record and store locally
    const { data: account } = await supabase
      .from('accounts')
      .select('id, full_name, email, role, company_name')
      .eq('email', email.toLowerCase().trim())
      .maybeSingle()

    if (account) {
      localStorage.setItem('sevenhood_user', JSON.stringify(account))
    }

    // Set session cookie so middleware can detect login
    document.cookie = 'sb_logged_in=1; path=/; max-age=86400; SameSite=Strict'

    router.replace('/')
  }

  // ── OTP input helpers ─────────────────────────────────────────────────────

  function handleOtpInput(index: number, value: string) {
    if (!/^\d*$/.test(value)) return
    const newOtp = [...otp]
    newOtp[index] = value.slice(-1)
    setOtp(newOtp)
    setError('')
    if (value && index < 5) inputRefs.current[index + 1]?.focus()
  }

  function handleOtpKeyDown(index: number, e: React.KeyboardEvent) {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus()
    }
    if (e.key === 'ArrowLeft'  && index > 0) inputRefs.current[index - 1]?.focus()
    if (e.key === 'ArrowRight' && index < 5) inputRefs.current[index + 1]?.focus()
  }

  function handleOtpPaste(e: React.ClipboardEvent) {
    e.preventDefault()
    const paste = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    if (!paste) return
    const newOtp = Array.from({ length: 6 }, (_, i) => paste[i] ?? '')
    setOtp(newOtp)
    inputRefs.current[Math.min(paste.length - 1, 5)]?.focus()
  }

  async function handleResend() {
    if (countdown > 0) return
    setOtp(['', '', '', '', '', ''])
    setError('')
    setLoading(true)
    await supabase.auth.signInWithOtp({
      email: email.toLowerCase().trim(),
      options: { shouldCreateUser: true },
    })
    setCountdown(60)
    setLoading(false)
    setTimeout(() => inputRefs.current[0]?.focus(), 50)
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
                  Enter your operator email to receive a 6-digit login code.
                </p>
              </div>

              {error && <ErrorBanner message={error} />}

              <form onSubmit={handleSendOTP} className="space-y-5">
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
                    ? <><Spinner />Sending code...</>
                    : 'Send Login Code →'
                  }
                </button>
              </form>

              <p className="mt-8 text-center text-xs text-fog">
                Don&apos;t have access?{' '}
                <span className="text-slate">Contact your administrator to add your account.</span>
              </p>
            </>
          )}

          {/* ── OTP step ───────────────────────────────────────────────── */}
          {step === 'otp' && (
            <>
              <button
                onClick={() => { setStep('email'); setOtp(['', '', '', '', '', '']); setError('') }}
                className="flex items-center gap-1.5 text-slate text-sm mb-7 hover:text-ink transition-colors"
              >
                ← Back
              </button>

              <div className="mb-8">
                <div className="w-14 h-14 bg-forest/10 rounded-2xl flex items-center justify-center text-2xl mb-5">📧</div>
                <h1 className="text-2xl font-bold text-ink">Check your email</h1>
                <p className="text-slate text-sm mt-2">
                  We sent a 6-digit code to{' '}
                  <span className="font-semibold text-ink">{email}</span>
                </p>
                <p className="text-fog text-xs mt-1">Didn&apos;t get it? Check your spam folder.</p>
              </div>

              {error && <ErrorBanner message={error} />}

              <form onSubmit={handleVerifyOTP} className="space-y-6">
                <div>
                  <label className="block text-xs font-semibold text-slate mb-3 uppercase tracking-wide">
                    6-Digit Login Code
                  </label>

                  {/* OTP boxes */}
                  <div
                    className="flex gap-2.5 justify-between"
                    onPaste={handleOtpPaste}
                  >
                    {otp.map((digit, i) => (
                      <input
                        key={i}
                        ref={el => { inputRefs.current[i] = el }}
                        type="text"
                        inputMode="numeric"
                        maxLength={1}
                        value={digit}
                        onChange={e => handleOtpInput(i, e.target.value)}
                        onKeyDown={e => handleOtpKeyDown(i, e)}
                        className={`w-12 h-14 text-center text-2xl font-bold rounded-xl border-2 focus:outline-none transition-all ${
                          digit
                            ? 'border-forest bg-forest/5 text-forest'
                            : 'border-border text-ink focus:border-forest'
                        }`}
                      />
                    ))}
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading || otp.some(d => d === '')}
                  className="w-full bg-forest text-white rounded-xl py-3 text-sm font-semibold hover:bg-deep transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {loading
                    ? <><Spinner />Verifying...</>
                    : 'Verify & Sign In →'
                  }
                </button>

                <div className="text-center pt-1">
                  {countdown > 0 ? (
                    <p className="text-xs text-fog">
                      Resend code in{' '}
                      <span className="font-semibold text-slate tabular-nums">{countdown}s</span>
                    </p>
                  ) : (
                    <button
                      type="button"
                      onClick={handleResend}
                      disabled={loading}
                      className="text-xs text-forest hover:text-deep font-semibold underline underline-offset-2 disabled:opacity-50"
                    >
                      Resend login code
                    </button>
                  )}
                </div>
              </form>
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
