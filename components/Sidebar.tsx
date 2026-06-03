'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { HREF_PERMISSION } from '@/lib/permissions'

interface StoredUser {
  id:          string
  full_name:   string
  email:       string
  role:        string
  company_name: string | null
  permissions: string[]
}

const ROLE_LABEL: Record<string, string> = {
  super_admin:      'Super Admin',
  org_admin:        'Org Admin',
  project_owner:    'Project Owner',
  operator:         'Operator',
  finance:          'Finance',
  service_provider: 'Service Provider',
  technician:       'Technician',
}

// All nav groups with sections and hrefs
const NAV_GROUPS = [
  {
    id: 'overview',
    label: 'Overview',
    items: [
      { href: '/',          label: 'Dashboard',          icon: '▦'  },
    ],
  },
  {
    id: 'portfolio',
    label: 'Portfolio',
    items: [
      { href: '/projects',  label: 'Projects',           icon: '🏗️' },
      { href: '/buildings', label: 'Buildings',          icon: '🏢' },
      { href: '/units',     label: 'Units',              icon: '🚪' },
      { href: '/residents', label: 'Residents',          icon: '👤' },
      { href: '/amenities', label: 'Amenities',          icon: '🏊' },
    ],
  },
  {
    id: 'operations',
    label: 'Operations',
    items: [
      { href: '/bookings',  label: 'Bookings',           icon: '📅' },
      { href: '/tickets',     label: 'Maint. Tickets',     icon: '🔧' },
      { href: '/maintenance', label: 'Maintenance',         icon: '🛠️' },
      { href: '/providers', label: 'Service Providers',  icon: '⚙️' },
      { href: '/visitors',  label: 'Visitors',           icon: '🔑' },
    ],
  },
  {
    id: 'engagement',
    label: 'Engagement',
    items: [
      { href: '/community', label: 'Community',          icon: '👥' },
      { href: '/ai-design', label: 'AI Design',          icon: '✨' },
    ],
  },
  {
    id: 'intelligence',
    label: 'Intelligence',
    items: [
      { href: '/ai-docs',  label: 'Document AI',         icon: '📄' },
      { href: '/chatbot',  label: 'AI Concierge',        icon: '🤖' },
    ],
  },
  {
    id: 'billing',
    label: 'Billing',
    items: [
      { href: '/billing',          label: 'Financial Overview', icon: '💰' },
      { href: '/billing/invoices', label: 'Invoices',           icon: '🧾' },
      { href: '/billing/reports',  label: 'Revenue Reports',    icon: '📊' },
      { href: '/billing/audit',    label: 'Audit Trail',        icon: '🔍' },
      { href: '/billing/settings', label: 'Billing Settings',   icon: '⚙️' },
    ],
  },
  {
    id: 'admin',
    label: 'Admin',
    items: [
      { href: '/accounts',  label: 'Accounts',           icon: '🛡️' },
    ],
  },
]

// Roles that see every section without needing per-permission checks
const FULL_ACCESS_ROLES = new Set(['super_admin', 'org_admin'])

// Per role: which section IDs are accessible by default
const ROLE_SECTIONS: Record<string, Set<string>> = {
  project_owner:    new Set(['overview', 'portfolio', 'operations', 'engagement']),
  operator:         new Set(['overview']),   // + permission-gated items below
  finance:          new Set(['overview']),
  service_provider: new Set(['overview']),   // tickets + providers via HREF_PERMISSION
  technician:       new Set(['overview']),   // tickets only
}

function canSeeHref(href: string, role: string, permissions: string[]): boolean {
  // Dashboard is always visible
  if (href === '/') return true

  // Admin section — only super/org admin
  if (href === '/accounts') return FULL_ACCESS_ROLES.has(role)

  // Full access roles see everything
  if (FULL_ACCESS_ROLES.has(role)) return true

  // Project owner sees everything except admin
  if (role === 'project_owner') return href !== '/accounts'

  // For everyone else (including finance), check the required permission
  const required = HREF_PERMISSION[href]
  if (!required) return false
  return permissions.includes(required)
}

export default function Sidebar() {
  const path   = usePathname()
  const router = useRouter()
  const [user, setUser] = useState<StoredUser | null>(null)

  useEffect(() => {
    const stored = localStorage.getItem('sevenhood_user')
    if (stored) {
      try {
        const parsed = JSON.parse(stored)
        // Ensure permissions is always an array
        setUser({ ...parsed, permissions: parsed.permissions ?? [] })
      } catch { /* ignore */ }
    }
  }, [])

  async function handleLogout() {
    await supabase.auth.signOut()
    localStorage.removeItem('sevenhood_user')
    // Clear HttpOnly cookie via server route (cannot be cleared by document.cookie)
    await fetch('/api/auth/session', { method: 'DELETE' })
    router.replace('/login')
  }

  function initials(name: string) {
    return name.split(' ').slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('')
  }

  const role        = user?.role ?? ''
  const permissions = user?.permissions ?? []

  // Build filtered nav
  const visibleGroups = NAV_GROUPS
    .map(group => ({
      ...group,
      items: group.items.filter(item => canSeeHref(item.href, role, permissions)),
    }))
    .filter(group => group.items.length > 0)

  return (
    <aside className="w-60 min-h-screen bg-forest text-white flex flex-col shrink-0">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-white/10">
        <div className="flex items-center gap-2.5">
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
            <div className="text-[10px] text-white/35 tracking-[.12em] mt-[3px] uppercase"
              style={{ fontFamily: 'Geist Mono, monospace' }}>
              {ROLE_LABEL[role] ?? 'Console'}
            </div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-5 overflow-y-auto">
        {visibleGroups.map(group => (
          <div key={group.id}>
            <div className="px-3 mb-1 text-white/30 text-xs font-semibold uppercase tracking-widest">
              {group.label}
            </div>
            <div className="space-y-0.5">
              {group.items.map(({ href, label, icon }) => {
                const active = path === href || (href !== '/' && path.startsWith(href))
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
                    <span className="text-base w-5 text-center">{icon}</span>
                    {label}
                  </Link>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* User card + logout */}
      <div className="px-4 py-4 border-t border-white/10">
        {user && (
          <div className="flex items-center gap-3 mb-3 px-2">
            <div className="w-8 h-8 rounded-full bg-gold flex items-center justify-center text-white text-xs font-bold shrink-0">
              {initials(user.full_name)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-white text-xs font-semibold truncate">{user.full_name}</div>
              <div className="text-white/40 text-xs truncate">
                {ROLE_LABEL[role] ?? role}
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
        <div className="px-3 pt-2 text-white/20 text-[11px]"
          style={{ fontFamily: 'Geist Mono, monospace', letterSpacing: '.04em' }}>
          Sevenhood v2.0
        </div>
      </div>
    </aside>
  )
}
