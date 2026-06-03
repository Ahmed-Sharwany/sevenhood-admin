import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function sar(amount: number) {
  return new Intl.NumberFormat('en-SA', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount)
}

function daysOverdue(dueDateStr: string): number {
  const due  = new Date(dueDateStr)
  due.setHours(0, 0, 0, 0)
  const now  = new Date()
  now.setHours(0, 0, 0, 0)
  return Math.floor((now.getTime() - due.getTime()) / (1000 * 60 * 60 * 24))
}

// ── Reminder email template ───────────────────────────────────────────────────

const REMINDER_CONFIG = {
  1: { subject: 'Invoice Overdue',                      headerColor: '#B45309', badge: '⚠️ Overdue',         intro: 'Your invoice is now overdue. Please arrange payment as soon as possible to avoid service interruption.' },
  2: { subject: '3-Day Overdue Reminder',               headerColor: '#C2410C', badge: '🔔 3 Days Overdue',  intro: 'Your invoice has been overdue for 3 days. Please settle the outstanding balance immediately.' },
  3: { subject: 'Urgent — Invoice 7 Days Overdue',      headerColor: '#B91C1C', badge: '🚨 7 Days Overdue',  intro: 'This is an urgent reminder. Your invoice is 7 days past due. Continued non-payment may affect your account status.' },
  4: { subject: 'Final Notice — Payment Required',      headerColor: '#7F1D1D', badge: '❗ Final Notice',     intro: 'This is your final notice. Your invoice is 14 days overdue. Immediate payment is required to keep your account active.' },
}

