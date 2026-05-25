'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { Amenity, AmenityBookingRules, AmenityCategory } from '@/lib/types'

// ─── Types ───────────────────────────────────────────────────────────────────

type AmenityRow = Amenity & {
  projects?: { id: string; name: string } | null
  buildings?: { id: string; name: string } | null
  amenity_booking_rules?: AmenityBookingRules | null
}

type ProjectOption = { id: string; name: string }
type BuildingOption = { id: string; name: string; project_id: string | null }

// ─── Constants ───────────────────────────────────────────────────────────────

const CATEGORY_META: Record<string, { label: string; icon: string; color: string }> = {
  fitness:       { label: 'Fitness',       icon: '💪', color: 'bg-red-100 text-red-700' },
  social:        { label: 'Social',        icon: '👥', color: 'bg-blue-100 text-blue-700' },
  workspace:     { label: 'Workspace',     icon: '💼', color: 'bg-purple-100 text-purple-700' },
  entertainment: { label: 'Entertainment', icon: '🎬', color: 'bg-yellow-100 text-yellow-700' },
  outdoor:       { label: 'Outdoor',       icon: '🌿', color: 'bg-green-100 text-green-700' },
  sports:        { label: 'Sports',        icon: '⚽', color: 'bg-orange-100 text-orange-700' },
  other:         { label: 'Other',         icon: '✨', color: 'bg-gray-100 text-gray-700' },
}

const CATEGORY_FILTER_TABS: { key: string; label: string; icon: string }[] = [
  { key: 'all',           label: 'All',           icon: '' },
  { key: 'fitness',       label: 'Fitness',       icon: '💪' },
  { key: 'social',        label: 'Social',        icon: '👥' },
  { key: 'workspace',     label: 'Workspace',     icon: '💼' },
  { key: 'entertainment', label: 'Entertainment', icon: '🎬' },
  { key: 'outdoor',       label: 'Outdoor',       icon: '🌿' },
  { key: 'sports',        label: 'Sports',        icon: '⚽' },
  { key: 'other',         label: 'Other',         icon: '✨' },
]

const AMENITY_PRESETS = [
  { name: 'Meeting Room',     category: 'workspace'     as AmenityCategory, icon: '🤝' },
  { name: 'Majlis / Lounge',  category: 'social'        as AmenityCategory, icon: '🛋️' },
  { name: 'Gym',              category: 'fitness'       as AmenityCategory, icon: '💪' },
  { name: 'BBQ Area',         category: 'outdoor'       as AmenityCategory, icon: '🔥' },
  { name: 'Cinema Room',      category: 'entertainment' as AmenityCategory, icon: '🎬' },
  { name: 'Shared Workspace', category: 'workspace'     as AmenityCategory, icon: '💼' },
  { name: 'Swimming Pool',    category: 'outdoor'       as AmenityCategory, icon: '🏊' },
  { name: 'Event Hall',       category: 'social'        as AmenityCategory, icon: '🎉' },
  { name: 'Sports Court',     category: 'sports'        as AmenityCategory, icon: '⚽' },
  { name: 'Kids Play Area',   category: 'social'        as AmenityCategory, icon: '🎮' },
  { name: 'Sauna',            category: 'fitness'       as AmenityCategory, icon: '♨️' },
  { name: 'Rooftop Terrace',  category: 'outdoor'       as AmenityCategory, icon: '🌇' },
]

const DURATION_OPTIONS = [
  { value: 30,  label: '30 min' },
  { value: 60,  label: '1 hr'   },
  { value: 90,  label: '1.5 hr' },
  { value: 120, label: '2 hr'   },
  { value: 180, label: '3 hr'   },
  { value: 240, label: '4 hr'   },
]

const BUFFER_OPTIONS = [
  { value: 0,  label: 'None'   },
  { value: 5,  label: '5 min'  },
  { value: 10, label: '10 min' },
  { value: 15, label: '15 min' },
  { value: 30, label: '30 min' },
]

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

