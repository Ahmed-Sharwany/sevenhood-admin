'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { MaintenanceTicket, Project, Building, Unit, Resident, ServiceProvider } from '@/lib/types'

// ─── Constants ──────────────────────────────────────────────────────────────

const CATEGORIES = ['AC & Cooling', 'Plumbing', 'Electrical', 'Cleaning', 'Doors & Windows', 'Other']

const STATUS_STYLES: Record<string, string> = {
  open:        'bg-red-100 text-red-700',
  in_progress: 'bg-yellow-100 text-yellow-700',
  completed:   'bg-green-100 text-green-700',
  cancelled:   'bg-gray-100 text-gray-500',
}
const PRIORITY_STYLES: Record<string, string> = {
  high:   'bg-red-50 text-red-600 border border-red-200',
  medium: 'bg-orange-50 text-orange-600 border border-orange-200',
  low:    'bg-gray-50 text-gray-500 border border-gray-200',
}

const INPUT_CLS = 'w-full border border-border rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-forest bg-white'
const SELECT_CLS = 'border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-forest bg-white'

// ─── Types ───────────────────────────────────────────────────────────────────

type TicketRow = MaintenanceTicket & {
  units?: Pick<Unit, 'unit_number'>
  residents?: Pick<Resident, 'full_name'>
  service_providers?: Pick<ServiceProvider, 'name'>
  projects?: Pick<Project, 'name'>
}

interface Filters {
  status: string
  category: string
  project_id: string
  building_id: string
  unit_id: string
  resident_id: string
  provider_id: string
  date_from: string
  date_to: string
}

const EMPTY_FILTERS: Filters = {
  status: '', category: '', project_id: '', building_id: '',
  unit_id: '', resident_id: '', provider_id: '', date_from: '', date_to: '',
}

interface AddForm {
  project_id: string
  building_id: string
  unit_id: string
  resident_id: string
  category: string
  description: string
  priority: string
  service_provider_id: string
  preferred_time: string
}

