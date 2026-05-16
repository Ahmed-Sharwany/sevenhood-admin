'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Unit, Building } from '@/lib/types'

const STATUS_STYLES: Record<string, string> = {
  occupied: 'bg-green-100 text-green-700',
  vacant:   'bg-gray-100 text-gray-600',
  reserved: 'bg-yellow-100 text-yellow-700',
}

export default function UnitsPage() {
  const [units, setUnits] = useState<Unit[]>([])
  const [buildings, setBuildings] = useState<Pick<Building, 'id' | 'name'>[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ unit_number: '', floor: '', building_id: '', bedrooms: '1', bathrooms: '1', area_sqm: '', status: 'occupied' })
  const [saving, setSaving] = useState(false)

  async function load() {
    setLoading(true)
    const [u, b] = await Promise.all([
      supabase.from('units').select('*, buildings(name)').order('unit_number'),
      supabase.from('buildings').select('id, name').order('name'),
    ])
    setUnits(u.data ?? [])
    setBuildings(b.data ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    await supabase.from('units').insert({
      unit_number: form.unit_number,
      floor: parseInt(form.floor),
      building_id: form.building_id || null,
      bedrooms: parseInt(form.bedrooms),
      bathrooms: parseInt(form.bathrooms),
      area_sqm: form.area_sqm ? parseFloat(form.area_sqm) : null,
      status: form.status,
    })
    setSaving(false)
    setShowModal(false)
    setForm({ unit_number: '', floor: '', building_id: '', bedrooms: '1', bathrooms: '1', area_sqm: '', status: 'occupied' })
    load()
  }

  async function deleteUnit(id: string) {
    if (!confirm('Delete this unit?')) return
    await supabase.from('units').delete().eq('id', id)
    load()
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-ink">Units</h1>
          <p className="text-slate text-sm mt-1">{units.length} total units</p>
        </div>
        <button onClick={() => setShowModal(true)} className="bg-forest text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-deep transition-colors">
          + Add Unit
        </button>
      </div>

      {buildings.length === 0 && !loading && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-700 mb-6">
          You need to add a Building first before adding units.
        </div>
      )}

      <div className="bg-white rounded-2xl border border-border shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-slate text-xs uppercase tracking-wide border-b border-border">
              <th className="px-6 py-3 text-left">Unit</th>
              <th className="px-6 py-3 text-left">Building</th>
              <th className="px-6 py-3 text-left">Floor</th>
              <th className="px-6 py-3 text-left">Beds / Baths</th>
              <th className="px-6 py-3 text-left">Area</th>
              <th className="px-6 py-3 text-left">Status</th>
              <th className="px-6 py-3 text-left"></th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={7} className="px-6 py-8 text-center text-slate">Loading...</td></tr>}
            {!loading && units.map(u => (
              <tr key={u.id} className="border-b border-border last:border-0 hover:bg-cream/50">
                <td className="px-6 py-3 font-semibold">{u.unit_number}</td>
                <td className="px-6 py-3">{(u as any).buildings?.name ?? '—'}</td>
                <td className="px-6 py-3">{u.floor}</td>
                <td className="px-6 py-3">{u.bedrooms}BR / {u.bathrooms}BA</td>
                <td className="px-6 py-3">{u.area_sqm ? `${u.area_sqm} m²` : '—'}</td>
                <td className="px-6 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[u.status]}`}>
                    {u.status}
                  </span>
                </td>
                <td className="px-6 py-3">
                  <button onClick={() => deleteUnit(u.id)} className="text-red-400 hover:text-red-600 text-xs">Delete</button>
                </td>
              </tr>
            ))}
            {!loading && units.length === 0 && <tr><td colSpan={7} className="px-6 py-8 text-center text-slate">No units yet</td></tr>}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-96 shadow-xl">
            <h2 className="font-bold text-lg text-ink mb-4">Add Unit</h2>
            <form onSubmit={handleAdd} className="space-y-3">
              <select required value={form.building_id} onChange={e => setForm(f => ({...f, building_id: e.target.value}))} className="w-full border border-border rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-forest">
                <option value="">Select Building</option>
                {buildings.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
              <input required placeholder="Unit Number (e.g. 12B)" value={form.unit_number} onChange={e => setForm(f => ({...f, unit_number: e.target.value}))} className="w-full border border-border rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-forest" />
              <input required type="number" placeholder="Floor" value={form.floor} onChange={e => setForm(f => ({...f, floor: e.target.value}))} className="w-full border border-border rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-forest" />
              <div className="grid grid-cols-2 gap-3">
                <input required type="number" placeholder="Bedrooms" value={form.bedrooms} onChange={e => setForm(f => ({...f, bedrooms: e.target.value}))} className="border border-border rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-forest" />
                <input required type="number" placeholder="Bathrooms" value={form.bathrooms} onChange={e => setForm(f => ({...f, bathrooms: e.target.value}))} className="border border-border rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-forest" />
              </div>
              <input type="number" placeholder="Area (m²)" value={form.area_sqm} onChange={e => setForm(f => ({...f, area_sqm: e.target.value}))} className="w-full border border-border rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-forest" />
              <select value={form.status} onChange={e => setForm(f => ({...f, status: e.target.value}))} className="w-full border border-border rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-forest">
                <option value="occupied">Occupied</option>
                <option value="vacant">Vacant</option>
                <option value="reserved">Reserved</option>
              </select>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 border border-border rounded-xl py-2 text-sm">Cancel</button>
                <button type="submit" disabled={saving} className="flex-1 bg-forest text-white rounded-xl py-2 text-sm font-medium disabled:opacity-50">
                  {saving ? 'Saving...' : 'Add Unit'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
