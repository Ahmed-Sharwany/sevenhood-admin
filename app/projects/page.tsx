'use client'

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { supabase } from '@/lib/supabase'
import type { Project, City, ProjectStatus } from '@/lib/types'
import ImageUpload from '@/components/ImageUpload'

const MapPicker = dynamic(() => import('@/components/MapPicker'), { ssr: false })

const AMENITY_OPTIONS = [
  'Pool', 'Gym', 'Parking', 'Security', 'Concierge',
  'Garden', 'Playground', 'Mosque', 'Retail', 'Co-working',
]

const STATUS_OPTIONS: ProjectStatus[] = ['active', 'inactive', 'pending']

interface FormState {
  name: string
  city_id: string
  owner_name: string
  owner_company: string
  location: string
  description: string
  amenities: string[]
  image_url: string
  contract_start: string
  contract_end: string
  monthly_fee: string
  status: ProjectStatus
  lat: number | null
  lng: number | null
}

const EMPTY_FORM: FormState = {
  name: '',
  city_id: '',
  owner_name: '',
  owner_company: '',
  location: '',
  description: '',
  amenities: [],
  image_url: '',
  contract_start: '',
  contract_end: '',
  monthly_fee: '',
  status: 'active',
  lat: null,
  lng: null,
}

const STATUS_BADGE: Record<ProjectStatus, string> = {
  active:   'bg-green-100 text-green-700',
  inactive: 'bg-gray-100 text-gray-500',
  pending:  'bg-yellow-100 text-yellow-700',
}

function ProjectImage({ url, name }: { url: string | null; name: string }) {
  const colors = [
    'bg-forest', 'bg-deep', 'bg-garden', 'bg-sage',
    'bg-gold', 'bg-amber', 'bg-slate',
  ]
  const color = colors[name.charCodeAt(0) % colors.length]
  if (url) {
    return (
      <img
        src={url}
        alt={name}
        className="w-12 h-12 rounded-xl object-cover border border-border"
        onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
      />
    )
  }
  return (
    <div className={`w-12 h-12 rounded-xl ${color} flex items-center justify-center text-white font-bold text-lg flex-shrink-0`}>
      {name.charAt(0).toUpperCase()}
    </div>
  )
}

