'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const NAV = [
  { href: '/',            label: 'Dashboard',    icon: '▦' },
  { href: '/units',       label: 'Units',        icon: '🏢' },
  { href: '/residents',   label: 'Residents',    icon: '👤' },
  { href: '/maintenance', label: 'Maintenance',  icon: '🔧' },
  { href: '/community',   label: 'Community',    icon: '👥' },
  { href: '/visitors',    label: 'Visitors',     icon: '🔑' },
]

export default function Sidebar() {
  const path = usePathname()
  return (
    <aside className="w-60 min-h-screen bg-forest text-white flex flex-col shrink-0">
      {/* Logo */}
      <div className="px-6 py-6 border-b border-white/10">
        <div className="text-2xl font-bold tracking-wide">Sevenhood</div>
        <div className="text-xs text-white/40 tracking-widest mt-0.5">OPERATOR CONSOLE</div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {NAV.map(({ href, label, icon }) => {
          const active = path === href
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                active
                  ? 'bg-gold text-white'
                  : 'text-white/60 hover:bg-white/8 hover:text-white'
              }`}
            >
              <span className="text-base">{icon}</span>
              {label}
            </Link>
          )
        })}
      </nav>

      <div className="px-6 py-4 border-t border-white/10 text-xs text-white/30">
        Sevenhood v1.0 · سابع جار
      </div>
    </aside>
  )
}
