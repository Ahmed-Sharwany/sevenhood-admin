'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@supabase/supabase-js'

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// ─── Types ────────────────────────────────────────────────────────────────────

interface AuditEntry {
  id:           string
  event_type:   string
  invoice_id:   string | null
  performed_by: string | null
  details:      Record<string, unknown>
  created_at:   string
  // Supabase returns foreign-key joins as arrays; we take index [0]
  invoices?: {
    invoice_number: string
    total: number
    invoice_type: 'subscription' | 'commission'
    status: string
  }[] | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const EVENT_META: Record<string, { label: string; color: string; icon: string }> = {
  invoice_generated: { label: 'Generated',    color: 'bg-blue-100 text-blue-700',    icon: '🧾' },
  invoice_paid:      { label: 'Paid',          color: 'bg-green-100 text-green-700',  icon: '✅' },
  invoice_cancelled: { label: 'Cancelled',     color: 'bg-red-100 text-red-700',      icon: '❌' },
  overdue_reminder:  { label: 'Reminder Sent', color: 'bg-orange-100 text-orange-700', icon: '🔔' },
  credit_note:       { label: 'Credit Note',   color: 'bg-amber-100 text-amber-700',  icon: '📝' },
  adjustment:        { label: 'Adjustment',    color: 'bg-purple-100 text-purple-700', icon: '⚙️' },
}

function sar(n: number | undefined | null) {
  if (n == null) return '—'
  return new Intl.NumberFormat('en-SA', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)
}

function fmt(iso: string) {
  return new Date(iso).toLocaleString('en-SA', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function DetailRow({ label, value }: { label: string; value: unknown }) {
  if (value == null || value === '') return null
  const display = typeof value === 'object'
    ? JSON.stringify(value, null, 2)
    : String(value)
  return (
    <div className="flex gap-2 text-xs leading-relaxed">
      <span className="text-slate-400 shrink-0 w-36">{label}</span>
      <span className="text-slate-700 break-all font-mono">{display}</span>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const ALL_EVENTS = ['invoice_generated', 'invoice_paid', 'invoice_cancelled', 'overdue_reminder', 'credit_note', 'adjustment']

export default function BillingAuditPage() {
  const [entries,    setEntries]    = useState<AuditEntry[]>([])
  const [loading,    setLoading]    = useState(true)
  const [search,     setSearch]     = useState('')
  const [filterType, setFilterType] = useState('all')
  const [filterPeriod, setFilterPeriod] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [page,       setPage]       = useState(0)
  const PAGE_SIZE = 50

  const load = useCallback(async () => {
    setLoading(true)
    let q = db
      .from('billing_audit_log')
      .select(`
        id, event_type, invoice_id, performed_by, details, created_at,
        invoices ( invoice_number, total, invoice_type, status )
      `)
      .order('created_at', { ascending: false })
      .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1)

    if (filterType !== 'all') q = q.eq('event_type', filterType)
    if (filterPeriod)         q = q.gte('created_at', `${filterPeriod}-01T00:00:00Z`)
                                   .lte('created_at', `${filterPeriod}-31T23:59:59Z`)

    const { data, error } = await q
    if (error) console.error('[audit]', error)
    setEntries((data as AuditEntry[]) ?? [])
    setLoading(false)
  }, [page, filterType, filterPeriod])

  useEffect(() => { load() }, [load])

  // Client-side search filter
  const visible = entries.filter(e => {
    if (!search) return true
    const q = search.toLowerCase()
    const inv = e.invoices?.invoice_number?.toLowerCase() ?? ''
    const det = JSON.stringify(e.details).toLowerCase()
    return inv.includes(q) || det.includes(q)
  })

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Billing Audit Trail</h1>
          <p className="text-sm text-slate-500 mt-1">
            Immutable log of all billing events — invoice generation, payments, cancellations and adjustments.
          </p>
        </div>
        <button
          onClick={load}
          className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
        >
          ↻ Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <input
          type="text"
          placeholder="Search invoice number, account, provider…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="flex-1 min-w-64 px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-forest/30"
        />

        <select
          value={filterType}
          onChange={e => { setFilterType(e.target.value); setPage(0) }}
          className="px-4 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-forest/30"
        >
          <option value="all">All event types</option>
          {ALL_EVENTS.map(t => (
            <option key={t} value={t}>{EVENT_META[t]?.label ?? t}</option>
          ))}
        </select>

        <input
          type="month"
          value={filterPeriod}
          onChange={e => { setFilterPeriod(e.target.value); setPage(0) }}
          className="px-4 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-forest/30"
        />

        {(filterType !== 'all' || filterPeriod || search) && (
          <button
            onClick={() => { setFilterType('all'); setFilterPeriod(''); setSearch(''); setPage(0) }}
            className="px-4 py-2.5 text-sm text-red-600 border border-red-200 rounded-xl hover:bg-red-50 transition-colors"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Stats strip */}
      {!loading && entries.length > 0 && (
        <div className="flex gap-4 flex-wrap">
          {ALL_EVENTS.map(type => {
            const count = entries.filter(e => e.event_type === type).length
            if (count === 0) return null
            const meta  = EVENT_META[type] ?? { label: type, color: 'bg-slate-100 text-slate-600', icon: '•' }
            return (
              <button
                key={type}
                onClick={() => { setFilterType(type); setPage(0) }}
                className={`px-3 py-1.5 rounded-full text-xs font-medium ${meta.color} hover:opacity-80 transition-opacity`}
              >
                {meta.icon} {meta.label}: {count}
              </button>
            )
          })}
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-16 text-center text-slate-400 text-sm">Loading audit log…</div>
        ) : visible.length === 0 ? (
          <div className="p-16 text-center text-slate-400">
            <div className="text-4xl mb-3">📋</div>
            <div className="font-medium">No audit entries found</div>
            <div className="text-sm mt-1">Events will appear here after invoices are generated.</div>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="px-5 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Date / Time</th>
                <th className="px-5 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Event</th>
                <th className="px-5 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Invoice</th>
                <th className="px-5 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Type</th>
                <th className="px-5 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Amount</th>
                <th className="px-5 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Period</th>
                <th className="px-5 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Actor</th>
                <th className="px-5 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {visible.map(entry => {
                const meta   = EVENT_META[entry.event_type] ?? { label: entry.event_type, color: 'bg-slate-100 text-slate-600', icon: '•' }
                const d      = entry.details
                const period = (d.period_start && d.period_end)
                  ? `${String(d.period_start).slice(0, 7)}`
                  : ''
                const actor  = d.generated_by
                  ? String(d.generated_by)
                  : entry.performed_by
                    ? `User ${String(entry.performed_by).slice(0, 8)}`
                    : 'system'
                const name   = String(d.account_name ?? d.provider_name ?? '—')
                const isOpen = expandedId === entry.id

                return (
                  <>
                    <tr
                      key={entry.id}
                      className="hover:bg-slate-50/60 cursor-pointer transition-colors"
                      onClick={() => setExpandedId(isOpen ? null : entry.id)}
                    >
                      <td className="px-5 py-4 text-slate-600 whitespace-nowrap font-mono text-xs">
                        {fmt(entry.created_at)}
                      </td>
                      <td className="px-5 py-4">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${meta.color}`}>
                          {meta.icon} {meta.label}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        {entry.invoices?.[0]?.invoice_number
                          ? <a
                              href={`/billing/invoices/${entry.invoice_id}`}
                              onClick={e => e.stopPropagation()}
                              className="font-mono text-xs text-forest hover:underline"
                            >
                              {entry.invoices[0].invoice_number}
                            </a>
                          : <span className="text-slate-400 text-xs">—</span>
                        }
                      </td>
                      <td className="px-5 py-4">
                        {entry.invoices?.[0]?.invoice_type ? (
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                            entry.invoices[0].invoice_type === 'subscription'
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-purple-100 text-purple-700'
                          }`}>
                            {entry.invoices[0].invoice_type === 'subscription' ? 'Subscription' : 'Commission'}
                          </span>
                        ) : (
                          <span className="text-slate-400 text-xs">—</span>
                        )}
                      </td>
                      <td className="px-5 py-4 font-semibold text-slate-800">
                        {entry.invoices?.[0]?.total != null
                          ? `SAR ${sar(entry.invoices[0].total)}`
                          : <span className="text-slate-400 font-normal">—</span>
                        }
                      </td>
                      <td className="px-5 py-4 text-slate-500 font-mono text-xs">{period || '—'}</td>
                      <td className="px-5 py-4 text-slate-500 text-xs">{name}</td>
                      <td className="px-5 py-4 text-slate-400 text-xs">
                        <span className={`transition-transform inline-block ${isOpen ? 'rotate-90' : ''}`}>›</span>
                      </td>
                    </tr>

                    {/* Expanded details row */}
                    {isOpen && (
                      <tr key={`${entry.id}-detail`} className="bg-slate-50/80">
                        <td colSpan={8} className="px-5 py-4">
                          <div className="bg-white border border-slate-100 rounded-xl p-4 space-y-2">
                            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Event Details</p>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-1.5">
                              <DetailRow label="Event ID"          value={entry.id} />
                              <DetailRow label="Invoice ID"        value={entry.invoice_id} />
                              <DetailRow label="Invoice Number"    value={entry.invoices?.[0]?.invoice_number} />
                              <DetailRow label="Invoice Status"    value={entry.invoices?.[0]?.status} />
                              <DetailRow label="Period Start"      value={d.period_start as string} />
                              <DetailRow label="Period End"        value={d.period_end as string} />
                              <DetailRow label="Account / Provider" value={String(d.account_name ?? d.provider_name ?? '')} />
                              <DetailRow label="Account ID"        value={d.account_id as string} />
                              <DetailRow label="Provider ID"       value={d.service_provider_id as string} />
                              <DetailRow label="Unit Count"        value={d.unit_count as number} />
                              <DetailRow label="Effective Rate"    value={d.effective_rate != null ? `SAR ${d.effective_rate}` : undefined} />
                              <DetailRow label="Ticket Count"      value={d.ticket_count as number} />
                              <DetailRow label="Commission Rate"   value={d.commission_rate_pct != null ? `${d.commission_rate_pct}%` : undefined} />
                              <DetailRow label="Commission Base"   value={d.commission_base != null ? `SAR ${sar(d.commission_base as number)}` : undefined} />
                              <DetailRow label="Subtotal"          value={d.subtotal != null ? `SAR ${sar(d.subtotal as number)}` : undefined} />
                              <DetailRow label="VAT (15%)"         value={d.vat_amount != null ? `SAR ${sar(d.vat_amount as number)}` : undefined} />
                              <DetailRow label="Total"             value={d.total != null ? `SAR ${sar(d.total as number)}` : undefined} />
                              <DetailRow label="Generated At"      value={d.generated_at as string} />
                              <DetailRow label="Generated By"      value={actor} />
                              {Array.isArray(d.ticket_ids) && (
                                <div className="col-span-2">
                                  <DetailRow label={`Ticket IDs (${(d.ticket_ids as string[]).length})`} value={(d.ticket_ids as string[]).join(', ')} />
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {!loading && (
        <div className="flex items-center justify-between text-sm text-slate-500">
          <span>
            Showing {visible.length} of {PAGE_SIZE} entries per page
            {filterType !== 'all' || filterPeriod || search ? ' (filtered)' : ''}
          </span>
          <div className="flex gap-2">
            <button
              disabled={page === 0}
              onClick={() => setPage(p => Math.max(0, p - 1))}
              className="px-4 py-2 rounded-xl border border-slate-200 disabled:opacity-40 hover:bg-slate-50 transition-colors"
            >
              ← Previous
            </button>
            <span className="px-4 py-2 text-slate-700 font-medium">Page {page + 1}</span>
            <button
              disabled={entries.length < PAGE_SIZE}
              onClick={() => setPage(p => p + 1)}
              className="px-4 py-2 rounded-xl border border-slate-200 disabled:opacity-40 hover:bg-slate-50 transition-colors"
            >
              Next →
            </button>
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
        <p className="text-xs font-semibold text-amber-800 mb-2">⚠️ Audit Trail Integrity</p>
        <p className="text-xs text-amber-700 leading-relaxed">
          This log is append-only. Once a ticket is linked to an invoice it cannot be re-billed without a credit note
          or manual Super Admin reversal. To reverse a billing, cancel the invoice and create a new one — both actions
          are logged here automatically.
        </p>
      </div>

    </div>
  )
}
