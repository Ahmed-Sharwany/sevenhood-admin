import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Always allow the login page and auth callback through
  if (pathname.startsWith('/login') || pathname.startsWith('/auth/callback')) {
    return NextResponse.next()
  }

  // Check for the session cookie set after successful OTP login
  const isLoggedIn = request.cookies.get('sb_logged_in')

  if (!isLoggedIn) {
    const loginUrl = new URL('/login', request.url)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  // Run on all routes EXCEPT Next.js internals and static assets
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/).*)'],
}
