'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
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

const PAYMENT_STATUS_BADGE: Record<string, string> = {
  initiated: 'bg-blue-100 text-blue-700',
  paid:      'bg-green-100 text-green-700',
  failed:    'bg-red-100 text-red-700',
  refunded:  'bg-gray-100 text-gray-600',
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
  notes:            string | null
  created_at:       string
  account_id:       string | null
  service_provider_id: string | null
  accounts?:        { full_name: string; email: string } | null
  service_providers?: { name: string } | null
}

interface InvoiceItem {
  id:             string
  description:    string
  quantity:       number
  unit_price:     number
  amount:         number
  reference_type: string | null
}

interface Payment {
  id:             string
  amount:         number
  currency:       string
  gateway:        string
  gateway_id:     string | null
  gateway_status: string | null
  status:         string
  payment_method: string | null
  paid_at:        string | null
  created_at:     string
}

export default function InvoiceDetailPage() {
  const params  = useParams()
  const router  = useRouter()
  const id      = params?.id as string

  const [invoice, setInvoice]   = useState<Invoice | null>(null)
  const [items, setItems]       = useState<InvoiceItem[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [loading, setLoading]   = useState(true)
  const [paying, setPaying]     = useState(false)
  const [toast, setToast]       = useState<{ msg: string; type: 'success' | 'error' } | null>(null)

  // Manual payment modal state
  const [showManualPayment, setShowManualPayment] = useState(false)
  const [manualForm, setManualForm] = useState({
    amount: '',
    method: 'bank_transfer',
    reference: '',
    date: new Date().toISOString().slice(0, 10),
  })
  const [savingManual, setSavingManual] = useState(false)

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)

    const [invRes, itemsRes, paymentsRes] = await Promise.all([
      supabase.from('invoices').select('*, accounts(full_name, email), service_providers(name)').eq('id', id).single(),
      supabase.from('invoice_items').select('*').eq('invoice_id', id).order('id'),
      supabase.from('payments').select('*').eq('invoice_id', id).order('created_at', { ascending: false }),
    ])

    setInvoice((invRes.data as Invoice) ?? null)
    setItems((itemsRes.data as InvoiceItem[]) ?? [])
    setPayments((paymentsRes.data as Payment[]) ?? [])
    setLoading(false)
  }, [id])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    if (invoice) setManualForm(f => ({ ...f, amount: String(invoice.total) }))
  }, [invoice])

  function showToast(msg: string, type: 'success' | 'error') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 4000)
  }

  async function handlePayNow() {
    if (!invoice) return
    setPaying(true)
    try {
      const res  = await fetch('/api/billing/pay', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ invoice_id: invoice.id }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Payment failed')
      // Redirect to Moyasar payment page
      if (data.payment_url) {
        window.location.href = data.payment_url
      } else {
        showToast('Payment initiated — awaiting redirect', 'success')
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Payment error'
      showToast(msg, 'error')
    } finally {
      setPaying(false)
    }
  }

  async function writeAuditLog(event_type: string, details: Record<string, unknown>) {
    try {
      await supabase.from('billing_audit_log').insert({
        event_type,
        invoice_id: invoice?.id ?? null,
        details,
      })
    } catch { /* non-blocking */ }
  }

  async function handleMarkPaid() {
    if (!invoice) return
    const paidAt = new Date().toISOString()
    const { error } = await supabase
      .from('invoices')
      .update({ status: 'paid', paid_at: paidAt })
      .eq('id', invoice.id)
    if (error) {
      showToast('Failed to update invoice', 'error')
    } else {
      await writeAuditLog('invoice_paid', {
        invoice_number: invoice.invoice_number,
        invoice_type:   invoice.invoice_type,
        total:          invoice.total,
        period_start:   invoice.period_start,
        period_end:     invoice.period_end,
        paid_at:        paidAt,
        generated_by:   'manual/admin',
      })
      showToast('Invoice marked as paid', 'success')
      load()
    }
  }

  async function handleManualPayment(e: React.FormEvent) {
    e.preventDefault()
    if (!invoice) return
    setSavingManual(true)
    try {
      const paidAt = new Date(manualForm.date).toISOString()

      // 1. Insert payment record
      const { error: payErr } = await supabase.from('payments').insert({
        invoice_id:     invoice.id,
        amount:         parseFloat(manualForm.amount),
        currency:       'SAR',
        gateway:        'manual',
        gateway_id:     manualForm.reference || null,
        gateway_status: 'completed',
        status:         'paid',
        payment_method: manualForm.method,
        paid_at:        paidAt,
      })
      if (payErr) throw new Error(payErr.message)

      // 2. Mark invoice paid
      const { error: invErr } = await supabase.from('invoices')
        .update({ status: 'paid', paid_at: paidAt })
        .eq('id', invoice.id)
      if (invErr) throw new Error(invErr.message)

      // 3. Audit log
      await writeAuditLog('invoice_paid', {
        invoice_number:  invoice.invoice_number,
        invoice_type:    invoice.invoice_type,
        total:           invoice.total,
        paid_amount:     parseFloat(manualForm.amount),
        payment_method:  manualForm.method,
        reference:       manualForm.reference,
        paid_at:         paidAt,
        generated_by:    'manual/admin',
      })

      setShowManualPayment(false)
      showToast('Payment recorded successfully', 'success')
      load()
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Failed to record payment', 'error')
    } finally {
      setSavingManual(false)
    }
  }

  async function handleCancel() {
    if (!invoice) return
    if (!confirm('Cancel this invoice? This action cannot be undone.')) return
    const { error } = await supabase
      .from('invoices')
      .update({ status: 'cancelled' })
      .eq('id', invoice.id)
    if (error) {
      showToast('Failed to cancel invoice', 'error')
    } else {
      await writeAuditLog('invoice_cancelled', {
        invoice_number: invoice.invoice_number,
        invoice_type:   invoice.invoice_type,
        total:          invoice.total,
        period_start:   invoice.period_start,
        period_end:     invoice.period_end,
        cancelled_at:   new Date().toISOString(),
        generated_by:   'manual/admin',
      })
      showToast('Invoice cancelled', 'success')
      load()
    }
  }

  function entityName() {
    if (!invoice) return '—'
    if (invoice.accounts?.full_name)     return invoice.accounts.full_name
    if (invoice.service_providers?.name) return invoice.service_providers.name
    return '—'
  }

  if (loading) {
    return (
      <div className="p-8">
        <div className="text-slate text-sm">Loading invoice...</div>
      </div>
    )
  }

  if (!invoice) {
    return (
      <div className="p-8">
        <div className="text-red-600 text-sm">Invoice not found.</div>
        <Link href="/billing/invoices" className="text-forest text-sm hover:underline mt-2 block">
          ← Back to Invoices
        </Link>
      </div>
    )
  }

  return (
    <div className="p-8 max-w-4xl">
      {toast && (
        <div className={`fixed top-6 right-6 z-50 px-5 py-3 rounded-xl shadow-lg text-sm font-medium ${
          toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
        }`}>
          {toast.msg}
        </div>
      )}

      {/* Back */}
      <div className="mb-6">
        <Link href="/billing/invoices" className="text-sm text-slate hover:text-ink transition-colors">
          ← Back to Invoices
        </Link>
      </div>

      {/* Invoice Header */}
      <div className="bg-white rounded-2xl border border-border p-6 shadow-sm mb-6">
        <div className="flex items-start justify-between mb-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-xl font-bold text-ink font-mono">{invoice.invoice_number}</h1>
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[invoice.status] ?? 'bg-gray-100 text-gray-600'}`}>
                {invoice.status}
              </span>
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${TYPE_BADGE[invoice.invoice_type] ?? 'bg-gray-100 text-gray-600'}`}>
                {invoice.invoice_type}
              </span>
            </div>
            <p className="text-slate text-sm">Issued {new Date(invoice.created_at).toLocaleDateString('en-SA', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
          </div>
          <div className="text-right">
            <p className="text-3xl font-bold text-ink">{sar(invoice.total)}</p>
            <p className="text-xs text-slate mt-1">Including 15% VAT</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-xs text-slate uppercase tracking-wide mb-1">Billed To</p>
            <p className="font-medium text-ink">{entityName()}</p>
            {invoice.accounts?.email && (
              <p className="text-slate text-xs">{invoice.accounts.email}</p>
            )}
          </div>
          <div>
            <p className="text-xs text-slate uppercase tracking-wide mb-1">Billing Period</p>
            <p className="font-medium text-ink">{invoice.period_start}</p>
            <p className="text-slate text-xs">to {invoice.period_end}</p>
          </div>
          <div>
            <p className="text-xs text-slate uppercase tracking-wide mb-1">Due Date</p>
            <p className={`font-medium ${
              invoice.status === 'overdue' ? 'text-red-600' : 'text-ink'
            }`}>
              {invoice.due_date ?? '—'}
            </p>
            {invoice.paid_at && (
              <p className="text-green-600 text-xs">Paid {new Date(invoice.paid_at).toLocaleDateString('en-SA')}</p>
            )}
          </div>
        </div>

        {invoice.notes && (
          <div className="mt-4 p-3 bg-cream rounded-xl text-sm text-slate">
            {invoice.notes}
          </div>
        )}
      </div>

      {/* Line Items */}
      <div className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden mb-6">
        <div className="px-5 py-4 border-b border-border">
          <h2 className="text-sm font-semibold text-ink">Line Items</h2>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-cream">
            <tr>
              <th className="px-4 py-3 text-left text-xs text-slate uppercase tracking-wide">Description</th>
              <th className="px-4 py-3 text-right text-xs text-slate uppercase tracking-wide">Qty</th>
              <th className="px-4 py-3 text-right text-xs text-slate uppercase tracking-wide">Unit Price</th>
              <th className="px-4 py-3 text-right text-xs text-slate uppercase tracking-wide">Amount</th>
            </tr>
          </thead>
          <tbody>
            {items.map(item => (
              <tr key={item.id} className="border-t border-border">
                <td className="px-4 py-3 text-ink">{item.description}</td>
                <td className="px-4 py-3 text-right text-slate">{item.quantity}</td>
                <td className="px-4 py-3 text-right text-slate">{sar(item.unit_price)}</td>
                <td className="px-4 py-3 text-right font-medium text-ink">{sar(item.amount)}</td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-slate text-sm">No line items</td>
              </tr>
            )}
          </tbody>
        </table>

        {/* Totals */}
        <div className="border-t border-border">
          <div className="ml-auto max-w-xs p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-slate">Subtotal</span>
              <span className="text-ink font-medium">{sar(invoice.subtotal)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate">VAT (15%)</span>
              <span className="text-ink font-medium">{sar(invoice.vat_amount)}</span>
            </div>
            <div className="flex justify-between text-sm font-bold border-t border-border pt-2 mt-2">
              <span className="text-ink">Total (SAR)</span>
              <span className="text-ink text-base">{sar(invoice.total)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Payment History */}
      {payments.length > 0 && (
        <div className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden mb-6">
          <div className="px-5 py-4 border-b border-border">
            <h2 className="text-sm font-semibold text-ink">Payment History</h2>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-cream">
              <tr>
                <th className="px-4 py-3 text-left text-xs text-slate uppercase tracking-wide">Date</th>
                <th className="px-4 py-3 text-left text-xs text-slate uppercase tracking-wide">Gateway</th>
                <th className="px-4 py-3 text-left text-xs text-slate uppercase tracking-wide">Method</th>
                <th className="px-4 py-3 text-left text-xs text-slate uppercase tracking-wide">Amount</th>
                <th className="px-4 py-3 text-left text-xs text-slate uppercase tracking-wide">Status</th>
                <th className="px-4 py-3 text-left text-xs text-slate uppercase tracking-wide">Gateway ID</th>
              </tr>
            </thead>
            <tbody>
              {payments.map(p => (
                <tr key={p.id} className="border-t border-border">
                  <td className="px-4 py-3 text-slate text-xs">
                    {new Date(p.created_at).toLocaleDateString('en-SA', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </td>
                  <td className="px-4 py-3 text-ink capitalize">{p.gateway}</td>
                  <td className="px-4 py-3 text-slate capitalize">{p.payment_method ?? '—'}</td>
                  <td className="px-4 py-3 font-medium text-ink">{sar(p.amount)}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${PAYMENT_STATUS_BADGE[p.status] ?? 'bg-gray-100 text-gray-600'}`}>
                      {p.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-slate truncate max-w-[120px]">
                    {p.gateway_id ?? '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-wrap gap-3">
        {/* Print / PDF — always available */}
        <a
          href={`/billing/invoices/${invoice.id}/print`}
          target="_blank"
          rel="noopener noreferrer"
          className="border border-slate-200 text-slate-600 px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-slate-50 transition-colors"
        >
          🖨️ Print / Save as PDF
        </a>

        {invoice.status !== 'cancelled' && invoice.status !== 'paid' && (
          <>
            <button
              onClick={handlePayNow}
              disabled={paying}
              className="bg-forest text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-deep transition-colors disabled:opacity-60"
            >
              {paying ? 'Redirecting...' : 'Pay Now via Moyasar'}
            </button>

            <button
              onClick={() => setShowManualPayment(true)}
              className="bg-green-600 text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-green-700 transition-colors"
            >
              Record Manual Payment
            </button>

            <button
              onClick={handleCancel}
              className="border border-red-200 text-red-600 px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-red-50 transition-colors"
            >
              Cancel Invoice
            </button>
          </>
        )}
      </div>

      {/* Manual Payment Modal */}
      {showManualPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="px-6 py-5 border-b border-slate-100">
              <h2 className="text-base font-bold text-slate-900">Record Manual Payment</h2>
              <p className="text-xs text-slate-500 mt-0.5">Record a payment received outside the online gateway (bank transfer, cheque, cash).</p>
            </div>

            <form onSubmit={handleManualPayment} className="px-6 py-5 space-y-4">
              {/* Amount */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Amount (SAR)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  value={manualForm.amount}
                  onChange={e => setManualForm(f => ({ ...f, amount: e.target.value }))}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-forest/30"
                />
              </div>

              {/* Method */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Payment Method</label>
                <select
                  value={manualForm.method}
                  onChange={e => setManualForm(f => ({ ...f, method: e.target.value }))}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-forest/30"
                >
                  <option value="bank_transfer">Bank Transfer</option>
                  <option value="cheque">Cheque</option>
                  <option value="cash">Cash</option>
                  <option value="other">Other</option>
                </select>
              </div>

              {/* Reference */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Reference Number <span className="font-normal text-slate-400">(optional)</span></label>
                <input
                  type="text"
                  placeholder="Bank transfer ref, cheque no., etc."
                  value={manualForm.reference}
                  onChange={e => setManualForm(f => ({ ...f, reference: e.target.value }))}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-forest/30"
                />
              </div>

              {/* Date */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Payment Date</label>
                <input
                  type="date"
                  required
                  value={manualForm.date}
                  onChange={e => setManualForm(f => ({ ...f, date: e.target.value }))}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-forest/30"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowManualPayment(false)}
                  className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingManual}
                  className="flex-1 bg-green-600 text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-green-700 transition-colors disabled:opacity-60"
                >
                  {savingManual ? 'Saving…' : 'Record Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
