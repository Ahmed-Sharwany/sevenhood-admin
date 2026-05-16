'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Building, Project } from '@/lib/types'

export default function BuildingsPage() {
  const [buildings, setBuildings] = useState<Building[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ name: '', project_id: '', floors: '' })
  const [saving, setSaving] = useState(false)

  async function load() {
    setLoading(true)
    const [b, p] = await Promise.all([
      supabase.from('buildings').select('*, projects(name)').order('name'),
      supabase.from('projects').select('id, name').order('name'),
    ])
    setBuildings(b.data ?? [])
    setProjects(p.data ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    await supabase.from('buildings').insert({
      name: form.name,
      project_id: form.project_id || null,
      floors: form.floors ? parseInt(form.floors) : null,
    })
    setSaving(false)
    setShowModal(false)
    setForm({ name: '', project_id: '', floors: '' })
    load()
  }

  async function deleteBuilding(id: string) {
    if (!confirm('Delete this building? This will also remove its units.')) return
    await supabase.from('buildings').delete().eq('id', id)
    load()
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-ink">Buildings</h1>
          <p className="text-slate text-sm mt-1">{buildings.length} total buildings</p>
        </div>
        <button onClick={() => setShowModal(true)} className="bg-forest text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-deep transition-colors">
          + Add Building
        </button>
      </div>

      {projects.length === 0 && !loading && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-700 mb-6">
          You need to add a Project first before adding buildings.
        </div>
      )}

      <div className="bg-white rounded-2xl border border-border shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-slate text-xs uppercase tracking-wide border-b border-border">
              <th className="px-6 py-3 text-left">Building</th>
              <th className="px-6 py-3 text-left">Project</th>
              <th className="px-6 py-3 text-left">Floors</th>
              <th className="px-6 py-3 text-left"></th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={4} className="px-6 py-8 text-center text-slate">Loading...</td></tr>}
            {!loading && buildings.map(b => (
              <tr key={b.id} className="border-b border-border last:border-0 hover:bg-cream/50">
                <td className="px-6 py-3 font-semibold">{b.name}</td>
                <td className="px-6 py-3 text-slate">{(b as any).projects?.name ?? '—'}</td>
                <td className="px-6 py-3">{b.floors ? `${b.floors} floors` : '—'}</td>
                <td className="px-6 py-3">
                  <button onClick={() => deleteBuilding(b.id)} className="text-red-400 hover:text-red-600 text-xs">Delete</button>
                </td>
              </tr>
            ))}
            {!loading && buildings.length === 0 && (
              <tr><td colSpan={4} className="px-6 py-8 text-center text-slate">No buildings yet</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-96 shadow-xl">
            <h2 className="font-bold text-lg text-ink mb-4">Add Building</h2>
            <form onSubmit={handleAdd} className="space-y-3">
              <select required value={form.project_id} onChange={e => setForm(f => ({...f, project_id: e.target.value}))} className="w-full border border-border rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-forest">
                <option value="">Select Project</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <input required placeholder="Building Name (e.g. Tower A)" value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))} className="w-full border border-border rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-forest" />
              <input type="number" placeholder="Number of Floors" value={form.floors} onChange={e => setForm(f => ({...f, floors: e.target.value}))} className="w-full border border-border rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-forest" />
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 border border-border rounded-xl py-2 text-sm">Cancel</button>
                <button type="submit" disabled={saving} className="flex-1 bg-forest text-white rounded-xl py-2 text-sm font-medium disabled:opacity-50">
                  {saving ? 'Saving...' : 'Add Building'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
