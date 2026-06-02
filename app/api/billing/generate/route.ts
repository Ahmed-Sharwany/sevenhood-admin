import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

function periodDates(year: number, month: number) {
  const start = new Date(year, month - 1, 1)
  const end   = new Date(year, month, 0) // last day of month
  return {
    period_start: start.toISOString().slice(0, 10),
    period_end:   end.toISOString().slice(0, 10),
  }
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr)
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

// Write one audit log entry (never throws — errors are logged to console only)
async function auditLog(
  db: ReturnType<typeof adminClient>,
  event_type: string,
  invoice_id: string,
  details: Record<string, unknown>
) {
  try {
    await db.from('billing_audit_log').insert({ event_type, invoice_id, details })
  } catch (err) {
    console.error('[billing/generate] auditLog failed:', err)
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const now  = new Date()
    const year  = Number(body.year  ?? now.getFullYear())
    const month = Number(body.month ?? now.getMonth() + 1)

    if (month < 1 || month > 12) {
      return NextResponse.json({ error: 'month must be 1–12' }, { status: 400 })
    }
    if (year < 2020 || year > 2100) {
      return NextResponse.json({ error: 'Invalid year' }, { status: 400 })
    }

    const db = adminClient()
    const { period_start, period_end } = periodDates(year, month)

    // ── Fetch platform settings ──────────────────────────────────────────────
    const { data: settings, error: settingsErr } = await db
      .from('platform_settings')
      .select('*')
      .limit(1)
      .single()
    if (settingsErr) throw new Error(`Failed to fetch settings: ${settingsErr.message}`)

    const { unit_monthly_fee, service_commission_pct, vat_pct, invoice_due_days } = settings
    const monthTag = `${year}-${String(month).padStart(2, '0')}`

    let created = 0
    let skipped = 0
    const errors: string[] = []

    // ════════════════════════════════════════════════════════════════════════
    // SUBSCRIPTION INVOICES — one per account per period
    // Duplicate guard: unique invoice_number (INV-SUB-YYYY-MM-XXXXXX)
    // ════════════════════════════════════════════════════════════════════════
    const { data: accounts, error: accountsErr } = await db
      .from('accounts')
      .select('id, full_name, email, role, project_access, unit_monthly_fee')
      .in('role', ['project_owner', 'operator', 'org_admin'])
      .eq('is_active', true)

    if (accountsErr) throw new Error(`Failed to fetch accounts: ${accountsErr.message}`)

    for (const account of accounts ?? []) {
      try {
        const projectAccess: string[] = account.project_access ?? []
        if (!projectAccess || projectAccess.length === 0) { skipped++; continue }

        // Count billable units (exclude cancelled)
        const { data: units, error: unitsErr } = await db
          .from('units')
          .select('id, project_id')
          .in('project_id', projectAccess)
          .neq('status', 'cancelled')

        if (unitsErr) throw new Error(`Units query failed: ${unitsErr.message}`)

        const unitCount = units?.length ?? 0
        if (unitCount === 0) { skipped++; continue }

        // Per-account rate or global fallback
        const effective_rate = account.unit_monthly_fee != null
          ? parseFloat(String(account.unit_monthly_fee))
          : unit_monthly_fee

        const subtotal   = parseFloat((unitCount * effective_rate).toFixed(2))
        const vat_amount = parseFloat((subtotal * (vat_pct / 100)).toFixed(2))
        const total      = parseFloat((subtotal + vat_amount).toFixed(2))

        const invoice_number = `INV-SUB-${monthTag}-${account.id.slice(0, 6).toUpperCase()}`
        const due_date       = addDays(period_end, invoice_due_days)

        // ── Duplicate check: same invoice_number means this period is already billed
        const { data: existing } = await db
          .from('invoices')
          .select('id')
          .eq('invoice_number', invoice_number)
          .maybeSingle()

        if (existing) { skipped++; continue }

        // ── Create invoice
        const { data: invoice, error: invoiceErr } = await db
          .from('invoices')
          .insert({
            invoice_number,
            account_id:   account.id,
            invoice_type: 'subscription',
            period_start,
            period_end,
            subtotal,
            vat_amount,
            total,
            status:   'pending',
            due_date,
          })
          .select()
          .single()

        if (invoiceErr) throw new Error(`Invoice insert failed: ${invoiceErr.message}`)

        // ── Group units by project for line items
        const projectUnitMap: Record<string, number> = {}
        for (const unit of units ?? []) {
          projectUnitMap[unit.project_id] = (projectUnitMap[unit.project_id] ?? 0) + 1
        }

        const projectIds = Object.keys(projectUnitMap)
        const { data: projects } = await db
          .from('projects')
          .select('id, name')
          .in('id', projectIds)

        const projectNameMap: Record<string, string> = {}
        for (const p of projects ?? []) { projectNameMap[p.id] = p.name }

        const lineItems = projectIds.map(pid => {
          const qty    = projectUnitMap[pid]
          const amount = parseFloat((qty * effective_rate).toFixed(2))
          return {
            invoice_id:     invoice.id,
            description:    `${projectNameMap[pid] ?? 'Project'} — ${qty} active unit${qty !== 1 ? 's' : ''} @ SAR ${effective_rate}/unit`,
            quantity:       qty,
            unit_price:     effective_rate,
            amount,
            reference_id:   pid,
            reference_type: 'unit',
          }
        })

        await db.from('invoice_items').insert(lineItems)

        // ── Audit log
        await auditLog(db, 'invoice_generated', invoice.id, {
          invoice_number,
          invoice_type:   'subscription',
          account_id:     account.id,
          account_name:   account.full_name,
          period_start,
          period_end,
          unit_count:     unitCount,
          effective_rate,
          subtotal,
          vat_amount,
          total,
          generated_at:   new Date().toISOString(),
          generated_by:   'system/cron',
        })

        created++
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err)
        errors.push(`Account ${account.id}: ${msg}`)
      }
    }

    // ════════════════════════════════════════════════════════════════════════
    // COMMISSION INVOICES — one per service provider per period
    // Duplicate guard:
    //   1. Unique invoice_number (INV-COM-YYYY-MM-XXXXXX)
    //   2. Only tickets where invoice_id IS NULL (not yet invoiced)
    //   3. After invoice creation, stamp invoice_id + invoiced_at on each ticket
    // ════════════════════════════════════════════════════════════════════════
    const { data: providers, error: providersErr } = await db
      .from('service_providers')
      .select('id, name')
      .eq('is_active', true)

    if (providersErr) throw new Error(`Failed to fetch providers: ${providersErr.message}`)

    for (const sp of providers ?? []) {
      try {
        // Only tickets that have NOT been invoiced yet (.is('invoice_id', null))
        const { data: tickets, error: ticketsErr } = await db
          .from('maintenance_tickets')
          .select('id, description, actual_cost, category')
          .eq('service_provider_id', sp.id)
          .eq('status', 'completed')
          .not('actual_cost', 'is', null)
          .is('invoice_id', null)                  // ← DUPLICATE PREVENTION
          .gte('created_at', `${period_start}T00:00:00.000Z`)
          .lte('created_at', `${period_end}T23:59:59.999Z`)

        if (ticketsErr) throw new Error(`Tickets query failed: ${ticketsErr.message}`)

        if (!tickets || tickets.length === 0) { skipped++; continue }

        const commission_base = tickets.reduce((sum, t) => sum + parseFloat(String(t.actual_cost ?? 0)), 0)
        const commission      = parseFloat((commission_base * (service_commission_pct / 100)).toFixed(2))

        if (commission === 0) { skipped++; continue }

        const vat_amount = parseFloat((commission * (vat_pct / 100)).toFixed(2))
        const total      = parseFloat((commission + vat_amount).toFixed(2))

        const invoice_number = `INV-COM-${monthTag}-${sp.id.slice(0, 6).toUpperCase()}`
        const due_date       = addDays(period_end, invoice_due_days)

        // ── Duplicate check: same invoice_number means this period is already billed
        const { data: existing } = await db
          .from('invoices')
          .select('id')
          .eq('invoice_number', invoice_number)
          .maybeSingle()

        if (existing) { skipped++; continue }

        // ── Create invoice
        const { data: invoice, error: invoiceErr } = await db
          .from('invoices')
          .insert({
            invoice_number,
            service_provider_id: sp.id,
            invoice_type: 'commission',
            period_start,
            period_end,
            subtotal:   commission,
            vat_amount,
            total,
            status:   'pending',
            due_date,
            notes: `Commission on ${tickets.length} completed ticket${tickets.length !== 1 ? 's' : ''}. Base cost: SAR ${commission_base.toFixed(2)}`,
          })
          .select()
          .single()

        if (invoiceErr) throw new Error(`Invoice insert failed: ${invoiceErr.message}`)

        // ── Line items — one per ticket
        const lineItems = tickets.map(t => {
          const ticketCost    = parseFloat(String(t.actual_cost ?? 0))
          const ticketCommiss = parseFloat((ticketCost * (service_commission_pct / 100)).toFixed(2))
          return {
            invoice_id:     invoice.id,
            description:    `Commission on ticket: ${t.category ?? 'maintenance'} — ${t.description?.slice(0, 80) ?? 'N/A'}`,
            quantity:       1,
            unit_price:     ticketCommiss,
            amount:         ticketCommiss,
            reference_id:   t.id,
            reference_type: 'ticket',
          }
        })

        await db.from('invoice_items').insert(lineItems)

        // ── CRITICAL: Stamp every ticket with this invoice so it cannot be re-billed
        const ticketIds     = tickets.map(t => t.id)
        const invoicedAt    = new Date().toISOString()

        const { error: stampErr } = await db
          .from('maintenance_tickets')
          .update({ invoice_id: invoice.id, invoiced_at: invoicedAt })
          .in('id', ticketIds)

        if (stampErr) {
          // Log but don't abort — invoice is already created; manual reconciliation possible
          console.error(`[billing/generate] Failed to stamp tickets for invoice ${invoice.id}:`, stampErr.message)
          errors.push(`Provider ${sp.id}: ticket stamp failed — ${stampErr.message}`)
        }

        // ── Audit log
        await auditLog(db, 'invoice_generated', invoice.id, {
          invoice_number,
          invoice_type:        'commission',
          service_provider_id: sp.id,
          provider_name:       sp.name,
          period_start,
          period_end,
          ticket_count:        tickets.length,
          ticket_ids:          ticketIds,
          commission_base,
          commission_rate_pct: service_commission_pct,
          subtotal:            commission,
          vat_amount,
          total,
          generated_at:        invoicedAt,
          generated_by:        'system/cron',
        })

        created++
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err)
        errors.push(`Provider ${sp.id}: ${msg}`)
      }
    }

    return NextResponse.json({
      success: true,
      month,
      year,
      period_start,
      period_end,
      created,
      skipped,
      errors,
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    console.error('[billing/generate]', err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
