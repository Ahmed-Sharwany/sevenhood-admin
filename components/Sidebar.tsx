'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

interface StoredUser {
  id: string
  full_name: string
  email: string
  role: string
  company_name: string | null
}

const ROLE_LABEL: Record<string, string> = {
  super_admin:      'Super Admin',
  project_owner:    'Project Owner',
  service_provider: 'Service Provider',
}

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
      { href: '/amenities', label: 'Amenities',     icon: '🏊' },
    ]
  },
  {
    label: 'Operations',
    items: [
      { href: '/bookings',  label: 'Bookings',       icon: '📅' },
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
  const path    = usePathname()
  const router  = useRouter()
  const [user, setUser] = useState<StoredUser | null>(null)

  useEffect(() => {
    const stored = localStorage.getItem('sevenhood_user')
    if (stored) {
      try { setUser(JSON.parse(stored)) } catch { /* ignore */ }
    }
  }, [])

  async function handleLogout() {
    await supabase.auth.signOut()
    localStorage.removeItem('sevenhood_user')
    document.cookie = 'sb_logged_in=; path=/; max-age=0; SameSite=Strict'
    router.replace('/login')
  }

  // Initials from full name
  function initials(name: string) {
    return name.split(' ').slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('')
  }

  return (
    <aside className="w-60 min-h-screen bg-forest text-white flex flex-col shrink-0">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-white/10">
        <div className="flex items-center gap-2.5">
          {/* S-mark */}
          <svg width="28" height="28" viewBox="0 0 64 64" fill="none" aria-hidden="true" style={{ color: '#C9A56B' }}>
            <mask id="sidebar-mark" maskUnits="userSpaceOnUse" x="0" y="0" width="64" height="64">
              <rect x="4" y="4" width="56" height="56" rx="15" fill="white" />
              <path d="M 46 22 C 14 22 14 32 32 32 C 50 32 50 42 18 42"
                stroke="black" strokeWidth="5.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            </mask>
            <rect x="4" y="4" width="56" height="56" rx="15" fill="currentColor" mask="url(#sidebar-mark)" />
          </svg>
          <div>
            <div className="text-[15px] font-semibold tracking-[-0.02em] text-white leading-none">Sevenhood</div>
            <div className="text-[10px] text-white/35 tracking-[.12em] mt-[3px] uppercase" style={{ fontFamily: 'Geist Mono, monospace' }}>Operator Console</div>
          </div>
        </div>
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

      {/* User info + logout */}
      <div className="px-4 py-4 border-t border-white/10">
        {user && (
          <div className="flex items-center gap-3 mb-3 px-2">
            <div className="w-8 h-8 rounded-full bg-gold flex items-center justify-center text-white text-xs font-bold shrink-0">
              {initials(user.full_name)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-white text-xs font-semibold truncate">{user.full_name}</div>
              <div className="text-white/40 text-xs truncate">
                {ROLE_LABEL[user.role] ?? user.role}
              </div>
            </div>
          </div>
        )}
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-white/40 hover:text-white hover:bg-white/8 text-xs font-medium transition-colors"
        >
          <span className="text-sm">↪</span>
          Sign out
        </button>
        <div className="px-3 pt-2 text-white/20 text-[11px]" style={{ fontFamily: 'Geist Mono, monospace', letterSpacing: '.04em' }}>
          Sevenhood v2.0
        </div>
      </div>
    </aside>
  )
}
