import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// These API routes use their own auth (CRON_SECRET or HMAC signature)
// and must NOT require the session cookie
const EXEMPT_API_ROUTES = [
  '/api/billing/auto-generate',
  '/api/billing/check-overdue',
  '/api/billing/webhook',
]

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Always allow the login page and auth callback through
  if (pathname.startsWith('/login') || pathname.startsWith('/auth/callback')) {
    return NextResponse.next()
  }

  // Allow cron and webhook routes through (they have their own auth)
  if (EXEMPT_API_ROUTES.some(r => pathname.startsWith(r))) {
    return NextResponse.next()
  }

  // Check for the session cookie set after successful OTP login
  const isLoggedIn = request.cookies.get('sb_logged_in')

  if (!isLoggedIn) {
    // For API routes, return 401 JSON instead of a redirect
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const loginUrl = new URL('/login', request.url)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  // Run on ALL routes except Next.js internals and static assets
  // API routes are now included so unauthenticated API calls return 401
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
