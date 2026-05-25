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
        <div className="px-3 pt-2 text-white/20 text-xs">
          Sevenhood v2.0 · سابع جار
        </div>
      </div>
    </aside>
  )
}
