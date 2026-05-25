'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Unit, Building, Project, City, UnitStatus } from '@/lib/types'

const STATUS_STYLES: Record<UnitStatus, string> = {
  occupied: 'bg-green-100 text-green-700',
  vacant:   'bg-gray-100 text-gray-600',
  reserved: 'bg-yellow-100 text-yellow-700',
}

const EMPTY_FORM = {
  project_id: '',
  building_id: '',
  unit_number: '',
  floor: '',
  bedrooms: '1',
  bathrooms: '1',
  living_rooms: '1',
  has_kitchen: true,
  area_sqm: '',
  description: '',
  status: 'vacant' as UnitStatus,
}

type UnitRow = Unit & {
  buildings?: Pick<Building, 'id' | 'name' | 'project_id'> & {
    projects?: Pick<Project, 'id' | 'name'>
  }
}

type BuildingWithProject = Pick<Building, 'id' | 'name' | 'project_id' | 'city_id'>

export default function UnitsPage() {
  const [units, setUnits] = useState<UnitRow[]>([])
  const [buildings, setBuildings] = useState<BuildingWithProject[]>([])
  const [projects, setProjects] = useState<Pick<Project, 'id' | 'name'>[]>([])
  const [cities, setCities] = useState<Pick<City, 'id' | 'name'>[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingUnit, setEditingUnit] = useState<UnitRow | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  const [filterProject, setFilterProject] = useState('')
  const [filterBuilding, setFilterBuilding] = useState('')
  const [filterCity, setFilterCity] = useState('')
  const [filterStatus, setFilterStatus] = useState('')

  async function load() {
    setLoading(true)
    const [u, b, p, c] = await Promise.all([
      supabase
        .from('units')
        .select('*, buildings(id, name, project_id, city_id, projects(id, name))')
        .order('unit_number'),
      supabase.from('buildings').select('id, name, project_id, city_id').order('name'),
      supabase.from('projects').select('id, name').order('name'),
      supabase.from('cities').select('id, name').order('name'),
    ])
    setUnits((u.data ?? []) as UnitRow[])
    setBuildings(b.data ?? [])
    setProjects(p.data ?? [])
    setCities(c.data ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  // When project_id changes in form, reset building_id if it doesn't belong to that project
  function handleProjectChange(pid: string) {
    const newBuilding = buildings.find(b => b.id === form.building_id && b.project_id === pid)
    setForm(f => ({ ...f, project_id: pid, building_id: newBuilding ? f.building_id : '' }))
  }

  const filteredFormBuildings = form.project_id
    ? buildings.filter(b => b.project_id === form.project_id)
    : buildings

  function openAdd() {
    setEditingUnit(null)
    setForm(EMPTY_FORM)
    setShowModal(true)
  }

  function openEdit(u: UnitRow) {
    setEditingUnit(u)
    const bld = buildings.find(b => b.id === u.building_id)
    setForm({
      project_id: u.project_id ?? bld?.project_id ?? '',
      building_id: u.building_id ?? '',
      unit_number: u.unit_number,
      floor: String(u.floor),
      bedrooms: String(u.bedrooms),
      bathrooms: String(u.bathrooms),
      living_rooms: String(u.living_rooms),
      has_kitchen: u.has_kitchen,
      area_sqm: u.area_sqm != null ? String(u.area_sqm) : '',
      description: u.description ?? '',
      status: u.status,
    })
    setShowModal(true)
  }

  function closeModal() {
    setShowModal(false)
    setEditingUnit(null)
    setForm(EMPTY_FORM)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const payload = {
      project_id: form.project_id || null,
      building_id: form.building_id || null,
      unit_number: form.unit_number,
      floor: parseInt(form.floor),
      bedrooms: parseInt(form.bedrooms),
      bathrooms: parseInt(form.bathrooms),
      living_rooms: parseInt(form.living_rooms),
      has_kitchen: form.has_kitchen,
      area_sqm: form.area_sqm ? parseFloat(form.area_sqm) : null,
      description: form.description || null,
      status: form.status,
    }
    if (editingUnit) {
      await supabase.from('units').update(payload).eq('id', editingUnit.id)
    } else {
      await supabase.from('units').insert(payload)
    }
    setSaving(false)
    closeModal()
    load()
  }

  async function deleteUnit(id: string) {
    if (!confirm('Delete this unit?')) return
    await supabase.from('units').delete().eq('id', id)
    load()
  }

  const filtered = units.filter(u => {
    const bld = buildings.find(b => b.id === u.building_id)
    if (filterProject && (u.project_id ?? bld?.project_id) !== filterProject) return false
    if (filterBuilding && u.building_id !== filterBuilding) return false
    if (filterCity && bld?.city_id !== filterCity) return false
    if (filterStatus && u.status !== filterStatus) return false
    return true
  })

  const filteredListBuildings = filterProject
    ? buildings.filter(b => b.project_id === filterProject)
    : buildings

  const totalOccupied = units.filter(u => u.status === 'occupied').length
  const totalVacant = units.filter(u => u.status === 'vacant').length
  const totalReserved = units.filter(u => u.status === 'reserved').length

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-ink">Units</h1>
          <p className="text-slate text-sm mt-1">{units.length} total units</p>
        </div>
        <button
          onClick={openAdd}
          className="bg-forest text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-deep transition-colors"
        >
          + Add Unit
        </button>
      </div>

      {/* No Buildings Warning */}
      {!loading && buildings.length === 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl px-5 py-4 text-sm text-amber-800 mb-6 flex items-center gap-3">
          <span className="text-lg">⚠️</span>
          <span>Add a building first before adding units.</span>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total', value: units.length, color: 'text-ink' },
          { label: 'Occupied', value: totalOccupied, color: 'text-green-600' },
          { label: 'Vacant', value: totalVacant, color: 'text-gray-500' },
          { label: 'Reserved', value: totalReserved, color: 'text-yellow-600' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-2xl border border-border p-5 shadow-sm">
            <p className="text-xs text-slate uppercase tracking-wide mb-1">{s.label}</p>
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <select
          value={filterProject}
          onChange={e => { setFilterProject(e.target.value); setFilterBuilding('') }}
          className="border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-forest bg-white"
        >
          <option value="">All Projects</option>
          {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <select
          value={filterBuilding}
          onChange={e => setFilterBuilding(e.target.value)}
          className="border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-forest bg-white"
        >
          <option value="">All Buildings</option>
          {filteredListBuildings.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        <select
          value={filterCity}
          onChange={e => setFilterCity(e.target.value)}
          className="border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-forest bg-white"
        >
          <option value="">All Cities</option>
          {cities.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
          className="border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-forest bg-white"
        >
          <option value="">All Statuses</option>
          <option value="vacant">Vacant</option>
          <option value="occupied">Occupied</option>
          <option value="reserved">Reserved</option>
        </select>
        {(filterProject || filterBuilding || filterCity || filterStatus) && (
          <button
            onClick={() => { setFilterProject(''); setFilterBuilding(''); setFilterCity(''); setFilterStatus('') }}
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
              <th className="px-5 py-3 text-left">Unit #</th>
              <th className="px-5 py-3 text-left">Building</th>
              <th className="px-5 py-3 text-left">Project</th>
              <th className="px-5 py-3 text-left">Floor</th>
              <th className="px-5 py-3 text-left">Beds / Baths / Living</th>
              <th className="px-5 py-3 text-left">Area</th>
              <th className="px-5 py-3 text-left">Kitchen</th>
              <th className="px-5 py-3 text-left">Status</th>
              <th className="px-5 py-3 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={9} className="px-6 py-10 text-center text-slate">Loading...</td></tr>
            )}
            {!loading && filtered.map(u => {
              const bld = buildings.find(b => b.id === u.building_id)
              const proj = projects.find(p => p.id === (u.project_id ?? bld?.project_id))
              return (
                <tr key={u.id} className="border-b border-border last:border-0 hover:bg-cream/40 transition-colors">
                  <td className="px-5 py-3 font-semibold text-ink">{u.unit_number}</td>
                  <td className="px-5 py-3 text-slate">{u.buildings?.name ?? '—'}</td>
                  <td className="px-5 py-3 text-slate">{proj?.name ?? '—'}</td>
                  <td className="px-5 py-3">{u.floor}</td>
                  <td className="px-5 py-3 text-slate">
                    {u.bedrooms}BR / {u.bathrooms}BA / {u.living_rooms}LR
                  </td>
                  <td className="px-5 py-3">{u.area_sqm != null ? `${u.area_sqm} m²` : '—'}</td>
                  <td className="px-5 py-3 text-center">
                    {u.has_kitchen ? (
                      <span className="text-green-600 font-bold">✓</span>
                    ) : (
                      <span className="text-gray-400">✗</span>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${STATUS_STYLES[u.status]}`}>
                      {u.status}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex gap-3">
                      <button
                        onClick={() => openEdit(u)}
                        className="text-forest hover:text-deep text-xs font-medium"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => deleteUnit(u.id)}
                        className="text-red-400 hover:text-red-600 text-xs font-medium"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
            {!loading && filtered.length === 0 && (
              <tr>
                <td colSpan={9} className="px-6 py-10 text-center text-slate">
                  {units.length === 0 ? 'No units yet — add one to get started.' : 'No units match the selected filters.'}
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
              {editingUnit ? 'Edit Unit' : 'Add Unit'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="text-xs text-slate mb-1 block">Project <span className="text-red-400">*</span></label>
                <select
                  required
                  value={form.project_id}
                  onChange={e => handleProjectChange(e.target.value)}
                  className="w-full border border-border rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-forest"
                >
                  <option value="">Select Project</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-slate mb-1 block">Building <span className="text-red-400">*</span></label>
                <select
                  required
                  value={form.building_id}
                  onChange={e => setForm(f => ({ ...f, building_id: e.target.value }))}
                  className="w-full border border-border rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-forest"
                >
                  <option value="">Select Building</option>
                  {filteredFormBuildings.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate mb-1 block">Unit Number <span className="text-red-400">*</span></label>
                  <input
                    required
                    placeholder="e.g. 12B"
                    value={form.unit_number}
                    onChange={e => setForm(f => ({ ...f, unit_number: e.target.value }))}
                    className="w-full border border-border rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-forest"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate mb-1 block">Floor <span className="text-red-400">*</span></label>
                  <input
                    required
                    type="number"
                    placeholder="e.g. 5"
                    value={form.floor}
                    onChange={e => setForm(f => ({ ...f, floor: e.target.value }))}
                    className="w-full border border-border rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-forest"
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs text-slate mb-1 block">Bedrooms</label>
                  <input
                    type="number"
                    min="0"
                    value={form.bedrooms}
                    onChange={e => setForm(f => ({ ...f, bedrooms: e.target.value }))}
                    className="w-full border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-forest"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate mb-1 block">Bathrooms</label>
                  <input
                    type="number"
                    min="0"
                    value={form.bathrooms}
                    onChange={e => setForm(f => ({ ...f, bathrooms: e.target.value }))}
                    className="w-full border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-forest"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate mb-1 block">Living Rooms</label>
                  <input
                    type="number"
                    min="0"
                    value={form.living_rooms}
                    onChange={e => setForm(f => ({ ...f, living_rooms: e.target.value }))}
                    className="w-full border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-forest"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 items-end">
                <div>
                  <label className="text-xs text-slate mb-1 block">Area (m²)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="e.g. 120"
                    value={form.area_sqm}
                    onChange={e => setForm(f => ({ ...f, area_sqm: e.target.value }))}
                    className="w-full border border-border rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-forest"
                  />
                </div>
                <label className="flex items-center gap-2 cursor-pointer pb-2">
                  <input
                    type="checkbox"
                    checked={form.has_kitchen}
                    onChange={e => setForm(f => ({ ...f, has_kitchen: e.target.checked }))}
                    className="w-4 h-4 accent-forest"
                  />
                  <span className="text-sm text-ink">Has Kitchen</span>
                </label>
              </div>
              <div>
                <label className="text-xs text-slate mb-1 block">Description</label>
                <textarea
                  rows={2}
                  placeholder="Optional notes..."
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  className="w-full border border-border rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-forest resize-none"
                />
              </div>
              <div>
                <label className="text-xs text-slate mb-1 block">Status</label>
                <select
                  value={form.status}
                  onChange={e => setForm(f => ({ ...f, status: e.target.value as UnitStatus }))}
                  className="w-full border border-border rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-forest"
                >
                  <option value="vacant">Vacant</option>
                  <option value="occupied">Occupied</option>
                  <option value="reserved">Reserved</option>
                </select>
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
                  {saving ? 'Saving...' : editingUnit ? 'Save Changes' : 'Add Unit'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
