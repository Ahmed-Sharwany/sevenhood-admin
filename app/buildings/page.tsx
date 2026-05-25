'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Building, Project, City } from '@/lib/types'
import ImageUpload from '@/components/ImageUpload'

const EMPTY_FORM = {
  project_id: '',
  city_id: '',
  name: '',
  description: '',
  floors: '',
  units_count: '',
  image_url: '',
}

type BuildingRow = Building & {
  projects?: Pick<Project, 'id' | 'name'>
  cities?: Pick<City, 'id' | 'name'>
}

export default function BuildingsPage() {
  const [buildings, setBuildings] = useState<BuildingRow[]>([])
  const [projects, setProjects] = useState<Pick<Project, 'id' | 'name'>[]>([])
  const [cities, setCities] = useState<Pick<City, 'id' | 'name'>[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingBuilding, setEditingBuilding] = useState<BuildingRow | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [filterProject, setFilterProject] = useState('')
  const [filterCity, setFilterCity] = useState('')

  async function load() {
    setLoading(true)
    const [b, p, c] = await Promise.all([
      supabase
        .from('buildings')
        .select('*, projects(id, name), cities(id, name)')
        .order('name'),
      supabase.from('projects').select('id, name').order('name'),
      supabase.from('cities').select('id, name').order('name'),
    ])
    setBuildings((b.data ?? []) as BuildingRow[])
    setProjects(p.data ?? [])
    setCities(c.data ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  function openAdd() {
    setEditingBuilding(null)
    setForm(EMPTY_FORM)
    setShowModal(true)
  }

  function openEdit(b: BuildingRow) {
    setEditingBuilding(b)
    setForm({
      project_id: b.project_id ?? '',
      city_id: b.city_id ?? '',
      name: b.name,
      description: b.description ?? '',
      floors: b.floors != null ? String(b.floors) : '',
      units_count: String(b.units_count ?? ''),
      image_url: b.image_url ?? '',
    })
    setShowModal(true)
  }

  function closeModal() {
    setShowModal(false)
    setEditingBuilding(null)
    setForm(EMPTY_FORM)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const payload = {
      project_id: form.project_id || null,
      city_id: form.city_id || null,
      name: form.name,
      description: form.description || null,
      floors: form.floors ? parseInt(form.floors) : null,
      units_count: form.units_count ? parseInt(form.units_count) : 0,
      image_url: form.image_url || null,
    }
    if (editingBuilding) {
      await supabase.from('buildings').update(payload).eq('id', editingBuilding.id)
    } else {
      await supabase.from('buildings').insert(payload)
    }
    setSaving(false)
    closeModal()
    load()
  }

  async function deleteBuilding(id: string) {
    if (!confirm('Delete this building? This will also remove its units.')) return
    await supabase.from('buildings').delete().eq('id', id)
    load()
  }

  const filtered = buildings.filter(b => {
    if (filterProject && b.project_id !== filterProject) return false
    if (filterCity && b.city_id !== filterCity) return false
    return true
  })

  const totalFloors = buildings.reduce((s, b) => s + (b.floors ?? 0), 0)
  const avgUnits = buildings.length > 0
    ? Math.round(buildings.reduce((s, b) => s + (b.units_count ?? 0), 0) / buildings.length)
    : 0

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-ink">Buildings</h1>
          <p className="text-slate text-sm mt-1">{buildings.length} total buildings</p>
        </div>
        <button
          onClick={openAdd}
          className="bg-forest text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-deep transition-colors"
        >
          + Add Building
        </button>
      </div>

      {/* No Projects Warning */}
      {!loading && projects.length === 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl px-5 py-4 text-sm text-amber-800 mb-6 flex items-center gap-3">
          <span className="text-lg">⚠️</span>
          <span>Add a project first before adding buildings.</span>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: 'Total Buildings', value: buildings.length },
          { label: 'Total Floors', value: totalFloors },
          { label: 'Avg Units / Building', value: avgUnits },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-2xl border border-border p-5 shadow-sm">
            <p className="text-xs text-slate uppercase tracking-wide mb-1">{s.label}</p>
            <p className="text-2xl font-bold text-ink">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-4">
        <select
          value={filterProject}
          onChange={e => setFilterProject(e.target.value)}
          className="border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-forest bg-white"
        >
          <option value="">All Projects</option>
          {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <select
          value={filterCity}
          onChange={e => setFilterCity(e.target.value)}
          className="border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-forest bg-white"
        >
          <option value="">All Cities</option>
          {cities.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        {(filterProject || filterCity) && (
          <button
            onClick={() => { setFilterProject(''); setFilterCity('') }}
            className="text-xs text-slate hover:text-ink border border-border rounded-xl px-3 py-2 bg-white"
          >
            Clear
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-slate text-xs uppercase tracking-wide border-b border-border bg-cream/50">
              <th className="px-6 py-3 text-left">Building Name</th>
              <th className="px-6 py-3 text-left">Project</th>
              <th className="px-6 py-3 text-left">City</th>
              <th className="px-6 py-3 text-left">Floors</th>
              <th className="px-6 py-3 text-left">Units Count</th>
              <th className="px-6 py-3 text-left">Description</th>
              <th className="px-6 py-3 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={7} className="px-6 py-10 text-center text-slate">Loading...</td></tr>
            )}
            {!loading && filtered.map(b => (
              <tr key={b.id} className="border-b border-border last:border-0 hover:bg-cream/40 transition-colors">
                <td className="px-6 py-3 font-semibold text-ink">{b.name}</td>
                <td className="px-6 py-3 text-slate">{b.projects?.name ?? '—'}</td>
                <td className="px-6 py-3 text-slate">{b.cities?.name ?? '—'}</td>
                <td className="px-6 py-3">{b.floors != null ? `${b.floors}` : '—'}</td>
                <td className="px-6 py-3">{b.units_count ?? 0}</td>
                <td className="px-6 py-3 text-slate max-w-[200px]">
                  <span className="block truncate">{b.description ?? '—'}</span>
                </td>
                <td className="px-6 py-3">
                  <div className="flex gap-3">
                    <button
                      onClick={() => openEdit(b)}
                      className="text-forest hover:text-deep text-xs font-medium"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => deleteBuilding(b.id)}
                      className="text-red-400 hover:text-red-600 text-xs font-medium"
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {!loading && filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="px-6 py-10 text-center text-slate">
                  {buildings.length === 0 ? 'No buildings yet — add one to get started.' : 'No buildings match the selected filters.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl max-h-[90vh] overflow-y-auto">
            <h2 className="font-bold text-lg text-ink mb-5">
              {editingBuilding ? 'Edit Building' : 'Add Building'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="text-xs text-slate mb-1 block">Project <span className="text-red-400">*</span></label>
                <select
                  required
                  value={form.project_id}
                  onChange={e => setForm(f => ({ ...f, project_id: e.target.value }))}
                  className="w-full border border-border rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-forest"
                >
                  <option value="">Select Project</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-slate mb-1 block">City</label>
                <select
                  value={form.city_id}
                  onChange={e => setForm(f => ({ ...f, city_id: e.target.value }))}
                  className="w-full border border-border rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-forest"
                >
                  <option value="">Select City</option>
                  {cities.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-slate mb-1 block">Building Name <span className="text-red-400">*</span></label>
                <input
                  required
                  placeholder="e.g. Tower A"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full border border-border rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-forest"
                />
              </div>
              <div>
                <label className="text-xs text-slate mb-1 block">Description</label>
                <textarea
                  rows={3}
                  placeholder="Optional description..."
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  className="w-full border border-border rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-forest resize-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate mb-1 block">Floors</label>
                  <input
                    type="number"
                    min="1"
                    placeholder="e.g. 12"
                    value={form.floors}
                    onChange={e => setForm(f => ({ ...f, floors: e.target.value }))}
                    className="w-full border border-border rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-forest"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate mb-1 block">Units Count</label>
                  <input
                    type="number"
                    min="0"
                    placeholder="e.g. 48"
                    value={form.units_count}
                    onChange={e => setForm(f => ({ ...f, units_count: e.target.value }))}
                    className="w-full border border-border rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-forest"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs text-slate mb-1 block uppercase tracking-wide font-semibold">Building Image</label>
                <ImageUpload
                  value={form.image_url}
                  onChange={url => setForm(f => ({ ...f, image_url: url }))}
                  folder="buildings"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 border border-border rounded-xl py-2 text-sm hover:bg-cream transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 bg-forest text-white rounded-xl py-2 text-sm font-medium disabled:opacity-50 hover:bg-deep transition-colors"
                >
                  {saving ? 'Saving...' : editingBuilding ? 'Save Changes' : 'Add Building'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
