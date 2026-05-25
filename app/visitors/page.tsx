'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { VisitorPass, Unit, Resident, PassStatus, Building } from '@/lib/types'

const STATUS_STYLES: Record<PassStatus, string> = {
  active:    'bg-green-100 text-green-700',
  pending:   'bg-yellow-100 text-yellow-700',
  expired:   'bg-gray-100 text-gray-500',
  cancelled: 'bg-red-100 text-red-500',
}

const PASS_TYPE_STYLES: Record<string, string> = {
  'one-time':  'bg-gray-100 text-gray-600',
  'recurring': 'bg-blue-100 text-blue-700',
  'temporary': 'bg-yellow-100 text-yellow-700',
}

const EMPTY_FORM = {
  visitor_name: '',
  unit_id: '',
  resident_id: '',
  pass_type: 'one-time' as 'one-time' | 'recurring' | 'temporary',
  valid_until: '',
  detail: '',
  is_recurring: false,
}

type PassRow = VisitorPass & {
  units?: Pick<Unit, 'id' | 'unit_number'>
  residents?: Pick<Resident, 'id' | 'full_name'>
}

type UnitWithBuilding = Pick<Unit, 'id' | 'unit_number' | 'building_id'> & {
  buildings?: Pick<Building, 'id' | 'name'>
}

