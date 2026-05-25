import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// ── Data fetching ─────────────────────────────────────────────────────────────

async function getStats() {
  const [
    projectsRes,
    buildingsRes,
    unitsRes,
    residentsRes,
    ticketsRes,
    passesRes,
    aiRes,
    spRes,
  ] = await Promise.all([
    supabase.from('projects').select('id, status'),
    supabase.from('buildings').select('id'),
    supabase.from('units').select('id, status'),
    supabase.from('residents').select('id'),
    supabase.from('maintenance_tickets').select('id, status'),
    supabase.from('visitor_passes').select('id, status'),
    supabase.from('ai_design_requests').select('id, status'),
    supabase.from('service_providers').select('id, is_active'),
  ])

  const projectRows  = projectsRes.data  ?? []
  const unitRows     = unitsRes.data     ?? []
  const ticketRows   = ticketsRes.data   ?? []
  const passRows     = passesRes.data    ?? []
  const aiRows       = aiRes.data        ?? []
  const spRows       = spRes.data        ?? []

  const occupied = unitRows.filter(u => u.status === 'occupied').length
  const vacant   = unitRows.filter(u => u.status === 'vacant').length

  const openTickets      = ticketRows.filter(t => t.status === 'open').length
  const inProgressTickets = ticketRows.filter(t => t.status === 'in_progress').length
  const completedTickets  = ticketRows.filter(t => t.status === 'completed').length

  // Distinct cities count from projects
  const citiesRes = await supabase.from('projects').select('city_id').not('city_id', 'is', null)
  const cityCount = new Set((citiesRes.data ?? []).map((r: any) => r.city_id)).size

  return {
    totalProjects:    projectRows.length,
    activeProjects:   projectRows.filter(p => p.status === 'active').length,
    totalBuildings:   (buildingsRes.data ?? []).length,
    totalUnits:       unitRows.length,
    occupied,
    vacant,
    totalResidents:   (residentsRes.data ?? []).length,
    openTickets,
    inProgressTickets,
    completedTickets,
    totalTickets:     ticketRows.length,
    pendingPasses:    passRows.filter(p => p.status === 'pending').length,
    cityCount,
    totalAI:          aiRows.length,
    completedAI:      aiRows.filter(a => a.status === 'completed').length,
    totalSP:          spRows.length,
    activeSP:         spRows.filter(s => s.is_active).length,
  }
}

async function getRecentTickets() {
  const { data } = await supabase
    .from('maintenance_tickets')
    .select('id, category, description, status, priority, created_at, projects(name), units(unit_number)')
    .order('created_at', { ascending: false })
    .limit(5)
  return data ?? []
}

async function getRecentActivity() {
  const [ticketsRes, passesRes] = await Promise.all([
    supabase
      .from('maintenance_tickets')
      .select('id, category, status, created_at')
      .order('created_at', { ascending: false })
      .limit(5),
    supabase
      .from('visitor_passes')
      .select('id, visitor_name, status, created_at')
      .order('created_at', { ascending: false })
      .limit(5),
  ])

  const tickets = (ticketsRes.data ?? []).map((t: any) => ({
    id: `t-${t.id}`,
    type: 'ticket' as const,
    label: `Maintenance ticket — ${t.category}`,
    status: t.status,
    created_at: t.created_at,
  }))

  const passes = (passesRes.data ?? []).map((p: any) => ({
    id: `p-${p.id}`,
    type: 'pass' as const,
    label: `Visitor pass — ${p.visitor_name}`,
    status: p.status,
    created_at: p.created_at,
  }))

  return [...tickets, ...passes]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 5)
}

// ── Style maps ────────────────────────────────────────────────────────────────

const TICKET_STATUS_STYLES: Record<string, string> = {
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

const PASS_STATUS_STYLES: Record<string, string> = {
  active:    'bg-green-100 text-green-700',
  pending:   'bg-yellow-100 text-yellow-700',
  expired:   'bg-gray-100 text-gray-500',
  cancelled: 'bg-red-100 text-red-500',
}

// ── Progress Bar ──────────────────────────────────────────────────────────────

function ProgressBar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-2 rounded-full bg-forest/20">
        <div
          className="h-2 rounded-full bg-forest transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-sm font-semibold text-ink w-10 text-right">{pct}%</span>
    </div>
  )
}

