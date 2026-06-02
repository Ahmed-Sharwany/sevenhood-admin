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

export default function InvoicesPage() {
  const [invoices, setInvoices]   = useState<Invoice[]>([])
  const [loading, setLoading]     = useState(true)
  const [typeFilter, setTypeFilter]   = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [search, setSearch]       = useState('')
  const [toast, setToast]         = useState<{ msg: string; type: 'success' | 'error' } | null>(null)

  const loadInvoices = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('invoices')
      .select('*, accounts(full_name), service_providers(name)')
      .order('created_at', { ascending: false })
      .limit(500)
    setInvoices((data as Invoice[]) ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { loadInvoices() }, [loadInvoices])

  function showToast(msg: string, type: 'success' | 'error') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 4000)
  }

  async function markPaid(id: string) {
    const inv    = invoices.find(i => i.id === id)
    const paidAt = new Date().toISOString()
    const { error } = await supabase
      .from('invoices')
      .update({ status: 'paid', paid_at: paidAt })
      .eq('id', id)
    if (error) {
      showToast('Failed to mark as paid', 'error')
    } else {
      // Write audit log entry
      await supabase.from('billing_audit_log').insert({
        event_type: 'invoice_paid',
        invoice_id: id,
        details: {
          invoice_number: inv?.invoice_number,
          invoice_type:   inv?.invoice_type,
          total:          inv?.total,
          paid_at:        paidAt,
          generated_by:   'manual/admin',
        },
      })
      showToast('Invoice marked as paid', 'success')
      loadInvoices()
    }
  }

  function entityName(inv: Invoice) {
    if (inv.accounts?.full_name)     return inv.accounts.full_name
    if (inv.service_providers?.name) return inv.service_providers.name
    return '—'
  }

  const filtered = invoices.filter(inv => {
    if (typeFilter !== 'all'   && inv.invoice_type !== typeFilter) return false
    if (statusFilter !== 'all' && inv.status       !== statusFilter) return false
    if (search) {
      const q = search.toLowerCase()
      if (
        !inv.invoice_number.toLowerCase().includes(q) &&
        !entityName(inv).toLowerCase().includes(q)
      ) return false
    }
    return true
  })

  return (
    <div className="p-8">
      {toast && (
        <div className={`fixed top-6 right-6 z-50 px-5 py-3 rounded-xl shadow-lg text-sm font-medium ${
          toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
        }`}>
          {toast.msg}
        </div>
      )}

      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-ink">Invoices</h1>
          <p className="text-slate text-sm mt-1">{filtered.length} of {invoices.length} invoices</p>
        </div>
        <Link
          href="/billing"
          className="text-sm text-slate hover:text-ink transition-colors"
        >
          ← Back to Overview
        </Link>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-border p-4 shadow-sm mb-6 flex gap-3 flex-wrap">
        <input
          type="text"
          placeholder="Search invoice # or name..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-forest max-w-xs"
        />
        <select
          value={typeFilter}
          onChange={e => setTypeFilter(e.target.value)}
          className="border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-forest"
        >
          <option value="all">All Types</option>
          <option value="subscription">Subscription</option>
          <option value="commission">Commission</option>
        </select>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-forest"
        >
          <option value="all">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="paid">Paid</option>
          <option value="overdue">Overdue</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate text-sm">Loading invoices...</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-cream">
              <tr>
                <th className="px-4 py-3 text-left text-xs text-slate uppercase tracking-wide">Invoice #</th>
                <th className="px-4 py-3 text-left text-xs text-slate uppercase tracking-wide">Entity</th>
                <th className="px-4 py-3 text-left text-xs text-slate uppercase tracking-wide">Type</th>
                <th className="px-4 py-3 text-left text-xs text-slate uppercase tracking-wide">Period</th>
                <th className="px-4 py-3 text-left text-xs text-slate uppercase tracking-wide">Subtotal</th>
                <th className="px-4 py-3 text-left text-xs text-slate uppercase tracking-wide">VAT</th>
                <th className="px-4 py-3 text-left text-xs text-slate uppercase tracking-wide">Total</th>
                <th className="px-4 py-3 text-left text-xs text-slate uppercase tracking-wide">Status</th>
                <th className="px-4 py-3 text-left text-xs text-slate uppercase tracking-wide">Due</th>
                <th className="px-4 py-3 text-left text-xs text-slate uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(inv => (
                <tr key={inv.id} className="border-t border-border hover:bg-cream/50 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-ink">{inv.invoice_number}</td>
                  <td className="px-4 py-3 text-ink max-w-[140px] truncate">{entityName(inv)}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${TYPE_BADGE[inv.invoice_type] ?? 'bg-gray-100 text-gray-600'}`}>
                      {inv.invoice_type}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate text-xs">
                    {inv.period_start} → {inv.period_end}
                  </td>
                  <td className="px-4 py-3 text-ink">{sar(inv.subtotal)}</td>
                  <td className="px-4 py-3 text-slate">{sar(inv.vat_amount)}</td>
                  <td className="px-4 py-3 font-semibold text-ink">{sar(inv.total)}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[inv.status] ?? 'bg-gray-100 text-gray-600'}`}>
                      {inv.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate text-xs">{inv.due_date ?? '—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Link
                        href={`/billing/invoices/${inv.id}`}
                        className="text-xs text-forest hover:underline font-medium"
                      >
                        View
                      </Link>
                      {inv.status === 'pending' && (
                        <button
                          onClick={() => markPaid(inv.id)}
                          className="text-xs text-green-600 hover:underline font-medium"
                        >
                          Mark Paid
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-4 py-10 text-center text-slate text-sm">
                    No invoices match the current filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
