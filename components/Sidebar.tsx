'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const NAV_GROUPS = [
  {
    label: 'Overview',
    items: [
      { href: '/',          label: 'Dashboard',     icon: '▦' },
    ]
  },
  {
    label: 'Portfolio',
    items: [
      { href: '/projects',  label: 'Projects',      icon: '🏗️' },
      { href: '/buildings', label: 'Buildings',     icon: '🏢' },
      { href: '/units',     label: 'Units',         icon: '🚪' },
      { href: '/residents', label: 'Residents',     icon: '👤' },
    ]
  },
  {
    label: 'Operations',
    items: [
      { href: '/tickets',   label: 'Maint. Tickets', icon: '🔧' },
      { href: '/providers', label: 'Service Providers', icon: '⚙️' },
      { href: '/visitors',  label: 'Visitors',      icon: '🔑' },
    ]
  },
  {
    label: 'Engagement',
    items: [
      { href: '/community', label: 'Community',     icon: '👥' },
      { href: '/ai-design', label: 'AI Design',     icon: '✨' },
    ]
  },
  {
    label: 'Admin',
    items: [
      { href: '/accounts',  label: 'Accounts',      icon: '🛡️' },
    ]
  },
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
      <nav className="flex-1 px-3 py-4 space-y-5 overflow-y-auto">
        {NAV_GROUPS.map(group => (
          <div key={group.label}>
            <div className="px-3 mb-1 text-white/30 text-xs font-semibold uppercase tracking-widest">
              {group.label}
            </div>
            <div className="space-y-0.5">
              {group.items.map(({ href, label, icon }) => {
                const active = path === href
                return (
                  <Link
                    key={href}
                    href={href}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                      active ? 'bg-gold text-white' : 'text-white/60 hover:bg-white/8 hover:text-white'
                    }`}
                  >
                    <span className="text-base w-5 text-center">{icon}</span>
                    {label}
                  </Link>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="px-6 py-4 border-t border-white/10 text-xs text-white/30">
        Sevenhood v2.0 · سابع جار
      </div>
    </aside>
  )
}
