'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

interface Invoice {
  id: string
  invoice_number: string
  invoice_type: string
  period_start: string
  period_end: string
  subtotal: number
  vat_amount: number
  total: number
  status: string
  due_date: string | null
  paid_at: string | null
  notes: string | null
  created_at: string
  accounts?: { full_name: string; email: string } | null
  service_providers?: { name: string; contact_email: string | null } | null
}

interface InvoiceItem {
  id: string
  description: string
  quantity: number
  unit_price: number
  amount: number
}

function sar(n: number) {
  return new Intl.NumberFormat('en-SA', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)
}

function fmtDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-SA', { day: 'numeric', month: 'long', year: 'numeric' })
}

export default function InvoicePrintPage() {
  const params = useParams()
  const id = params?.id as string

  const [invoice, setInvoice] = useState<Invoice | null>(null)
  const [items,   setItems]   = useState<InvoiceItem[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!id) return
    const [invRes, itemsRes] = await Promise.all([
      db.from('invoices').select('*, accounts(full_name, email), service_providers(name, contact_email)').eq('id', id).single(),
      db.from('invoice_items').select('*').eq('invoice_id', id).order('id'),
    ])
    setInvoice((invRes.data as Invoice) ?? null)
    setItems((itemsRes.data as InvoiceItem[]) ?? [])
    setLoading(false)
  }, [id])

  useEffect(() => { load() }, [load])

  if (loading) {
    return <div style={{ padding: 40, fontFamily: 'Arial, sans-serif', color: '#666' }}>Loading invoice…</div>
  }

  if (!invoice) {
    return <div style={{ padding: 40, fontFamily: 'Arial, sans-serif', color: '#c00' }}>Invoice not found.</div>
  }

  const recipientName  = invoice.accounts?.full_name ?? invoice.service_providers?.name ?? '—'
  const recipientEmail = invoice.accounts?.email ?? invoice.service_providers?.contact_email ?? ''
  const typeLabel      = invoice.invoice_type === 'subscription' ? 'Subscription Invoice' : 'Commission Invoice'
  const accentColor    = invoice.invoice_type === 'subscription' ? '#1E4D3B' : '#6D28D9'

  return (
    <>
      {/* Print button — hidden when printing */}
      <div className="no-print" style={{
        position: 'fixed', top: 16, right: 16, zIndex: 100,
        display: 'flex', gap: 8,
      }}>
        <a href={`/billing/invoices/${id}`} style={{
          padding: '10px 20px', borderRadius: 10, border: '1px solid #e2e8f0',
          background: '#fff', color: '#475569', fontSize: 14, fontWeight: 500,
          cursor: 'pointer', textDecoration: 'none', fontFamily: 'Arial, sans-serif',
        }}>
          ← Back
        </a>
        <button
          onClick={() => window.print()}
          style={{
            padding: '10px 24px', borderRadius: 10, border: 'none',
            background: accentColor, color: '#fff', fontSize: 14, fontWeight: 600,
            cursor: 'pointer', fontFamily: 'Arial, sans-serif',
          }}
        >
          🖨️ Print / Save as PDF
        </button>
      </div>

      {/* Print styles */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { margin: 0 !important; background: #fff !important; }
          @page { size: A4; margin: 15mm; }
        }
        body { background: #f5f5f0; }
      `}</style>

      {/* Invoice document */}
      <div style={{
        maxWidth: 760,
        margin: '40px auto 60px',
        background: '#fff',
        boxShadow: '0 4px 32px rgba(0,0,0,0.08)',
        borderRadius: 16,
        overflow: 'hidden',
        fontFamily: 'Arial, sans-serif',
      }}>

        {/* Header */}
        <div style={{ background: accentColor, padding: '32px 48px' }}>
          <table width="100%" style={{ borderCollapse: 'collapse' }}>
            <tbody>
              <tr>
                <td>
                  <div style={{ color: '#C9A56B', fontSize: 24, fontWeight: 700, letterSpacing: -0.5 }}>Sevenhood</div>
                  <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, letterSpacing: 2, marginTop: 4, textTransform: 'uppercase' }}>{typeLabel}</div>
                </td>
                <td style={{ textAlign: 'right' }}>
                  <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1 }}>Invoice</div>
                  <div style={{ color: '#fff', fontSize: 20, fontWeight: 700, marginTop: 2, fontFamily: 'monospace' }}>{invoice.invoice_number}</div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Body */}
        <div style={{ padding: '36px 48px' }}>

          {/* Bill to / Invoice meta */}
          <table width="100%" style={{ borderCollapse: 'collapse', marginBottom: 32 }}>
            <tbody>
              <tr>
                <td style={{ width: '50%', verticalAlign: 'top' }}>
                  <div style={{ fontSize: 11, color: '#888', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Billed To</div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#1a1a1a' }}>{recipientName}</div>
                  {recipientEmail && <div style={{ fontSize: 13, color: '#666', marginTop: 3 }}>{recipientEmail}</div>}
                </td>
                <td style={{ width: '50%', verticalAlign: 'top', textAlign: 'right' }}>
                  <table style={{ borderCollapse: 'collapse', marginLeft: 'auto' }}>
                    <tbody>
                      {[
                        ['Issue Date',    fmtDate(invoice.created_at)],
                        ['Billing Period', `${invoice.period_start} – ${invoice.period_end}`],
                        ['Due Date',       fmtDate(invoice.due_date)],
                        ['Status',         invoice.status.toUpperCase()],
                      ].map(([label, value]) => (
                        <tr key={label}>
                          <td style={{ fontSize: 12, color: '#888', paddingRight: 16, paddingBottom: 4 }}>{label}</td>
                          <td style={{ fontSize: 12, fontWeight: 600, color: label === 'Status' && invoice.status === 'paid' ? '#16a34a' : label === 'Status' && invoice.status === 'overdue' ? '#dc2626' : '#1a1a1a', paddingBottom: 4 }}>{value}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </td>
              </tr>
            </tbody>
          </table>

          {/* Divider */}
          <div style={{ height: 1, background: '#e5e7eb', marginBottom: 28 }} />

          {/* Line items */}
          <table width="100%" style={{ borderCollapse: 'collapse', marginBottom: 28 }}>
            <thead>
              <tr style={{ background: '#f9fafb' }}>
                {['Description', 'Qty', 'Unit Price', 'Amount'].map((h, i) => (
                  <th key={h} style={{
                    padding: '10px 14px',
                    fontSize: 11,
                    color: '#888',
                    textTransform: 'uppercase',
                    letterSpacing: 1,
                    fontWeight: 600,
                    textAlign: i === 0 ? 'left' : 'right',
                    borderBottom: '1px solid #e5e7eb',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map(item => (
                <tr key={item.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '12px 14px', fontSize: 13, color: '#1a1a1a' }}>{item.description}</td>
                  <td style={{ padding: '12px 14px', fontSize: 13, color: '#666', textAlign: 'right' }}>{item.quantity}</td>
                  <td style={{ padding: '12px 14px', fontSize: 13, color: '#666', textAlign: 'right' }}>SAR {sar(item.unit_price)}</td>
                  <td style={{ padding: '12px 14px', fontSize: 13, fontWeight: 600, color: '#1a1a1a', textAlign: 'right' }}>SAR {sar(item.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Totals */}
          <table width="100%" style={{ borderCollapse: 'collapse', marginBottom: 32 }}>
            <tbody>
              <tr>
                <td />
                <td style={{ width: 280 }}>
                  {[
                    ['Subtotal', sar(invoice.subtotal), false],
                    ['VAT (15%)', sar(invoice.vat_amount), false],
                  ].map(([label, value]) => (
                    <div key={label as string} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', fontSize: 13 }}>
                      <span style={{ color: '#666' }}>{label}</span>
                      <span style={{ color: '#1a1a1a' }}>SAR {value}</span>
                    </div>
                  ))}
                  <div style={{ height: 2, background: '#1a1a1a', margin: '10px 0 8px' }} />
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                    <span style={{ fontSize: 16, fontWeight: 700, color: '#1a1a1a' }}>Total Due</span>
                    <span style={{ fontSize: 16, fontWeight: 700, color: accentColor }}>SAR {sar(invoice.total)}</span>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>

          {/* Notes */}
          {invoice.notes && (
            <div style={{ background: '#f9fafb', borderRadius: 10, padding: '14px 18px', fontSize: 13, color: '#555', marginBottom: 24 }}>
              <strong>Notes:</strong> {invoice.notes}
            </div>
          )}

          {/* Payment instructions */}
          {invoice.status !== 'paid' && invoice.status !== 'cancelled' && (
            <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10, padding: '14px 18px', fontSize: 13, color: '#92400e' }}>
              <strong>Payment Instructions:</strong> Please pay via the Sevenhood portal or contact your account manager for bank transfer details. Reference your invoice number in all communications.
            </div>
          )}

        </div>

        {/* Footer */}
        <div style={{ background: '#f9f7f4', padding: '18px 48px', textAlign: 'center', borderTop: '1px solid #e5e7eb' }}>
          <div style={{ fontSize: 12, color: '#999' }}>Sevenhood Platform · KSA PropTech</div>
          <div style={{ fontSize: 11, color: '#bbb', marginTop: 4 }}>This document was generated automatically. For queries contact billing@sevenhood.app</div>
        </div>

      </div>
    </>
  )
}
