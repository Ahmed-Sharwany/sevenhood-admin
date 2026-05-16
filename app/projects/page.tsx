'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Project } from '@/lib/types'

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ name: '', location: '', description: '' })
  const [saving, setSaving] = useState(false)

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('projects').select('*').order('name')
    setProjects(data ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    await supabase.from('projects').insert({
      name: form.name,
      location: form.location || null,
      description: form.description || null,
    })
    setSaving(false)
    setShowModal(false)
    setForm({ name: '', location: '', description: '' })
    load()
  }

  async function deleteProject(id: string) {
    if (!confirm('Delete this project? This will also delete its buildings and units.')) return
    await supabase.from('projects').delete().eq('id', id)
    load()
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-ink">Projects</h1>
          <p className="text-slate text-sm mt-1">{projects.length} total projects</p>
        </div>
        <button onClick={() => setShowModal(true)} className="bg-forest text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-deep transition-colors">
          + Add Project
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {loading && <p className="text-slate text-sm">Loading...</p>}
        {!loading && projects.length === 0 && (
          <div className="bg-white rounded-2xl border border-border p-12 text-center text-slate">
            No projects yet — add your first project above
          </div>
        )}
        {!loading && projects.map(p => (
          <div key={p.id} className="bg-white rounded-2xl border border-border p-6 flex items-center justify-between">
            <div>
              <div className="font-semibold text-ink text-lg">{p.name}</div>
              {p.location && <div className="text-slate text-sm mt-1">📍 {p.location}</div>}
              {p.description && <div className="text-slate text-sm mt-1">{p.description}</div>}
              <div className="text-xs text-slate/60 mt-2">Created {new Date(p.created_at).toLocaleDateString()}</div>
            </div>
            <button onClick={() => deleteProject(p.id)} className="text-red-400 hover:text-red-600 text-xs ml-8">Delete</button>
          </div>
        ))}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-96 shadow-xl">
            <h2 className="font-bold text-lg text-ink mb-4">Add Project</h2>
            <form onSubmit={handleAdd} className="space-y-3">
              <input required placeholder="Project Name (e.g. Sevenhood Tower)" value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))} className="w-full border border-border rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-forest" />
              <input placeholder="Location (e.g. Downtown Riyadh)" value={form.location} onChange={e => setForm(f => ({...f, location: e.target.value}))} className="w-full border border-border rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-forest" />
              <textarea placeholder="Description (optional)" value={form.description} onChange={e => setForm(f => ({...f, description: e.target.value}))} rows={3} className="w-full border border-border rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-forest resize-none" />
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 border border-border rounded-xl py-2 text-sm">Cancel</button>
                <button type="submit" disabled={saving} className="flex-1 bg-forest text-white rounded-xl py-2 text-sm font-medium disabled:opacity-50">
                  {saving ? 'Saving...' : 'Add Project'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
