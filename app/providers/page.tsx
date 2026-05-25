'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { ServiceProvider, City } from '@/lib/types'

// ─── Constants ──────────────────────────────────────────────────────────────

const ALL_SERVICES = [
  'AC & Cooling', 'Plumbing', 'Electrical', 'Cleaning', 'Painting',
  'Security', 'Landscaping', 'Pest Control', 'General',
]

const SERVICE_COLORS: Record<string, string> = {
  'AC & Cooling': 'bg-blue-50 text-blue-600 border-blue-200',
  'Plumbing':     'bg-cyan-50 text-cyan-600 border-cyan-200',
  'Electrical':   'bg-yellow-50 text-yellow-600 border-yellow-200',
  'Cleaning':     'bg-green-50 text-green-600 border-green-200',
  'Painting':     'bg-purple-50 text-purple-600 border-purple-200',
  'Security':     'bg-red-50 text-red-600 border-red-200',
  'Landscaping':  'bg-emerald-50 text-emerald-600 border-emerald-200',
  'Pest Control': 'bg-orange-50 text-orange-600 border-orange-200',
  'General':      'bg-gray-50 text-gray-600 border-gray-200',
}

// Deterministic avatar color from provider name
const AVATAR_COLORS = [
  'bg-forest text-white', 'bg-gold text-white', 'bg-sage text-white',
  'bg-blue-600 text-white', 'bg-purple-600 text-white', 'bg-red-600 text-white',
]
function avatarColor(name: string) {
  let hash = 0
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) | 0
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

const INPUT_CLS = 'w-full border border-border rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-forest bg-white'

// ─── Types ───────────────────────────────────────────────────────────────────

interface ProviderForm {
  name: string
  services: string[]
  city_id: string
  coverage_area: string
  working_hours_start: string
  working_hours_end: string
  contact_phone: string
  contact_email: string
  description: string
  is_active: boolean
}

