import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json()
    if (!email) return NextResponse.json({ error: 'Email required' }, { status: 400 })

    const cleanEmail = email.toLowerCase().trim()

    // ── 1. Validate account (service role bypasses RLS) ──────────────────────
    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    const { data: account } = await adminClient
      .from('accounts')
      .select('id, is_active')
      .eq('email', cleanEmail)
      .maybeSingle()

    if (!account) {
      return NextResponse.json(
        { error: 'This email is not registered on the platform. Contact your administrator.' },
        { status: 403 }
      )
    }
    if (!account.is_active) {
      return NextResponse.json(
        { error: 'This account has been deactivated. Contact your administrator.' },
        { status: 403 }
      )
    }

    // ── 2. Send 6-digit OTP — single call, no double-send ────────────────────
    const anonClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    const { error: otpError } = await anonClient.auth.signInWithOtp({
      email: cleanEmail,
      options: { shouldCreateUser: true },
    })

    if (otpError) {
      const msg = otpError.message ?? ''
      // Surface rate-limit errors clearly
      if (msg.toLowerCase().includes('after') || msg.toLowerCase().includes('seconds')) {
        const secs = msg.match(/(\d+)\s*second/)?.[1] ?? '60'
        return NextResponse.json(
          { error: `Please wait ${secs} seconds before requesting another code.` },
          { status: 429 }
        )
      }
      return NextResponse.json({ error: msg || 'Failed to send login code.' }, { status: 500 })
    }

    return NextResponse.json({ success: true })

  } catch (err) {
    console.error('[send-otp] error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