interface EditForm {
  status: string
  category: string
  description: string
  priority: string
  service_provider_id: string
  preferred_time: string
  eta: string
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function TicketsPage() {
  const [tickets, setTickets]       = useState<TicketRow[]>([])
  const [projects, setProjects]     = useState<Pick<Project, 'id' | 'name'>[]>([])
  const [buildings, setBuildings]   = useState<Pick<Building, 'id' | 'name' | 'project_id'>[]>([])
  const [units, setUnits]           = useState<Pick<Unit, 'id' | 'unit_number' | 'building_id' | 'project_id'>[]>([])
  const [residents, setResidents]   = useState<Pick<Resident, 'id' | 'full_name' | 'unit_id'>[]>([])
  const [providers, setProviders]   = useState<Pick<ServiceProvider, 'id' | 'name'>[]>([])
  const [loading, setLoading]       = useState(true)
  const [filters, setFilters]       = useState<Filters>(EMPTY_FILTERS)
  const [showAddModal, setShowAddModal]   = useState(false)
  const [editingTicket, setEditingTicket] = useState<TicketRow | null>(null)
  const [saving, setSaving]         = useState(false)

  const [addForm, setAddForm] = useState<AddForm>({
    project_id: '', building_id: '', unit_id: '', resident_id: '',
    category: 'AC & Cooling', description: '', priority: 'medium',
    service_provider_id: '', preferred_time: '',
  })
  const [editForm, setEditForm] = useState<EditForm>({
    status: '', category: '', description: '', priority: '',
    service_provider_id: '', preferred_time: '', eta: '',
  })

  // ── Load ──────────────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    setLoading(true)
    const [t, p, b, u, r, sp] = await Promise.all([
      supabase
        .from('maintenance_tickets')
        .select('*, units(unit_number), residents(full_name), service_providers(name), projects(name)')
        .order('created_at', { ascending: false }),
      supabase.from('projects').select('id, name').order('name'),
      supabase.from('buildings').select('id, name, project_id').order('name'),
      supabase.from('units').select('id, unit_number, building_id, project_id').order('unit_number'),
      supabase.from('residents').select('id, full_name, unit_id').order('full_name'),
      supabase.from('service_providers').select('id, name').order('name'),
    ])
    if (t.error) console.error(t.error)
    setTickets(t.data ?? [])
    setProjects(p.data ?? [])
    setBuildings(b.data ?? [])
    setUnits(u.data ?? [])
    setResidents(r.data ?? [])
    setProviders(sp.data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  // ── Filter logic ──────────────────────────────────────────────────────────

  const filtered = tickets.filter(t => {
    if (filters.status && t.status !== filters.status) return false
    if (filters.category && t.category !== filters.category) return false
    if (filters.project_id && t.project_id !== filters.project_id) return false
    if (filters.building_id && t.building_id !== filters.building_id) return false
    if (filters.unit_id && t.unit_id !== filters.unit_id) return false
    if (filters.resident_id && t.resident_id !== filters.resident_id) return false
    if (filters.provider_id && t.service_provider_id !== filters.provider_id) return false
    if (filters.date_from && t.created_at < filters.date_from) return false
    if (filters.date_to && t.created_at > filters.date_to + 'T23:59:59') return false
    return true
  })

  // ── Add ───────────────────────────────────────────────────────────────────

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const { error } = await supabase.from('maintenance_tickets').insert({
      project_id:          addForm.project_id || null,
      building_id:         addForm.building_id || null,
      unit_id:             addForm.unit_id || null,
      resident_id:         addForm.resident_id || null,
      category:            addForm.category,
      description:         addForm.description,
      priority:            addForm.priority,
      service_provider_id: addForm.service_provider_id || null,
      preferred_time:      addForm.preferred_time || null,
      status:              'open',
    })
    if (error) console.error(error)
    setSaving(false)
    setShowAddModal(false)
    setAddForm({ project_id: '', building_id: '', unit_id: '', resident_id: '', category: 'AC & Cooling', description: '', priority: 'medium', service_provider_id: '', preferred_time: '' })
    load()
  }

  // ── Edit ──────────────────────────────────────────────────────────────────

  function openEdit(ticket: TicketRow) {
    setEditingTicket(ticket)
    setEditForm({
      status:              ticket.status,
      category:            ticket.category,
      description:         ticket.description,
      priority:            ticket.priority,
      service_provider_id: ticket.service_provider_id ?? '',
      preferred_time:      ticket.preferred_time ?? '',
      eta:                 ticket.eta ?? '',
    })
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault()
    if (!editingTicket) return
    setSaving(true)
    const { error } = await supabase
      .from('maintenance_tickets')
      .update({
        status:              editForm.status,
        category:            editForm.category,
        description:         editForm.description,
        priority:            editForm.priority,
        service_provider_id: editForm.service_provider_id || null,
        preferred_time:      editForm.preferred_time || null,
        eta:                 editForm.eta || null,
        updated_at:          new Date().toISOString(),
      })
      .eq('id', editingTicket.id)
    if (error) console.error(error)
    setSaving(false)
    setEditingTicket(null)
    load()
  }

  // ── Delete ────────────────────────────────────────────────────────────────

  async function handleDelete(id: string) {
    if (!confirm('Delete this ticket?')) return
    const { error } = await supabase.from('maintenance_tickets').delete().eq('id', id)
    if (error) console.error(error)
    else load()
  }

  // ── Derived filter options ────────────────────────────────────────────────

  const filteredBuildings = filters.project_id
    ? buildings.filter(b => b.project_id === filters.project_id)
    : buildings
  const filteredUnits = filters.building_id
    ? units.filter(u => u.building_id === filters.building_id)
    : filters.project_id
    ? units.filter(u => u.project_id === filters.project_id)
    : units

  const addFormBuildings = addForm.project_id
    ? buildings.filter(b => b.project_id === addForm.project_id)
    : buildings
  const addFormUnits = addForm.building_id
    ? units.filter(u => u.building_id === addForm.building_id)
    : addForm.project_id
    ? units.filter(u => u.project_id === addForm.project_id)
    : units
  const addFormResidents = addForm.unit_id
    ? residents.filter(r => r.unit_id === addForm.unit_id)
    : residents

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-ink">Maintenance Tickets</h1>
          <p className="text-slate text-sm mt-1">
            {tickets.filter(t => t.status === 'open').length} open &middot;{' '}
            {tickets.filter(t => t.status === 'in_progress').length} in progress &middot;{' '}
            {tickets.length} total
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="bg-forest text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-deep transition-colors"
        >
          + New Ticket
        </button>
      </div>

      {/* Filter Bar */}
      <div className="bg-white rounded-2xl border border-border p-4 mb-5 flex flex-wrap gap-3">
        <select
          value={filters.status}
          onChange={e => setFilters(f => ({ ...f, status: e.target.value }))}
          className={SELECT_CLS}
        >
          <option value="">All Statuses</option>
          <option value="open">Open</option>
          <option value="in_progress">In Progress</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </select>

        <select
          value={filters.category}
          onChange={e => setFilters(f => ({ ...f, category: e.target.value }))}
          className={SELECT_CLS}
        >
          <option value="">All Categories</option>
          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>

        <select
          value={filters.project_id}
          onChange={e => setFilters(f => ({ ...f, project_id: e.target.value, building_id: '', unit_id: '' }))}
          className={SELECT_CLS}
        >
          <option value="">All Projects</option>
          {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>

        <select
          value={filters.building_id}
          onChange={e => setFilters(f => ({ ...f, building_id: e.target.value, unit_id: '' }))}
          className={SELECT_CLS}
        >
          <option value="">All Buildings</option>
          {filteredBuildings.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>

        <select
          value={filters.unit_id}
          onChange={e => setFilters(f => ({ ...f, unit_id: e.target.value }))}
          className={SELECT_CLS}
        >
          <option value="">All Units</option>
          {filteredUnits.map(u => <option key={u.id} value={u.id}>{u.unit_number}</option>)}
        </select>

        <select
          value={filters.resident_id}
          onChange={e => setFilters(f => ({ ...f, resident_id: e.target.value }))}
          className={SELECT_CLS}
        >
          <option value="">All Residents</option>
          {residents.map(r => <option key={r.id} value={r.id}>{r.full_name}</option>)}
        </select>

        <select
          value={filters.provider_id}
          onChange={e => setFilters(f => ({ ...f, provider_id: e.target.value }))}
          className={SELECT_CLS}
        >
          <option value="">All Providers</option>
          {providers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>

        <input
          type="date"
          value={filters.date_from}
          onChange={e => setFilters(f => ({ ...f, date_from: e.target.value }))}
          className={SELECT_CLS}
          placeholder="From"
        />
        <input
          type="date"
          value={filters.date_to}
          onChange={e => setFilters(f => ({ ...f, date_to: e.target.value }))}
          className={SELECT_CLS}
          placeholder="To"
        />

        {Object.values(filters).some(v => v !== '') && (
          <button
            onClick={() => setFilters(EMPTY_FILTERS)}
            className="px-3 py-2 text-sm text-slate hover:text-ink underline"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-border shadow-sm overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-slate text-xs uppercase tracking-wide border-b border-border">
              <th className="px-5 py-3 text-left">Ticket #</th>
              <th className="px-5 py-3 text-left">Project</th>
              <th className="px-5 py-3 text-left">Unit</th>
              <th className="px-5 py-3 text-left">Resident</th>
              <th className="px-5 py-3 text-left">Category</th>
              <th className="px-5 py-3 text-left">Description</th>
              <th className="px-5 py-3 text-left">Priority</th>
              <th className="px-5 py-3 text-left">Status</th>
              <th className="px-5 py-3 text-left">SP Assigned</th>
              <th className="px-5 py-3 text-left">Date</th>
              <th className="px-5 py-3 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={11} className="px-5 py-10 text-center text-slate">
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-4 h-4 border-2 border-forest border-t-transparent rounded-full animate-spin" />
                    Loading tickets...
                  </div>
                </td>
              </tr>
            )}
            {!loading && filtered.map(t => (
              <tr key={t.id} className="border-b border-border last:border-0 hover:bg-cream/50 transition-colors">
                <td className="px-5 py-3 font-mono text-xs text-slate">{t.id.slice(0, 8).toUpperCase()}</td>
                <td className="px-5 py-3 font-medium">{t.projects?.name ?? '—'}</td>
                <td className="px-5 py-3">{t.units?.unit_number ?? '—'}</td>
                <td className="px-5 py-3">{t.residents?.full_name ?? '—'}</td>
                <td className="px-5 py-3 text-slate">{t.category}</td>
                <td className="px-5 py-3 max-w-[180px]">
                  <span className="truncate block text-slate" title={t.description}>{t.description}</span>
                </td>
                <td className="px-5 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${PRIORITY_STYLES[t.priority]}`}>
                    {t.priority}
                  </span>
                </td>
                <td className="px-5 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${STATUS_STYLES[t.status]}`}>
                    {t.status.replace('_', ' ')}
                  </span>
                </td>
                <td className="px-5 py-3 text-slate">{t.service_providers?.name ?? <span className="text-fog">Unassigned</span>}</td>
                <td className="px-5 py-3 text-slate whitespace-nowrap">{new Date(t.created_at).toLocaleDateString()}</td>
                <td className="px-5 py-3">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => openEdit(t)}
                      className="text-forest hover:text-deep text-xs font-medium"
                    >
                      Edit
                    </button>
                    <span className="text-border">|</span>
                    <button
                      onClick={() => handleDelete(t.id)}
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
                <td colSpan={11} className="px-5 py-12 text-center">
                  <div className="text-fog text-4xl mb-3">🔧</div>
                  <p className="text-slate font-medium">No tickets match your filters</p>
                  <p className="text-fog text-sm mt-1">Try adjusting the filters above</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ─── Add Modal ──────────────────────────────────────────────────────── */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-xl max-h-[90vh] overflow-y-auto">
            <h2 className="font-bold text-lg text-ink mb-5">New Maintenance Ticket</h2>
            <form onSubmit={handleAdd} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate mb-1 block">Project</label>
                  <select
                    value={addForm.project_id}
                    onChange={e => setAddForm(f => ({ ...f, project_id: e.target.value, building_id: '', unit_id: '', resident_id: '' }))}
                    className={INPUT_CLS}
                  >
                    <option value="">Select project</option>
                    {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate mb-1 block">Building</label>
                  <select
                    value={addForm.building_id}
                    onChange={e => setAddForm(f => ({ ...f, building_id: e.target.value, unit_id: '', resident_id: '' }))}
                    className={INPUT_CLS}
                  >
                    <option value="">Select building</option>
                    {addFormBuildings.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate mb-1 block">Unit</label>
                  <select
                    value={addForm.unit_id}
                    onChange={e => setAddForm(f => ({ ...f, unit_id: e.target.value, resident_id: '' }))}
                    className={INPUT_CLS}
                  >
                    <option value="">Select unit</option>
                    {addFormUnits.map(u => <option key={u.id} value={u.id}>{u.unit_number}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate mb-1 block">Resident</label>
                  <select
                    value={addForm.resident_id}
                    onChange={e => setAddForm(f => ({ ...f, resident_id: e.target.value }))}
                    className={INPUT_CLS}
                  >
                    <option value="">Select resident</option>
                    {addFormResidents.map(r => <option key={r.id} value={r.id}>{r.full_name}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate mb-1 block">Category *</label>
                  <select
                    value={addForm.category}
                    onChange={e => setAddForm(f => ({ ...f, category: e.target.value }))}
                    className={INPUT_CLS}
                  >
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate mb-1 block">Priority</label>
                  <select
                    value={addForm.priority}
                    onChange={e => setAddForm(f => ({ ...f, priority: e.target.value }))}
                    className={INPUT_CLS}
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs text-slate mb-1 block">Description *</label>
                <textarea
                  required
                  rows={3}
                  value={addForm.description}
                  onChange={e => setAddForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Describe the issue..."
                  className={`${INPUT_CLS} resize-none`}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate mb-1 block">Service Provider</label>
                  <select
                    value={addForm.service_provider_id}
                    onChange={e => setAddForm(f => ({ ...f, service_provider_id: e.target.value }))}
                    className={INPUT_CLS}
                  >
                    <option value="">Unassigned</option>
                    {providers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate mb-1 block">Preferred Time</label>
                  <input
                    type="datetime-local"
                    value={addForm.preferred_time}
                    onChange={e => setAddForm(f => ({ ...f, preferred_time: e.target.value }))}
                    className={INPUT_CLS}
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 border border-border rounded-xl py-2 text-sm hover:bg-cream transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 bg-forest text-white rounded-xl py-2 text-sm font-medium disabled:opacity-50 hover:bg-deep transition-colors"
                >
                  {saving ? 'Creating...' : 'Create Ticket'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── Edit Modal ─────────────────────────────────────────────────────── */}
      {editingTicket && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between mb-5">
              <div>
                <h2 className="font-bold text-lg text-ink">Edit Ticket</h2>
                <p className="text-xs text-slate mt-0.5 font-mono">{editingTicket.id.slice(0, 8).toUpperCase()}</p>
              </div>
              <button onClick={() => setEditingTicket(null)} className="text-fog hover:text-slate text-xl leading-none">&times;</button>
            </div>
            <form onSubmit={handleEdit} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate mb-1 block">Status</label>
                  <select
                    value={editForm.status}
                    onChange={e => setEditForm(f => ({ ...f, status: e.target.value }))}
                    className={INPUT_CLS}
                  >
                    <option value="open">Open</option>
                    <option value="in_progress">In Progress</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate mb-1 block">Category</label>
                  <select
                    value={editForm.category}
                    onChange={e => setEditForm(f => ({ ...f, category: e.target.value }))}
                    className={INPUT_CLS}
                  >
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs text-slate mb-1 block">Description</label>
                <textarea
                  rows={3}
                  value={editForm.description}
                  onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))}
                  className={`${INPUT_CLS} resize-none`}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate mb-1 block">Priority</label>
                  <select
                    value={editForm.priority}
                    onChange={e => setEditForm(f => ({ ...f, priority: e.target.value }))}
                    className={INPUT_CLS}
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate mb-1 block">Service Provider</label>
                  <select
                    value={editForm.service_provider_id}
                    onChange={e => setEditForm(f => ({ ...f, service_provider_id: e.target.value }))}
                    className={INPUT_CLS}
                  >
                    <option value="">Unassigned</option>
                    {providers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate mb-1 block">Preferred Time</label>
                  <input
                    type="datetime-local"
                    value={editForm.preferred_time}
                    onChange={e => setEditForm(f => ({ ...f, preferred_time: e.target.value }))}
                    className={INPUT_CLS}
                  />
                </div>
                <div>
                  <label className="text-xs text-slate mb-1 block">ETA</label>
                  <input
                    type="datetime-local"
                    value={editForm.eta}
                    onChange={e => setEditForm(f => ({ ...f, eta: e.target.value }))}
                    className={INPUT_CLS}
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingTicket(null)}
                  className="flex-1 border border-border rounded-xl py-2 text-sm hover:bg-cream transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 bg-forest text-white rounded-xl py-2 text-sm font-medium disabled:opacity-50 hover:bg-deep transition-colors"
                >
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