const EMPTY_FORM: ProviderForm = {
  name: '', services: [], city_id: '', coverage_area: '',
  working_hours_start: '', working_hours_end: '',
  contact_phone: '', contact_email: '', description: '', is_active: true,
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function ProvidersPage() {
  const [providers, setProviders] = useState<ServiceProvider[]>([])
  const [cities, setCities]       = useState<Pick<City, 'id' | 'name'>[]>([])
  const [loading, setLoading]     = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingProvider, setEditingProvider] = useState<ServiceProvider | null>(null)
  const [form, setForm]           = useState<ProviderForm>(EMPTY_FORM)
  const [saving, setSaving]       = useState(false)

  // ── Load ──────────────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    setLoading(true)
    const [p, c] = await Promise.all([
      supabase.from('service_providers').select('*, cities(name)').order('name'),
      supabase.from('cities').select('id, name').order('name'),
    ])
    if (p.error) console.error(p.error)
    setProviders(p.data ?? [])
    setCities(c.data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  // ── Stats ─────────────────────────────────────────────────────────────────

  const totalProviders  = providers.length
  const activeProviders = providers.filter(p => p.is_active).length
  const avgRating       = providers.length
    ? (providers.reduce((sum, p) => sum + (p.rating ?? 0), 0) / providers.length).toFixed(1)
    : '—'
  const totalJobs       = providers.reduce((sum, p) => sum + (p.total_jobs ?? 0), 0)

  // ── Modal helpers ─────────────────────────────────────────────────────────

  function openAdd() {
    setEditingProvider(null)
    setForm(EMPTY_FORM)
    setShowModal(true)
  }

  function openEdit(provider: ServiceProvider) {
    setEditingProvider(provider)
    setForm({
      name:                provider.name,
      services:            provider.services ?? [],
      city_id:             provider.city_id ?? '',
      coverage_area:       provider.coverage_area ?? '',
      working_hours_start: provider.working_hours_start ?? '',
      working_hours_end:   provider.working_hours_end ?? '',
      contact_phone:       provider.contact_phone ?? '',
      contact_email:       provider.contact_email ?? '',
      description:         provider.description ?? '',
      is_active:           provider.is_active,
    })
    setShowModal(true)
  }

  function toggleService(svc: string) {
    setForm(f => ({
      ...f,
      services: f.services.includes(svc)
        ? f.services.filter(s => s !== svc)
        : [...f.services, svc],
    }))
  }

  // ── Save ──────────────────────────────────────────────────────────────────

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)

    const payload = {
      name:                form.name,
      services:            form.services,
      city_id:             form.city_id || null,
      coverage_area:       form.coverage_area || null,
      working_hours_start: form.working_hours_start || null,
      working_hours_end:   form.working_hours_end || null,
      contact_phone:       form.contact_phone || null,
      contact_email:       form.contact_email || null,
      description:         form.description || null,
      is_active:           form.is_active,
    }

    if (editingProvider) {
      const { error } = await supabase
        .from('service_providers')
        .update(payload)
        .eq('id', editingProvider.id)
      if (error) console.error(error)
    } else {
      const { error } = await supabase.from('service_providers').insert(payload)
      if (error) console.error(error)
    }

    setSaving(false)
    setShowModal(false)
    setEditingProvider(null)
    load()
  }

  // ── Delete ────────────────────────────────────────────────────────────────

  async function handleDelete(id: string) {
    if (!confirm('Delete this service provider?')) return
    const { error } = await supabase.from('service_providers').delete().eq('id', id)
    if (error) console.error(error)
    else load()
  }

  // ── Stars renderer ────────────────────────────────────────────────────────

  function StarRating({ rating }: { rating: number }) {
    return (
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map(i => (
          <span key={i} className={i <= Math.round(rating) ? 'text-gold' : 'text-border'}>
            ★
          </span>
        ))}
        <span className="text-xs text-slate ml-1">{rating > 0 ? rating.toFixed(1) : '—'}</span>
      </div>
    )
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-ink">Service Providers</h1>
          <p className="text-slate text-sm mt-1">{totalProviders} providers registered</p>
        </div>
        <button
          onClick={openAdd}
          className="bg-forest text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-deep transition-colors"
        >
          + Add Provider
        </button>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total Providers', value: totalProviders, icon: '⚙️', color: 'text-ink' },
          { label: 'Active',          value: activeProviders, icon: '✅', color: 'text-leaf' },
          { label: 'Avg Rating',      value: avgRating,       icon: '⭐', color: 'text-gold' },
          { label: 'Total Jobs Done', value: totalJobs.toLocaleString(), icon: '🔧', color: 'text-forest' },
        ].map(stat => (
          <div key={stat.label} className="bg-white rounded-2xl border border-border p-5 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xl">{stat.icon}</span>
            </div>
            <div className={`text-2xl font-bold ${stat.color}`}>{stat.value}</div>
            <div className="text-xs text-slate mt-1">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-border shadow-sm overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-slate text-xs uppercase tracking-wide border-b border-border">
              <th className="px-5 py-3 text-left">Provider</th>
              <th className="px-5 py-3 text-left">Services</th>
              <th className="px-5 py-3 text-left">City</th>
              <th className="px-5 py-3 text-left">Working Hours</th>
              <th className="px-5 py-3 text-left">Contact</th>
              <th className="px-5 py-3 text-left">Rating</th>
              <th className="px-5 py-3 text-left">Total Jobs</th>
              <th className="px-5 py-3 text-left">Status</th>
              <th className="px-5 py-3 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={9} className="px-5 py-10 text-center text-slate">
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-4 h-4 border-2 border-forest border-t-transparent rounded-full animate-spin" />
                    Loading providers...
                  </div>
                </td>
              </tr>
            )}
            {!loading && providers.map(p => {
              const initials = p.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
              return (
                <tr key={p.id} className="border-b border-border last:border-0 hover:bg-cream/50 transition-colors">
                  {/* Logo + Name */}
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${avatarColor(p.name)}`}>
                        {initials}
                      </div>
                      <div>
                        <div className="font-medium text-ink">{p.name}</div>
                        {p.coverage_area && (
                          <div className="text-xs text-fog">{p.coverage_area}</div>
                        )}
                      </div>
                    </div>
                  </td>

                  {/* Services */}
                  <td className="px-5 py-3">
                    <div className="flex flex-wrap gap-1 max-w-[220px]">
                      {(p.services ?? []).slice(0, 3).map(svc => (
                        <span
                          key={svc}
                          className={`px-2 py-0.5 rounded-full text-xs border font-medium ${SERVICE_COLORS[svc] ?? 'bg-gray-50 text-gray-600 border-gray-200'}`}
                        >
                          {svc}
                        </span>
                      ))}
                      {(p.services ?? []).length > 3 && (
                        <span className="px-2 py-0.5 rounded-full text-xs border bg-gray-50 text-gray-500 border-gray-200">
                          +{(p.services ?? []).length - 3}
                        </span>
                      )}
                    </div>
                  </td>

                  {/* City */}
                  <td className="px-5 py-3 text-slate">{(p as any).cities?.name ?? '—'}</td>

                  {/* Working Hours */}
                  <td className="px-5 py-3 text-slate whitespace-nowrap">
                    {p.working_hours_start && p.working_hours_end
                      ? `${p.working_hours_start} – ${p.working_hours_end}`
                      : '—'}
                  </td>

                  {/* Contact */}
                  <td className="px-5 py-3">
                    <div className="text-sm">{p.contact_phone ?? '—'}</div>
                    {p.contact_email && (
                      <div className="text-xs text-fog">{p.contact_email}</div>
                    )}
                  </td>

                  {/* Rating */}
                  <td className="px-5 py-3">
                    <StarRating rating={p.rating ?? 0} />
                  </td>

                  {/* Total Jobs */}
                  <td className="px-5 py-3 text-slate">{(p.total_jobs ?? 0).toLocaleString()}</td>

                  {/* Status */}
                  <td className="px-5 py-3">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${p.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {p.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>

                  {/* Actions */}
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => openEdit(p)}
                        className="text-forest hover:text-deep text-xs font-medium"
                      >
                        Edit
                      </button>
                      <span className="text-border">|</span>
                      <button
                        onClick={() => handleDelete(p.id)}
                        className="text-red-400 hover:text-red-600 text-xs font-medium"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
            {!loading && providers.length === 0 && (
              <tr>
                <td colSpan={9} className="px-5 py-12 text-center">
                  <div className="text-fog text-4xl mb-3">⚙️</div>
                  <p className="text-slate font-medium">No service providers yet</p>
                  <p className="text-fog text-sm mt-1">Add your first provider to get started</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ─── Add / Edit Modal ───────────────────────────────────────────────── */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-2xl shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between mb-5">
              <h2 className="font-bold text-lg text-ink">
                {editingProvider ? 'Edit Provider' : 'Add Service Provider'}
              </h2>
              <button onClick={() => setShowModal(false)} className="text-fog hover:text-slate text-xl leading-none">&times;</button>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              {/* Name */}
              <div>
                <label className="text-xs text-slate mb-1 block">Company / Provider Name *</label>
                <input
                  required
                  placeholder="e.g. Al-Faris Maintenance Co."
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  className={INPUT_CLS}
                />
              </div>

              {/* Services */}
              <div>
                <label className="text-xs text-slate mb-2 block">Services Offered</label>
                <div className="flex flex-wrap gap-2">
                  {ALL_SERVICES.map(svc => (
                    <button
                      key={svc}
                      type="button"
                      onClick={() => toggleService(svc)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors ${
                        form.services.includes(svc)
                          ? 'bg-forest text-white border-forest'
                          : 'bg-white text-slate border-border hover:border-forest'
                      }`}
                    >
                      {svc}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {/* City */}
                <div>
                  <label className="text-xs text-slate mb-1 block">City</label>
                  <select
                    value={form.city_id}
                    onChange={e => setForm(f => ({ ...f, city_id: e.target.value }))}
                    className={INPUT_CLS}
                  >
                    <option value="">Select city</option>
                    {cities.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>

                {/* Coverage Area */}
                <div>
                  <label className="text-xs text-slate mb-1 block">Coverage Area</label>
                  <input
                    placeholder="e.g. North Riyadh, Al Malqa"
                    value={form.coverage_area}
                    onChange={e => setForm(f => ({ ...f, coverage_area: e.target.value }))}
                    className={INPUT_CLS}
                  />
                </div>
              </div>

              {/* Working Hours */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate mb-1 block">Working Hours Start</label>
                  <input
                    type="time"
                    value={form.working_hours_start}
                    onChange={e => setForm(f => ({ ...f, working_hours_start: e.target.value }))}
                    className={INPUT_CLS}
                  />
                </div>
                <div>
                  <label className="text-xs text-slate mb-1 block">Working Hours End</label>
                  <input
                    type="time"
                    value={form.working_hours_end}
                    onChange={e => setForm(f => ({ ...f, working_hours_end: e.target.value }))}
                    className={INPUT_CLS}
                  />
                </div>
              </div>

              {/* Contact */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate mb-1 block">Contact Phone</label>
                  <input
                    type="tel"
                    placeholder="+966 5x xxx xxxx"
                    value={form.contact_phone}
                    onChange={e => setForm(f => ({ ...f, contact_phone: e.target.value }))}
                    className={INPUT_CLS}
                  />
                </div>
                <div>
                  <label className="text-xs text-slate mb-1 block">Contact Email</label>
                  <input
                    type="email"
                    placeholder="provider@email.com"
                    value={form.contact_email}
                    onChange={e => setForm(f => ({ ...f, contact_email: e.target.value }))}
                    className={INPUT_CLS}
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="text-xs text-slate mb-1 block">Description</label>
                <textarea
                  rows={2}
                  placeholder="Brief description of services offered..."
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  className={`${INPUT_CLS} resize-none`}
                />
              </div>

              {/* Active toggle */}
              <div className="flex items-center justify-between bg-cream rounded-xl px-4 py-3">
                <div>
                  <div className="text-sm font-medium text-ink">Active Status</div>
                  <div className="text-xs text-slate">Provider will appear in assignment dropdowns</div>
                </div>
                <button
                  type="button"
                  onClick={() => setForm(f => ({ ...f, is_active: !f.is_active }))}
                  className={`relative w-11 h-6 rounded-full transition-colors ${form.is_active ? 'bg-forest' : 'bg-border'}`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${form.is_active ? 'translate-x-5' : ''}`} />
                </button>
              </div>

              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 border border-border rounded-xl py-2 text-sm hover:bg-cream transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 bg-forest text-white rounded-xl py-2 text-sm font-medium disabled:opacity-50 hover:bg-deep transition-colors"
                >
                  {saving ? 'Saving...' : editingProvider ? 'Save Changes' : 'Add Provider'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
