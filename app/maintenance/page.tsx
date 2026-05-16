'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { MaintenanceTicket } from '@/lib/types'

const STATUS_STYLES: Record<string, string> = {
  open:        'bg-red-100 text-red-700',
  in_progress: 'bg-yellow-100 text-yellow-700',
  completed:   'bg-green-100 text-green-700',
  cancelled:   'bg-gray-100 text-gray-500',
}
const PRIORITY_STYLES: Record<string, string> = {
  high:   'bg-red-50 text-red-600',
  medium: 'bg-orange-50 text-orange-600',
  low:    'bg-gray-50 text-gray-500',
}

export default function MaintenancePage() {
  const [tickets, setTickets] = useState<MaintenanceTicket[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('maintenance_tickets')
      .select('*, units(unit_number), residents(full_name)')
      .order('created_at', { ascending: false })
    setTickets(data ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function updateStatus(id: string, status: string) {
    await supabase.from('maintenance_tickets').update({ status, updated_at: new Date().toISOString() }).eq('id', id)
    load()
  }

  const filtered = filter === 'all' ? tickets : tickets.filter(t => t.status === filter)

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-ink">Maintenance</h1>
          <p className="text-slate text-sm mt-1">{tickets.filter(t => t.status === 'open').length} open · {tickets.filter(t => t.status === 'in_progress').length} in progress</p>
        </div>
        <div className="flex gap-2">
          {['all','open','in_progress','completed'].map(s => (
            <button key={s} onClick={() => setFilter(s)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-colors ${filter === s ? 'bg-forest text-white' : 'bg-white border border-border text-slate hover:border-forest'}`}>
              {s === 'all' ? 'All' : s.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-border shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-slate text-xs uppercase tracking-wide border-b border-border">
              <th className="px-6 py-3 text-left">Unit</th>
              <th className="px-6 py-3 text-left">Resident</th>
              <th className="px-6 py-3 text-left">Category</th>
              <th className="px-6 py-3 text-left">Description</th>
              <th className="px-6 py-3 text-left">Priority</th>
              <th className="px-6 py-3 text-left">Status</th>
              <th className="px-6 py-3 text-left">Date</th>
              <th className="px-6 py-3 text-left">Action</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={8} className="px-6 py-8 text-center text-slate">Loading...</td></tr>}
            {!loading && filtered.map((t: any) => (
              <tr key={t.id} className="border-b border-border last:border-0 hover:bg-cream/50">
                <td className="px-6 py-3 font-medium">{t.units?.unit_number ?? '—'}</td>
                <td className="px-6 py-3">{t.residents?.full_name ?? '—'}</td>
                <td className="px-6 py-3">{t.category}</td>
                <td className="px-6 py-3 text-slate max-w-xs truncate">{t.description}</td>
                <td className="px-6 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${PRIORITY_STYLES[t.priority]}`}>{t.priority}</span>
                </td>
                <td className="px-6 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[t.status]}`}>{t.status.replace('_',' ')}</span>
                </td>
                <td className="px-6 py-3 text-slate">{new Date(t.created_at).toLocaleDateString()}</td>
                <td className="px-6 py-3">
                  <select value={t.status} onChange={e => updateStatus(t.id, e.target.value)}
                    className="border border-border rounded-lg px-2 py-1 text-xs focus:outline-none focus:border-forest bg-white">
                    <option value="open">Open</option>
                    <option value="in_progress">In Progress</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </td>
              </tr>
            ))}
            {!loading && filtered.length === 0 && <tr><td colSpan={8} className="px-6 py-8 text-center text-slate">No tickets</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}
