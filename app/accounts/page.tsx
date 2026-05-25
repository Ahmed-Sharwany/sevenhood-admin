'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Account, AccountRole } from '@/lib/types'

const ROLE_OPTIONS: AccountRole[] = ['super_admin', 'project_owner', 'service_provider']

const ROLE_LABELS: Record<AccountRole, string> = {
  super_admin:      'Super Admin',
  project_owner:    'Project Owner',
  service_provider: 'Service Provider',
}

const ROLE_BADGE: Record<AccountRole, string> = {
  super_admin:      'bg-forest text-white',
  project_owner:    'bg-gold text-white',
  service_provider: 'bg-blue-600 text-white',
}

interface FormState {
  full_name: string
  email: string
  role: AccountRole
  company_name: string
  phone: string
  is_active: boolean
}

const EMPTY_FORM: FormState = {
  full_name: '',
  email: '',
  role: 'project_owner',
  company_name: '',
  phone: '',
  is_active: true,
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
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingAccount, setEditingAccount] = useState<Account | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [filterRole, setFilterRole] = useState('')

  async function loadAccounts() {
    setLoading(true)
    const { data } = await supabase.from('accounts').select('*').order('created_at', { ascending: false })
    setAccounts((data as Account[]) ?? [])
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
      full_name: a.full_name,
      email: a.email,
      role: a.role,
      company_name: a.company_name ?? '',
      phone: a.phone ?? '',
      is_active: a.is_active,
    })
    setShowModal(true)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const payload = {
      full_name: form.full_name,
      email: form.email,
      role: form.role,
      company_name: form.company_name || null,
      phone: form.phone || null,
      is_active: form.is_active,
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
  const totalAccounts     = accounts.length
  const superAdmins       = accounts.filter(a => a.role === 'super_admin').length
  const projectOwners     = accounts.filter(a => a.role === 'project_owner').length
  const serviceProviders  = accounts.filter(a => a.role === 'service_provider').length

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
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-forest text-white rounded-2xl p-5 border border-border shadow-sm">
          <div className="text-3xl font-bold mb-1">{totalAccounts}</div>
          <div className="font-semibold text-sm">Total Accounts</div>
          <div className="text-xs opacity-70 mt-1">all platform users</div>
        </div>
        <div className="bg-white rounded-2xl p-5 border border-border shadow-sm">
          <div className="text-3xl font-bold text-ink mb-1">{superAdmins}</div>
          <div className="font-semibold text-sm text-ink">Super Admins</div>
          <div className="text-xs text-slate mt-1">full access</div>
        </div>
        <div className="bg-white rounded-2xl p-5 border border-border shadow-sm">
          <div className="text-3xl font-bold text-ink mb-1">{projectOwners}</div>
          <div className="font-semibold text-sm text-ink">Project Owners</div>
          <div className="text-xs text-slate mt-1">project-level access</div>
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
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
            <div className="px-7 py-5 border-b border-border flex items-center justify-between">
              <h2 className="font-bold text-lg text-ink">
                {editingAccount ? 'Edit Account' : 'Add Account'}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="text-slate hover:text-ink text-xl leading-none"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSave} className="px-7 py-5 space-y-4">
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
                  onChange={e => setForm(f => ({ ...f, role: e.target.value as AccountRole }))}
                  className="w-full border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-forest bg-white"
                >
                  {ROLE_OPTIONS.map(r => (
                    <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                  ))}
                </select>
              </div>

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

              {/* Actions */}
              <div className="flex gap-3 pt-2">
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
                  className="flex-1 bg-forest text-white rounded-xl py-2.5 text-sm font-semibold hover:bg-deep transition-colors disabled:opacity-50"
                >
                  {saving ? 'Saving…' : editingAccount ? 'Save Changes' : 'Add Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