function buildReminderEmail(params: {
  recipientName: string
  invoiceNumber: string
  total: number
  dueDate: string
  days: number
  invoiceUrl: string
  level: 1 | 2 | 3 | 4
}) {
  const cfg = REMINDER_CONFIG[params.level]

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>${cfg.subject}</title></head>
<body style="margin:0;padding:0;background:#f5f5f0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f0;padding:40px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

        <!-- Header -->
        <tr><td style="background:${cfg.headerColor};border-radius:16px 16px 0 0;padding:28px 40px;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td>
                <div style="color:#fff;font-size:20px;font-weight:700;letter-spacing:-0.5px;">Sevenhood</div>
                <div style="color:rgba(255,255,255,0.6);font-size:11px;letter-spacing:2px;margin-top:3px;text-transform:uppercase;">Billing Notice</div>
              </td>
              <td align="right">
                <div style="background:rgba(255,255,255,0.15);color:#fff;font-size:12px;font-weight:600;padding:6px 14px;border-radius:20px;white-space:nowrap;">
                  ${cfg.badge}
                </div>
              </td>
            </tr>
          </table>
        </td></tr>

        <!-- Body -->
        <tr><td style="background:#fff;padding:32px 40px;">

          <p style="margin:0 0 20px;font-size:15px;color:#1a1a1a;">Dear <strong>${params.recipientName}</strong>,</p>
          <p style="margin:0 0 28px;font-size:14px;color:#555;line-height:1.6;">${cfg.intro}</p>

          <!-- Invoice summary box -->
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#fef2f2;border:1px solid #fecaca;border-radius:12px;margin-bottom:28px;">
            <tr>
              <td style="padding:14px 20px;border-right:1px solid #fecaca;">
                <div style="font-size:11px;color:#888;text-transform:uppercase;letter-spacing:1px;">Invoice</div>
                <div style="font-size:14px;font-weight:700;color:#1a1a1a;margin-top:4px;font-family:monospace;">${params.invoiceNumber}</div>
              </td>
              <td style="padding:14px 20px;border-right:1px solid #fecaca;">
                <div style="font-size:11px;color:#888;text-transform:uppercase;letter-spacing:1px;">Amount Due</div>
                <div style="font-size:16px;font-weight:700;color:${cfg.headerColor};margin-top:4px;">SAR ${sar(params.total)}</div>
              </td>
              <td style="padding:14px 20px;">
                <div style="font-size:11px;color:#888;text-transform:uppercase;letter-spacing:1px;">Days Overdue</div>
                <div style="font-size:14px;font-weight:700;color:${cfg.headerColor};margin-top:4px;">${params.days} day${params.days !== 1 ? 's' : ''}</div>
              </td>
            </tr>
          </table>

          <!-- CTA -->
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
            <tr><td align="center">
              <a href="${params.invoiceUrl}"
                 style="display:inline-block;background:${cfg.headerColor};color:#fff;text-decoration:none;padding:14px 44px;border-radius:12px;font-size:15px;font-weight:600;">
                Pay Now →
              </a>
            </td></tr>
          </table>

          <p style="margin:0;font-size:13px;color:#888;text-align:center;line-height:1.6;">
            If you have already made payment, please disregard this notice.<br>
            For queries, contact your account manager.
          </p>

        </td></tr>

        <!-- Footer -->
        <tr><td style="background:#f9f7f4;border-radius:0 0 16px 16px;padding:20px 40px;text-align:center;">
          <p style="margin:0;font-size:12px;color:#999;">Sevenhood Platform · KSA PropTech</p>
          <p style="margin:6px 0 0;font-size:11px;color:#bbb;">This is an automated billing notice. Please do not reply to this email.</p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`
}

// ── Audit helper ──────────────────────────────────────────────────────────────

async function auditLog(db: ReturnType<typeof adminClient>, event_type: string, invoice_id: string, details: Record<string, unknown>) {
  try {
    await db.from('billing_audit_log').insert({ event_type, invoice_id, details })
  } catch (err) {
    console.error('[check-overdue] auditLog failed:', err)
  }
}

// ── Route ─────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = adminClient()

  const appUrl     = process.env.NEXT_PUBLIC_APP_URL ?? 'https://admin.sevenhood.app'
  const resendKey  = process.env.RESEND_API_KEY
  const today      = new Date().toISOString().slice(0, 10)
  const now        = new Date().toISOString()

  let newlyOverdue = 0
  let remindersSent = 0
  const errors: string[] = []

  // ── 1. Find PENDING invoices past due date → mark overdue + send level-1 email
  const { data: pendingOverdue } = await db
    .from('invoices')
    .select('id, invoice_number, total, due_date, account_id, service_provider_id, accounts(full_name, email), service_providers(name, contact_email)')
    .eq('status', 'pending')
    .lt('due_date', today)

  for (const inv of pendingOverdue ?? []) {
    try {
      await db.from('invoices').update({
        status:           'overdue',
        reminder_count:   1,
        last_reminder_at: now,
      }).eq('id', inv.id)

      const days     = daysOverdue(inv.due_date)
      const name     = (inv.accounts as any)?.full_name ?? (inv.service_providers as any)?.name ?? 'Valued Partner'
      const email    = (inv.accounts as any)?.email ?? (inv.service_providers as any)?.contact_email

      if (email && resendKey) {
        const cfg = REMINDER_CONFIG[1]
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from:    'Sevenhood Billing <billing@sevenhood.app>',
            to:      [email],
            subject: `${cfg.subject} — ${inv.invoice_number} · SAR ${sar(parseFloat(String(inv.total)))}`,
            html:    buildReminderEmail({
              recipientName: name,
              invoiceNumber: inv.invoice_number,
              total:         parseFloat(String(inv.total)),
              dueDate:       inv.due_date,
              days,
              invoiceUrl:    `${appUrl}/billing/invoices/${inv.id}`,
              level:         1,
            }),
          }),
        })
      }

      await auditLog(db, 'overdue_reminder', inv.id, {
        reminder_level: 1,
        days_overdue:   days,
        due_date:       inv.due_date,
        email_sent:     !!email,
        sent_at:        now,
      })

      newlyOverdue++
    } catch (err: unknown) {
      errors.push(`Invoice ${inv.id}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  // ── 2. Send escalating reminders for already-overdue invoices
  const { data: overdueInvoices } = await db
    .from('invoices')
    .select('id, invoice_number, total, due_date, reminder_count, accounts(full_name, email), service_providers(name, contact_email)')
    .eq('status', 'overdue')
    .lt('reminder_count', 4)

  for (const inv of overdueInvoices ?? []) {
    try {
      const days           = daysOverdue(inv.due_date)
      const reminderCount  = inv.reminder_count ?? 1

      // Determine which level is due
      let level: 2 | 3 | 4 | null = null
      if (days >= 14 && reminderCount < 4) level = 4
      else if (days >= 7  && reminderCount < 3) level = 3
      else if (days >= 3  && reminderCount < 2) level = 2

      if (!level) continue

      const name  = (inv.accounts as any)?.full_name ?? (inv.service_providers as any)?.name ?? 'Valued Partner'
      const email = (inv.accounts as any)?.email ?? (inv.service_providers as any)?.contact_email

      // ── Update DB FIRST — prevents duplicate emails if email step fails
      await db.from('invoices').update({
        reminder_count:   level,
        last_reminder_at: now,
      }).eq('id', inv.id)

      if (email && resendKey) {
        const cfg = REMINDER_CONFIG[level]
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from:    'Sevenhood Billing <billing@sevenhood.app>',
            to:      [email],
            subject: `${cfg.subject} — ${inv.invoice_number} · SAR ${sar(parseFloat(String(inv.total)))}`,
            html:    buildReminderEmail({
              recipientName: name,
              invoiceNumber: inv.invoice_number,
              total:         parseFloat(String(inv.total)),
              dueDate:       inv.due_date,
              days,
              invoiceUrl:    `${appUrl}/billing/invoices/${inv.id}`,
              level,
            }),
          }),
        })
      }

      await auditLog(db, 'overdue_reminder', inv.id, {
        reminder_level: level,
        days_overdue:   days,
        due_date:       inv.due_date,
        email_sent:     !!email,
        sent_at:        now,
      })

      remindersSent++
    } catch (err: unknown) {
      errors.push(`Invoice ${inv.id}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  return NextResponse.json({
    success:       true,
    date:          today,
    newly_overdue: newlyOverdue,
    reminders_sent: remindersSent,
    errors,
  })
}
