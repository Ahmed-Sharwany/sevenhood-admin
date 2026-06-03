'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Account, AccountRole, Project } from '@/lib/types'
import { ALL_PERMISSIONS, ROLE_DEFAULT_PERMISSIONS } from '@/lib/permissions'

const ROLE_OPTIONS: AccountRole[] = [
  'super_admin', 'org_admin', 'project_owner',
  'operator', 'finance', 'service_provider', 'technician',
]

const ROLE_LABELS: Record<AccountRole, string> = {
  super_admin:      'Super Admin',
  org_admin:        'Org Admin',
  project_owner:    'Project Owner',
  operator:         'Operator',
  finance:          'Finance',
  service_provider: 'Service Provider',
  technician:       'Technician',
}

const ROLE_BADGE: Record<AccountRole, string> = {
  super_admin:      'bg-forest text-white',
  org_admin:        'bg-deep text-white',
  project_owner:    'bg-gold text-white',
  operator:         'bg-amber-600 text-white',
  finance:          'bg-emerald-600 text-white',
  service_provider: 'bg-blue-600 text-white',
  technician:       'bg-slate-500 text-white',
}

interface FormState {
  full_name:        string
  email:            string
  role:             AccountRole
  company_name:     string
  phone:            string
  is_active:        boolean
  permissions:      string[]
  project_access:   string[]  // project IDs this account can bill/manage
  unit_monthly_fee: string    // custom billing rate per unit (empty = use global)
}

const EMPTY_FORM: FormState = {
  full_name:        '',
  email:            '',
  role:             'project_owner',
  company_name:     '',
  phone:            '',
  is_active:        true,
  permissions:      ROLE_DEFAULT_PERMISSIONS['project_owner'],
  project_access:   [],
  unit_monthly_fee: '',
}

