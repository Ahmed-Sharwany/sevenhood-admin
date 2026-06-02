import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// ── Helpers ───────────────────────────────────────────────────────────────────

function sar(amount: number) {
  return new Intl.NumberFormat('en-SA', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount)
}

function monthName(month: number, year: number) {
  return new Date(year, month - 1, 1).toLocaleString('en-SA', { month: 'long', year: 'numeric' })
}

// ── Email template ────────────────────────────────────────────────────────────

function buildInvoiceEmail(params: {
  recipientName: string
  invoiceNumber: string
  invoiceType:   'subscription' | 'commission'
  period:        string
  dueDate:       string
  subtotal:      number
  vatAmount:     number
  total:         number
  lineItems:     { description: string; quantity: number; unit_price: number; amount: number }[]
  invoiceUrl:    string
}) {
  const typeLabel = params.invoiceType === 'subscription' ? 'Subscription' : 'Commission'
  const accentColor = params.invoiceType === 'subscription' ? '#1E4D3B' : '#7C3AED'

  const lineItemRows = params.lineItems.map(item => `
    <tr>
      <td style="padding:10px 16px;font-size:13px;color:#1a1a1a;border-bottom:1px solid #f0f0f0;">${item.description}</td>
      <td style="padding:10px 16px;font-size:13px;color:#555;text-align:center;border-bottom:1px solid #f0f0f0;">${item.quantity}</td>
      <td style="padding:10px 16px;font-size:13px;color:#555;text-align:right;border-bottom:1px solid #f0f0f0;">SAR ${sar(item.unit_price)}</td>
      <td style="padding:10px 16px;font-size:13px;color:#1a1a1a;font-weight:600;text-align:right;border-bottom:1px solid #f0f0f0;">SAR ${sar(item.amount)}</td>
    </tr>
  `).join('')

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Invoice ${params.invoiceNumber}</title></head>
<body style="margin:0;padding:0;background:#f5f5f0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f0;padding:40px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

        <!-- Header -->
        <tr><td style="background:${accentColor};border-radius:16px 16px 0 0;padding:32px 40px;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td>
                <div style="color:#C9A56B;font-size:22px;font-weight:700;letter-spacing:-0.5px;">Sevenhood</div>
                <div style="color:rgba(255,255,255,0.5);font-size:11px;letter-spacing:2px;margin-top:3px;text-transform:uppercase;">${typeLabel} Invoice</div>
              </td>
              <td align="right">
                <div style="color:rgba(255,255,255,0.5);font-size:11px;text-transform:uppercase;letter-spacing:1px;">Invoice</div>
                <div style="color:#fff;font-size:18px;font-weight:700;margin-top:2px;">${params.invoiceNumber}</div>
              </td>
            </tr>
          </table>
        </td></tr>

        <!-- Body -->
        <tr><td style="background:#fff;padding:32px 40px;">

          <p style="margin:0 0 24px;font-size:15px;color:#1a1a1a;">Dear <strong>${params.recipientName}</strong>,</p>
          <p style="margin:0 0 28px;font-size:14px;color:#555;line-height:1.6;">
            Please find your ${typeLabel.toLowerCase()} invoice for <strong>${params.period}</strong> attached below.
            Payment is due by <strong>${params.dueDate}</strong>.
          </p>

          <!-- Invoice meta -->
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9f7f4;border-radius:12px;margin-bottom:28px;">
            <tr>
              <td style="padding:14px 20px;border-right:1px solid #eee;">
                <div style="font-size:11px;color:#888;text-transform:uppercase;letter-spacing:1px;">Period</div>
                <div style="font-size:14px;font-weight:600;color:#1a1a1a;margin-top:4px;">${params.period}</div>
              </td>
              <td style="padding:14px 20px;border-right:1px solid #eee;">
                <div style="font-size:11px;color:#888;text-transform:uppercase;letter-spacing:1px;">Type</div>
                <div style="font-size:14px;font-weight:600;color:#1a1a1a;margin-top:4px;">${typeLabel}</div>
              </td>
              <td style="padding:14px 20px;">
                <div style="font-size:11px;color:#888;text-transform:uppercase;letter-spacing:1px;">Due Date</div>
                <div style="font-size:14px;font-weight:600;color:#e53e3e;margin-top:4px;">${params.dueDate}</div>
              </td>
            </tr>
          </table>

          <!-- Line items -->
          <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #f0f0f0;border-radius:12px;overflow:hidden;margin-bottom:20px;">
            <thead>
              <tr style="background:#f9f7f4;">
                <th style="padding:10px 16px;font-size:11px;color:#888;text-transform:uppercase;letter-spacing:1px;text-align:left;font-weight:600;">Description</th>
                <th style="padding:10px 16px;font-size:11px;color:#888;text-transform:uppercase;letter-spacing:1px;text-align:center;font-weight:600;">Qty</th>
                <th style="padding:10px 16px;font-size:11px;color:#888;text-transform:uppercase;letter-spacing:1px;text-align:right;font-weight:600;">Unit Price</th>
                <th style="padding:10px 16px;font-size:11px;color:#888;text-transform:uppercase;letter-spacing:1px;text-align:right;font-weight:600;">Amount</th>
              </tr>
            </thead>
            <tbody>
              ${lineItemRows}
            </tbody>
          </table>

          <!-- Totals -->
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:32px;">
            <tr>
              <td></td>
              <td width="260">
                <table width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="padding:6px 0;font-size:13px;color:#555;">Subtotal</td>
                    <td style="padding:6px 0;font-size:13px;color:#1a1a1a;text-align:right;">SAR ${sar(params.subtotal)}</td>
                  </tr>
                  <tr>
                    <td style="padding:6px 0;font-size:13px;color:#555;">VAT (15%)</td>
                    <td style="padding:6px 0;font-size:13px;color:#1a1a1a;text-align:right;">SAR ${sar(params.vatAmount)}</td>
                  </tr>
                  <tr>
                    <td style="padding:12px 0 6px;font-size:16px;font-weight:700;color:#1a1a1a;border-top:2px solid #1a1a1a;">Total Due</td>
                    <td style="padding:12px 0 6px;font-size:16px;font-weight:700;color:${accentColor};text-align:right;border-top:2px solid #1a1a1a;">SAR ${sar(params.total)}</td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>

          <!-- CTA -->
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr><td align="center">
              <a href="${params.invoiceUrl}"
                 style="display:inline-block;background:${accentColor};color:#fff;text-decoration:none;padding:14px 40px;border-radius:12px;font-size:15px;font-weight:600;letter-spacing:-0.2px;">
                View &amp; Pay Invoice →
              </a>
            </td></tr>
          </table>

        </td></tr>

        <!-- Footer -->
        <tr><td style="background:#f9f7f4;border-radius:0 0 16px 16px;padding:20px 40px;text-align:center;">
          <p style="margin:0;font-size:12px;color:#999;">Sevenhood Platform · KSA PropTech · نوع/هذه رسالة آلية</p>
          <p style="margin:6px 0 0;font-size:11px;color:#bbb;">This is an automated invoice. Please do not reply to this email.</p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`
}

// ── Route ─────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  // Verify Vercel cron secret (Vercel sends Authorization: Bearer CRON_SECRET)
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const now    = new Date()
  const month  = now.getMonth() + 1
  const year   = now.getFullYear()
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://admin.sevenhood.app'

  // ── 1. Trigger invoice generation ──────────────────────────────────────────
  let generateResult: { created?: number; skipped?: number } = {}
  try {
    const genRes = await fetch(`${appUrl}/api/billing/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ month, year }),
    })
    generateResult = await genRes.json()
  } catch (err) {
    console.error('[auto-generate] generate call failed:', err)
    return NextResponse.json({ error: 'Invoice generation failed' }, { status: 500 })
  }

  if ((generateResult.created ?? 0) === 0) {
    return NextResponse.json({
      success: true,
      message: 'No new invoices to send this cycle.',
      ...generateResult,
    })
  }

  // ── 2. Fetch invoices created today ────────────────────────────────────────
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)

  const { data: invoices } = await db
    .from('invoices')
    .select(`
      id, invoice_number, invoice_type, period_start, period_end,
      subtotal, vat_amount, total, due_date, status,
      accounts ( full_name, email ),
      service_providers ( name, contact_email )
    `)
    .gte('created_at', todayStart.toISOString())
    .eq('status', 'pending')

  // ── 3. Fetch line items for those invoices ─────────────────────────────────
  const invoiceIds = (invoices ?? []).map(i => i.id)
  const { data: allLineItems } = invoiceIds.length > 0
    ? await db.from('invoice_items').select('*').in('invoice_id', invoiceIds)
    : { data: [] }

  const lineItemsByInvoice: Record<string, any[]> = {}
  for (const item of (allLineItems ?? []) as any[]) {
    if (!lineItemsByInvoice[item.invoice_id]) lineItemsByInvoice[item.invoice_id] = []
    lineItemsByInvoice[item.invoice_id].push(item)
  }

  // ── 4. Send emails via Resend ──────────────────────────────────────────────
  const resendKey = process.env.RESEND_API_KEY
  let emailsSent  = 0
  let emailErrors = 0

  for (const invoice of invoices ?? []) {
    const recipientName  = (invoice.accounts as any)?.full_name
      ?? (invoice.service_providers as any)?.name
      ?? 'Valued Partner'
    const recipientEmail = (invoice.accounts as any)?.email
      ?? (invoice.service_providers as any)?.contact_email

    if (!recipientEmail) { emailErrors++; continue }

    const lineItems = (lineItemsByInvoice[invoice.id] ?? []).map((li: any) => ({
      description: li.description,
      quantity:    li.quantity,
      unit_price:  parseFloat(li.unit_price),
      amount:      parseFloat(li.amount),
    }))

    const dueDate = invoice.due_date
      ? new Date(invoice.due_date).toLocaleDateString('en-SA', { day: 'numeric', month: 'long', year: 'numeric' })
      : 'Upon receipt'

    const html = buildInvoiceEmail({
      recipientName,
      invoiceNumber: invoice.invoice_number,
      invoiceType:   invoice.invoice_type as 'subscription' | 'commission',
      period:        monthName(month, year),
      dueDate,
      subtotal:      parseFloat(String(invoice.subtotal)),
      vatAmount:     parseFloat(String(invoice.vat_amount)),
      total:         parseFloat(String(invoice.total)),
      lineItems,
      invoiceUrl:    `${appUrl}/billing/invoices/${invoice.id}`,
    })

    try {
      const emailRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendKey}`,
          'Content-Type':  'application/json',
        },
        body: JSON.stringify({
          from:    'Sevenhood Billing <billing@sevenhood.app>',
          to:      [recipientEmail],
          subject: `Invoice ${invoice.invoice_number} — ${monthName(month, year)} · SAR ${sar(parseFloat(String(invoice.total)))}`,
          html,
        }),
      })

      if (emailRes.ok) {
        emailsSent++
      } else {
        const errBody = await emailRes.json().catch(() => ({}))
        console.error(`[auto-generate] email failed for ${recipientEmail}:`, errBody)
        emailErrors++
      }
    } catch (err) {
      console.error(`[auto-generate] email exception for ${recipientEmail}:`, err)
      emailErrors++
    }
  }

  return NextResponse.json({
    success:      true,
    period:       monthName(month, year),
    invoices_created: generateResult.created ?? 0,
    invoices_skipped: generateResult.skipped ?? 0,
    emails_sent:  emailsSent,
    email_errors: emailErrors,
  })
}
