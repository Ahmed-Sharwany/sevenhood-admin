import { NextRequest, NextResponse } from 'next/server'

const COOKIE_OPTIONS = {
  httpOnly: true,                                        // not readable by JS — XSS safe
  secure:   process.env.NODE_ENV === 'production',       // HTTPS only in production
  sameSite: 'strict' as const,                          // no cross-site requests
  path:     '/',
  maxAge:   86400,                                       // 24 hours
}

/** POST /api/auth/session — set the session cookie after successful login */
export async function POST(_req: NextRequest) {
  const response = NextResponse.json({ ok: true })
  response.cookies.set('sb_logged_in', '1', COOKIE_OPTIONS)
  return response
}

/** DELETE /api/auth/session — clear the session cookie on logout */
export async function DELETE(_req: NextRequest) {
  const response = NextResponse.json({ ok: true })
  response.cookies.set('sb_logged_in', '', { ...COOKIE_OPTIONS, maxAge: 0 })
  return response
}