function Avatar({ name }: { name: string }) {
  const palette = [
    { bg: 'bg-forest', text: 'text-white' },
    { bg: 'bg-gold',   text: 'text-white' },
    { bg: 'bg-sage',   text: 'text-white' },
    { bg: 'bg-deep',   text: 'text-white' },
    { bg: 'bg-blue-600', text: 'text-white' },
    { bg: 'bg-amber',  text: 'text-white' },
  ]
  const initials = name
    .split(' ')
    .slice(0, 2)
    .map(w => w.charAt(0).toUpperCase())
    .join('')
  const { bg, text } = palette[(name.charCodeAt(0) + (name.charCodeAt(1) || 0)) % palette.length]
  return (
    <div className={`w-10 h-10 rounded-full ${bg} ${text} flex items-center justify-center text-sm font-bold flex-shrink-0`}>
      {initials}
    </div>
  )
}

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingAccount, setEditingAccount] = useState<Account | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [filterRole, setFilterRole] = useState('')

  async function loadAccounts() {
    setLoading(true)
    const [{ data: accs }, { data: projs }] = await Promise.all([
      supabase.from('accounts').select('*').order('created_at', { ascending: false }),
      supabase.from('projects').select('id, name').order('name'),
    ])
    setAccounts((accs as Account[]) ?? [])
    setProjects((projs as Project[]) ?? [])
    setLoading(false)
  }

  useEffect(() => { loadAccounts() }, [])

  function openAdd() {
    setEditingAccount(null)
    setForm(EMPTY_FORM)
    setShowModal(true)
  }

  function openEdit(a: Account) {
    setEditingAccount(a)
    setForm({
      full_name:        a.full_name,
      email:            a.email,
      role:             a.role,
      company_name:     a.company_name ?? '',
      phone:            a.phone ?? '',
      is_active:        a.is_active,
      permissions:      a.permissions ?? ROLE_DEFAULT_PERMISSIONS[a.role] ?? [],
      project_access:   a.project_access ?? [],
      unit_monthly_fee: a.unit_monthly_fee != null ? String(a.unit_monthly_fee) : '',
    })
    setShowModal(true)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const payload = {
      full_name:        form.full_name,
      email:            form.email,
      role:             form.role,
      company_name:     form.company_name || null,
      phone:            form.phone || null,
      is_active:        form.is_active,
      permissions:      form.permissions,
      project_access:   form.project_access.length > 0 ? form.project_access : null,
      unit_monthly_fee: form.unit_monthly_fee !== '' ? parseFloat(form.unit_monthly_fee) : null,
    }
    if (editingAccount) {
      await supabase.from('accounts').update(payload).eq('id', editingAccount.id)
    } else {
      await supabase.from('accounts').insert(payload)
    }
    setSaving(false)
    setShowModal(false)
    loadAccounts()
  }

  async function deleteAccount(id: string) {
    if (!confirm('Remove this account? This action cannot be undone.')) return
    await supabase.from('accounts').delete().eq('id', id)
    loadAccounts()
  }

  const filtered = filterRole
    ? accounts.filter(a => a.role === filterRole)
    : accounts

  // Stats
  const totalAccounts    = accounts.length
  const adminCount       = accounts.filter(a => ['super_admin', 'org_admin'].includes(a.role)).length
  const projectOwners    = accounts.filter(a => a.role === 'project_owner').length
  const operationsCount  = accounts.filter(a => ['operator', 'finance', 'technician'].includes(a.role)).length
  const serviceProviders = accounts.filter(a => a.role === 'service_provider').length

  return (
    <div className="p-8">
      {/* Warning Banner */}
      <div className="mb-6 bg-yellow-50 border border-yellow-200 rounded-2xl px-5 py-3.5 flex items-start gap-3">
        <span className="text-yellow-500 text-lg mt-0.5">⚠</span>
        <p className="text-sm text-yellow-800 font-medium">
          Account management controls who can access this platform. Changes take effect immediately.
        </p>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-ink">Accounts</h1>
          <p className="text-slate text-sm mt-1">Platform users and access control</p>
        </div>
        <button
          onClick={openAdd}
          className="bg-forest text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-deep transition-colors"
        >
          + Add Account
        </button>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-5 gap-4 mb-6">
        <div className="bg-forest text-white rounded-2xl p-5 border border-border shadow-sm">
          <div className="text-3xl font-bold mb-1">{totalAccounts}</div>
          <div className="font-semibold text-sm">Total Accounts</div>
          <div className="text-xs opacity-70 mt-1">all platform users</div>
        </div>
        <div className="bg-white rounded-2xl p-5 border border-border shadow-sm">
          <div className="text-3xl font-bold text-ink mb-1">{adminCount}</div>
          <div className="font-semibold text-sm text-ink">Admins</div>
          <div className="text-xs text-slate mt-1">super & org admin</div>
        </div>
        <div className="bg-white rounded-2xl p-5 border border-border shadow-sm">
          <div className="text-3xl font-bold text-ink mb-1">{projectOwners}</div>
          <div className="font-semibold text-sm text-ink">Project Owners</div>
          <div className="text-xs text-slate mt-1">project-level access</div>
        </div>
        <div className="bg-white rounded-2xl p-5 border border-border shadow-sm">
          <div className="text-3xl font-bold text-ink mb-1">{operationsCount}</div>
          <div className="font-semibold text-sm text-ink">Operations</div>
          <div className="text-xs text-slate mt-1">operator, finance, tech</div>
        </div>
        <div className="bg-gold text-white rounded-2xl p-5 border border-border shadow-sm">
          <div className="text-3xl font-bold mb-1">{serviceProviders}</div>
          <div className="font-semibold text-sm">Service Providers</div>
          <div className="text-xs opacity-70 mt-1">maintenance access</div>
        </div>
      </div>

      {/* Filter */}
      <div className="bg-white rounded-2xl border border-border shadow-sm px-5 py-4 mb-4 flex gap-3 items-center">
        <span className="text-sm font-medium text-slate">Filter by Role:</span>
        <select
          value={filterRole}
          onChange={e => setFilterRole(e.target.value)}
          className="border border-border rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-forest bg-white min-w-[200px]"
        >
          <option value="">All Roles</option>
          {ROLE_OPTIONS.map(r => (
            <option key={r} value={r}>{ROLE_LABELS[r]}</option>
          ))}
        </select>
        {filterRole && (
          <button
            onClick={() => setFilterRole('')}
            className="text-slate text-sm hover:text-ink px-3 py-2 rounded-xl border border-border"
          >
            Clear
          </button>
        )}
        <span className="ml-auto text-xs text-slate">{filtered.length} account{filtered.length !== 1 ? 's' : ''} shown</span>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-slate text-xs uppercase tracking-wide border-b border-border bg-cream/60">
              <th className="px-5 py-3 text-left">Avatar</th>
              <th className="px-5 py-3 text-left">Name</th>
              <th className="px-5 py-3 text-left">Email</th>
              <th className="px-5 py-3 text-left">Role</th>
              <th className="px-5 py-3 text-left">Company</th>
              <th className="px-5 py-3 text-left">Phone</th>
              <th className="px-5 py-3 text-left">Status</th>
              <th className="px-5 py-3 text-left">Created</th>
              <th className="px-5 py-3 text-center">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={9} className="px-5 py-10 text-center text-slate">Loading accounts...</td>
              </tr>
            )}
            {!loading && filtered.length === 0 && (
              <tr>
                <td colSpan={9} className="px-5 py-10 text-center text-slate">
                  {accounts.length === 0 ? 'No accounts yet — add your first account above' : 'No accounts match this role filter'}
                </td>
              </tr>
            )}
            {!loading && filtered.map(a => (
              <tr key={a.id} className="border-b border-border last:border-0 hover:bg-cream/40 transition-colors">
                <td className="px-5 py-3">
                  <Avatar name={a.full_name} />
                </td>
                <td className="px-5 py-3">
                  <div className="font-semibold text-ink">{a.full_name}</div>
                </td>
                <td className="px-5 py-3 text-slate">{a.email}</td>
                <td className="px-5 py-3">
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${ROLE_BADGE[a.role]}`}>
                    {ROLE_LABELS[a.role]}
                  </span>
                </td>
                <td className="px-5 py-3 text-slate">{a.company_name ?? '—'}</td>
                <td className="px-5 py-3 text-slate">{a.phone ?? '—'}</td>
                <td className="px-5 py-3">
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                    a.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                  }`}>
                    {a.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-5 py-3 text-slate text-xs">
                  {new Date(a.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                </td>
                <td className="px-5 py-3">
                  <div className="flex items-center justify-center gap-2">
                    <button
                      onClick={() => openEdit(a)}
                      className="text-xs font-medium text-forest border border-forest px-3 py-1 rounded-lg hover:bg-forest hover:text-white transition-colors"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => deleteAccount(a.id)}
                      className="text-xs font-medium text-red-500 border border-red-200 px-3 py-1 rounded-lg hover:bg-red-50 transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col"
            style={{ maxHeight: 'calc(100vh - 48px)' }}>

            {/* ── Fixed Header ─────────────────────────────────────────────── */}
            <div className="px-6 py-4 border-b border-border flex items-center justify-between shrink-0">
              <div>
                <h2 className="font-bold text-base text-ink">
                  {editingAccount ? 'Edit Account' : 'Add Account'}
                </h2>
                <p className="text-xs text-slate mt-0.5">
                  {editingAccount ? 'Update account details and permissions' : 'Create a new platform account'}
                </p>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-slate hover:text-ink hover:bg-cream transition-colors text-lg"
              >
                ×
              </button>
            </div>

            {/* ── Scrollable Body ───────────────────────────────────────────── */}
            <form onSubmit={handleSave} className="flex flex-col min-h-0 flex-1">
              <div className="px-6 py-5 space-y-4 overflow-y-auto flex-1">
              {/* Full Name + Email */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate mb-1.5 uppercase tracking-wide">Full Name *</label>
                  <input
                    required
                    placeholder="e.g. Ahmed Al-Rashid"
                    value={form.full_name}
                    onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
                    className="w-full border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-forest"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate mb-1.5 uppercase tracking-wide">Email *</label>
                  <input
                    required
                    type="email"
                    placeholder="email@example.com"
                    value={form.email}
                    onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                    className="w-full border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-forest"
                  />
                </div>
              </div>

              {/* Role */}
              <div>
                <label className="block text-xs font-semibold text-slate mb-1.5 uppercase tracking-wide">Role</label>
                <select
                  value={form.role}
                  onChange={e => {
                    const newRole = e.target.value as AccountRole
                    setForm(f => ({
                      ...f,
                      role: newRole,
                      // Auto-set default permissions when role changes
                      permissions: ROLE_DEFAULT_PERMISSIONS[newRole] ?? [],
                    }))
                  }}
                  className="w-full border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-forest bg-white"
                >
                  {ROLE_OPTIONS.map(r => (
                    <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                  ))}
                </select>
              </div>

              {/* Permissions — shown for non-super-admin roles */}
              {!['super_admin', 'org_admin'].includes(form.role) && (
                <div>
                  <label className="block text-xs font-semibold text-slate mb-2 uppercase tracking-wide">
                    Permissions
                    <span className="ml-2 font-normal normal-case text-slate/70">
                      — controls what this account can access
                    </span>
                  </label>
                  <div className="border border-border rounded-xl overflow-hidden divide-y divide-border">
                    {(() => {
                      const groups = Array.from(new Set(ALL_PERMISSIONS.map(p => p.group)))
                      return groups.map(group => (
                        <div key={group}>
                          <div className="px-3 py-1.5 bg-cream/60 text-xs font-semibold text-slate uppercase tracking-wide">
                            {group}
                          </div>
                          {ALL_PERMISSIONS.filter(p => p.group === group).map(perm => (
                            <label key={perm.id}
                              className="flex items-center gap-3 px-4 py-2.5 hover:bg-cream/40 cursor-pointer transition-colors">
                              <input
                                type="checkbox"
                                checked={form.permissions.includes(perm.id)}
                                onChange={e => setForm(f => ({
                                  ...f,
                                  permissions: e.target.checked
                                    ? [...f.permissions, perm.id]
                                    : f.permissions.filter(p => p !== perm.id),
                                }))}
                                className="w-4 h-4 rounded border-border accent-forest"
                              />
                              <span className="text-lg w-5 text-center flex-shrink-0">{perm.icon}</span>
                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-medium text-ink">{perm.label}</div>
                                <div className="text-xs text-slate">{perm.desc}</div>
                              </div>
                            </label>
                          ))}
                        </div>
                      ))
                    })()}
                  </div>
                  <div className="mt-2 flex gap-3">
                    <button type="button"
                      onClick={() => setForm(f => ({ ...f, permissions: ALL_PERMISSIONS.map(p => p.id) }))}
                      className="text-xs text-forest hover:underline">
                      Select all
                    </button>
                    <button type="button"
                      onClick={() => setForm(f => ({ ...f, permissions: [] }))}
                      className="text-xs text-slate hover:underline">
                      Clear all
                    </button>
                    <button type="button"
                      onClick={() => setForm(f => ({ ...f, permissions: ROLE_DEFAULT_PERMISSIONS[f.role] ?? [] }))}
                      className="text-xs text-slate hover:underline">
                      Reset to defaults
                    </button>
                  </div>
                </div>
              )}

              {/* Company + Phone */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate mb-1.5 uppercase tracking-wide">Company</label>
                  <input
                    placeholder="Company name"
                    value={form.company_name}
                    onChange={e => setForm(f => ({ ...f, company_name: e.target.value }))}
                    className="w-full border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-forest"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate mb-1.5 uppercase tracking-wide">Phone</label>
                  <input
                    placeholder="+966 50 000 0000"
                    value={form.phone}
                    onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                    className="w-full border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-forest"
                  />
                </div>
              </div>

              {/* Project Access — controls which projects are billed to this account */}
              {['project_owner', 'operator', 'org_admin'].includes(form.role) && projects.length > 0 && (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                  <label className="block text-xs font-semibold text-blue-800 mb-2 uppercase tracking-wide">
                    🏗️ Project Access
                    <span className="ml-2 font-normal normal-case text-blue-600/80">
                      — determines which projects are billed to this account
                    </span>
                  </label>
                  <div className="space-y-1 max-h-40 overflow-y-auto">
                    {projects.map(p => (
                      <label key={p.id} className="flex items-center gap-3 px-2 py-1.5 rounded-lg hover:bg-blue-100/50 cursor-pointer transition-colors">
                        <input
                          type="checkbox"
                          checked={form.project_access.includes(p.id)}
                          onChange={e => setForm(f => ({
                            ...f,
                            project_access: e.target.checked
                              ? [...f.project_access, p.id]
                              : f.project_access.filter(id => id !== p.id),
                          }))}
                          className="w-4 h-4 rounded border-blue-300 accent-blue-600"
                        />
                        <span className="text-sm text-ink font-medium">{p.name}</span>
                      </label>
                    ))}
                  </div>
                  {form.project_access.length === 0 && (
                    <p className="text-xs text-blue-600 mt-2">
                      ⚠️ No projects selected — subscription invoices won&apos;t be generated for this account.
                    </p>
                  )}
                </div>
              )}

              {/* Custom Billing Rate — only for subscription-billed roles */}
              {['project_owner', 'operator', 'org_admin'].includes(form.role) && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                  <label className="block text-xs font-semibold text-amber-800 mb-1.5 uppercase tracking-wide">
                    💰 Custom Unit Subscription Fee (SAR)
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="Leave empty to use global rate"
                      value={form.unit_monthly_fee}
                      onChange={e => setForm(f => ({ ...f, unit_monthly_fee: e.target.value }))}
                      className="flex-1 border border-amber-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-amber-500 bg-white"
                    />
                    <span className="text-sm text-amber-700 font-medium whitespace-nowrap">SAR / unit / month</span>
                  </div>
                  <p className="text-xs text-amber-600 mt-1.5">
                    Overrides the global rate for this account only. Leave empty to use the platform default.
                  </p>
                </div>
              )}

              {/* Active Toggle */}
              <div className="flex items-center justify-between border border-border rounded-xl px-4 py-3">
                <div>
                  <div className="text-sm font-semibold text-ink">Account Active</div>
                  <div className="text-xs text-slate mt-0.5">Inactive accounts cannot log in</div>
                </div>
                <button
                  type="button"
                  onClick={() => setForm(f => ({ ...f, is_active: !f.is_active }))}
                  className={`relative w-11 h-6 rounded-full transition-colors ${
                    form.is_active ? 'bg-forest' : 'bg-gray-300'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                      form.is_active ? 'translate-x-5' : 'translate-x-0.5'
                    }`}
                  />
                </button>
              </div>

              </div>{/* end scrollable body */}

              {/* ── Sticky Footer ────────────────────────────────────────────── */}
              <div className="px-6 py-4 border-t border-border bg-white rounded-b-2xl shrink-0">
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="flex-1 border border-border rounded-xl py-2.5 text-sm font-medium text-slate hover:bg-cream transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="flex-2 bg-forest text-white rounded-xl py-2.5 px-8 text-sm font-semibold hover:bg-deep transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {saving && (
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    )}
                    {saving ? 'Saving…' : editingAccount ? 'Save Changes' : 'Add Account'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