function AmenityChips({ amenities }: { amenities: string[] }) {
  if (!amenities || amenities.length === 0) return <span className="text-fog text-xs">—</span>
  const visible = amenities.slice(0, 3)
  const extra = amenities.length - 3
  return (
    <div className="flex flex-wrap gap-1">
      {visible.map(a => (
        <span key={a} className="bg-mist text-forest text-xs px-2 py-0.5 rounded-full font-medium">{a}</span>
      ))}
      {extra > 0 && (
        <span className="bg-sand text-slate text-xs px-2 py-0.5 rounded-full font-medium">+{extra} more</span>
      )}
    </div>
  )
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [cities, setCities] = useState<City[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingProject, setEditingProject] = useState<Project | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  // Filters
  const [filterCity, setFilterCity] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [search, setSearch] = useState('')

  async function loadCities() {
    const { data } = await supabase.from('cities').select('id,name').order('name')
    setCities((data as City[]) ?? [])
  }

  async function loadProjects() {
    setLoading(true)
    const { data } = await supabase
      .from('projects')
      .select('*, cities(name)')
      .order('name')
    setProjects((data as Project[]) ?? [])
    setLoading(false)
  }

  useEffect(() => {
    loadCities()
    loadProjects()
  }, [])

  function openAdd() {
    setEditingProject(null)
    setForm(EMPTY_FORM)
    setShowModal(true)
  }

  function openEdit(p: Project) {
    setEditingProject(p)
    setForm({
      name: p.name,
      city_id: p.city_id ?? '',
      owner_name: p.owner_name ?? '',
      owner_company: p.owner_company ?? '',
      location: p.location ?? '',
      description: p.description ?? '',
      amenities: p.amenities ?? [],
      image_url: p.image_url ?? '',
      contract_start: p.contract_start ?? '',
      contract_end: p.contract_end ?? '',
      monthly_fee: p.monthly_fee?.toString() ?? '',
      status: p.status,
      lat: (p as any).lat ?? null,
      lng: (p as any).lng ?? null,
    })
    setShowModal(true)
  }

  function toggleAmenity(a: string) {
    setForm(f => ({
      ...f,
      amenities: f.amenities.includes(a)
        ? f.amenities.filter(x => x !== a)
        : [...f.amenities, a],
    }))
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const payload = {
      name: form.name,
      city_id: form.city_id || null,
      owner_name: form.owner_name || null,
      owner_company: form.owner_company || null,
      location: form.location || null,
      description: form.description || null,
      amenities: form.amenities,
      image_url: form.image_url || null,
      contract_start: form.contract_start || null,
      contract_end: form.contract_end || null,
      monthly_fee: form.monthly_fee ? parseFloat(form.monthly_fee) : 0,
      status: form.status,
      lat: form.lat,
      lng: form.lng,
    }
    if (editingProject) {
      await supabase.from('projects').update(payload).eq('id', editingProject.id)
    } else {
      await supabase.from('projects').insert(payload)
    }
    setSaving(false)
    setShowModal(false)
    loadProjects()
  }

  async function deleteProject(id: string) {
    if (!confirm('Delete this project? This will also affect its buildings and units.')) return
    await supabase.from('projects').delete().eq('id', id)
    loadProjects()
  }

  const filtered = projects.filter(p => {
    if (filterCity && p.city_id !== filterCity) return false
    if (filterStatus && p.status !== filterStatus) return false
    if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  // Stats
  const totalProjects = projects.length
  const activeProjects = projects.filter(p => p.status === 'active').length
  const totalRevenue = projects.reduce((sum, p) => sum + (p.monthly_fee ?? 0) * (p.total_units ?? 0), 0)
  const cityCount = new Set(projects.map(p => p.city_id).filter(Boolean)).size

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-ink">Projects</h1>
          <p className="text-slate text-sm mt-1">Manage all platform projects and contracts</p>
        </div>
        <button
          onClick={openAdd}
          className="bg-forest text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-deep transition-colors"
        >
          + Add Project
        </button>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-forest text-white rounded-2xl p-5 border border-border shadow-sm">
          <div className="text-3xl font-bold mb-1">{totalProjects}</div>
          <div className="font-semibold text-sm">Total Projects</div>
          <div className="text-xs opacity-70 mt-1">across all cities</div>
        </div>
        <div className="bg-white rounded-2xl p-5 border border-border shadow-sm">
          <div className="text-3xl font-bold text-ink mb-1">{activeProjects}</div>
          <div className="font-semibold text-sm text-ink">Active</div>
          <div className="text-xs text-slate mt-1">live on platform</div>
        </div>
        <div className="bg-white rounded-2xl p-5 border border-border shadow-sm">
          <div className="text-3xl font-bold text-ink mb-1">
            {totalRevenue >= 1000 ? `${(totalRevenue / 1000).toFixed(0)}K` : totalRevenue.toLocaleString()}
          </div>
          <div className="font-semibold text-sm text-ink">Monthly Revenue</div>
          <div className="text-xs text-slate mt-1">AED · fee × units</div>
        </div>
        <div className="bg-gold text-white rounded-2xl p-5 border border-border shadow-sm">
          <div className="text-3xl font-bold mb-1">{cityCount}</div>
          <div className="font-semibold text-sm">Cities</div>
          <div className="text-xs opacity-70 mt-1">coverage</div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white rounded-2xl border border-border shadow-sm px-5 py-4 mb-4 flex gap-3 items-center">
        <input
          type="text"
          placeholder="Search by project name..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="flex-1 border border-border rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-forest"
        />
        <select
          value={filterCity}
          onChange={e => setFilterCity(e.target.value)}
          className="border border-border rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-forest bg-white min-w-[160px]"
        >
          <option value="">All Cities</option>
          {cities.map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
          className="border border-border rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-forest bg-white min-w-[140px]"
        >
          <option value="">All Statuses</option>
          {STATUS_OPTIONS.map(s => (
            <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
          ))}
        </select>
        {(search || filterCity || filterStatus) && (
          <button
            onClick={() => { setSearch(''); setFilterCity(''); setFilterStatus('') }}
            className="text-slate text-sm hover:text-ink px-3 py-2 rounded-xl border border-border"
          >
            Clear
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-slate text-xs uppercase tracking-wide border-b border-border bg-cream/60">
              <th className="px-5 py-3 text-left">Image</th>
              <th className="px-5 py-3 text-left">Project Name</th>
              <th className="px-5 py-3 text-left">City</th>
              <th className="px-5 py-3 text-left">Owner / Company</th>
              <th className="px-5 py-3 text-left">Amenities</th>
              <th className="px-5 py-3 text-right">Monthly Fee</th>
              <th className="px-5 py-3 text-left">Status</th>
              <th className="px-5 py-3 text-left">Contract End</th>
              <th className="px-5 py-3 text-right">Units</th>
              <th className="px-5 py-3 text-center">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={10} className="px-5 py-10 text-center text-slate">Loading projects...</td>
              </tr>
            )}
            {!loading && filtered.length === 0 && (
              <tr>
                <td colSpan={10} className="px-5 py-10 text-center text-slate">
                  {projects.length === 0 ? 'No projects yet — add your first project above' : 'No projects match your filters'}
                </td>
              </tr>
            )}
            {!loading && filtered.map(p => (
              <tr key={p.id} className="border-b border-border last:border-0 hover:bg-cream/40 transition-colors">
                <td className="px-5 py-3">
                  <ProjectImage url={p.image_url} name={p.name} />
                </td>
                <td className="px-5 py-3">
                  <div className="font-semibold text-ink">{p.name}</div>
                  {p.location && <div className="text-xs text-slate mt-0.5 truncate max-w-[160px]">{p.location}</div>}
                </td>
                <td className="px-5 py-3 text-slate">
                  {(p as any).cities?.name ?? '—'}
                </td>
                <td className="px-5 py-3">
                  <div className="text-ink font-medium">{p.owner_name ?? '—'}</div>
                  {p.owner_company && <div className="text-xs text-slate">{p.owner_company}</div>}
                </td>
                <td className="px-5 py-3">
                  <AmenityChips amenities={p.amenities ?? []} />
                </td>
                <td className="px-5 py-3 text-right font-semibold text-ink">
                  {p.monthly_fee ? `AED ${p.monthly_fee.toLocaleString()}` : '—'}
                </td>
                <td className="px-5 py-3">
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${STATUS_BADGE[p.status]}`}>
                    {p.status.charAt(0).toUpperCase() + p.status.slice(1)}
                  </span>
                </td>
                <td className="px-5 py-3 text-slate text-xs">
                  {p.contract_end ? new Date(p.contract_end).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                </td>
                <td className="px-5 py-3 text-right font-semibold text-ink">
                  {p.total_units ?? 0}
                </td>
                <td className="px-5 py-3">
                  <div className="flex items-center justify-center gap-2">
                    <button
                      onClick={() => openEdit(p)}
                      className="text-xs font-medium text-forest border border-forest px-3 py-1 rounded-lg hover:bg-forest hover:text-white transition-colors"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => deleteProject(p.id)}
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
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="px-7 py-5 border-b border-border flex items-center justify-between sticky top-0 bg-white rounded-t-2xl">
              <h2 className="font-bold text-lg text-ink">
                {editingProject ? 'Edit Project' : 'Add Project'}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="text-slate hover:text-ink text-xl leading-none"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSave} className="px-7 py-5 space-y-5">
              {/* Name + City */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate mb-1.5 uppercase tracking-wide">Project Name *</label>
                  <input
                    required
                    placeholder="e.g. Sevenhood Tower"
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    className="w-full border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-forest"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate mb-1.5 uppercase tracking-wide">City</label>
                  <select
                    value={form.city_id}
                    onChange={e => setForm(f => ({ ...f, city_id: e.target.value }))}
                    className="w-full border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-forest bg-white"
                  >
                    <option value="">Select city…</option>
                    {cities.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Owner */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate mb-1.5 uppercase tracking-wide">Owner Name</label>
                  <input
                    placeholder="e.g. Ahmed Al-Rashid"
                    value={form.owner_name}
                    onChange={e => setForm(f => ({ ...f, owner_name: e.target.value }))}
                    className="w-full border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-forest"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate mb-1.5 uppercase tracking-wide">Owner Company</label>
                  <input
                    placeholder="e.g. Al-Rashid Real Estate"
                    value={form.owner_company}
                    onChange={e => setForm(f => ({ ...f, owner_company: e.target.value }))}
                    className="w-full border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-forest"
                  />
                </div>
              </div>

              {/* Location */}
              <div>
                <label className="block text-xs font-semibold text-slate mb-1.5 uppercase tracking-wide">Location (Address)</label>
                <input
                  placeholder="e.g. King Fahd Road, Al Olaya, Riyadh"
                  value={form.location}
                  onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
                  className="w-full border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-forest"
                />
              </div>

              {/* Map */}
              <div>
                <label className="block text-xs font-semibold text-slate mb-1.5 uppercase tracking-wide">Pin on Map</label>
                <MapPicker
                  lat={form.lat}
                  lng={form.lng}
                  onChange={(lat, lng) => setForm(f => ({ ...f, lat, lng }))}
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-semibold text-slate mb-1.5 uppercase tracking-wide">Description</label>
                <textarea
                  placeholder="Brief description of the project..."
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  rows={3}
                  className="w-full border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-forest resize-none"
                />
              </div>

              {/* Amenities */}
              <div>
                <label className="block text-xs font-semibold text-slate mb-2 uppercase tracking-wide">Amenities</label>
                <div className="flex flex-wrap gap-2">
                  {AMENITY_OPTIONS.map(a => (
                    <button
                      key={a}
                      type="button"
                      onClick={() => toggleAmenity(a)}
                      className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                        form.amenities.includes(a)
                          ? 'bg-forest text-white border-forest'
                          : 'bg-white text-slate border-border hover:border-forest hover:text-forest'
                      }`}
                    >
                      {a}
                    </button>
                  ))}
                </div>
              </div>

              {/* Image Upload */}
              <div>
                <label className="block text-xs font-semibold text-slate mb-1.5 uppercase tracking-wide">Project Image</label>
                <ImageUpload
                  value={form.image_url}
                  onChange={url => setForm(f => ({ ...f, image_url: url }))}
                  folder="projects"
                />
              </div>

              {/* Contract + Fee */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate mb-1.5 uppercase tracking-wide">Contract Start</label>
                  <input
                    type="date"
                    value={form.contract_start}
                    onChange={e => setForm(f => ({ ...f, contract_start: e.target.value }))}
                    className="w-full border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-forest"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate mb-1.5 uppercase tracking-wide">Contract End</label>
                  <input
                    type="date"
                    value={form.contract_end}
                    onChange={e => setForm(f => ({ ...f, contract_end: e.target.value }))}
                    className="w-full border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-forest"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate mb-1.5 uppercase tracking-wide">Monthly Fee (AED)</label>
                  <input
                    type="number"
                    min="0"
                    placeholder="0"
                    value={form.monthly_fee}
                    onChange={e => setForm(f => ({ ...f, monthly_fee: e.target.value }))}
                    className="w-full border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-forest"
                  />
                </div>
              </div>

              {/* Status */}
              <div>
                <label className="block text-xs font-semibold text-slate mb-1.5 uppercase tracking-wide">Status</label>
                <select
                  value={form.status}
                  onChange={e => setForm(f => ({ ...f, status: e.target.value as ProjectStatus }))}
                  className="w-full border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-forest bg-white"
                >
                  {STATUS_OPTIONS.map(s => (
                    <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                  ))}
                </select>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-2 pb-1">
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
                  {saving ? 'Saving…' : editingProject ? 'Save Changes' : 'Add Project'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
