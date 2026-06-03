'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

type Building = { id: string; name: string }
type Project  = { id: string; name: string }

type NotificationHistory = {
  id: string
  title: string
  body: string
  target: string
  sent_at: string
  recipient_count: number
}

export default function NotificationsPage() {
  // Form state
  const [title,     setTitle]     = useState('')
  const [body,      setBody]      = useState('')
  const [targetType, setTargetType] = useState<'all' | 'building' | 'project'>('all')
  const [selectedBuilding, setSelectedBuilding] = useState('')
  const [selectedProject,  setSelectedProject]  = useState('')
  const [screen,    setScreen]    = useState('')
  const [sending,   setSending]   = useState(false)
  const [success,   setSuccess]   = useState<string | null>(null)
  const [error,     setError]     = useState<string | null>(null)

  // Data
  const [buildings, setBuildings] = useState<Building[]>([])
  const [projects,  setProjects]  = useState<Project[]>([])
  const [history,   setHistory]   = useState<NotificationHistory[]>([])
  const [histLoading, setHistLoading] = useState(true)

  useEffect(() => {
    supabase.from('buildings').select('id, name').order('name').then(({ data }) => setBuildings(data ?? []))
    supabase.from('projects').select('id, name').order('name').then(({ data }) => setProjects(data ?? []))
    loadHistory()
  }, [])

  async function loadHistory() {
    setHistLoading(true)
    const { data } = await supabase
      .from('notification_log')
      .select('*')
      .order('sent_at', { ascending: false })
      .limit(20)
    setHistory(data ?? [])
    setHistLoading(false)
  }

  async function handleSend() {
    if (!title.trim() || !body.trim()) {
      setError('Title and message are required.')
      return
    }

    setSending(true)
    setError(null)
    setSuccess(null)

    try {
      // Call the send-notification edge function
      const payload: Record<string, any> = {
        title: title.trim(),
        body: body.trim(),
        data: screen ? { screen } : {},
      }
      if (targetType === 'building' && selectedBuilding) {
        payload.buildingId = selectedBuilding
      } else if (targetType === 'project' && selectedProject) {
        payload.projectId = selectedProject
      }
      // 'all' sends to everyone (no filter)

      const { data, error: fnError } = await supabase.functions.invoke('send-notification', {
        body: payload,
      })

      if (fnError) throw fnError

      const count = data?.sent ?? 0
      setSuccess(`Notification sent to ${count} resident${count !== 1 ? 's' : ''}.`)
      setTitle('')
      setBody('')
      setScreen('')
      setTargetType('all')
      setSelectedBuilding('')
      setSelectedProject('')
      loadHistory()
    } catch (err: any) {
      setError(err.message ?? 'Failed to send notification. Please try again.')
    } finally {
      setSending(false)
    }
  }

  const charCount = body.length
  const isOverLimit = charCount > 200

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-8">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-forest">Push Notifications</h1>
        <p className="text-sm text-gray-500 mt-1">Send announcements and alerts to residents via their mobile app.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">

        {/* ── Compose form ──────────────────────────────────────────────── */}
        <div className="lg:col-span-3 bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-5">
          <h2 className="text-base font-semibold text-forest">Compose Message</h2>

          {/* Title */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
              Title
            </label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. Pool maintenance this Saturday"
              maxLength={80}
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-forest/30"
            />
          </div>

          {/* Body */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
              Message
            </label>
            <textarea
              value={body}
              onChange={e => setBody(e.target.value)}
              placeholder="Write your message here…"
              rows={4}
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-forest/30 resize-none"
            />
            <p className={`text-xs mt-1 text-right ${isOverLimit ? 'text-red-500' : 'text-gray-400'}`}>
              {charCount}/200
            </p>
          </div>

          {/* Deep-link screen */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
              Deep Link (optional)
            </label>
            <select
              value={screen}
              onChange={e => setScreen(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-forest/30"
            >
              <option value="">No deep link (opens app home)</option>
              <option value="maintenance">Maintenance Tickets</option>
              <option value="bookings">Bookings</option>
              <option value="community">Community</option>
              <option value="visitors">Visitors</option>
              <option value="property">My Unit / Property</option>
            </select>
          </div>

          {/* Target audience */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
              Recipients
            </label>
            <div className="flex gap-2 flex-wrap">
              {(['all', 'building', 'project'] as const).map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTargetType(t)}
                  className={`px-4 py-2 rounded-xl text-sm font-medium border transition-colors ${
                    targetType === t
                      ? 'bg-forest text-white border-forest'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-forest/40'
                  }`}
                >
                  {t === 'all' ? 'All Residents' : t === 'building' ? 'By Building' : 'By Project'}
                </button>
              ))}
            </div>

            {targetType === 'building' && (
              <select
                value={selectedBuilding}
                onChange={e => setSelectedBuilding(e.target.value)}
                className="mt-3 w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-forest/30"
              >
                <option value="">Select building…</option>
                {buildings.map(b => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            )}

            {targetType === 'project' && (
              <select
                value={selectedProject}
                onChange={e => setSelectedProject(e.target.value)}
                className="mt-3 w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-forest/30"
              >
                <option value="">Select project…</option>
                {projects.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            )}
          </div>

          {/* Feedback */}
          {success && (
            <div className="rounded-xl bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700 font-medium">
              ✓ {success}
            </div>
          )}
          {error && (
            <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 font-medium">
              ✗ {error}
            </div>
          )}

          {/* Send button */}
          <button
            type="button"
            onClick={handleSend}
            disabled={sending || isOverLimit || !title.trim() || !body.trim()}
            className="w-full bg-forest text-white rounded-xl py-3 font-semibold text-sm hover:bg-forest/90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
          >
            {sending ? 'Sending…' : 'Send Notification'}
          </button>
        </div>

        {/* ── Preview panel ──────────────────────────────────────────────── */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">Preview</h3>
            <div className="bg-gray-900 rounded-2xl p-4 shadow-xl">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-gold flex items-center justify-center text-white text-xs font-bold shrink-0">
                  S
                </div>
                <div className="flex-1">
                  <p className="text-white text-xs font-semibold leading-tight">
                    {title || 'Notification Title'}
                  </p>
                  <p className="text-white/60 text-xs mt-1 leading-snug">
                    {body || 'Your message will appear here…'}
                  </p>
                </div>
              </div>
            </div>
            <p className="text-xs text-gray-400 mt-3 text-center">iOS lock-screen preview</p>
          </div>

          {/* Tips */}
          <div className="bg-amber-50 border border-amber-100 rounded-2xl p-5">
            <h3 className="text-xs font-semibold text-amber-700 uppercase tracking-wider mb-2">Tips</h3>
            <ul className="text-xs text-amber-700 space-y-1.5 list-disc pl-4">
              <li>Keep titles under 50 characters for best visibility</li>
              <li>Messages show only the first ~100 chars on lock screen</li>
              <li>Use deep links to send users directly to the right screen</li>
              <li>Respect quiet hours — avoid sending after 10 PM</li>
            </ul>
          </div>
        </div>
      </div>

      {/* ── History table ──────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-base font-semibold text-forest">Recent Notifications</h2>
          <button onClick={loadHistory} className="text-xs text-gray-400 hover:text-forest transition-colors">
            Refresh
          </button>
        </div>
        {histLoading ? (
          <div className="py-12 text-center text-sm text-gray-400">Loading…</div>
        ) : history.length === 0 ? (
          <div className="py-12 text-center text-sm text-gray-400">No notifications sent yet.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wider">
                <th className="px-6 py-3 text-left font-semibold">Title</th>
                <th className="px-6 py-3 text-left font-semibold">Target</th>
                <th className="px-6 py-3 text-left font-semibold">Recipients</th>
                <th className="px-6 py-3 text-left font-semibold">Sent At</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {history.map(n => (
                <tr key={n.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-3.5">
                    <p className="font-medium text-gray-800">{n.title}</p>
                    <p className="text-gray-400 text-xs mt-0.5 truncate max-w-xs">{n.body}</p>
                  </td>
                  <td className="px-6 py-3.5 text-gray-600">{n.target ?? 'All'}</td>
                  <td className="px-6 py-3.5 text-gray-600">{n.recipient_count ?? '—'}</td>
                  <td className="px-6 py-3.5 text-gray-500 text-xs">
                    {new Date(n.sent_at).toLocaleString('en-SA', {
                      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                    })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
