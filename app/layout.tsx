import type { Metadata } from 'next'
import './globals.css'
import AuthInit from '@/components/AuthInit'
import LayoutWrapper from '@/components/LayoutWrapper'

export const metadata: Metadata = {
  title: 'Sevenhood Admin',
  description: 'Operator Console',
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
