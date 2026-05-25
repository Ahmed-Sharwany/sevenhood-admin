'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { AIDesignRequest, ServiceProvider } from '@/lib/types'

// ─── Types ───────────────────────────────────────────────────────────────────

type DesignRow = AIDesignRequest & {
  residents?: { full_name: string }
  units?:     { unit_number: string }
  service_providers?: { name: string }
}

// ─── Badge styles ─────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<string, string> = {
  pending:    'bg-yellow-100 text-yellow-700',
  processing: 'bg-blue-100 text-blue-700',
  completed:  'bg-green-100 text-green-700',
  failed:     'bg-red-100 text-red-700',
}

// ─── Helper: statistical mode ─────────────────────────────────────────────────

function mode(arr: (string | null | undefined)[]): string {
  const counts: Record<string, number> = {}
  for (const v of arr) {
    if (!v) continue
    counts[v] = (counts[v] ?? 0) + 1
  }
  const entries = Object.entries(counts)
  if (!entries.length) return '—'
  return entries.sort((a, b) => b[1] - a[1])[0][0]
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function AIDesignPage() {
  const [requests, setRequests]       = useState<DesignRow[]>([])
  const [providers, setProviders]     = useState<Pick<ServiceProvider, 'id' | 'name'>[]>([])
  const [loading, setLoading]         = useState(true)
  const [filterStatus, setFilterStatus] = useState('')

  // Assign SP modal state
  const [assignTarget, setAssignTarget] = useState<DesignRow | null>(null)
  const [assignProviderId, setAssignProviderId] = useState('')
  const [assigning, setAssigning]       = useState(false)

  // ── Load ──────────────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    setLoading(true)
    const [r, p] = await Promise.all([
      supabase
        .from('ai_design_requests')
        .select('*, residents(full_name), units(unit_number), service_providers(name)')
        .order('created_at', { ascending: false }),
      supabase.from('service_providers').select('id, name').eq('is_active', true).order('name'),
    ])
    if (r.error) console.error(r.error)
    setRequests(r.data ?? [])
    setProviders(p.data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  // ── Stats ─────────────────────────────────────────────────────────────────

  const total      = requests.length
  const processing = requests.filter(r => r.status === 'pending' || r.status === 'processing').length
  const completed  = requests.filter(r => r.status === 'completed').length
  const execRequested = requests.filter(r => r.execution_requested).length
  const conversionRate = total > 0 ? ((execRequested / total) * 100).toFixed(0) : '0'

  const topStyle    = mode(requests.map(r => r.style))
  const topRoomType = mode(requests.map(r => r.room_type))
  const pendingExec = requests.filter(r => r.execution_requested && !r.service_provider_id).length

  // ── Filtered list ─────────────────────────────────────────────────────────

  const filtered = filterStatus
    ? requests.filter(r => r.status === filterStatus)
    : requests

  // ── Assign SP ─────────────────────────────────────────────────────────────

  function openAssign(row: DesignRow) {
    setAssignTarget(row)
    setAssignProviderId(row.service_provider_id ?? '')
  }

  async function handleAssign(e: React.FormEvent) {
    e.preventDefault()
    if (!assignTarget) return
    setAssigning(true)
    const { error } = await supabase
      .from('ai_design_requests')
      .update({ service_provider_id: assignProviderId || null })
      .eq('id', assignTarget.id)
    if (error) console.error(error)
    setAssigning(false)
    setAssignTarget(null)
    load()
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-ink">AI Interior Design</h1>
        <p className="text-slate text-sm mt-1">Design requests submitted by residents from the app</p>
      </div>

      {/* ── Primary Stats Row ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-4 gap-4 mb-4">
        {[
          {
            label: 'Total Requests',
            value: total,
            icon: '✨',
            sub:  'all time',
            color: 'text-ink',
            bg:   'bg-white',
          },
          {
            label: 'Active / Processing',
            value: processing,
            icon: '⏳',
            sub:  'pending + processing',
            color: 'text-blue-600',
            bg:   'bg-blue-50/40',
          },
          {
            label: 'Completed',
            value: completed,
            icon: '✅',
            sub:  'design generated',
            color: 'text-leaf',
            bg:   'bg-green-50/40',
          },
          {
            label: 'Conversion Rate',
            value: `${conversionRate}%`,
            icon: '📈',
            sub:  'execution requested',
            color: 'text-gold',
            bg:   'bg-amber-50/40',
          },
        ].map(stat => (
          <div key={stat.label} className={`${stat.bg} rounded-2xl border border-border p-5 shadow-sm`}>
            <div className="text-2xl mb-1">{stat.icon}</div>
            <div className={`text-2xl font-bold ${stat.color}`}>{stat.value}</div>
            <div className="text-sm font-medium text-ink mt-0.5">{stat.label}</div>
            <div className="text-xs text-fog mt-0.5">{stat.sub}</div>
          </div>
        ))}
      </div>

      {/* ── Secondary Stats Row ───────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-2xl border border-border p-5 shadow-sm flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center text-lg">🎨</div>
          <div>
            <div className="text-xs text-slate">Most Requested Style</div>
            <div className="text-base font-semibold text-ink capitalize">{topStyle}</div>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-border p-5 shadow-sm flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-lg">🏠</div>
          <div>
            <div className="text-xs text-slate">Most Requested Room Type</div>
            <div className="text-base font-semibold text-ink capitalize">{topRoomType}</div>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-border p-5 shadow-sm flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center text-lg">🔔</div>
          <div>
            <div className="text-xs text-slate">Pending Execution Requests</div>
            <div className={`text-2xl font-bold ${pendingExec > 0 ? 'text-gold' : 'text-fog'}`}>{pendingExec}</div>
          </div>
        </div>
      </div>

      {/* Filter + Table */}
      <div className="bg-white rounded-2xl border border-border shadow-sm">
        {/* Toolbar */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="text-sm font-medium text-ink">
            {filtered.length} request{filtered.length !== 1 ? 's' : ''}
            {filterStatus ? ` · ${filterStatus}` : ''}
          </div>
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            className="border border-border rounded-xl px-3 py-1.5 text-sm focus:outline-none focus:border-forest bg-white"
          >
            <option value="">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="processing">Processing</option>
            <option value="completed">Completed</option>
            <option value="failed">Failed</option>
          </select>
        </div>

        {/* Table */}
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-12 text-slate">
            <div className="w-4 h-4 border-2 border-forest border-t-transparent rounded-full animate-spin" />
            Loading design requests...
          </div>
        ) : filtered.length === 0 && !filterStatus ? (
          /* Empty state */
          <div className="py-16 px-8 text-center">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-50 to-blue-50 border border-border flex items-center justify-center text-3xl mx-auto mb-4">
              ✨
            </div>
            <h3 className="text-base font-semibold text-ink mb-1">No AI Design Requests Yet</h3>
            <p className="text-slate text-sm max-w-sm mx-auto">
              AI Design requests will appear here when residents submit them from the app.
              They can upload a photo of their room and choose a design style to regenerate.
            </p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center text-slate text-sm">
            No requests match the selected status filter.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-slate text-xs uppercase tracking-wide border-b border-border">
                  <th className="px-5 py-3 text-left">Resident</th>
                  <th className="px-5 py-3 text-left">Unit</th>
                  <th className="px-5 py-3 text-left">Room Type</th>
                  <th className="px-5 py-3 text-left">Style</th>
                  <th className="px-5 py-3 text-left">Status</th>
                  <th className="px-5 py-3 text-left">Execution</th>
                  <th className="px-5 py-3 text-left">Service Provider</th>
                  <th className="px-5 py-3 text-left">Date</th>
                  <th className="px-5 py-3 text-left">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(r => (
                  <tr key={r.id} className="border-b border-border last:border-0 hover:bg-cream/50 transition-colors">
                    {/* Resident */}
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-forest/10 text-forest flex items-center justify-center text-xs font-semibold shrink-0">
                          {r.residents?.full_name?.[0] ?? '?'}
                        </div>
                        <span className="font-medium">{r.residents?.full_name ?? '—'}</span>
                      </div>
                    </td>

                    {/* Unit */}
                    <td className="px-5 py-3 text-slate">{r.units?.unit_number ?? '—'}</td>

                    {/* Room Type */}
                    <td className="px-5 py-3 capitalize">{r.room_type ?? '—'}</td>

                    {/* Style */}
                    <td className="px-5 py-3">
                      {r.style ? (
                        <span className="px-2.5 py-1 rounded-lg bg-purple-50 text-purple-700 text-xs font-medium capitalize">
                          {r.style}
                        </span>
                      ) : '—'}
                    </td>

                    {/* Status */}
                    <td className="px-5 py-3">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium capitalize ${STATUS_STYLES[r.status]}`}>
                        {r.status}
                      </span>
                    </td>

                    {/* Execution Requested */}
                    <td className="px-5 py-3">
                      {r.execution_requested ? (
                        <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                          Yes
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-500">
                          No
                        </span>
                      )}
                    </td>

                    {/* Service Provider */}
                    <td className="px-5 py-3">
                      {r.service_providers?.name ? (
                        <span className="text-sm font-medium text-ink">{r.service_providers.name}</span>
                      ) : (
                        <span className="text-fog text-sm">Unassigned</span>
                      )}
                    </td>

                    {/* Date */}
                    <td className="px-5 py-3 text-slate whitespace-nowrap">
                      {new Date(r.created_at).toLocaleDateString()}
                    </td>

                    {/* Actions */}
                    <td className="px-5 py-3">
                      {r.status === 'completed' && (
                        <button
                          onClick={() => openAssign(r)}
                          className="px-3 py-1.5 bg-forest text-white rounded-xl text-xs font-medium hover:bg-deep transition-colors whitespace-nowrap"
                        >
                          Assign SP
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ─── Assign SP Modal ────────────────────────────────────────────────── */}
      {assignTarget && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="font-bold text-base text-ink">Assign Service Provider</h2>
                <p className="text-xs text-slate mt-0.5">
                  {assignTarget.residents?.full_name ?? '—'} · {assignTarget.units?.unit_number ?? '—'} · {assignTarget.style ?? '—'} design
                </p>
              </div>
              <button onClick={() => setAssignTarget(null)} className="text-fog hover:text-slate text-xl leading-none">&times;</button>
            </div>

            <form onSubmit={handleAssign} className="space-y-4">
              <div>
                <label className="text-xs text-slate mb-1 block">Service Provider</label>
                <select
                  value={assignProviderId}
                  onChange={e => setAssignProviderId(e.target.value)}
                  className="w-full border border-border rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-forest bg-white"
                >
                  <option value="">— Unassign —</option>
                  {providers.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setAssignTarget(null)}
                  className="flex-1 border border-border rounded-xl py-2 text-sm hover:bg-cream transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={assigning}
                  className="flex-1 bg-forest text-white rounded-xl py-2 text-sm font-medium disabled:opacity-50 hover:bg-deep transition-colors"
                >
                  {assigning ? 'Saving...' : 'Confirm Assignment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
