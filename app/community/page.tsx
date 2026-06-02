'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Post, Event, Project } from '@/lib/types'

type Tab = 'announcements' | 'posts' | 'events'

const EMPTY_ANNOUNCEMENT_FORM = {
  title: '',
  content: '',
  project_id: '',
  scheduled_at: '',
  is_pinned: false,
}

const EMPTY_EVENT_FORM = {
  name: '',
  date: '',
  time: '',
  location: '',
  capacity: '',
  emoji: '',
}

export default function CommunityPage() {
  const [tab, setTab] = useState<Tab>('announcements')
  const [posts, setPosts] = useState<Post[]>([])
  const [events, setEvents] = useState<Event[]>([])
  const [projects, setProjects] = useState<Pick<Project, 'id' | 'name'>[]>([])
  const [loading, setLoading] = useState(true)

  const [announcementForm, setAnnouncementForm] = useState(EMPTY_ANNOUNCEMENT_FORM)
  const [eventForm, setEventForm] = useState(EMPTY_EVENT_FORM)
  const [savingAnnouncement, setSavingAnnouncement] = useState(false)
  const [savingEvent, setSavingEvent] = useState(false)
  const [showEventModal, setShowEventModal] = useState(false)

  // AI Announcement Generator state
  const [showAIModal, setShowAIModal] = useState(false)
  const [aiForm, setAIForm] = useState({ type: 'maintenance', details: '', tone: 'formal' })
  const [aiGenerating, setAIGenerating] = useState(false)
  const [aiError, setAIError] = useState('')

  async function load() {
    setLoading(true)
    const [p, e, pr] = await Promise.all([
      supabase.from('posts').select('*').order('created_at', { ascending: false }),
      supabase.from('events').select('*').order('date'),
      supabase.from('projects').select('id, name').order('name'),
    ])
    setPosts(p.data ?? [])
    setEvents(e.data ?? [])
    setProjects(pr.data ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function handleGenerateAI(e: React.FormEvent) {
    e.preventDefault()
    setAIGenerating(true)
    setAIError('')
    try {
      const res = await fetch('/api/ai/announcement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: aiForm.type,
          details: aiForm.details,
          tone: aiForm.tone,
          project_name: projects[0]?.name,
        }),
      })
      const data = await res.json()
      if (!res.ok || data.error) {
        setAIError(data.error ?? 'Failed to generate announcement.')
      } else {
        // Fill the announcement form with generated content
        setAnnouncementForm(f => ({
          ...f,
          title: data.title_en,
          content: `${data.body_en}\n\n---\n\n${data.title_ar}\n\n${data.body_ar}`,
        }))
        setShowAIModal(false)
        setAIForm({ type: 'maintenance', details: '', tone: 'formal' })
      }
    } catch {
      setAIError('Network error. Please try again.')
    }
    setAIGenerating(false)
  }

  async function handlePostAnnouncement(e: React.FormEvent) {
    e.preventDefault()
    setSavingAnnouncement(true)
    await supabase.from('posts').insert({
      content: announcementForm.title
        ? `**${announcementForm.title}**\n\n${announcementForm.content}`
        : announcementForm.content,
      is_operator: true,
      author_name: 'Management',
      likes: 0,
      comments: 0,
    })
    setSavingAnnouncement(false)
    setAnnouncementForm(EMPTY_ANNOUNCEMENT_FORM)
    load()
  }

  async function handleAddEvent(e: React.FormEvent) {
    e.preventDefault()
    setSavingEvent(true)
    await supabase.from('events').insert({
      name: eventForm.name,
      date: eventForm.date,
      time: eventForm.time || null,
      location: eventForm.location || null,
      capacity: eventForm.capacity ? parseInt(eventForm.capacity) : null,
      emoji: eventForm.emoji || null,
      rsvp_count: 0,
    })
    setSavingEvent(false)
    setShowEventModal(false)
    setEventForm(EMPTY_EVENT_FORM)
    load()
  }

  async function deletePost(id: string) {
    if (!confirm('Delete this post?')) return
    await supabase.from('posts').delete().eq('id', id)
    load()
  }

  async function deleteEvent(id: string) {
    if (!confirm('Delete this event?')) return
    await supabase.from('events').delete().eq('id', id)
    load()
  }

  const announcements = posts.filter(p => p.is_operator)
  const communityPosts = posts.filter(p => !p.is_operator)

  const tabs: { key: Tab; label: string; count?: number }[] = [
    { key: 'announcements', label: 'Announcements', count: announcements.length },
    { key: 'posts', label: 'Posts', count: communityPosts.length },
    { key: 'events', label: 'Events', count: events.length },
  ]

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-ink">Community</h1>
          <p className="text-slate text-sm mt-1">
            {posts.length} posts &middot; {events.length} events
          </p>
        </div>
        {tab === 'events' && (
          <button
            onClick={() => setShowEventModal(true)}
            className="bg-forest text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-deep transition-colors"
          >
            + Create Event
          </button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: 'Total Posts', value: posts.length },
          { label: 'Total Events', value: events.length },
          { label: 'Active Announcements', value: announcements.length },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-2xl border border-border p-5 shadow-sm">
            <p className="text-xs text-slate uppercase tracking-wide mb-1">{s.label}</p>
            <p className="text-2xl font-bold text-ink">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors flex items-center gap-2 ${
              tab === t.key
                ? 'bg-forest text-white'
                : 'bg-white border border-border text-slate hover:border-forest'
            }`}
          >
            {t.label}
            {t.count != null && (
              <span className={`text-xs px-1.5 py-0.5 rounded-full ${tab === t.key ? 'bg-white/20' : 'bg-border'}`}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Announcements Tab */}
      {tab === 'announcements' && (
        <div className="space-y-6">
          {/* Post Announcement Form */}
          <div className="bg-white rounded-2xl border border-border p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-ink flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-forest inline-block"></span>
                Post New Announcement
              </h3>
              <button
                type="button"
                onClick={() => setShowAIModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-purple-500 to-indigo-500 text-white text-xs font-semibold hover:from-purple-600 hover:to-indigo-600 transition-all shadow-sm"
              >
                ✨ Generate with AI
              </button>
            </div>
            <form onSubmit={handlePostAnnouncement} className="space-y-3">
              <input
                required
                placeholder="Announcement title"
                value={announcementForm.title}
                onChange={e => setAnnouncementForm(f => ({ ...f, title: e.target.value }))}
                className="w-full border border-border rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-forest"
              />
              <textarea
                required
                rows={4}
                placeholder="Write your announcement content..."
                value={announcementForm.content}
                onChange={e => setAnnouncementForm(f => ({ ...f, content: e.target.value }))}
                className="w-full border border-border rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-forest resize-none"
              />
              <div className="flex flex-wrap gap-3">
                <select
                  value={announcementForm.project_id}
                  onChange={e => setAnnouncementForm(f => ({ ...f, project_id: e.target.value }))}
                  className="border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-forest bg-white"
                >
                  <option value="">All Projects</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <input
                  type="datetime-local"
                  value={announcementForm.scheduled_at}
                  onChange={e => setAnnouncementForm(f => ({ ...f, scheduled_at: e.target.value }))}
                  className="border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-forest bg-white"
                />
                <label className="flex items-center gap-2 cursor-pointer border border-border rounded-xl px-3 py-2 bg-white hover:border-forest transition-colors">
                  <input
                    type="checkbox"
                    checked={announcementForm.is_pinned}
                    onChange={e => setAnnouncementForm(f => ({ ...f, is_pinned: e.target.checked }))}
                    className="w-4 h-4 accent-forest"
                  />
                  <span className="text-sm text-ink">Pin announcement</span>
                </label>
              </div>
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={savingAnnouncement}
                  className="bg-gradient-to-r from-forest to-garden text-white px-6 py-2 rounded-xl text-sm font-medium disabled:opacity-50 hover:from-deep hover:to-forest transition-all"
                >
                  {savingAnnouncement ? 'Posting...' : 'Post Announcement'}
                </button>
              </div>
            </form>
          </div>

          {/* Announcements List */}
          <div className="space-y-3">
            {loading && <div className="text-slate text-sm p-4">Loading...</div>}
            {!loading && announcements.length === 0 && (
              <div className="bg-white rounded-2xl border border-border p-6 text-slate text-sm text-center">
                No announcements yet.
              </div>
            )}
            {!loading && announcements.map(p => (
              <div key={p.id} className="bg-white rounded-2xl border border-border p-5 shadow-sm">
                <div className="flex items-start gap-4">
                  <div className="w-9 h-9 rounded-full bg-forest flex items-center justify-center text-white font-semibold text-sm shrink-0">
                    M
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <span className="font-semibold text-sm text-ink">{p.author_name ?? 'Management'}</span>
                      <span className="bg-forest/10 text-forest text-xs px-2 py-0.5 rounded-full font-medium">Operator</span>
                      <span className="text-slate text-xs ml-auto">
                        {new Date(p.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </span>
                    </div>
                    <p className="text-sm text-slate whitespace-pre-wrap">{p.content}</p>
                    <div className="flex gap-4 mt-3 text-xs text-fog">
                      <span>Likes: {p.likes}</span>
                      <span>Comments: {p.comments}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => deletePost(p.id)}
                    className="text-red-400 hover:text-red-600 text-xs shrink-0 font-medium"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Posts Tab */}
      {tab === 'posts' && (
        <div className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-slate text-xs uppercase tracking-wide border-b border-border bg-cream/50">
                <th className="px-6 py-3 text-left">Author</th>
                <th className="px-6 py-3 text-left">Content</th>
                <th className="px-6 py-3 text-left">Likes</th>
                <th className="px-6 py-3 text-left">Comments</th>
                <th className="px-6 py-3 text-left">Date</th>
                <th className="px-6 py-3 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={6} className="px-6 py-10 text-center text-slate">Loading...</td></tr>
              )}
              {!loading && communityPosts.map(p => (
                <tr key={p.id} className="border-b border-border last:border-0 hover:bg-cream/40 transition-colors">
                  <td className="px-6 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-mist text-forest flex items-center justify-center text-xs font-semibold shrink-0">
                        {(p.author_name ?? 'U')[0].toUpperCase()}
                      </div>
                      <span className="font-medium text-ink">{p.author_name ?? 'Unknown'}</span>
                    </div>
                  </td>
                  <td className="px-6 py-3 text-slate max-w-[300px]">
                    <span className="block truncate">{p.content}</span>
                  </td>
                  <td className="px-6 py-3">{p.likes}</td>
                  <td className="px-6 py-3">{p.comments}</td>
                  <td className="px-6 py-3 text-slate">
                    {new Date(p.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </td>
                  <td className="px-6 py-3">
                    <button
                      onClick={() => deletePost(p.id)}
                      className="text-red-400 hover:text-red-600 text-xs font-medium"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
              {!loading && communityPosts.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-10 text-center text-slate">No community posts yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Events Tab */}
      {tab === 'events' && (
        <div className="space-y-3">
          {loading && <div className="text-slate text-sm p-4">Loading...</div>}
          {!loading && events.length === 0 && (
            <div className="bg-white rounded-2xl border border-border p-6 text-slate text-sm text-center">
              No events yet — create one to get started.
            </div>
          )}
          {!loading && events.map(ev => (
            <div key={ev.id} className="bg-white rounded-2xl border border-border p-5 shadow-sm flex items-center gap-5">
              <div className="w-12 h-12 rounded-2xl bg-cream flex items-center justify-center text-2xl shrink-0">
                {ev.emoji ?? '🎉'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-ink">{ev.name}</p>
                <div className="flex flex-wrap gap-3 mt-1 text-xs text-slate">
                  <span>{new Date(ev.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                  {ev.time && <span>{ev.time}</span>}
                  {ev.location && <span>{ev.location}</span>}
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-medium text-ink">
                  {ev.rsvp_count} / {ev.capacity ?? '∞'}
                </p>
                <p className="text-xs text-slate">RSVPs</p>
              </div>
              <button
                onClick={() => deleteEvent(ev.id)}
                className="text-red-400 hover:text-red-600 text-xs font-medium shrink-0"
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Create Event Modal */}
      {showEventModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl">
            <h2 className="font-bold text-lg text-ink mb-5">Create Event</h2>
            <form onSubmit={handleAddEvent} className="space-y-3">
              <div>
                <label className="text-xs text-slate mb-1 block">Event Name <span className="text-red-400">*</span></label>
                <input
                  required
                  placeholder="e.g. Rooftop BBQ Night"
                  value={eventForm.name}
                  onChange={e => setEventForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full border border-border rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-forest"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate mb-1 block">Date <span className="text-red-400">*</span></label>
                  <input
                    required
                    type="date"
                    value={eventForm.date}
                    onChange={e => setEventForm(f => ({ ...f, date: e.target.value }))}
                    className="w-full border border-border rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-forest"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate mb-1 block">Time</label>
                  <input
                    placeholder="e.g. 7:00 PM"
                    value={eventForm.time}
                    onChange={e => setEventForm(f => ({ ...f, time: e.target.value }))}
                    className="w-full border border-border rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-forest"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs text-slate mb-1 block">Location</label>
                <input
                  placeholder="e.g. Rooftop Terrace, Tower A"
                  value={eventForm.location}
                  onChange={e => setEventForm(f => ({ ...f, location: e.target.value }))}
                  className="w-full border border-border rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-forest"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate mb-1 block">Capacity</label>
                  <input
                    type="number"
                    min="1"
                    placeholder="e.g. 50"
                    value={eventForm.capacity}
                    onChange={e => setEventForm(f => ({ ...f, capacity: e.target.value }))}
                    className="w-full border border-border rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-forest"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate mb-1 block">Emoji</label>
                  <input
                    placeholder="e.g. 🎉"
                    value={eventForm.emoji}
                    onChange={e => setEventForm(f => ({ ...f, emoji: e.target.value }))}
                    className="w-full border border-border rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-forest"
                  />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setShowEventModal(false); setEventForm(EMPTY_EVENT_FORM) }}
                  className="flex-1 border border-border rounded-xl py-2 text-sm hover:bg-cream transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingEvent}
                  className="flex-1 bg-forest text-white rounded-xl py-2 text-sm font-medium disabled:opacity-50 hover:bg-deep transition-colors"
                >
                  {savingEvent ? 'Creating...' : 'Create Event'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── AI Announcement Generator Modal ─────────────────────────────────── */}
      {showAIModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <div className="flex items-center gap-2">
                <span className="text-lg">✨</span>
                <h2 className="font-semibold text-ink">AI Announcement Generator</h2>
              </div>
              <button
                onClick={() => { setShowAIModal(false); setAIError('') }}
                className="text-slate hover:text-ink text-lg leading-none"
              >
                ×
              </button>
            </div>
            <form onSubmit={handleGenerateAI} className="p-6 space-y-4">
              {aiError && (
                <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
                  {aiError}
                </div>
              )}
              <div>
                <label className="block text-xs font-semibold text-slate mb-1.5 uppercase tracking-wide">
                  Announcement Type
                </label>
                <select
                  value={aiForm.type}
                  onChange={e => setAIForm(f => ({ ...f, type: e.target.value }))}
                  className="w-full border border-border rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-forest bg-white"
                >
                  <option value="maintenance">🔧 Maintenance Notice</option>
                  <option value="amenity">🏊 Amenity Update</option>
                  <option value="security">🔒 Security Notice</option>
                  <option value="event">🎉 Event / Activity</option>
                  <option value="welcome">👋 Welcome Message</option>
                  <option value="rule">📋 Community Rule Reminder</option>
                  <option value="general">📢 General Announcement</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate mb-1.5 uppercase tracking-wide">
                  Tone
                </label>
                <select
                  value={aiForm.tone}
                  onChange={e => setAIForm(f => ({ ...f, tone: e.target.value }))}
                  className="w-full border border-border rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-forest bg-white"
                >
                  <option value="formal">Formal &amp; Professional</option>
                  <option value="friendly">Warm &amp; Friendly</option>
                  <option value="urgent">Urgent &amp; Important</option>
                  <option value="reminder">Gentle Reminder</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate mb-1.5 uppercase tracking-wide">
                  Brief Details
                </label>
                <textarea
                  required
                  rows={4}
                  placeholder="e.g. The swimming pool will be closed for maintenance from Monday Jan 6 to Wednesday Jan 8. We apologize for the inconvenience."
                  value={aiForm.details}
                  onChange={e => setAIForm(f => ({ ...f, details: e.target.value }))}
                  className="w-full border border-border rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-forest resize-none"
                />
                <p className="text-xs text-fog mt-1">Write in English or Arabic — AI will generate a bilingual announcement.</p>
              </div>
              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => { setShowAIModal(false); setAIError('') }}
                  className="flex-1 border border-border rounded-xl py-2.5 text-sm hover:bg-cream transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={aiGenerating || !aiForm.details.trim()}
                  className="flex-1 bg-gradient-to-r from-purple-500 to-indigo-500 text-white rounded-xl py-2.5 text-sm font-semibold disabled:opacity-50 hover:from-purple-600 hover:to-indigo-600 transition-all flex items-center justify-center gap-2"
                >
                  {aiGenerating ? (
                    <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Generating...</>
                  ) : '✨ Generate Bilingual'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
