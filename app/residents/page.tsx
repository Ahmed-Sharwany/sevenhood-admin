'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Resident, Unit } from '@/lib/types'

export default function ResidentsPage() {
  const [residents, setResidents] = useState<Resident[]>([])
  const [units, setUnits] = useState<Pick<Unit, 'id' | 'unit_number'>[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ full_name: '', email: '', phone: '', unit_id: '', role: 'owner', move_in_date: '' })
  const [saving, setSaving] = useState(false)

  async function load() {
    setLoading(true)
    const [r, u] = await Promise.all([
      supabase.from('residents').select('*, units(unit_number)').order('full_name'),
      supabase.from('units').select('id, unit_number').order('unit_number'),
    ])
    setResidents(r.data ?? [])
    setUnits(u.data ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    await supabase.from('residents').insert({
      full_name: form.full_name,
      email: form.email || null,
      phone: form.phone || null,
      unit_id: form.unit_id || null,
      role: form.role,
      move_in_date: form.move_in_date || null,
    })
    setSaving(false)
    setShowModal(false)
    setForm({ full_name: '', email: '', phone: '', unit_id: '', role: 'owner', move_in_date: '' })
    load()
  }

  async function deleteResident(id: string) {
    if (!confirm('Delete this resident?')) return
    await supabase.from('residents').delete().eq('id', id)
    load()
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-ink">Residents</h1>
          <p className="text-slate text-sm mt-1">{residents.length} registered</p>
        </div>
        <button onClick={() => setShowModal(true)} className="bg-forest text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-deep transition-colors">
          + Add Resident
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-border shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-slate text-xs uppercase tracking-wide border-b border-border">
              <th className="px-6 py-3 text-left">Name</th>
              <th className="px-6 py-3 text-left">Unit</th>
              <th className="px-6 py-3 text-left">Role</th>
              <th className="px-6 py-3 text-left">Email</th>
              <th className="px-6 py-3 text-left">Phone</th>
              <th className="px-6 py-3 text-left">Move-in</th>
              <th className="px-6 py-3 text-left"></th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={7} className="px-6 py-8 text-center text-slate">Loading...</td></tr>}
            {!loading && residents.map(r => (
              <tr key={r.id} className="border-b border-border last:border-0 hover:bg-cream/50">
                <td className="px-6 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-forest/10 text-forest flex items-center justify-center font-semibold text-xs">
                      {r.full_name[0]}
                    </div>
                    <span className="font-medium">{r.full_name}</span>
                  </div>
                </td>
                <td className="px-6 py-3">{(r as any).units?.unit_number ?? '—'}</td>
                <td className="px-6 py-3 capitalize">{r.role}</td>
                <td className="px-6 py-3 text-slate">{r.email ?? '—'}</td>
                <td className="px-6 py-3 text-slate">{r.phone ?? '—'}</td>
                <td className="px-6 py-3 text-slate">{r.move_in_date ?? '—'}</td>
                <td className="px-6 py-3">
                  <button onClick={() => deleteResident(r.id)} className="text-red-400 hover:text-red-600 text-xs">Delete</button>
                </td>
              </tr>
            ))}
            {!loading && residents.length === 0 && <tr><td colSpan={7} className="px-6 py-8 text-center text-slate">No residents yet</td></tr>}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-96 shadow-xl">
            <h2 className="font-bold text-lg text-ink mb-4">Add Resident</h2>
            <form onSubmit={handleAdd} className="space-y-3">
              <input required placeholder="Full Name" value={form.full_name} onChange={e => setForm(f => ({...f, full_name: e.target.value}))} className="w-full border border-border rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-forest" />
              <input type="email" placeholder="Email" value={form.email} onChange={e => setForm(f => ({...f, email: e.target.value}))} className="w-full border border-border rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-forest" />
              <input placeholder="Phone" value={form.phone} onChange={e => setForm(f => ({...f, phone: e.target.value}))} className="w-full border border-border rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-forest" />
              <select value={form.unit_id} onChange={e => setForm(f => ({...f, unit_id: e.target.value}))} className="w-full border border-border rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-forest">
                <option value="">No unit assigned</option>
                {units.map(u => <option key={u.id} value={u.id}>{u.unit_number}</option>)}
              </select>
              <select value={form.role} onChange={e => setForm(f => ({...f, role: e.target.value}))} className="w-full border border-border rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-forest">
                <option value="owner">Owner</option>
                <option value="tenant">Tenant</option>
                <option value="family">Family</option>
              </select>
              <input type="date" value={form.move_in_date} onChange={e => setForm(f => ({...f, move_in_date: e.target.value}))} className="w-full border border-border rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-forest" />
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 border border-border rounded-xl py-2 text-sm">Cancel</button>
                <button type="submit" disabled={saving} className="flex-1 bg-forest text-white rounded-xl py-2 text-sm font-medium disabled:opacity-50">
                  {saving ? 'Saving...' : 'Add Resident'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
