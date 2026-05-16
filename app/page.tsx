import { supabase } from '@/lib/supabase'

async function getStats() {
  const [units, residents, tickets, passes] = await Promise.all([
    supabase.from('units').select('status'),
    supabase.from('residents').select('id'),
    supabase.from('maintenance_tickets').select('status'),
    supabase.from('visitor_passes').select('status'),
  ])
  const unitRows = units.data ?? []
  const ticketRows = tickets.data ?? []
  return {
    totalUnits:    unitRows.length,
    occupied:      unitRows.filter(u => u.status === 'occupied').length,
    vacant:        unitRows.filter(u => u.status === 'vacant').length,
    totalResidents: (residents.data ?? []).length,
    openTickets:   ticketRows.filter(t => t.status === 'open').length,
    inProgress:    ticketRows.filter(t => t.status === 'in_progress').length,
    pendingPasses: (passes.data ?? []).filter(p => p.status === 'pending').length,
  }
}

async function getRecentTickets() {
  const { data } = await supabase
    .from('maintenance_tickets')
    .select('id, category, description, status, priority, created_at, units(unit_number)')
    .order('created_at', { ascending: false })
    .limit(5)
  return data ?? []
}

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

export default async function DashboardPage() {
  const [stats, tickets] = await Promise.all([getStats(), getRecentTickets()])

  const CARDS = [
    { label: 'Total Units',     value: stats.totalUnits,     sub: `${stats.occupied} occupied · ${stats.vacant} vacant`, color: 'bg-forest text-white' },
    { label: 'Residents',       value: stats.totalResidents, sub: 'registered accounts',                                  color: 'bg-white' },
    { label: 'Open Tickets',    value: stats.openTickets,    sub: `${stats.inProgress} in progress`,                      color: 'bg-white' },
    { label: 'Pending Passes',  value: stats.pendingPasses,  sub: 'awaiting approval',                                    color: 'bg-gold text-white' },
  ]

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-ink">Dashboard</h1>
        <p className="text-slate text-sm mt-1">Sevenhood Tower · Operator Overview</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        {CARDS.map(({ label, value, sub, color }) => (
          <div key={label} className={`rounded-2xl p-5 shadow-sm border border-border ${color}`}>
            <div className="text-3xl font-bold mb-1">{value}</div>
            <div className="font-semibold text-sm">{label}</div>
            <div className={`text-xs mt-1 ${color.includes('white') ? 'text-slate' : 'opacity-70'}`}>{sub}</div>
          </div>
        ))}
      </div>

      {/* Recent maintenance tickets */}
      <div className="bg-white rounded-2xl border border-border shadow-sm">
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <h2 className="font-semibold text-ink">Recent Maintenance Tickets</h2>
          <a href="/maintenance" className="text-gold text-sm font-medium hover:underline">View all →</a>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-slate text-xs uppercase tracking-wide border-b border-border">
              <th className="px-6 py-3 text-left">Unit</th>
              <th className="px-6 py-3 text-left">Category</th>
              <th className="px-6 py-3 text-left">Description</th>
              <th className="px-6 py-3 text-left">Priority</th>
              <th className="px-6 py-3 text-left">Status</th>
            </tr>
          </thead>
          <tbody>
            {tickets.map((t: any) => (
              <tr key={t.id} className="border-b border-border last:border-0 hover:bg-cream/50">
                <td className="px-6 py-3 font-medium">{t.units?.unit_number ?? '—'}</td>
                <td className="px-6 py-3">{t.category}</td>
                <td className="px-6 py-3 text-slate max-w-xs truncate">{t.description}</td>
                <td className="px-6 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${PRIORITY_STYLES[t.priority]}`}>
                    {t.priority}
                  </span>
                </td>
                <td className="px-6 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[t.status]}`}>
                    {t.status.replace('_', ' ')}
                  </span>
                </td>
              </tr>
            ))}
            {tickets.length === 0 && (
              <tr><td colSpan={5} className="px-6 py-8 text-center text-slate">No tickets yet</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
