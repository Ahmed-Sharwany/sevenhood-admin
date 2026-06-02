'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface PlatformSettings {
  id:                    string
  unit_monthly_fee:      number
  service_commission_pct: number
  vat_pct:               number
  currency:              string
  invoice_due_days:      number
  updated_at:            string
}

export default function BillingSettingsPage() {
  const [settings, setSettings]           = useState<PlatformSettings | null>(null)
  const [loading, setLoading]             = useState(true)
  const [saving, setSaving]               = useState(false)
  const [toast, setToast]                 = useState<{ msg: string; type: 'success' | 'error' } | null>(null)

  // Form state
  const [unitMonthlyFee, setUnitMonthlyFee]             = useState('')
  const [serviceCommissionPct, setServiceCommissionPct] = useState('')
  const [invoiceDueDays, setInvoiceDueDays]             = useState('')

  useEffect(() => {
    loadSettings()
  }, [])

  async function loadSettings() {
    setLoading(true)
    try {
      const res  = await fetch('/api/billing/settings')
      const data = await res.json()
      if (data.settings) {
        setSettings(data.settings)
        setUnitMonthlyFee(String(data.settings.unit_monthly_fee))
        setServiceCommissionPct(String(data.settings.service_commission_pct))
        setInvoiceDueDays(String(data.settings.invoice_due_days))
      }
    } catch {
      showToast('Failed to load settings', 'error')
    } finally {
      setLoading(false)
    }
  }

  function showToast(msg: string, type: 'success' | 'error') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 4000)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const res  = await fetch('/api/billing/settings', {
        method:  'PUT',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          unit_monthly_fee:       parseFloat(unitMonthlyFee),
          service_commission_pct: parseFloat(serviceCommissionPct),
          invoice_due_days:       parseInt(invoiceDueDays),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Save failed')
      setSettings(data.settings)
      showToast('Settings saved successfully', 'success')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Save failed'
      showToast(msg, 'error')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="p-8">
        <div className="text-slate text-sm">Loading settings...</div>
      </div>
    )
  }

  return (
    <div className="p-8 max-w-2xl">
      {toast && (
        <div className={`fixed top-6 right-6 z-50 px-5 py-3 rounded-xl shadow-lg text-sm font-medium ${
          toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
        }`}>
          {toast.msg}
        </div>
      )}

      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-ink">Billing Settings</h1>
          <p className="text-slate text-sm mt-1">
            Configure platform-wide billing parameters
            {settings?.updated_at && (
              <span className="ml-2">· Last updated {new Date(settings.updated_at).toLocaleDateString('en-SA')}</span>
            )}
          </p>
        </div>
        <Link
          href="/billing"
          className="text-sm text-slate hover:text-ink transition-colors"
        >
          ← Back to Overview
        </Link>
      </div>

      <form onSubmit={handleSave} className="space-y-5">
        {/* Unit Monthly Fee */}
        <div className="bg-white rounded-2xl border border-border p-5 shadow-sm">
          <div className="flex items-start justify-between mb-3">
            <div>
              <label className="block text-sm font-semibold text-ink">Unit Monthly Fee</label>
              <p className="text-xs text-slate mt-0.5">
                Charged per active unit to Project Owners, Operators, and Org Admins. Applied to all units in their project_access array that are not cancelled.
              </p>
            </div>
            <span className="text-xs text-slate bg-cream px-2 py-1 rounded-lg">Subscription billing</span>
          </div>
          <div className="relative max-w-xs">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate font-medium">SAR</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={unitMonthlyFee}
              onChange={e => setUnitMonthlyFee(e.target.value)}
              required
              className="w-full border border-border rounded-xl pl-12 pr-4 py-2.5 text-sm focus:outline-none focus:border-forest"
              placeholder="50.00"
            />
          </div>
        </div>

        {/* Service Commission */}
        <div className="bg-white rounded-2xl border border-border p-5 shadow-sm">
          <div className="flex items-start justify-between mb-3">
            <div>
              <label className="block text-sm font-semibold text-ink">Service Provider Commission</label>
              <p className="text-xs text-slate mt-0.5">
                Percentage of completed maintenance ticket cost charged to service providers as platform commission. Only tickets with actual_cost set are included.
              </p>
            </div>
            <span className="text-xs text-slate bg-cream px-2 py-1 rounded-lg">Commission billing</span>
          </div>
          <div className="relative max-w-xs">
            <input
              type="number"
              min="0"
              max="100"
              step="0.01"
              value={serviceCommissionPct}
              onChange={e => setServiceCommissionPct(e.target.value)}
              required
              className="w-full border border-border rounded-xl px-4 pr-10 py-2.5 text-sm focus:outline-none focus:border-forest"
              placeholder="10.00"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-slate font-medium">%</span>
          </div>
        </div>

        {/* Invoice Due Days */}
        <div className="bg-white rounded-2xl border border-border p-5 shadow-sm">
          <div className="flex items-start justify-between mb-3">
            <div>
              <label className="block text-sm font-semibold text-ink">Invoice Due Days</label>
              <p className="text-xs text-slate mt-0.5">
                Number of days after the billing period ends before an invoice becomes due. Invoices not paid by the due date are marked as overdue.
              </p>
            </div>
            <span className="text-xs text-slate bg-cream px-2 py-1 rounded-lg">Payment terms</span>
          </div>
          <div className="relative max-w-xs">
            <input
              type="number"
              min="1"
              max="90"
              step="1"
              value={invoiceDueDays}
              onChange={e => setInvoiceDueDays(e.target.value)}
              required
              className="w-full border border-border rounded-xl px-4 pr-16 py-2.5 text-sm focus:outline-none focus:border-forest"
              placeholder="7"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-slate font-medium">days</span>
          </div>
        </div>

        {/* VAT — locked */}
        <div className="bg-white rounded-2xl border border-border p-5 shadow-sm opacity-80">
          <div className="flex items-start justify-between mb-3">
            <div>
              <label className="block text-sm font-semibold text-ink">VAT Rate</label>
              <p className="text-xs text-slate mt-0.5">
                Fixed at 15% as required by Saudi ZATCA regulations. This cannot be changed. VAT is applied to all invoices (subtotal × 15%).
              </p>
            </div>
            <span className="text-xs text-red-600 bg-red-50 px-2 py-1 rounded-lg border border-red-100">ZATCA locked</span>
          </div>
          <div className="relative max-w-xs">
            <input
              type="text"
              value="15%"
              disabled
              className="w-full border border-border rounded-xl px-4 py-2.5 text-sm bg-cream text-slate cursor-not-allowed"
            />
          </div>
        </div>

        {/* Currency — info only */}
        <div className="bg-white rounded-2xl border border-border p-5 shadow-sm opacity-80">
          <div className="flex items-start justify-between mb-3">
            <div>
              <label className="block text-sm font-semibold text-ink">Currency</label>
              <p className="text-xs text-slate mt-0.5">
                All billing is denominated in Saudi Riyals (SAR) as required for Saudi Arabia operations.
              </p>
            </div>
            <span className="text-xs text-slate bg-cream px-2 py-1 rounded-lg">Platform default</span>
          </div>
          <div className="relative max-w-xs">
            <input
              type="text"
              value="SAR — Saudi Riyal"
              disabled
              className="w-full border border-border rounded-xl px-4 py-2.5 text-sm bg-cream text-slate cursor-not-allowed"
            />
          </div>
        </div>

        {/* Save */}
        <div className="flex items-center gap-4 pt-2">
          <button
            type="submit"
            disabled={saving}
            className="bg-forest text-white px-6 py-2.5 rounded-xl text-sm font-medium hover:bg-deep transition-colors disabled:opacity-60"
          >
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
          <p className="text-xs text-slate">
            Changes take effect on the next invoice generation cycle.
          </p>
        </div>
      </form>

      {/* Info box */}
      <div className="mt-8 bg-blue-50 border border-blue-200 rounded-2xl p-5 text-sm text-blue-800">
        <h3 className="font-semibold mb-2">How billing works</h3>
        <ul className="space-y-1.5 text-xs list-disc list-inside text-blue-700">
          <li>
            <strong>Subscription invoices</strong> are generated for Project Owners, Operators, and Org Admins monthly.
            Each active unit in their assigned projects is billed at the unit monthly fee.
          </li>
          <li>
            <strong>Commission invoices</strong> are generated for Service Providers monthly.
            A commission percentage is taken from the sum of completed ticket costs (actual_cost field).
          </li>
          <li>
            <strong>VAT (15%)</strong> is automatically added to all invoice subtotals per ZATCA requirements.
          </li>
          <li>
            Click <strong>Generate Invoices</strong> from the billing dashboard to create invoices for a given month. Duplicates are automatically skipped.
          </li>
        </ul>
      </div>
    </div>
  )
}