const DEFAULT_RULES = {
  capacity: 1,
  allowed_durations: [30, 60],
  operating_hours_start: '06:00',
  operating_hours_end: '22:00',
  operating_days: [1, 2, 3, 4, 5, 6, 7],
  buffer_time_mins: 0,
  max_bookings_per_user_per_day: 1,
  max_bookings_per_user_per_week: 3,
  auto_approve: true,
  advance_booking_days: 14,
  cancellation_hours: 2,
}

const EMPTY_FORM = {
  name: '',
  category: 'other' as AmenityCategory,
  project_id: '',
  building_id: '',
  description: '',
  image_url: '',
  requires_booking: false,
  is_active: true,
}

type RulesForm = {
  capacity: number
  allowed_durations: number[]
  operating_hours_start: string
  operating_hours_end: string
  operating_days: number[]
  buffer_time_mins: number
  max_bookings_per_user_per_day: number
  max_bookings_per_user_per_week: number
  auto_approve: boolean
  advance_booking_days: number
  cancellation_hours: number
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function durationLabel(mins: number): string {
  const found = DURATION_OPTIONS.find(d => d.value === mins)
  return found ? found.label : `${mins} min`
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
        checked ? 'bg-forest' : 'bg-gray-300'
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
          checked ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AmenitiesPage() {
  const [amenities, setAmenities]   = useState<AmenityRow[]>([])
  const [projects,  setProjects]    = useState<ProjectOption[]>([])
  const [buildings, setBuildings]   = useState<BuildingOption[]>([])
  const [loading,   setLoading]     = useState(true)
  const [saving,    setSaving]      = useState(false)
  const [showModal, setShowModal]   = useState(false)
  const [editing,   setEditing]     = useState<AmenityRow | null>(null)

  // Filters
  const [filterCategory,   setFilterCategory]   = useState('all')
  const [filterBookable,   setFilterBookable]   = useState(false)
  const [filterProject,    setFilterProject]    = useState('')

  // Basic form
  const [form, setForm] = useState(EMPTY_FORM)

  // Booking rules form
  const [rules, setRules] = useState<RulesForm>({ ...DEFAULT_RULES })

  // ─── Data loading ──────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    setLoading(true)
    const [a, p, b] = await Promise.all([
      supabase
        .from('amenities')
        .select('*, projects(id,name), buildings(id,name), amenity_booking_rules(*)')
        .order('name'),
      supabase.from('projects').select('id, name').order('name'),
      supabase.from('buildings').select('id, name, project_id').order('name'),
    ])
    setAmenities((a.data ?? []) as AmenityRow[])
    setProjects(p.data ?? [])
    setBuildings((b.data ?? []) as BuildingOption[])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  // ─── Modal helpers ─────────────────────────────────────────────────────────

  function openAdd() {
    setEditing(null)
    setForm({ ...EMPTY_FORM })
    setRules({ ...DEFAULT_RULES })
    setShowModal(true)
  }

  function openEdit(a: AmenityRow) {
    setEditing(a)
    setForm({
      name:             a.name,
      category:         a.category,
      project_id:       a.project_id ?? '',
      building_id:      a.building_id ?? '',
      description:      a.description ?? '',
      image_url:        a.image_url ?? '',
      requires_booking: a.requires_booking,
      is_active:        a.is_active,
    })
    if (a.amenity_booking_rules) {
      const r = a.amenity_booking_rules
      setRules({
        capacity:                      r.capacity,
        allowed_durations:             r.allowed_durations,
        operating_hours_start:         r.operating_hours_start,
        operating_hours_end:           r.operating_hours_end,
        operating_days:                r.operating_days,
        buffer_time_mins:              r.buffer_time_mins,
        max_bookings_per_user_per_day: r.max_bookings_per_user_per_day,
        max_bookings_per_user_per_week:r.max_bookings_per_user_per_week,
        auto_approve:                  r.auto_approve,
        advance_booking_days:          r.advance_booking_days,
        cancellation_hours:            r.cancellation_hours,
      })
    } else {
      setRules({ ...DEFAULT_RULES })
    }
    setShowModal(true)
  }

  function closeModal() {
    setShowModal(false)
    setEditing(null)
    setForm({ ...EMPTY_FORM })
    setRules({ ...DEFAULT_RULES })
  }

  function applyPreset(preset: typeof AMENITY_PRESETS[0]) {
    setForm(f => ({ ...f, name: preset.name, category: preset.category }))
  }

  function toggleDuration(val: number) {
    setRules(r => ({
      ...r,
      allowed_durations: r.allowed_durations.includes(val)
        ? r.allowed_durations.filter(d => d !== val)
        : [...r.allowed_durations, val].sort((a, b) => a - b),
    }))
  }

  function toggleDay(day: number) {
    setRules(r => ({
      ...r,
      operating_days: r.operating_days.includes(day)
        ? r.operating_days.filter(d => d !== day)
        : [...r.operating_days, day].sort((a, b) => a - b),
    }))
  }

  // ─── Save ──────────────────────────────────────────────────────────────────

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim() || !form.project_id) return
    setSaving(true)

    const payload = {
      name:             form.name.trim(),
      category:         form.category,
      project_id:       form.project_id || null,
      building_id:      form.building_id || null,
      description:      form.description || null,
      image_url:        form.image_url || null,
      requires_booking: form.requires_booking,
      is_active:        form.is_active,
    }

    let savedId: string

    if (editing) {
      await supabase.from('amenities').update(payload).eq('id', editing.id)
      savedId = editing.id
    } else {
      const { data } = await supabase.from('amenities').insert(payload).select().single()
      savedId = (data as { id: string } | null)?.id ?? ''
    }

    if (savedId) {
      if (form.requires_booking) {
        await supabase.from('amenity_booking_rules').upsert(
          { amenity_id: savedId, ...rules },
          { onConflict: 'amenity_id' },
        )
      } else {
        await supabase.from('amenity_booking_rules').delete().eq('amenity_id', savedId)
      }
    }

    setSaving(false)
    closeModal()
    load()
  }

  // ─── Delete ────────────────────────────────────────────────────────────────

  async function handleDelete(id: string) {
    if (!confirm('Delete this amenity? This cannot be undone.')) return
    await supabase.from('amenities').delete().eq('id', id)
    load()
  }

  // ─── Derived data ──────────────────────────────────────────────────────────

  const filtered = amenities.filter(a => {
    if (filterCategory !== 'all' && a.category !== filterCategory) return false
    if (filterBookable && !a.requires_booking) return false
    if (filterProject && a.project_id !== filterProject) return false
    return true
  })

  const totalCount      = amenities.length
  const bookableCount   = amenities.filter(a => a.requires_booking).length
  const activeCount     = amenities.filter(a => a.is_active).length
  const categoryCount   = new Set(amenities.map(a => a.category)).size

  const filteredBuildings = buildings.filter(
    b => !form.project_id || b.project_id === form.project_id,
  )

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-ink">Amenities</h1>
          <p className="text-slate text-sm mt-1">Manage building amenities and booking rules</p>
        </div>
        <button
          onClick={openAdd}
          className="bg-forest text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-deep transition-colors"
        >
          + Add Amenity
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total Amenities', value: totalCount,    icon: '🏛️' },
          { label: 'Bookable',        value: bookableCount, icon: '📅' },
          { label: 'Active Today',    value: activeCount,   icon: '✅' },
          { label: 'Categories',      value: categoryCount, icon: '🏷️' },
        ].map(stat => (
          <div key={stat.label} className="bg-white rounded-2xl border border-border p-5 shadow-sm">
            <div className="text-2xl mb-1">{stat.icon}</div>
            <div className="text-2xl font-bold text-ink">{stat.value}</div>
            <div className="text-xs text-slate mt-0.5">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        {/* Category tabs */}
        <div className="flex items-center gap-1 bg-white border border-border rounded-xl p-1">
          {CATEGORY_FILTER_TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setFilterCategory(tab.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                filterCategory === tab.key
                  ? 'bg-forest text-white'
                  : 'text-slate hover:text-ink hover:bg-cream'
              }`}
            >
              {tab.icon && <span className="mr-1">{tab.icon}</span>}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Bookable toggle */}
        <button
          onClick={() => setFilterBookable(v => !v)}
          className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors ${
            filterBookable
              ? 'bg-forest text-white border-forest'
              : 'bg-white text-slate border-border hover:text-ink'
          }`}
        >
          📅 Requires Booking
        </button>

        {/* Project filter */}
        <select
          value={filterProject}
          onChange={e => setFilterProject(e.target.value)}
          className="text-xs text-slate bg-white border border-border rounded-xl px-3 py-1.5 focus:outline-none focus:border-forest"
        >
          <option value="">All Projects</option>
          {projects.map(p => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-24">
          <div className="text-fog text-sm">Loading amenities…</div>
        </div>
      ) : amenities.length === 0 ? (
        /* Empty state */
        <div className="flex flex-col items-center justify-center py-24">
          <div className="text-6xl mb-4">🏊</div>
          <h2 className="text-xl font-bold text-ink mb-2">No amenities yet</h2>
          <p className="text-slate text-sm text-center max-w-sm mb-6">
            Add your first amenity to let residents know what facilities are available.
          </p>
          <button
            onClick={openAdd}
            className="bg-forest text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-deep transition-colors"
          >
            + Add Amenity
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex items-center justify-center py-24 text-fog text-sm">
          No amenities match the current filters.
        </div>
      ) : (
        /* Cards grid */
        <div className="grid grid-cols-3 gap-4">
          {filtered.map(a => {
            const meta = CATEGORY_META[a.category] ?? CATEGORY_META.other
            const r    = a.amenity_booking_rules
            return (
              <div
                key={a.id}
                className="bg-white rounded-2xl border border-border shadow-sm p-5 flex flex-col gap-3"
              >
                {/* Top row */}
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0 ${meta.color}`}>
                    {meta.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-ink text-sm truncate">{a.name}</span>
                      <span className={`shrink-0 text-xs font-medium px-2 py-0.5 rounded-full ${
                        a.is_active
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-gray-500'
                      }`}>
                        {a.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    {(a.projects?.name || a.buildings?.name) && (
                      <div className="text-xs text-slate mt-0.5 truncate">
                        {a.projects?.name}{a.buildings?.name ? ` · ${a.buildings.name}` : ''}
                      </div>
                    )}
                  </div>
                </div>

                {/* Description */}
                {a.description && (
                  <p className="text-xs text-fog line-clamp-2">{a.description}</p>
                )}

                {/* Booking badge + rules summary */}
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    {a.requires_booking ? (
                      <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-lg bg-forest/10 text-forest">
                        📅 Booking Required
                        {r?.capacity && (
                          <span className="ml-1 bg-forest/20 text-forest rounded-md px-1.5 py-0.5 text-xs">
                            👥 {r.capacity}
                          </span>
                        )}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-lg bg-gray-100 text-gray-500">
                        🔓 Open Access
                      </span>
                    )}
                  </div>

                  {/* Compact rules summary */}
                  {a.requires_booking && r && (
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {r.allowed_durations.length > 0 && (
                        <span className="text-xs text-fog bg-cream px-2 py-0.5 rounded-md">
                          ⏱ {durationLabel(r.allowed_durations[0])}
                          {r.allowed_durations.length > 1 && `–${durationLabel(r.allowed_durations[r.allowed_durations.length - 1])}`}
                        </span>
                      )}
                      <span className="text-xs text-fog bg-cream px-2 py-0.5 rounded-md">
                        👥 Cap: {r.capacity}
                      </span>
                      <span className="text-xs text-fog bg-cream px-2 py-0.5 rounded-md">
                        ⏰ {r.operating_hours_start}–{r.operating_hours_end}
                      </span>
                      {r.auto_approve && (
                        <span className="text-xs text-fog bg-cream px-2 py-0.5 rounded-md">
                          🔄 Auto-approve
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center justify-end gap-2 pt-1 border-t border-border mt-auto">
                  <button
                    onClick={() => openEdit(a)}
                    className="text-xs text-slate hover:text-ink px-2 py-1 rounded-lg hover:bg-cream transition-colors"
                  >
                    ✏️ Edit
                  </button>
                  <button
                    onClick={() => handleDelete(a.id)}
                    className="text-xs text-red-400 hover:text-red-600 px-2 py-1 rounded-lg hover:bg-red-50 transition-colors"
                  >
                    🗑 Delete
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ─── Modal ─────────────────────────────────────────────────────────── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 overflow-y-auto py-8 px-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl my-auto">
            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-border">
              <h2 className="text-lg font-bold text-ink">
                {editing ? 'Edit Amenity' : 'Add Amenity'}
              </h2>
              <button
                onClick={closeModal}
                className="text-fog hover:text-ink text-xl leading-none transition-colors"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="px-6 py-5 space-y-5">

                {/* ── Section 1: Basic Info ─────────────────────────────── */}
                <div>
                  <h3 className="text-sm font-semibold text-ink mb-3">Basic Info</h3>

                  {/* Presets */}
                  <div className="mb-4">
                    <label className="text-xs text-slate mb-2 block">Quick presets</label>
                    <div className="flex flex-wrap gap-1.5">
                      {AMENITY_PRESETS.map(p => (
                        <button
                          key={p.name}
                          type="button"
                          onClick={() => applyPreset(p)}
                          className={`text-xs px-2.5 py-1 rounded-lg border transition-colors ${
                            form.name === p.name && form.category === p.category
                              ? 'bg-forest text-white border-forest'
                              : 'bg-cream text-slate border-border hover:border-forest hover:text-ink'
                          }`}
                        >
                          {p.icon} {p.name}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Row 1: Name + Category */}
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div>
                      <label className="text-xs text-slate mb-1 block">Name <span className="text-red-400">*</span></label>
                      <input
                        type="text"
                        required
                        value={form.name}
                        onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                        placeholder="e.g. Rooftop Gym"
                        className="w-full text-sm border border-border rounded-xl px-3 py-2 focus:outline-none focus:border-forest"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-slate mb-1 block">Category</label>
                      <select
                        value={form.category}
                        onChange={e => setForm(f => ({ ...f, category: e.target.value as AmenityCategory }))}
                        className="w-full text-sm border border-border rounded-xl px-3 py-2 focus:outline-none focus:border-forest"
                      >
                        {Object.entries(CATEGORY_META).map(([k, v]) => (
                          <option key={k} value={k}>{v.icon} {v.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Row 2: Project + Building */}
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div>
                      <label className="text-xs text-slate mb-1 block">Project <span className="text-red-400">*</span></label>
                      <select
                        required
                        value={form.project_id}
                        onChange={e => setForm(f => ({ ...f, project_id: e.target.value, building_id: '' }))}
                        className="w-full text-sm border border-border rounded-xl px-3 py-2 focus:outline-none focus:border-forest"
                      >
                        <option value="">Select project…</option>
                        {projects.map(p => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-slate mb-1 block">Building (optional)</label>
                      <select
                        value={form.building_id}
                        onChange={e => setForm(f => ({ ...f, building_id: e.target.value }))}
                        disabled={!form.project_id}
                        className="w-full text-sm border border-border rounded-xl px-3 py-2 focus:outline-none focus:border-forest disabled:opacity-50"
                      >
                        <option value="">Any building</option>
                        {filteredBuildings.map(b => (
                          <option key={b.id} value={b.id}>{b.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Description */}
                  <div className="mb-3">
                    <label className="text-xs text-slate mb-1 block">Description (optional)</label>
                    <textarea
                      value={form.description}
                      onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                      rows={2}
                      placeholder="Brief description of this amenity…"
                      className="w-full text-sm border border-border rounded-xl px-3 py-2 focus:outline-none focus:border-forest resize-none"
                    />
                  </div>

                  {/* Image URL */}
                  <div className="mb-3">
                    <label className="text-xs text-slate mb-1 block">Image URL (optional)</label>
                    <input
                      type="url"
                      value={form.image_url}
                      onChange={e => setForm(f => ({ ...f, image_url: e.target.value }))}
                      placeholder="https://…"
                      className="w-full text-sm border border-border rounded-xl px-3 py-2 focus:outline-none focus:border-forest"
                    />
                  </div>

                  {/* Toggles row */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex items-start gap-3 bg-cream rounded-xl p-3">
                      <Toggle
                        checked={form.requires_booking}
                        onChange={v => setForm(f => ({ ...f, requires_booking: v }))}
                      />
                      <div>
                        <div className="text-xs font-medium text-ink">Requires Booking</div>
                        <div className="text-xs text-fog mt-0.5 leading-relaxed">
                          When ON, residents must reserve a time slot before using this amenity
                        </div>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 bg-cream rounded-xl p-3">
                      <Toggle
                        checked={form.is_active}
                        onChange={v => setForm(f => ({ ...f, is_active: v }))}
                      />
                      <div>
                        <div className="text-xs font-medium text-ink">Is Active</div>
                        <div className="text-xs text-fog mt-0.5 leading-relaxed">
                          Visible to residents in the app
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* ── Section 2: Booking Rules ───────────────────────────── */}
                {form.requires_booking && (
                  <>
                    <div className="border-t border-border" />

                    <div>
                      <div className="mb-4">
                        <h3 className="text-sm font-semibold text-ink flex items-center gap-1.5">
                          📅 Booking Rules Configuration
                        </h3>
                        <p className="text-xs text-fog mt-1">
                          Define how residents can book this amenity — capacity, hours, limits, and approval.
                        </p>
                      </div>

                      <div className="space-y-4">

                        {/* 1. Capacity */}
                        <div>
                          <label className="text-xs text-slate mb-1 block">
                            Capacity
                            <span className="text-fog font-normal ml-1">— Max simultaneous bookings at the same time slot</span>
                          </label>
                          <input
                            type="number"
                            min={1}
                            value={rules.capacity}
                            onChange={e => setRules(r => ({ ...r, capacity: Math.max(1, parseInt(e.target.value) || 1) }))}
                            className="w-24 text-sm border border-border rounded-xl px-3 py-2 focus:outline-none focus:border-forest"
                          />
                        </div>

                        {/* 2. Allowed Durations */}
                        <div>
                          <label className="text-xs text-slate mb-2 block">Allowed Durations</label>
                          <div className="flex flex-wrap gap-2">
                            {DURATION_OPTIONS.map(d => (
                              <button
                                key={d.value}
                                type="button"
                                onClick={() => toggleDuration(d.value)}
                                className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors ${
                                  rules.allowed_durations.includes(d.value)
                                    ? 'bg-forest text-white border-forest'
                                    : 'bg-white text-slate border-border hover:border-forest'
                                }`}
                              >
                                {d.label}
                              </button>
                            ))}
                          </div>
                          {rules.allowed_durations.length === 0 && (
                            <p className="text-xs text-red-400 mt-1">Select at least one duration</p>
                          )}
                        </div>

                        {/* 3. Operating Hours */}
                        <div>
                          <label className="text-xs text-slate mb-2 block">Operating Hours</label>
                          <div className="flex items-center gap-3">
                            <input
                              type="time"
                              value={rules.operating_hours_start}
                              onChange={e => setRules(r => ({ ...r, operating_hours_start: e.target.value }))}
                              className="text-sm border border-border rounded-xl px-3 py-2 focus:outline-none focus:border-forest"
                            />
                            <span className="text-fog text-sm">to</span>
                            <input
                              type="time"
                              value={rules.operating_hours_end}
                              onChange={e => setRules(r => ({ ...r, operating_hours_end: e.target.value }))}
                              className="text-sm border border-border rounded-xl px-3 py-2 focus:outline-none focus:border-forest"
                            />
                          </div>
                        </div>

                        {/* 4. Operating Days */}
                        <div>
                          <label className="text-xs text-slate mb-2 block">Operating Days</label>
                          <div className="flex gap-2">
                            {DAY_LABELS.map((day, i) => {
                              const dayNum = i + 1
                              return (
                                <button
                                  key={day}
                                  type="button"
                                  onClick={() => toggleDay(dayNum)}
                                  className={`w-10 h-10 rounded-xl text-xs font-medium border transition-colors ${
                                    rules.operating_days.includes(dayNum)
                                      ? 'bg-forest text-white border-forest'
                                      : 'bg-white text-slate border-border hover:border-forest'
                                  }`}
                                >
                                  {day}
                                </button>
                              )
                            })}
                          </div>
                        </div>

                        {/* 5. Buffer Time */}
                        <div>
                          <label className="text-xs text-slate mb-1 block">Buffer Time Between Bookings</label>
                          <select
                            value={rules.buffer_time_mins}
                            onChange={e => setRules(r => ({ ...r, buffer_time_mins: parseInt(e.target.value) }))}
                            className="text-sm border border-border rounded-xl px-3 py-2 focus:outline-none focus:border-forest"
                          >
                            {BUFFER_OPTIONS.map(o => (
                              <option key={o.value} value={o.value}>{o.label}</option>
                            ))}
                          </select>
                        </div>

                        {/* 6. Per-Resident Limits */}
                        <div>
                          <label className="text-xs text-slate mb-2 block">Per-Resident Limits</label>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="text-xs text-fog mb-1 block">Max per day</label>
                              <input
                                type="number"
                                min={1}
                                value={rules.max_bookings_per_user_per_day}
                                onChange={e => setRules(r => ({ ...r, max_bookings_per_user_per_day: Math.max(1, parseInt(e.target.value) || 1) }))}
                                className="w-full text-sm border border-border rounded-xl px-3 py-2 focus:outline-none focus:border-forest"
                              />
                            </div>
                            <div>
                              <label className="text-xs text-fog mb-1 block">Max per week</label>
                              <input
                                type="number"
                                min={1}
                                value={rules.max_bookings_per_user_per_week}
                                onChange={e => setRules(r => ({ ...r, max_bookings_per_user_per_week: Math.max(1, parseInt(e.target.value) || 1) }))}
                                className="w-full text-sm border border-border rounded-xl px-3 py-2 focus:outline-none focus:border-forest"
                              />
                            </div>
                          </div>
                        </div>

                        {/* 7. Auto-Approve */}
                        <div className="flex items-start gap-3 bg-cream rounded-xl p-3">
                          <Toggle
                            checked={rules.auto_approve}
                            onChange={v => setRules(r => ({ ...r, auto_approve: v }))}
                          />
                          <div>
                            <div className="text-xs font-medium text-ink">Auto-Approve Bookings</div>
                            <div className="text-xs text-fog mt-0.5 leading-relaxed">
                              When OFF, each booking requires manual admin approval before confirmation
                            </div>
                          </div>
                        </div>

                        {/* 8. Advance Booking */}
                        <div>
                          <label className="text-xs text-slate mb-1 block">
                            Advance Booking
                            <span className="text-fog font-normal ml-1">— How many days ahead residents can book</span>
                          </label>
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              min={1}
                              value={rules.advance_booking_days}
                              onChange={e => setRules(r => ({ ...r, advance_booking_days: Math.max(1, parseInt(e.target.value) || 1) }))}
                              className="w-24 text-sm border border-border rounded-xl px-3 py-2 focus:outline-none focus:border-forest"
                            />
                            <span className="text-xs text-fog">days</span>
                          </div>
                        </div>

                        {/* 9. Cancellation Policy */}
                        <div>
                          <label className="text-xs text-slate mb-1 block">
                            Cancellation Policy
                            <span className="text-fog font-normal ml-1">— Residents must cancel at least N hours before start</span>
                          </label>
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              min={0}
                              value={rules.cancellation_hours}
                              onChange={e => setRules(r => ({ ...r, cancellation_hours: Math.max(0, parseInt(e.target.value) || 0) }))}
                              className="w-24 text-sm border border-border rounded-xl px-3 py-2 focus:outline-none focus:border-forest"
                            />
                            <span className="text-xs text-fog">hours</span>
                          </div>
                        </div>

                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Modal footer */}
              <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border">
                <button
                  type="button"
                  onClick={closeModal}
                  className="text-sm text-slate hover:text-ink px-4 py-2 rounded-xl hover:bg-cream transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving || rules.allowed_durations.length === 0 && form.requires_booking}
                  className="bg-forest text-white text-sm font-medium px-5 py-2 rounded-xl hover:bg-deep disabled:opacity-50 transition-colors"
                >
                  {saving ? 'Saving…' : editing ? 'Save Changes' : 'Add Amenity'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
