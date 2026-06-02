'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const sar = (n: number) =>
  new Intl.NumberFormat('en-SA', { style: 'currency', currency: 'SAR' }).format(n)

const STATUS_BADGE: Record<string, string> = {
  pending:   'bg-yellow-100 text-yellow-700',
  paid:      'bg-green-100 text-green-700',
  overdue:   'bg-red-100 text-red-700',
  cancelled: 'bg-gray-100 text-gray-500',
}

const TYPE_BADGE: Record<string, string> = {
  subscription: 'bg-blue-100 text-blue-700',
  commission:   'bg-purple-100 text-purple-700',
}

interface Invoice {
  id:               string
  invoice_number:   string
  invoice_type:     string
  period_start:     string
  period_end:       string
  subtotal:         number
  vat_amount:       number
  total:            number
  status:           string
  due_date:         string | null
  paid_at:          string | null
  created_at:       string
  account_id:       string | null
  service_provider_id: string | null
  accounts?:        { full_name: string } | null
  service_providers?: { name: string } | null
}

interface MonthRevenue {
  month: string
  revenue: number
}

interface GenerateResult {
  created: number
  skipped: number
  errors:  string[]
}

export default function BillingPage() {
  const [invoices, setInvoices]             = useState<Invoice[]>([])
  const [loading, setLoading]               = useState(true)
  const [showGenModal, setShowGenModal]     = useState(false)
  const [genMonth, setGenMonth]             = useState(new Date().getMonth() + 1)
  const [genYear, setGenYear]               = useState(new Date().getFullYear())
  const [generating, setGenerating]         = useState(false)
  const [genResult, setGenResult]           = useState<GenerateResult | null>(null)
  const [toast, setToast]                   = useState<{ msg: string; type: 'success' | 'error' } | null>(null)

  const loadInvoices = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('invoices')
      .select('*, accounts(full_name), service_providers(name)')
      .order('created_at', { ascending: false })
      .limit(200)
    setInvoices((data as Invoice[]) ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { loadInvoices() }, [loadInvoices])

  function showToast(msg: string, type: 'success' | 'error') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 4000)
  }

  async function handleGenerate() {
    setGenerating(true)
    setGenResult(null)
    try {
      const res  = await fetch('/api/billing/generate', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ month: genMonth, year: genYear }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Generation failed')
      setGenResult(data)
      showToast(`Generated ${data.created} invoice${data.created !== 1 ? 's' : ''}, skipped ${data.skipped}`, 'success')
      loadInvoices()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      showToast(msg, 'error')
    } finally {
      setGenerating(false)
    }
  }

  // ── Stats ──────────────────────────────────────────────────────────────────
  const totalRevenue    = invoices.filter(i => i.status === 'paid').reduce((s, i) => s + i.total, 0)
  const now             = new Date()
  const thisMonthPaid   = invoices.filter(i => {
    if (i.status !== 'paid' || !i.paid_at) return false
    const d = new Date(i.paid_at)
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
  }).reduce((s, i) => s + i.total, 0)
  const outstanding     = invoices.filter(i => i.status === 'pending' || i.status === 'overdue').reduce((s, i) => s + i.total, 0)
  const totalInvoiced   = invoices.filter(i => i.status !== 'cancelled').reduce((s, i) => s + i.total, 0)
  const collectionRate  = totalInvoiced > 0 ? Math.round((totalRevenue / totalInvoiced) * 100) : 0
  const activeSubCount  = invoices.filter(i => i.invoice_type === 'subscription' && i.status !== 'cancelled').length
  const commissionMTD   = invoices.filter(i => {
    if (i.invoice_type !== 'commission') return false
    const d = new Date(i.created_at)
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
  }).length
  const unpaidCount     = invoices.filter(i => i.status === 'pending').length
  const overdueCount    = invoices.filter(i => i.status === 'overdue').length

  // ── Revenue by month (last 6 months) ──────────────────────────────────────
  const monthRevenue: MonthRevenue[] = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const mLabel = d.toLocaleString('en-SA', { month: 'short', year: '2-digit' })
    const mRevenue = invoices
      .filter(inv => {
        if (inv.status !== 'paid' || !inv.paid_at) return false
        const pd = new Date(inv.paid_at)
        return pd.getMonth() === d.getMonth() && pd.getFullYear() === d.getFullYear()
      })
      .reduce((s, inv) => s + inv.total, 0)
    monthRevenue.push({ month: mLabel, revenue: mRevenue })
  }
  const maxRevenue = Math.max(...monthRevenue.map(m => m.revenue), 1)

  // ── Recent invoices (last 10) ──────────────────────────────────────────────
  const recentInvoices = invoices.slice(0, 10)

  function entityName(inv: Invoice) {
    if (inv.accounts?.full_name)        return inv.accounts.full_name
    if (inv.service_providers?.name)    return inv.service_providers.name
    return '—'
  }

  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

  return (
    <div className="p-8">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-6 right-6 z-50 px-5 py-3 rounded-xl shadow-lg text-sm font-medium transition-all ${
          toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
        }`}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-ink">Billing &amp; Finance</h1>
          <p className="text-slate text-sm mt-1">
            {invoices.length} total invoices · SAR-denominated · 15% VAT applied
          </p>
        </div>
        <button
          onClick={() => { setShowGenModal(true); setGenResult(null) }}
          className="bg-forest text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-deep transition-colors"
        >
          Generate Invoices
        </button>
      </div>

      {/* Stats Row 1 */}
      <div className="grid grid-cols-4 gap-4 mb-4">
        <div className="bg-white rounded-2xl border border-border p-5 shadow-sm">
          <p className="text-xs text-slate uppercase tracking-wide mb-1">Total Revenue</p>
          <p className="text-2xl font-bold text-ink">{sar(totalRevenue)}</p>
          <p className="text-xs text-slate mt-1">All-time paid</p>
        </div>
        <div className="bg-white rounded-2xl border border-border p-5 shadow-sm">
          <p className="text-xs text-slate uppercase tracking-wide mb-1">This Month Revenue</p>
          <p className="text-2xl font-bold text-ink">{sar(thisMonthPaid)}</p>
          <p className="text-xs text-slate mt-1">{now.toLocaleString('en-SA', { month: 'long', year: 'numeric' })}</p>
        </div>
        <div className="bg-white rounded-2xl border border-border p-5 shadow-sm">
          <p className="text-xs text-slate uppercase tracking-wide mb-1">Outstanding Balance</p>
          <p className="text-2xl font-bold text-red-600">{sar(outstanding)}</p>
          <p className="text-xs text-slate mt-1">Pending + overdue</p>
        </div>
        <div className="bg-white rounded-2xl border border-border p-5 shadow-sm">
          <p className="text-xs text-slate uppercase tracking-wide mb-1">Collection Rate</p>
          <p className="text-2xl font-bold text-ink">{collectionRate}%</p>
          <p className="text-xs text-slate mt-1">Paid / total invoiced</p>
        </div>
      </div>

      {/* Stats Row 2 */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-2xl border border-border p-5 shadow-sm">
          <p className="text-xs text-slate uppercase tracking-wide mb-1">Active Subscriptions</p>
          <p className="text-2xl font-bold text-ink">{activeSubCount}</p>
          <p className="text-xs text-slate mt-1">Non-cancelled sub invoices</p>
        </div>
        <div className="bg-white rounded-2xl border border-border p-5 shadow-sm">
          <p className="text-xs text-slate uppercase tracking-wide mb-1">Commission Invoices MTD</p>
          <p className="text-2xl font-bold text-ink">{commissionMTD}</p>
          <p className="text-xs text-slate mt-1">This month</p>
        </div>
        <div className="bg-white rounded-2xl border border-border p-5 shadow-sm">
          <p className="text-xs text-slate uppercase tracking-wide mb-1">Unpaid Invoices</p>
          <p className="text-2xl font-bold text-yellow-600">{unpaidCount}</p>
          <p className="text-xs text-slate mt-1">Pending payment</p>
        </div>
        <div className="bg-white rounded-2xl border border-border p-5 shadow-sm">
          <p className="text-xs text-slate uppercase tracking-wide mb-1">Overdue Invoices</p>
          <p className="text-2xl font-bold text-red-600">{overdueCount}</p>
          <p className="text-xs text-slate mt-1">Past due date</p>
        </div>
      </div>

      {/* Revenue Chart + Recent Invoices */}
      <div className="grid grid-cols-3 gap-6 mb-8">
        {/* Bar chart */}
        <div className="col-span-1 bg-white rounded-2xl border border-border p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-ink mb-4">Revenue (Last 6 Months)</h2>
          <div className="flex items-end gap-2 h-40">
            {monthRevenue.map(m => {
              const pct = Math.round((m.revenue / maxRevenue) * 100)
              return (
                <div key={m.month} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-[10px] text-slate">{sar(m.revenue).replace('SAR', '').trim()}</span>
                  <div className="w-full flex items-end" style={{ height: 100 }}>
                    <div
                      className="w-full rounded-t-lg bg-forest transition-all"
                      style={{ height: `${Math.max(pct, 2)}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-slate">{m.month}</span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Recent invoices */}
        <div className="col-span-2 bg-white rounded-2xl border border-border shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between">
            <h2 className="text-sm font-semibold text-ink">Recent Invoices</h2>
            <Link href="/billing/invoices" className="text-xs text-forest hover:underline font-medium">
              View all
            </Link>
          </div>
          {loading ? (
            <div className="p-8 text-center text-slate text-sm">Loading...</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-cream">
                <tr>
                  <th className="px-4 py-3 text-left text-xs text-slate uppercase tracking-wide">Invoice</th>
                  <th className="px-4 py-3 text-left text-xs text-slate uppercase tracking-wide">Entity</th>
                  <th className="px-4 py-3 text-left text-xs text-slate uppercase tracking-wide">Type</th>
                  <th className="px-4 py-3 text-left text-xs text-slate uppercase tracking-wide">Total</th>
                  <th className="px-4 py-3 text-left text-xs text-slate uppercase tracking-wide">Status</th>
                  <th className="px-4 py-3 text-left text-xs text-slate uppercase tracking-wide">Action</th>
                </tr>
              </thead>
              <tbody>
                {recentInvoices.map(inv => (
                  <tr key={inv.id} className="border-t border-border hover:bg-cream/50 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-ink">{inv.invoice_number}</td>
                    <td className="px-4 py-3 text-ink max-w-[120px] truncate">{entityName(inv)}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${TYPE_BADGE[inv.invoice_type] ?? 'bg-gray-100 text-gray-600'}`}>
                        {inv.invoice_type === 'subscription' ? 'Sub' : 'Com'}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium text-ink">{sar(inv.total)}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[inv.status] ?? 'bg-gray-100 text-gray-600'}`}>
                        {inv.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/billing/invoices/${inv.id}`}
                        className="text-xs text-forest hover:underline font-medium"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
                {recentInvoices.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-slate text-sm">
                      No invoices yet. Click &ldquo;Generate Invoices&rdquo; to create them.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Generate Invoices Modal */}
      {showGenModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-border shadow-xl w-full max-w-md p-6">
            <h2 className="text-lg font-bold text-ink mb-1">Generate Invoices</h2>
            <p className="text-sm text-slate mb-5">
              Create subscription and commission invoices for the selected period. Duplicates are automatically skipped.
            </p>

            <div className="grid grid-cols-2 gap-3 mb-5">
              <div>
                <label className="block text-xs font-medium text-ink mb-1.5">Month</label>
                <select
                  value={genMonth}
                  onChange={e => setGenMonth(Number(e.target.value))}
                  className="w-full border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-forest"
                >
                  {MONTHS.map((m, i) => (
                    <option key={m} value={i + 1}>{m}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-ink mb-1.5">Year</label>
                <select
                  value={genYear}
                  onChange={e => setGenYear(Number(e.target.value))}
                  className="w-full border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-forest"
                >
                  {[2025, 2026, 2027, 2028].map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
            </div>

            {genResult && (
              <div className={`rounded-xl p-4 mb-4 text-sm ${genResult.errors.length > 0 ? 'bg-yellow-50 border border-yellow-200' : 'bg-green-50 border border-green-200'}`}>
                <p className="font-medium text-ink">
                  {genResult.created} invoice{genResult.created !== 1 ? 's' : ''} created, {genResult.skipped} skipped
                </p>
                {genResult.errors.length > 0 && (
                  <ul className="mt-2 text-xs text-red-600 space-y-1">
                    {genResult.errors.map((e, i) => <li key={i}>{e}</li>)}
                  </ul>
                )}
              </div>
            )}

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => { setShowGenModal(false); setGenResult(null) }}
                className="px-4 py-2 rounded-xl text-sm font-medium text-slate border border-border hover:bg-cream transition-colors"
              >
                {genResult ? 'Close' : 'Cancel'}
              </button>
              {!genResult && (
                <button
                  onClick={handleGenerate}
                  disabled={generating}
                  className="bg-forest text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-deep transition-colors disabled:opacity-60"
                >
                  {generating ? 'Generating...' : 'Generate'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
