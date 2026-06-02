import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export async function GET() {
  try {
    const db = adminClient()
    const { data, error } = await db
      .from('platform_settings')
      .select('*')
      .limit(1)
      .single()

    if (error) throw error
    return NextResponse.json({ success: true, settings: data })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json()
    const { unit_monthly_fee, service_commission_pct, invoice_due_days } = body

    // Validate
    if (unit_monthly_fee !== undefined && (isNaN(Number(unit_monthly_fee)) || Number(unit_monthly_fee) < 0)) {
      return NextResponse.json({ error: 'Invalid unit_monthly_fee' }, { status: 400 })
    }
    if (service_commission_pct !== undefined && (isNaN(Number(service_commission_pct)) || Number(service_commission_pct) < 0 || Number(service_commission_pct) > 100)) {
      return NextResponse.json({ error: 'Invalid service_commission_pct — must be 0–100' }, { status: 400 })
    }
    if (invoice_due_days !== undefined && (isNaN(Number(invoice_due_days)) || Number(invoice_due_days) < 1)) {
      return NextResponse.json({ error: 'Invalid invoice_due_days — must be >= 1' }, { status: 400 })
    }

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (unit_monthly_fee !== undefined)      updates.unit_monthly_fee      = Number(unit_monthly_fee)
    if (service_commission_pct !== undefined) updates.service_commission_pct = Number(service_commission_pct)
    if (invoice_due_days !== undefined)       updates.invoice_due_days       = Number(invoice_due_days)

    const db = adminClient()

    // Get the single row id first
    const { data: existing, error: fetchErr } = await db
      .from('platform_settings')
      .select('id')
      .limit(1)
      .single()
    if (fetchErr) throw fetchErr

    const { data, error } = await db
      .from('platform_settings')
      .update(updates)
      .eq('id', existing.id)
      .select()
      .single()

    if (error) throw error
    return NextResponse.json({ success: true, settings: data })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
