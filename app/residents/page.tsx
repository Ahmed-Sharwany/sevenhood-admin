'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Resident, Unit, Building, Project } from '@/lib/types'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

const ROLE_STYLES: Record<string, string> = {
  owner:  'bg-forest text-white',
  tenant: 'bg-gold text-white',
  family: 'bg-gray-200 text-gray-700',
}

const AVATAR_COLORS = [
  'bg-forest/20 text-forest',
  'bg-gold/20 text-gold',
  'bg-blue-100 text-blue-700',
  'bg-purple-100 text-purple-700',
  'bg-pink-100 text-pink-700',
]

function getAvatarColor(name: string) {
  const idx = name.charCodeAt(0) % AVATAR_COLORS.length
  return AVATAR_COLORS[idx]
}

function getInitials(name: string) {
  const parts = name.trim().split(' ')
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return name.slice(0, 2).toUpperCase()
}

const EMPTY_FORM = {
  full_name: '',
  email: '',
  phone: '',
  modal_project_id: '',
  modal_building_id: '',
  unit_id: '',
  role: 'tenant' as 'owner' | 'tenant' | 'family',
  move_in_date: '',
}

type UnitWithBuilding = Pick<Unit, 'id' | 'unit_number' | 'building_id'> & {
  buildings?: Pick<Building, 'id' | 'name' | 'project_id'>
}

type ResidentRow = Resident & {
  units?: UnitWithBuilding
}

