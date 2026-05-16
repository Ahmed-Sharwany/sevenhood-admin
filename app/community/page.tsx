'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Post, Event } from '@/lib/types'

export default function CommunityPage() {
  const [tab, setTab] = useState<'posts' | 'events'>('posts')
  const [posts, setPosts] = useState<Post[]>([])
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)
  const [showPostModal, setShowPostModal] = useState(false)
  const [showEventModal, setShowEventModal] = useState(false)
  const [postForm, setPostForm] = useState({ content: '', author_name: '' })
  const [eventForm, setEventForm] = useState({ name: '', date: '', time: '', location: '', capacity: '', emoji: '🎉' })
  const [saving, setSaving] = useState(false)

  async function load() {
    setLoading(true)
    const [p, e] = await Promise.all([
      supabase.from('posts').select('*').order('created_at', { ascending: false }),
      supabase.from('events').select('*').order('date'),
    ])
    setPosts(p.data ?? [])
    setEvents(e.data ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function addPost(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    await supabase.from('posts').insert({ ...postForm, is_operator: true })
    setSaving(false)
    setShowPostModal(false)
    setPostForm({ content: '', author_name: '' })
    load()
  }

  async function addEvent(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    await supabase.from('events').insert({
      ...eventForm,
      capacity: eventForm.capacity ? parseInt(eventForm.capacity) : null,
    })
    setSaving(false)
    setShowEventModal(false)
    setEventForm({ name: '', date: '', time: '', location: '', capacity: '', emoji: '🎉' })
    load()
  }

  async function deletePost(id: string) {
    if (!confirm('Delete post?')) return
    await supabase.from('posts').delete().eq('id', id)
    load()
  }

  async function deleteEvent(id: string) {
    if (!confirm('Delete event?')) return
    await supabase.from('events').delete().eq('id', id)
    load()
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-ink">Community</h1>
          <p className="text-slate text-sm mt-1">{posts.length} posts · {events.length} events</p>
        </div>
        <button onClick={() => tab === 'posts' ? setShowPostModal(true) : setShowEventModal(true)}
          className="bg-forest text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-deep transition-colors">
          + Add {tab === 'posts' ? 'Post' : 'Event'}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        {(['posts', 'events'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-xl text-sm font-medium capitalize transition-colors ${tab === t ? 'bg-forest text-white' : 'bg-white border border-border text-slate hover:border-forest'}`}>
            {t}
          </button>
        ))}
      </div>

      {/* Posts */}
      {tab === 'posts' && (
        <div className="space-y-3">
          {loading && <div className="text-slate text-sm p-4">Loading...</div>}
          {!loading && posts.map(p => (
            <div key={p.id} className="bg-white rounded-2xl border border-border p-5 flex gap-4">
              <div className="w-9 h-9 rounded-full bg-forest/10 text-forest flex items-center justify-center font-semibold text-sm shrink-0">
                {p.author_name?.[0] ?? 'O'}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-sm">{p.author_name ?? 'Operator'}</span>
                  {p.is_operator && <span className="bg-gold/10 text-gold text-xs px-2 py-0.5 rounded-full font-medium">Operator</span>}
                  <span className="text-slate text-xs ml-auto">{new Date(p.created_at).toLocaleDateString()}</span>
                </div>
                <p className="text-sm text-slate">{p.content}</p>
                <div className="flex gap-4 mt-2 text-xs text-fog">
                  <span>👍 {p.likes}</span>
                  <span>💬 {p.comments}</span>
                </div>
              </div>
              <button onClick={() => deletePost(p.id)} className="text-red-400 hover:text-red-600 text-xs self-start">Delete</button>
            </div>
          ))}
          {!loading && posts.length === 0 && <div className="text-slate text-sm p-4 bg-white rounded-2xl border border-border">No posts yet</div>}
        </div>
      )}

      {/* Events */}
      {tab === 'events' && (
        <div className="bg-white rounded-2xl border border-border shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-slate text-xs uppercase tracking-wide border-b border-border">
                <th className="px-6 py-3 text-left">Event</th>
                <th className="px-6 py-3 text-left">Date</th>
                <th className="px-6 py-3 text-left">Time</th>
                <th className="px-6 py-3 text-left">Location</th>
                <th className="px-6 py-3 text-left">RSVPs</th>
                <th className="px-6 py-3 text-left"></th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={6} className="px-6 py-8 text-center text-slate">Loading...</td></tr>}
              {!loading && events.map(ev => (
                <tr key={ev.id} className="border-b border-border last:border-0 hover:bg-cream/50">
                  <td className="px-6 py-3 font-medium">{ev.emoji} {ev.name}</td>
                  <td className="px-6 py-3">{ev.date}</td>
                  <td className="px-6 py-3">{ev.time ?? '—'}</td>
                  <td className="px-6 py-3 text-slate">{ev.location ?? '—'}</td>
                  <td className="px-6 py-3">{ev.rsvp_count} / {ev.capacity ?? '∞'}</td>
                  <td className="px-6 py-3">
                    <button onClick={() => deleteEvent(ev.id)} className="text-red-400 hover:text-red-600 text-xs">Delete</button>
                  </td>
                </tr>
              ))}
              {!loading && events.length === 0 && <tr><td colSpan={6} className="px-6 py-8 text-center text-slate">No events yet</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {/* Add Post Modal */}
      {showPostModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-96 shadow-xl">
            <h2 className="font-bold text-lg text-ink mb-4">Post Announcement</h2>
            <form onSubmit={addPost} className="space-y-3">
              <input placeholder="Author name (optional)" value={postForm.author_name} onChange={e => setPostForm(f => ({...f, author_name: e.target.value}))} className="w-full border border-border rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-forest" />
              <textarea required rows={4} placeholder="Write your announcement..." value={postForm.content} onChange={e => setPostForm(f => ({...f, content: e.target.value}))} className="w-full border border-border rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-forest resize-none" />
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowPostModal(false)} className="flex-1 border border-border rounded-xl py-2 text-sm">Cancel</button>
                <button type="submit" disabled={saving} className="flex-1 bg-forest text-white rounded-xl py-2 text-sm font-medium disabled:opacity-50">{saving ? 'Posting...' : 'Post'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Event Modal */}
      {showEventModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-96 shadow-xl">
            <h2 className="font-bold text-lg text-ink mb-4">Create Event</h2>
            <form onSubmit={addEvent} className="space-y-3">
              <input required placeholder="Event name" value={eventForm.name} onChange={e => setEventForm(f => ({...f, name: e.target.value}))} className="w-full border border-border rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-forest" />
              <input required type="date" value={eventForm.date} onChange={e => setEventForm(f => ({...f, date: e.target.value}))} className="w-full border border-border rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-forest" />
              <input placeholder="Time (e.g. 6:00 PM)" value={eventForm.time} onChange={e => setEventForm(f => ({...f, time: e.target.value}))} className="w-full border border-border rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-forest" />
              <input placeholder="Location" value={eventForm.location} onChange={e => setEventForm(f => ({...f, location: e.target.value}))} className="w-full border border-border rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-forest" />
              <div className="grid grid-cols-2 gap-3">
                <input type="number" placeholder="Capacity" value={eventForm.capacity} onChange={e => setEventForm(f => ({...f, capacity: e.target.value}))} className="border border-border rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-forest" />
                <input placeholder="Emoji" value={eventForm.emoji} onChange={e => setEventForm(f => ({...f, emoji: e.target.value}))} className="border border-border rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-forest" />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowEventModal(false)} className="flex-1 border border-border rounded-xl py-2 text-sm">Cancel</button>
                <button type="submit" disabled={saving} className="flex-1 bg-forest text-white rounded-xl py-2 text-sm font-medium disabled:opacity-50">{saving ? 'Creating...' : 'Create'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
