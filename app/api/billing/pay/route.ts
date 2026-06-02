import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export async function POST(req: NextRequest) {
  try {
    const { invoice_id } = await req.json()
    if (!invoice_id) {
      return NextResponse.json({ error: 'invoice_id is required' }, { status: 400 })
    }

    const db = adminClient()

    // Fetch invoice
    const { data: invoice, error: invoiceErr } = await db
      .from('invoices')
      .select('*')
      .eq('id', invoice_id)
      .single()

    if (invoiceErr || !invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    }

    if (invoice.status === 'paid') {
      return NextResponse.json({ error: 'Invoice is already paid' }, { status: 400 })
    }
    if (invoice.status === 'cancelled') {
      return NextResponse.json({ error: 'Invoice is cancelled' }, { status: 400 })
    }

    const secretKey = process.env.MOYASAR_SECRET_KEY ?? ''
    const appUrl    = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

    // Encode amount in halalas (1 SAR = 100 halalas)
    const amountHalalas = Math.round(invoice.total * 100)

    // Create Moyasar payment
    const moyasarPayload = {
      amount:       amountHalalas,
      currency:     'SAR',
      description:  `Sevenhood Invoice ${invoice.invoice_number}`,
      callback_url: `${appUrl}/billing/payment-callback?invoice_id=${invoice_id}`,
      source: { type: 'creditcard' },
    }

    const credentials = Buffer.from(`${secretKey}:`).toString('base64')

    const moyasarRes = await fetch('https://api.moyasar.com/v1/payments', {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Basic ${credentials}`,
      },
      body: JSON.stringify(moyasarPayload),
    })

    const moyasarData = await moyasarRes.json()

    if (!moyasarRes.ok) {
      console.error('[billing/pay] Moyasar error:', moyasarData)
      return NextResponse.json(
        { error: moyasarData?.message ?? 'Payment gateway error', details: moyasarData },
        { status: moyasarRes.status }
      )
    }

    // Save payment record
    const { data: payment, error: paymentErr } = await db
      .from('payments')
      .insert({
        invoice_id,
        amount:         invoice.total,
        currency:       'SAR',
        gateway:        'moyasar',
        gateway_id:     moyasarData.id,
        gateway_status: moyasarData.status,
        status:         'initiated',
        metadata:       moyasarData,
      })
      .select()
      .single()

    if (paymentErr) {
      console.error('[billing/pay] Payment insert error:', paymentErr)
    }

    // Extract payment URL from Moyasar response
    const paymentUrl = moyasarData.source?.transaction_url
      ?? moyasarData.source?.url
      ?? `https://checkout.moyasar.com/${moyasarData.id}`

    return NextResponse.json({
      success:     true,
      payment_url: paymentUrl,
      payment_id:  payment?.id ?? null,
      gateway_id:  moyasarData.id,
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    console.error('[billing/pay]', err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
