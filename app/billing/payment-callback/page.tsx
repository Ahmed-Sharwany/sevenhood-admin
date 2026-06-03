'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'

interface CallbackStatus {
  state:      'loading' | 'success' | 'failed' | 'error'
  invoiceId:  string | null
  gatewayId:  string | null
  message:    string
}

export default function PaymentCallbackPage() {
  return (
    <Suspense fallback={<div className="p-8 text-slate text-sm">Loading...</div>}>
      <PaymentCallbackInner />
    </Suspense>
  )
}

function PaymentCallbackInner() {
  const searchParams = useSearchParams()
  const [status, setStatus] = useState<CallbackStatus>({
    state:     'loading',
    invoiceId: null,
    gatewayId: null,
    message:   'Verifying payment...',
  })

  useEffect(() => {
    const invoiceId = searchParams.get('invoice_id')
    const id        = searchParams.get('id')         // Moyasar payment id
    const gatewayStatus = searchParams.get('status') // Moyasar status in callback URL

    if (!invoiceId) {
      setStatus({
        state:     'error',
        invoiceId: null,
        gatewayId: id,
        message:   'Missing invoice reference. Please contact support.',
      })
      return
    }

    // If Moyasar includes status in callback URL params, use that first
    if (gatewayStatus === 'paid') {
      setStatus({
        state:     'success',
        invoiceId,
        gatewayId: id,
        message:   'Payment completed successfully.',
      })
      return
    }

    if (gatewayStatus === 'failed') {
      setStatus({
        state:     'failed',
        invoiceId,
        gatewayId: id,
        message:   'Payment was declined or failed. Please try again.',
      })
      return
    }

    // No status in URL — show pending state and let the webhook handle confirmation.
    // Never verify payments client-side (would require exposing secret key in browser).
    setStatus({
      state:     'success',
      invoiceId,
      gatewayId: id,
      message:   'Payment submitted successfully. Your invoice will be updated within a few minutes.',
    })
  }, [searchParams])

  return (
    <div className="p-8 flex items-start justify-center min-h-[60vh]">
      <div className="w-full max-w-md mt-16">
        {status.state === 'loading' && (
          <div className="bg-white rounded-2xl border border-border p-8 shadow-sm text-center">
            <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-blue-600 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
              </svg>
            </div>
            <h1 className="text-lg font-bold text-ink mb-2">Verifying Payment</h1>
            <p className="text-slate text-sm">Please wait...</p>
          </div>
        )}

        {status.state === 'success' && (
          <div className="bg-white rounded-2xl border border-border p-8 shadow-sm text-center">
            <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-lg font-bold text-ink mb-2">Payment Successful</h1>
            <p className="text-slate text-sm mb-6">{status.message}</p>
            {status.gatewayId && (
              <p className="text-xs text-slate mb-4 font-mono bg-cream rounded-lg px-3 py-2">
                Reference: {status.gatewayId}
              </p>
            )}
            <div className="flex gap-3 justify-center">
              {status.invoiceId && (
                <Link
                  href={`/billing/invoices/${status.invoiceId}`}
                  className="bg-forest text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-deep transition-colors"
                >
                  View Invoice
                </Link>
              )}
              <Link
                href="/billing"
                className="border border-border px-4 py-2 rounded-xl text-sm font-medium text-slate hover:bg-cream transition-colors"
              >
                Back to Billing
              </Link>
            </div>
          </div>
        )}

        {status.state === 'failed' && (
          <div className="bg-white rounded-2xl border border-border p-8 shadow-sm text-center">
            <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h1 className="text-lg font-bold text-ink mb-2">Payment Failed</h1>
            <p className="text-slate text-sm mb-6">{status.message}</p>
            <div className="flex gap-3 justify-center">
              {status.invoiceId && (
                <Link
                  href={`/billing/invoices/${status.invoiceId}`}
                  className="bg-forest text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-deep transition-colors"
                >
                  Try Again
                </Link>
              )}
              <Link
                href="/billing"
                className="border border-border px-4 py-2 rounded-xl text-sm font-medium text-slate hover:bg-cream transition-colors"
              >
                Back to Billing
              </Link>
            </div>
          </div>
        )}

        {status.state === 'error' && (
          <div className="bg-white rounded-2xl border border-border p-8 shadow-sm text-center">
            <div className="w-12 h-12 rounded-full bg-yellow-100 flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              </svg>
            </div>
            <h1 className="text-lg font-bold text-ink mb-2">Verification Issue</h1>
            <p className="text-slate text-sm mb-6">{status.message}</p>
            <div className="flex gap-3 justify-center">
              <Link
                href="/billing/invoices"
                className="bg-forest text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-deep transition-colors"
              >
                View Invoices
              </Link>
              <Link
                href="/billing"
                className="border border-border px-4 py-2 rounded-xl text-sm font-medium text-slate hover:bg-cream transition-colors"
              >
                Back to Billing
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