// ── Stat Card ─────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
  color = 'bg-white',
}: {
  label: string
  value: number | string
  sub?: string
  color?: string
}) {
  const isColored = color !== 'bg-white'
  return (
    <div className={`${color} rounded-2xl p-5 border border-border shadow-sm`}>
      <div className={`text-3xl font-bold mb-1 ${isColored ? '' : 'text-ink'}`}>{value}</div>
      <div className={`font-semibold text-sm ${isColored ? '' : 'text-ink'}`}>{label}</div>
      {sub && (
        <div className={`text-xs mt-1 ${isColored ? 'opacity-70' : 'text-slate'}`}>{sub}</div>
      )}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function DashboardPage() {
  const [stats, recentTickets, activity] = await Promise.all([
    getStats(),
    getRecentTickets(),
    getRecentActivity(),
  ])

  const today = new Date().toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  const occupancyRate     = stats.totalUnits > 0 ? Math.round((stats.occupied / stats.totalUnits) * 100) : 0
  const resolutionRate    = stats.totalTickets > 0 ? Math.round((stats.completedTickets / stats.totalTickets) * 100) : 0
  const aiConversionRate  = stats.totalAI > 0 ? Math.round((stats.completedAI / stats.totalAI) * 100) : 0

  return (
    <div className="p-8 space-y-6">

      {/* ── Header ── */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink">Dashboard</h1>
          <p className="text-slate text-sm mt-1">Sevenhood Platform · Operator Overview</p>
        </div>
        <div className="text-right">
          <div className="text-sm font-medium text-ink">{today}</div>
          <div className="text-xs text-slate mt-0.5">Live platform data</div>
        </div>
      </div>

      {/* ── Row 1: 4 primary cards ── */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard
          label="Total Projects"
          value={stats.totalProjects}
          sub={`${stats.activeProjects} active`}
          color="bg-forest text-white"
        />
        <StatCard
          label="Total Units"
          value={stats.totalUnits}
          sub={`${stats.occupied} occupied · ${stats.vacant} vacant`}
        />
        <StatCard
          label="Open Tickets"
          value={stats.openTickets}
          sub={`${stats.inProgressTickets} in progress`}
        />
        <StatCard
          label="Pending Visitors"
          value={stats.pendingPasses}
          sub="awaiting approval"
          color="bg-gold text-white"
        />
      </div>

      {/* ── Row 2: 4 secondary cards ── */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard
          label="Total Residents"
          value={stats.totalResidents}
          sub="registered accounts"
        />
        <StatCard
          label="Service Providers"
          value={stats.totalSP}
          sub={`${stats.activeSP} active`}
        />
        <StatCard
          label="AI Design Requests"
          value={stats.totalAI}
          sub={`${stats.completedAI} completed`}
        />
        <StatCard
          label="Cities"
          value={stats.cityCount}
          sub="platform coverage"
        />
      </div>

      {/* ── Row 3: 2-column grid ── */}
      <div className="grid grid-cols-5 gap-4">

        {/* Recent Maintenance Tickets (60%) */}
        <div className="col-span-3 bg-white rounded-2xl border border-border shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-border flex items-center justify-between">
            <h2 className="font-semibold text-ink">Recent Maintenance Tickets</h2>
            <a href="/maintenance" className="text-gold text-sm font-medium hover:underline">View all →</a>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-slate text-xs uppercase tracking-wide border-b border-border bg-cream/60">
                <th className="px-5 py-3 text-left">Project</th>
                <th className="px-5 py-3 text-left">Unit</th>
                <th className="px-5 py-3 text-left">Category</th>
                <th className="px-5 py-3 text-left">Priority</th>
                <th className="px-5 py-3 text-left">Status</th>
              </tr>
            </thead>
            <tbody>
              {(recentTickets as any[]).map(t => (
                <tr key={t.id} className="border-b border-border last:border-0 hover:bg-cream/40">
                  <td className="px-5 py-3 font-medium text-ink max-w-[120px] truncate">
                    {t.projects?.name ?? '—'}
                  </td>
                  <td className="px-5 py-3 text-slate">{t.units?.unit_number ?? '—'}</td>
                  <td className="px-5 py-3 text-slate capitalize">{t.category}</td>
                  <td className="px-5 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${PRIORITY_STYLES[t.priority] ?? ''}`}>
                      {t.priority}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${TICKET_STATUS_STYLES[t.status] ?? ''}`}>
                      {t.status.replace('_', ' ')}
                    </span>
                  </td>
                </tr>
              ))}
              {recentTickets.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-slate">No tickets yet</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Platform Health (40%) */}
        <div className="col-span-2 bg-white rounded-2xl border border-border shadow-sm">
          <div className="px-6 py-4 border-b border-border">
            <h2 className="font-semibold text-ink">Platform Health</h2>
            <p className="text-xs text-slate mt-0.5">Key performance indicators</p>
          </div>
          <div className="px-6 py-5 space-y-5">

            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium text-ink">Occupancy Rate</span>
                <span className="text-xs text-slate">{stats.occupied} / {stats.totalUnits} units</span>
              </div>
              <ProgressBar value={stats.occupied} max={stats.totalUnits} />
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium text-ink">Ticket Resolution Rate</span>
                <span className="text-xs text-slate">{stats.completedTickets} / {stats.totalTickets} tickets</span>
              </div>
              <ProgressBar value={stats.completedTickets} max={stats.totalTickets} />
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium text-ink">Active Projects</span>
                <span className="text-xs text-slate">{stats.activeProjects} / {stats.totalProjects} projects</span>
              </div>
              <ProgressBar value={stats.activeProjects} max={stats.totalProjects} />
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium text-ink">AI Design Conversion</span>
                <span className="text-xs text-slate">{stats.completedAI} / {stats.totalAI} requests</span>
              </div>
              <ProgressBar value={stats.completedAI} max={stats.totalAI} />
            </div>

            {/* Quick stats grid */}
            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border">
              <div className="bg-cream rounded-xl p-3 text-center">
                <div className="text-xl font-bold text-ink">{occupancyRate}%</div>
                <div className="text-xs text-slate mt-0.5">Occupancy</div>
              </div>
              <div className="bg-cream rounded-xl p-3 text-center">
                <div className="text-xl font-bold text-ink">{resolutionRate}%</div>
                <div className="text-xs text-slate mt-0.5">Resolution</div>
              </div>
              <div className="bg-cream rounded-xl p-3 text-center">
                <div className="text-xl font-bold text-ink">{stats.totalBuildings}</div>
                <div className="text-xs text-slate mt-0.5">Buildings</div>
              </div>
              <div className="bg-cream rounded-xl p-3 text-center">
                <div className="text-xl font-bold text-ink">{aiConversionRate}%</div>
                <div className="text-xs text-slate mt-0.5">AI Converted</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Row 4: Recent Activity Feed ── */}
      <div className="bg-white rounded-2xl border border-border shadow-sm">
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <h2 className="font-semibold text-ink">Recent Activity</h2>
          <span className="text-xs text-slate">Tickets &amp; visitor passes</span>
        </div>
        <div className="divide-y divide-border">
          {activity.length === 0 && (
            <div className="px-6 py-8 text-center text-slate text-sm">No recent activity</div>
          )}
          {activity.map(item => (
            <div key={item.id} className="px-6 py-4 flex items-center justify-between hover:bg-cream/40 transition-colors">
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm flex-shrink-0 ${
                  item.type === 'ticket' ? 'bg-forest/10 text-forest' : 'bg-gold/10 text-gold'
                }`}>
                  {item.type === 'ticket' ? '🔧' : '🪪'}
                </div>
                <div>
                  <div className="text-sm font-medium text-ink">{item.label}</div>
                  <div className="text-xs text-slate mt-0.5">
                    {new Date(item.created_at).toLocaleDateString('en-GB', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </div>
                </div>
              </div>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                item.type === 'ticket'
                  ? (TICKET_STATUS_STYLES[item.status] ?? 'bg-gray-100 text-gray-500')
                  : (PASS_STATUS_STYLES[item.status]  ?? 'bg-gray-100 text-gray-500')
              }`}>
                {item.status.replace('_', ' ')}
              </span>
            </div>
          ))}
        </div>
      </div>

    </div>
  )
}