export default function ResidentsPage() {
  const [residents, setResidents] = useState<ResidentRow[]>([])
  const [units, setUnits] = useState<UnitWithBuilding[]>([])
  const [buildings, setBuildings] = useState<Pick<Building, 'id' | 'name' | 'project_id'>[]>([])
  const [projects, setProjects] = useState<Pick<Project, 'id' | 'name'>[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingResident, setEditingResident] = useState<ResidentRow | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  const [filterProject, setFilterProject] = useState('')
  const [filterBuilding, setFilterBuilding] = useState('')
  const [search, setSearch] = useState('')

  async function load() {
    setLoading(true)
    const [r, u, b, p] = await Promise.all([
      supabase
        .from('residents')
        .select('*, units(id, unit_number, building_id, buildings(id, name, project_id))')
        .order('full_name'),
      supabase
        .from('units')
        .select('id, unit_number, building_id, buildings(id, name, project_id)')
        .order('unit_number'),
      supabase.from('buildings').select('id, name, project_id').order('name'),
      supabase.from('projects').select('id, name').order('name'),
    ])
    setResidents((r.data ?? []) as ResidentRow[])
    setUnits((u.data ?? []) as unknown as UnitWithBuilding[])
    setBuildings(b.data ?? [])
    setProjects(p.data ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  function openAdd() {
    setEditingResident(null)
    setForm(EMPTY_FORM)
    setShowModal(true)
  }

  function openEdit(r: ResidentRow) {
    setEditingResident(r)
    // Pre-fill cascade: find building + project from the unit
    const unit = units.find(u => u.id === r.unit_id)
    const bldId = unit?.building_id ?? ''
    const bld   = buildings.find(b => b.id === bldId)
    setForm({
      full_name: r.full_name,
      email: r.email ?? '',
      phone: r.phone ?? '',
      modal_project_id: bld?.project_id ?? '',
      modal_building_id: bldId,
      unit_id: r.unit_id ?? '',
      role: r.role,
      move_in_date: r.move_in_date ?? '',
    })
    setShowModal(true)
  }

  function closeModal() {
    setShowModal(false)
    setEditingResident(null)
    setForm(EMPTY_FORM)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const payload = {
      full_name: form.full_name,
      email: form.email || null,
      phone: form.phone || null,
      unit_id: form.unit_id || null,
      role: form.role,
      move_in_date: form.move_in_date || null,
    }
    if (editingResident) {
      await supabase.from('residents').update(payload).eq('id', editingResident.id)
    } else {
      await supabase.from('residents').insert(payload)
    }
    setSaving(false)
    closeModal()
    load()
  }

  async function deleteResident(id: string) {
    if (!confirm('Delete this resident?')) return
    await supabase.from('residents').delete().eq('id', id)
    load()
  }

  // Filtered units for the modal dropdown (no filter applied — show all with building prefix)
  const unitOptions = units.map(u => ({
    id: u.id,
    label: u.buildings?.name ? `${u.buildings.name} - ${u.unit_number}` : u.unit_number,
  }))

  // Filter residents
  const filtered = residents.filter(r => {
    const unit = units.find(u => u.id === r.unit_id)
    const bld = buildings.find(b => b.id === unit?.building_id)
    if (filterProject && bld?.project_id !== filterProject) return false
    if (filterBuilding && unit?.building_id !== filterBuilding) return false
    if (search) {
      const q = search.toLowerCase()
      if (
        !r.full_name.toLowerCase().includes(q) &&
        !(r.phone ?? '').toLowerCase().includes(q)
      ) return false
    }
    return true
  })

  const filteredBuildingsForFilter = filterProject
    ? buildings.filter(b => b.project_id === filterProject)
    : buildings

  const totalOwners  = residents.filter(r => r.role === 'owner').length
  const totalTenants = residents.filter(r => r.role === 'tenant').length
  const totalFamily  = residents.filter(r => r.role === 'family').length

  // ── Invitation state ──────────────────────────────────────────────────────
  const [inviteResident, setInviteResident] = useState<ResidentRow | null>(null)
  const [inviteSending,  setInviteSending]  = useState(false)
  const [inviteResult,   setInviteResult]   = useState<{ activation_code?: string; message?: string; error?: string } | null>(null)

  // Determine if current user can invite
  const canInvite = (() => {
    try {
      const u = JSON.parse(localStorage.getItem('sevenhood_user') ?? '{}')
      const adminRoles = ['super_admin', 'org_admin', 'project_owner']
      return adminRoles.includes(u.role) || (u.permissions ?? []).includes('invite_residents')
    } catch { return false }
  })()

  async function handleSendInvitation(resident: ResidentRow) {
    setInviteResident(resident)
    setInviteResult(null)
    setInviteSending(true)

    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/generate-invitation`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_ANON}`,
        },
        body: JSON.stringify({
          resident_id: resident.id,
          language: 'en',
          invited_by: null,
        }),
      })

      const data = await res.json()

      if (!res.ok || data.error) {
        setInviteResult({ error: data.error ?? 'Failed to generate invitation.' })
      } else {
        setInviteResult({
          activation_code: data.activation_code,
          message: `Invitation created! Activation code: ${data.activation_code}`,
        })
      }
    } catch {
      setInviteResult({ error: 'Network error. Please try again.' })
    } finally {
      setInviteSending(false)
    }
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-ink">Residents</h1>
          <p className="text-slate text-sm mt-1">{residents.length} registered</p>
        </div>
        <button
          onClick={openAdd}
          className="bg-forest text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-deep transition-colors"
        >
          + Add Resident
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total Residents', value: residents.length, color: 'text-ink' },
          { label: 'Owners', value: totalOwners, color: 'text-forest' },
          { label: 'Tenants', value: totalTenants, color: 'text-gold' },
          { label: 'Family Members', value: totalFamily, color: 'text-gray-500' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-2xl border border-border p-5 shadow-sm">
            <p className="text-xs text-slate uppercase tracking-wide mb-1">{s.label}</p>
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <input
          type="text"
          placeholder="Search by name or phone..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-forest bg-white min-w-[220px]"
        />
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
          {filteredBuildingsForFilter.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        {(filterProject || filterBuilding || search) && (
          <button
            onClick={() => { setFilterProject(''); setFilterBuilding(''); setSearch('') }}
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
              <th className="px-6 py-3 text-left">Name</th>
              <th className="px-6 py-3 text-left">Unit</th>
              <th className="px-6 py-3 text-left">Building</th>
              <th className="px-6 py-3 text-left">Role</th>
              <th className="px-6 py-3 text-left">Email</th>
              <th className="px-6 py-3 text-left">Phone</th>
              <th className="px-6 py-3 text-left">Move-in</th>
              <th className="px-6 py-3 text-left">App</th>
              <th className="px-6 py-3 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={9} className="px-6 py-10 text-center text-slate">Loading...</td></tr>
            )}
            {!loading && filtered.map(r => (
              <tr key={r.id} className="border-b border-border last:border-0 hover:bg-cream/40 transition-colors">
                <td className="px-6 py-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center font-semibold text-xs shrink-0 ${getAvatarColor(r.full_name)}`}>
                      {getInitials(r.full_name)}
                    </div>
                    <span className="font-medium text-ink">{r.full_name}</span>
                  </div>
                </td>
                <td className="px-6 py-3 text-slate">{r.units?.unit_number ?? '—'}</td>
                <td className="px-6 py-3 text-slate">{r.units?.buildings?.name ?? '—'}</td>
                <td className="px-6 py-3">
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${ROLE_STYLES[r.role]}`}>
                    {r.role}
                  </span>
                </td>
                <td className="px-6 py-3 text-slate">{r.email ?? '—'}</td>
                <td className="px-6 py-3 text-slate">{r.phone ?? '—'}</td>
                <td className="px-6 py-3 text-slate">
                  {r.move_in_date
                    ? new Date(r.move_in_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
                    : '—'}
                </td>
                <td className="px-6 py-3">
                  {canInvite && (
                    <button
                      onClick={() => handleSendInvitation(r)}
                      title="Send App Invitation"
                      className="text-xs font-medium px-2.5 py-1 rounded-lg border border-gold text-gold hover:bg-gold hover:text-white transition-colors"
                    >
                      📲 Invite
                    </button>
                  )}
                </td>
                <td className="px-6 py-3">
                  <div className="flex gap-3">
                    <button
                      onClick={() => openEdit(r)}
                      className="text-forest hover:text-deep text-xs font-medium"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => deleteResident(r.id)}
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
                <td colSpan={9} className="px-6 py-10 text-center text-slate">
                  {residents.length === 0 ? 'No residents yet.' : 'No residents match the filters.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ── Invitation Result Modal ──────────────────────────────────────────── */}
      {inviteResident && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-ink text-base">App Invitation</h3>
              <button onClick={() => { setInviteResident(null); setInviteResult(null) }}
                className="text-slate hover:text-ink text-xl leading-none">×</button>
            </div>

            <div className="flex items-center gap-3 mb-4 p-3 bg-cream rounded-xl border border-border">
              <div className={`w-9 h-9 rounded-full flex items-center justify-center font-semibold text-xs shrink-0 ${getAvatarColor(inviteResident.full_name)}`}>
                {getInitials(inviteResident.full_name)}
              </div>
              <div>
                <div className="font-semibold text-ink text-sm">{inviteResident.full_name}</div>
                <div className="text-xs text-slate">
                  {inviteResident.units?.unit_number
                    ? `Unit ${inviteResident.units.unit_number} · ${inviteResident.units.buildings?.name ?? ''}`
                    : 'No unit assigned'}
                </div>
              </div>
            </div>

            {inviteSending && (
              <div className="flex items-center gap-3 py-4 text-slate text-sm">
                <div className="w-5 h-5 border-2 border-forest border-t-transparent rounded-full animate-spin shrink-0" />
                Generating invitation…
              </div>
            )}

            {!inviteSending && !inviteResult && (
              <div className="text-sm text-slate mb-4">
                This will generate an activation code and send an SMS invitation to the resident&apos;s phone.
              </div>
            )}

            {inviteResult?.error && (
              <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm mb-4">
                ⚠️ {inviteResult.error}
              </div>
            )}

            {inviteResult?.activation_code && (
              <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-4 mb-4">
                <div className="text-xs font-semibold text-green-700 uppercase tracking-wide mb-2">
                  ✓ Invitation Created
                </div>
                <div className="text-slate text-xs mb-3">
                  Share this activation code with the resident to join the Sevenhood app:
                </div>
                <div className="bg-white border border-green-200 rounded-lg px-4 py-3 text-center">
                  <div className="font-mono text-2xl font-bold text-ink tracking-[0.2em]">
                    {inviteResult.activation_code}
                  </div>
                </div>
                <div className="text-xs text-slate mt-2 text-center">
                  Valid for 7 days · Resident enters this in the app
                </div>
              </div>
            )}

            {!inviteSending && (
              <div className="flex gap-3">
                <button
                  onClick={() => { setInviteResident(null); setInviteResult(null) }}
                  className="flex-1 border border-border rounded-xl py-2.5 text-sm text-slate hover:bg-cream transition-colors">
                  {inviteResult?.activation_code ? 'Done' : 'Cancel'}
                </button>
                {!inviteResult?.activation_code && (
                  <button
                    onClick={() => handleSendInvitation(inviteResident)}
                    className="flex-1 bg-gold text-white rounded-xl py-2.5 text-sm font-semibold hover:opacity-90 transition-opacity">
                    📲 Send Invitation
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl max-h-[90vh] overflow-y-auto">
            <h2 className="font-bold text-lg text-ink mb-5">
              {editingResident ? 'Edit Resident' : 'Add Resident'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="text-xs text-slate mb-1 block">Full Name <span className="text-red-400">*</span></label>
                <input
                  required
                  placeholder="e.g. Mohammed Al-Rashid"
                  value={form.full_name}
                  onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
                  className="w-full border border-border rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-forest"
                />
              </div>
              <div>
                <label className="text-xs text-slate mb-1 block">Email</label>
                <input
                  type="email"
                  placeholder="email@example.com"
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  className="w-full border border-border rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-forest"
                />
              </div>
              <div>
                <label className="text-xs text-slate mb-1 block">Phone</label>
                <input
                  placeholder="+966 5X XXX XXXX"
                  value={form.phone}
                  onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                  className="w-full border border-border rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-forest"
                />
              </div>
              {/* Cascade: Project → Building → Unit */}
              <div>
                <label className="text-xs font-semibold text-slate mb-1 block uppercase tracking-wide">Project</label>
                <select
                  value={form.modal_project_id}
                  onChange={e => setForm(f => ({ ...f, modal_project_id: e.target.value, modal_building_id: '', unit_id: '' }))}
                  className="w-full border border-border rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-forest bg-white"
                >
                  <option value="">Select project…</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate mb-1 block uppercase tracking-wide">Building</label>
                <select
                  value={form.modal_building_id}
                  disabled={!form.modal_project_id}
                  onChange={e => setForm(f => ({ ...f, modal_building_id: e.target.value, unit_id: '' }))}
                  className="w-full border border-border rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-forest bg-white disabled:opacity-50"
                >
                  <option value="">Select building…</option>
                  {buildings
                    .filter(b => b.project_id === form.modal_project_id)
                    .map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate mb-1 block uppercase tracking-wide">Unit</label>
                <select
                  value={form.unit_id}
                  disabled={!form.modal_building_id}
                  onChange={e => setForm(f => ({ ...f, unit_id: e.target.value }))}
                  className="w-full border border-border rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-forest bg-white disabled:opacity-50"
                >
                  <option value="">Select unit…</option>
                  {units
                    .filter(u => u.building_id === form.modal_building_id)
                    .map(u => <option key={u.id} value={u.id}>{u.unit_number}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-slate mb-1 block">Role</label>
                <select
                  value={form.role}
                  onChange={e => setForm(f => ({ ...f, role: e.target.value as typeof form.role }))}
                  className="w-full border border-border rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-forest"
                >
                  <option value="owner">Owner</option>
                  <option value="tenant">Tenant</option>
                  <option value="family">Family</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-slate mb-1 block">Move-in Date</label>
                <input
                  type="date"
                  value={form.move_in_date}
                  onChange={e => setForm(f => ({ ...f, move_in_date: e.target.value }))}
                  className="w-full border border-border rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-forest"
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
                  {saving ? 'Saving...' : editingResident ? 'Save Changes' : 'Add Resident'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
