import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export async function POST(req: NextRequest) {
  try {
    const body      = await req.text()
    const signature = req.headers.get('x-moyasar-signature') ?? ''
    const secret    = process.env.MOYASAR_WEBHOOK_SECRET ?? ''

    // Verify webhook signature if secret is configured
    if (secret) {
      const expectedSig = crypto
        .createHmac('sha256', secret)
        .update(body)
        .digest('hex')

      if (signature !== expectedSig) {
        console.warn('[billing/webhook] Invalid signature')
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
      }
    }

    const payload = JSON.parse(body)
    const { id: gatewayId, status, payment_method } = payload

    if (!gatewayId) {
      return NextResponse.json({ error: 'Missing payment id' }, { status: 400 })
    }

    const db = adminClient()

    // Find payment by gateway_id
    const { data: payment, error: paymentErr } = await db
      .from('payments')
      .select('id, invoice_id')
      .eq('gateway_id', gatewayId)
      .maybeSingle()

    if (paymentErr || !payment) {
      console.warn('[billing/webhook] Payment not found for gateway_id:', gatewayId)
      // Return 200 to prevent retries for unknown payments
      return NextResponse.json({ received: true })
    }

    const now = new Date().toISOString()

    if (status === 'paid') {
      // Update payment
      await db
        .from('payments')
        .update({
          status:         'paid',
          gateway_status: status,
          payment_method: payment_method ?? null,
          paid_at:        now,
          metadata:       payload,
        })
        .eq('id', payment.id)

      // Update invoice
      if (payment.invoice_id) {
        await db
          .from('invoices')
          .update({
            status:             'paid',
            paid_at:            now,
            payment_gateway_id: gatewayId,
          })
          .eq('id', payment.invoice_id)
      }
    } else if (status === 'failed') {
      // Update payment to failed
      await db
        .from('payments')
        .update({
          status:         'failed',
          gateway_status: status,
          metadata:       payload,
        })
        .eq('id', payment.id)
    } else if (status === 'refunded') {
      await db
        .from('payments')
        .update({
          status:         'refunded',
          gateway_status: status,
          metadata:       payload,
        })
        .eq('id', payment.id)
    }

    return NextResponse.json({ received: true })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    console.error('[billing/webhook]', err)
    // Return 200 to prevent excessive retries
    return NextResponse.json({ received: true, error: msg })
  }
}