export default function VisitorsPage() {
  const [passes, setPasses] = useState<PassRow[]>([])
  const [units, setUnits] = useState<UnitWithBuilding[]>([])
  const [residents, setResidents] = useState<Pick<Resident, 'id' | 'full_name' | 'unit_id'>[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [approvingAll, setApprovingAll] = useState(false)

  const [filterStatus, setFilterStatus] = useState('')
  const [filterPassType, setFilterPassType] = useState('')
  const [filterUnit, setFilterUnit] = useState('')
  const [searchVisitor, setSearchVisitor] = useState('')

  async function load() {
    setLoading(true)
    const [p, u, r] = await Promise.all([
      supabase
        .from('visitor_passes')
        .select('*, units(id, unit_number), residents(id, full_name)')
        .order('created_at', { ascending: false }),
      supabase
        .from('units')
        .select('id, unit_number, building_id, buildings(id, name)')
        .order('unit_number'),
      supabase
        .from('residents')
        .select('id, full_name, unit_id')
        .order('full_name'),
    ])
    setPasses((p.data ?? []) as PassRow[])
    setUnits((u.data ?? []) as unknown as UnitWithBuilding[])
    setResidents(r.data ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  // When unit_id changes in form, auto-suggest residents for that unit
  const filteredResidentsForForm = form.unit_id
    ? residents.filter(r => r.unit_id === form.unit_id)
    : residents

  function openAdd() {
    setForm(EMPTY_FORM)
    setShowModal(true)
  }

  function closeModal() {
    setShowModal(false)
    setForm(EMPTY_FORM)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    await supabase.from('visitor_passes').insert({
      visitor_name: form.visitor_name,
      unit_id: form.unit_id || null,
      resident_id: form.resident_id || null,
      pass_type: form.pass_type,
      valid_until: form.valid_until || null,
      detail: form.detail || null,
      is_recurring: form.is_recurring,
      status: 'pending',
    })
    setSaving(false)
    closeModal()
    load()
  }

  async function updateStatus(id: string, status: PassStatus) {
    await supabase.from('visitor_passes').update({ status }).eq('id', id)
    load()
  }

  async function deletePass(id: string) {
    if (!confirm('Delete this visitor pass?')) return
    await supabase.from('visitor_passes').delete().eq('id', id)
    load()
  }

  async function approveAllPending() {
    const pending = passes.filter(p => p.status === 'pending')
    if (pending.length === 0) return
    if (!confirm(`Approve all ${pending.length} pending passes?`)) return
    setApprovingAll(true)
    await supabase
      .from('visitor_passes')
      .update({ status: 'active' })
      .eq('status', 'pending')
    setApprovingAll(false)
    load()
  }

  const filtered = passes.filter(p => {
    if (filterStatus && p.status !== filterStatus) return false
    if (filterPassType && p.pass_type !== filterPassType) return false
    if (filterUnit && p.unit_id !== filterUnit) return false
    if (searchVisitor && !p.visitor_name.toLowerCase().includes(searchVisitor.toLowerCase())) return false
    return true
  })

  const totalPending = passes.filter(p => p.status === 'pending').length
  const totalActive = passes.filter(p => p.status === 'active').length
  const totalExpired = passes.filter(p => p.status === 'expired').length

  const unitOptions = units.map(u => ({
    id: u.id,
    label: u.buildings?.name ? `${u.buildings.name} - ${u.unit_number}` : u.unit_number,
  }))

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-ink">Visitor Passes</h1>
          <p className="text-slate text-sm mt-1">
            {totalPending > 0 && (
              <span className="text-gold font-medium">{totalPending} pending approval &middot; </span>
            )}
            {passes.length} total passes
          </p>
        </div>
        <button
          onClick={openAdd}
          className="bg-forest text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-deep transition-colors"
        >
          + Add Pass
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total Passes', value: passes.length, color: 'text-ink' },
          { label: 'Pending Approval', value: totalPending, color: 'text-yellow-600' },
          { label: 'Active', value: totalActive, color: 'text-green-600' },
          { label: 'Expired', value: totalExpired, color: 'text-gray-500' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-2xl border border-border p-5 shadow-sm">
            <p className="text-xs text-slate uppercase tracking-wide mb-1">{s.label}</p>
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filters + Bulk Actions */}
      <div className="flex flex-wrap gap-3 mb-4 items-center">
        <input
          type="text"
          placeholder="Search visitor name..."
          value={searchVisitor}
          onChange={e => setSearchVisitor(e.target.value)}
          className="border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-forest bg-white min-w-[200px]"
        />
        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
          className="border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-forest bg-white"
        >
          <option value="">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="active">Active</option>
          <option value="expired">Expired</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <select
          value={filterPassType}
          onChange={e => setFilterPassType(e.target.value)}
          className="border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-forest bg-white"
        >
          <option value="">All Types</option>
          <option value="one-time">One-time</option>
          <option value="recurring">Recurring</option>
          <option value="temporary">Temporary</option>
        </select>
        <select
          value={filterUnit}
          onChange={e => setFilterUnit(e.target.value)}
          className="border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-forest bg-white"
        >
          <option value="">All Units</option>
          {unitOptions.map(u => <option key={u.id} value={u.id}>{u.label}</option>)}
        </select>
        {(filterStatus || filterPassType || filterUnit || searchVisitor) && (
          <button
            onClick={() => { setFilterStatus(''); setFilterPassType(''); setFilterUnit(''); setSearchVisitor('') }}
            className="text-xs text-slate hover:text-ink border border-border rounded-xl px-3 py-2 bg-white"
          >
            Clear
          </button>
        )}
        <div className="ml-auto">
          <button
            onClick={approveAllPending}
            disabled={totalPending === 0 || approvingAll}
            className="bg-green-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-green-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {approvingAll ? 'Approving...' : `Approve All Pending${totalPending > 0 ? ` (${totalPending})` : ''}`}
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-slate text-xs uppercase tracking-wide border-b border-border bg-cream/50">
              <th className="px-5 py-3 text-left">Visitor Name</th>
              <th className="px-5 py-3 text-left">Unit</th>
              <th className="px-5 py-3 text-left">Resident</th>
              <th className="px-5 py-3 text-left">Pass Type</th>
              <th className="px-5 py-3 text-left">Status</th>
              <th className="px-5 py-3 text-left">Valid Until</th>
              <th className="px-5 py-3 text-left">Recurring</th>
              <th className="px-5 py-3 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={8} className="px-6 py-10 text-center text-slate">Loading...</td></tr>
            )}
            {!loading && filtered.map(p => (
              <tr
                key={p.id}
                className={`border-b border-border last:border-0 hover:bg-cream/40 transition-colors ${p.status === 'pending' ? 'bg-yellow-50/40' : ''}`}
              >
                <td className="px-5 py-3 font-medium text-ink">{p.visitor_name}</td>
                <td className="px-5 py-3 text-slate">{p.units?.unit_number ?? '—'}</td>
                <td className="px-5 py-3 text-slate">{p.residents?.full_name ?? '—'}</td>
                <td className="px-5 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${PASS_TYPE_STYLES[p.pass_type]}`}>
                    {p.pass_type.replace('-', ' ')}
                  </span>
                </td>
                <td className="px-5 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${STATUS_STYLES[p.status]}`}>
                    {p.status}
                  </span>
                </td>
                <td className="px-5 py-3 text-slate">
                  {p.valid_until
                    ? new Date(p.valid_until).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
                    : '—'}
                </td>
                <td className="px-5 py-3 text-center">
                  {p.is_recurring
                    ? <span className="text-green-600 font-bold">✓</span>
                    : <span className="text-gray-400">✗</span>}
                </td>
                <td className="px-5 py-3">
                  <div className="flex gap-2 flex-wrap">
                    {p.status === 'pending' && (
                      <>
                        <button
                          onClick={() => updateStatus(p.id, 'active')}
                          className="bg-green-100 text-green-700 hover:bg-green-200 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => updateStatus(p.id, 'cancelled')}
                          className="bg-red-100 text-red-600 hover:bg-red-200 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors"
                        >
                          Deny
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => deletePass(p.id)}
                      className="text-red-400 hover:text-red-600 text-xs font-medium px-1"
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {!loading && filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="px-6 py-10 text-center text-slate">
                  {passes.length === 0 ? 'No visitor passes yet.' : 'No passes match the selected filters.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Add Pass Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl max-h-[90vh] overflow-y-auto">
            <h2 className="font-bold text-lg text-ink mb-5">Add Visitor Pass</h2>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="text-xs text-slate mb-1 block">Visitor Name <span className="text-red-400">*</span></label>
                <input
                  required
                  placeholder="e.g. Ahmed Khalid"
                  value={form.visitor_name}
                  onChange={e => setForm(f => ({ ...f, visitor_name: e.target.value }))}
                  className="w-full border border-border rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-forest"
                />
              </div>
              <div>
                <label className="text-xs text-slate mb-1 block">Unit</label>
                <select
                  value={form.unit_id}
                  onChange={e => setForm(f => ({ ...f, unit_id: e.target.value, resident_id: '' }))}
                  className="w-full border border-border rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-forest"
                >
                  <option value="">Select Unit</option>
                  {unitOptions.map(u => <option key={u.id} value={u.id}>{u.label}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-slate mb-1 block">Resident</label>
                <select
                  value={form.resident_id}
                  onChange={e => setForm(f => ({ ...f, resident_id: e.target.value }))}
                  className="w-full border border-border rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-forest"
                >
                  <option value="">Select Resident</option>
                  {filteredResidentsForForm.map(r => (
                    <option key={r.id} value={r.id}>{r.full_name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-slate mb-1 block">Pass Type</label>
                <select
                  value={form.pass_type}
                  onChange={e => setForm(f => ({ ...f, pass_type: e.target.value as typeof form.pass_type }))}
                  className="w-full border border-border rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-forest"
                >
                  <option value="one-time">One-time</option>
                  <option value="recurring">Recurring</option>
                  <option value="temporary">Temporary</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-slate mb-1 block">Valid Until</label>
                <input
                  type="date"
                  value={form.valid_until}
                  onChange={e => setForm(f => ({ ...f, valid_until: e.target.value }))}
                  className="w-full border border-border rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-forest"
                />
              </div>
              <div>
                <label className="text-xs text-slate mb-1 block">Details / Notes</label>
                <textarea
                  rows={2}
                  placeholder="e.g. Family visitor, delivery..."
                  value={form.detail}
                  onChange={e => setForm(f => ({ ...f, detail: e.target.value }))}
                  className="w-full border border-border rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-forest resize-none"
                />
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.is_recurring}
                  onChange={e => setForm(f => ({ ...f, is_recurring: e.target.checked }))}
                  className="w-4 h-4 accent-forest"
                />
                <span className="text-sm text-ink">Recurring visit</span>
              </label>
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
                  {saving ? 'Saving...' : 'Add Pass'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
