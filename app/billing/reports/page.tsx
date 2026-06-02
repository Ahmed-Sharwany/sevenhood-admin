'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@supabase/supabase-js'

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// ─── Types ────────────────────────────────────────────────────────────────────

interface InvoiceRow {
  id:           string
  invoice_type: 'subscription' | 'commission'
  status:       string
  total:        number
  subtotal:     number
  vat_amount:   number
  period_start: string
  created_at:   string
}

interface MonthSummary {
  month:         string   // 'YYYY-MM'
  label:         string   // 'January 2026'
  sub_count:     number
  sub_amount:    number
  com_count:     number
  com_amount:    number
  total:         number
  paid:          number
  outstanding:   number
  cancelled:     number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sar(n: number) {
  return new Intl.NumberFormat('en-SA', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)
}

function monthLabel(yyyymm: string) {
  const [y, m] = yyyymm.split('-')
  return new Date(parseInt(y), parseInt(m) - 1, 1).toLocaleString('en-SA', { month: 'long', year: 'numeric' })
}

function last12Months(): string[] {
  const months: string[] = []
  const now = new Date()
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }
  return months
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ReportsPage() {
  const [invoices,  setInvoices]  = useState<InvoiceRow[]>([])
  const [loading,   setLoading]   = useState(true)
  const [rangeMonths, setRangeMonths] = useState(12) // 3, 6, 12

  const load = useCallback(async () => {
    setLoading(true)
    const cutoff = new Date()
    cutoff.setMonth(cutoff.getMonth() - rangeMonths)
    const cutoffStr = cutoff.toISOString().slice(0, 10)

    const { data } = await db
      .from('invoices')
      .select('id, invoice_type, status, total, subtotal, vat_amount, period_start, created_at')
      .neq('status', 'cancelled')
      .gte('period_start', cutoffStr)
      .order('period_start', { ascending: true })

    setInvoices((data as InvoiceRow[]) ?? [])
    setLoading(false)
  }, [rangeMonths])

  useEffect(() => { load() }, [load])

  // ── Aggregate by month ────────────────────────────────────────────────────

  const months = last12Months().slice(12 - rangeMonths)

  const summaryMap: Record<string, MonthSummary> = {}
  for (const m of months) {
    summaryMap[m] = {
      month: m, label: monthLabel(m),
      sub_count: 0, sub_amount: 0,
      com_count: 0, com_amount: 0,
      total: 0, paid: 0, outstanding: 0, cancelled: 0,
    }
  }

  for (const inv of invoices) {
    const m = inv.period_start.slice(0, 7)
    if (!summaryMap[m]) continue
    const t = parseFloat(String(inv.total))
    if (inv.invoice_type === 'subscription') {
      summaryMap[m].sub_count++
      summaryMap[m].sub_amount += t
    } else {
      summaryMap[m].com_count++
      summaryMap[m].com_amount += t
    }
    summaryMap[m].total += t
    if (inv.status === 'paid') summaryMap[m].paid += t
    else summaryMap[m].outstanding += t
  }

  const summaries = months.map(m => summaryMap[m]).reverse() // newest first

  // ── KPIs ──────────────────────────────────────────────────────────────────

  const totalCollected  = invoices.filter(i => i.status === 'paid').reduce((s, i) => s + parseFloat(String(i.total)), 0)
  const totalOutstanding = invoices.filter(i => i.status !== 'paid').reduce((s, i) => s + parseFloat(String(i.total)), 0)
  const subTotal = invoices.filter(i => i.invoice_type === 'subscription').reduce((s, i) => s + parseFloat(String(i.total)), 0)
  const comTotal = invoices.filter(i => i.invoice_type === 'commission').reduce((s, i) => s + parseFloat(String(i.total)), 0)
  const overdueCount = invoices.filter(i => i.status === 'overdue').length

  // ── CSV export ────────────────────────────────────────────────────────────

  function exportCSV() {
    const header = ['Month', 'Subscription Invoices', 'Subscription Amount (SAR)', 'Commission Invoices', 'Commission Amount (SAR)', 'Total (SAR)', 'Collected (SAR)', 'Outstanding (SAR)']
    const rows = summaries.map(s => [
      s.label,
      s.sub_count,
      s.sub_amount.toFixed(2),
      s.com_count,
      s.com_amount.toFixed(2),
      s.total.toFixed(2),
      s.paid.toFixed(2),
      s.outstanding.toFixed(2),
    ])
    const csv = [header, ...rows].map(r => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url
    a.download = `sevenhood-revenue-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  // ── Bar chart (pure CSS) ──────────────────────────────────────────────────

  const maxTotal = Math.max(...summaries.map(s => s.total), 1)

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Revenue Reports</h1>
          <p className="text-sm text-slate-500 mt-1">Monthly breakdown of subscription and commission revenue.</p>
        </div>
        <div className="flex gap-3">
          {/* Range selector */}
          <div className="flex rounded-xl border border-slate-200 overflow-hidden text-sm">
            {[3, 6, 12].map(n => (
              <button
                key={n}
                onClick={() => setRangeMonths(n)}
                className={`px-4 py-2 font-medium transition-colors ${rangeMonths === n ? 'bg-forest text-white' : 'text-slate-600 hover:bg-slate-50'}`}
              >
                {n}M
              </button>
            ))}
          </div>

          <button
            onClick={exportCSV}
            disabled={loading || summaries.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-forest text-white rounded-xl text-sm font-medium hover:bg-emerald-800 transition-colors disabled:opacity-50"
          >
            ⬇ Export CSV
          </button>

          <button
            onClick={load}
            className="px-4 py-2 border border-slate-200 rounded-xl text-sm text-slate-600 hover:bg-slate-50 transition-colors"
          >
            ↻ Refresh
          </button>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Collected',  value: `SAR ${sar(totalCollected)}`,  sub: 'Paid invoices',          color: 'text-green-700',  bg: 'bg-green-50',  icon: '✅' },
          { label: 'Outstanding',      value: `SAR ${sar(totalOutstanding)}`, sub: `${overdueCount} overdue`, color: 'text-amber-700',  bg: 'bg-amber-50',  icon: '⏳' },
          { label: 'Subscription Rev', value: `SAR ${sar(subTotal)}`,         sub: 'Unit-based fees',        color: 'text-blue-700',   bg: 'bg-blue-50',   icon: '🏗️' },
          { label: 'Commission Rev',   value: `SAR ${sar(comTotal)}`,         sub: 'Service commissions',    color: 'text-purple-700', bg: 'bg-purple-50', icon: '⚙️' },
        ].map(card => (
          <div key={card.label} className={`${card.bg} rounded-2xl p-5`}>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-lg">{card.icon}</span>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{card.label}</span>
            </div>
            <div className={`text-xl font-bold ${card.color}`}>{card.value}</div>
            <div className="text-xs text-slate-400 mt-1">{card.sub}</div>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="bg-white rounded-2xl border border-slate-100 p-16 text-center text-slate-400 text-sm">Loading reports…</div>
      ) : (
        <>
          {/* Bar chart */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
            <h2 className="text-sm font-semibold text-slate-700 mb-6">Monthly Revenue (SAR)</h2>
            <div className="flex items-end gap-2 h-44">
              {summaries.slice().reverse().map(s => (
                <div key={s.month} className="flex-1 flex flex-col items-center gap-1 group">
                  <div className="w-full relative flex flex-col justify-end" style={{ height: 140 }}>
                    {/* Subscription bar */}
                    <div
                      title={`Subscription: SAR ${sar(s.sub_amount)}`}
                      style={{ height: `${(s.sub_amount / maxTotal) * 100}%`, minHeight: s.sub_amount > 0 ? 3 : 0 }}
                      className="w-full bg-emerald-500 rounded-t-md transition-all"
                    />
                    {/* Commission bar */}
                    <div
                      title={`Commission: SAR ${sar(s.com_amount)}`}
                      style={{ height: `${(s.com_amount / maxTotal) * 100}%`, minHeight: s.com_amount > 0 ? 3 : 0 }}
                      className="w-full bg-purple-400 rounded-t-md transition-all"
                    />
                  </div>
                  <div className="text-[10px] text-slate-400 text-center leading-tight" style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', height: 36 }}>
                    {s.label.split(' ')[0].slice(0, 3)} {s.label.split(' ')[1]?.slice(2)}
                  </div>
                </div>
              ))}
            </div>
            <div className="flex gap-4 mt-4 justify-center">
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <div className="w-3 h-3 rounded-sm bg-emerald-500" /> Subscription
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <div className="w-3 h-3 rounded-sm bg-purple-400" /> Commission
              </div>
            </div>
          </div>

          {/* Monthly breakdown table */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-700">Monthly Breakdown</h2>
              <span className="text-xs text-slate-400">{rangeMonths}-month view</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    {['Month', 'Sub. Invoices', 'Sub. Amount', 'Com. Invoices', 'Com. Amount', 'Total', 'Collected', 'Outstanding'].map((h, i) => (
                      <th key={h} className={`px-5 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider ${i === 0 ? 'text-left' : 'text-right'}`}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {summaries.map(s => (
                    <tr key={s.month} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-5 py-4 font-medium text-slate-800">{s.label}</td>
                      <td className="px-5 py-4 text-right text-slate-500">{s.sub_count}</td>
                      <td className="px-5 py-4 text-right text-slate-700">
                        {s.sub_amount > 0 ? `SAR ${sar(s.sub_amount)}` : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-5 py-4 text-right text-slate-500">{s.com_count}</td>
                      <td className="px-5 py-4 text-right text-slate-700">
                        {s.com_amount > 0 ? `SAR ${sar(s.com_amount)}` : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-5 py-4 text-right font-semibold text-slate-800">
                        {s.total > 0 ? `SAR ${sar(s.total)}` : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-5 py-4 text-right text-green-700 font-medium">
                        {s.paid > 0 ? `SAR ${sar(s.paid)}` : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-5 py-4 text-right">
                        {s.outstanding > 0
                          ? <span className="text-amber-700 font-medium">SAR {sar(s.outstanding)}</span>
                          : <span className="text-slate-300">—</span>
                        }
                      </td>
                    </tr>
                  ))}

                  {/* Totals row */}
                  <tr className="bg-slate-50 border-t-2 border-slate-200">
                    <td className="px-5 py-4 font-bold text-slate-900">Total</td>
                    <td className="px-5 py-4 text-right font-semibold text-slate-700">{summaries.reduce((s, r) => s + r.sub_count, 0)}</td>
                    <td className="px-5 py-4 text-right font-semibold text-slate-800">SAR {sar(subTotal)}</td>
                    <td className="px-5 py-4 text-right font-semibold text-slate-700">{summaries.reduce((s, r) => s + r.com_count, 0)}</td>
                    <td className="px-5 py-4 text-right font-semibold text-slate-800">SAR {sar(comTotal)}</td>
                    <td className="px-5 py-4 text-right font-bold text-slate-900">SAR {sar(subTotal + comTotal)}</td>
                    <td className="px-5 py-4 text-right font-bold text-green-700">SAR {sar(totalCollected)}</td>
                    <td className="px-5 py-4 text-right font-bold text-amber-700">SAR {sar(totalOutstanding)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
