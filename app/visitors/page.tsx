'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { VisitorPass } from '@/lib/types'

const STATUS_STYLES: Record<string, string> = {
  active:    'bg-green-100 text-green-700',
  pending:   'bg-yellow-100 text-yellow-700',
  expired:   'bg-gray-100 text-gray-500',
  cancelled: 'bg-red-100 text-red-500',
}

export default function VisitorsPage() {
  const [passes, setPasses] = useState<VisitorPass[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('visitor_passes')
      .select('*, units(unit_number), residents(full_name)')
      .order('created_at', { ascending: false })
    setPasses(data ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function updateStatus(id: string, status: string) {
    await supabase.from('visitor_passes').update({ status }).eq('id', id)
    load()
  }

  const filtered = filter === 'all' ? passes : passes.filter(p => p.status === filter)

  const pendingCount = passes.filter(p => p.status === 'pending').length

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-ink">Visitor Passes</h1>
          <p className="text-slate text-sm mt-1">
            {pendingCount > 0 && <span className="text-gold font-medium">{pendingCount} pending approval · </span>}
            {passes.length} total passes
          </p>
        </div>
        <div className="flex gap-2">
          {['all','pending','active','expired'].map(s => (
            <button key={s} onClick={() => setFilter(s)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-colors ${filter === s ? 'bg-forest text-white' : 'bg-white border border-border text-slate hover:border-forest'}`}>
              {s === 'all' ? 'All' : s}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-border shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-slate text-xs uppercase tracking-wide border-b border-border">
              <th className="px-6 py-3 text-left">Visitor</th>
              <th className="px-6 py-3 text-left">Unit</th>
              <th className="px-6 py-3 text-left">Resident</th>
              <th className="px-6 py-3 text-left">Type</th>
              <th className="px-6 py-3 text-left">Valid Until</th>
              <th className="px-6 py-3 text-left">Status</th>
              <th className="px-6 py-3 text-left">Action</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={7} className="px-6 py-8 text-center text-slate">Loading...</td></tr>}
            {!loading && filtered.map((p: any) => (
              <tr key={p.id} className={`border-b border-border last:border-0 hover:bg-cream/50 ${p.status === 'pending' ? 'bg-yellow-50/30' : ''}`}>
                <td className="px-6 py-3 font-medium">{p.visitor_name}</td>
                <td className="px-6 py-3">{p.units?.unit_number ?? '—'}</td>
                <td className="px-6 py-3">{p.residents?.full_name ?? '—'}</td>
                <td className="px-6 py-3 capitalize">{p.pass_type.replace('-',' ')}</td>
                <td className="px-6 py-3 text-slate">{p.valid_until ?? '—'}</td>
                <td className="px-6 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[p.status]}`}>{p.status}</span>
                </td>
                <td className="px-6 py-3">
                  {p.status === 'pending' ? (
                    <div className="flex gap-2">
                      <button onClick={() => updateStatus(p.id, 'active')} className="bg-green-100 text-green-700 px-2 py-1 rounded-lg text-xs font-medium hover:bg-green-200">Approve</button>
                      <button onClick={() => updateStatus(p.id, 'cancelled')} className="bg-red-100 text-red-600 px-2 py-1 rounded-lg text-xs font-medium hover:bg-red-200">Deny</button>
                    </div>
                  ) : (
                    <select value={p.status} onChange={e => updateStatus(p.id, e.target.value)}
                      className="border border-border rounded-lg px-2 py-1 text-xs focus:outline-none focus:border-forest bg-white">
                      <option value="active">Active</option>
                      <option value="pending">Pending</option>
                      <option value="expired">Expired</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                  )}
                </td>
              </tr>
            ))}
            {!loading && filtered.length === 0 && <tr><td colSpan={7} className="px-6 py-8 text-center text-slate">No passes</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}
