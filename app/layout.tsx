import type { Metadata, Viewport } from 'next'
import './globals.css'
import AuthInit from '@/components/AuthInit'
import LayoutWrapper from '@/components/LayoutWrapper'

export const metadata: Metadata = {
  title: 'Sevenhood Admin — Operator Console',
  description: 'Sevenhood property management dashboard for operators and building managers.',
  manifest: '/manifest.webmanifest',
  icons: {
    icon:     [
      { url: '/icon',     sizes: '32x32', type: 'image/png' },
      { url: '/icon.svg', type: 'image/svg+xml' },
    ],
    apple:    [{ url: '/apple-icon', sizes: '180x180', type: 'image/png' }],
    shortcut: [{ url: '/icon', type: 'image/png' }],
  },
}

export const viewport: Viewport = {
  themeColor: '#0B0C0A',
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-cream">
        <AuthInit />
        <LayoutWrapper>{children}</LayoutWrapper>
      </body>
    </html>
  )
}
