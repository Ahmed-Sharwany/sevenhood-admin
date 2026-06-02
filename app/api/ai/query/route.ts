import { NextRequest, NextResponse } from 'next/server'
import { anthropic } from '@/lib/anthropic'
import { createClient } from '@supabase/supabase-js'

const SCHEMA_SUMMARY = `
Database tables and their exact columns (only use columns listed here):
- projects: id, name, status(active/inactive), created_at
- buildings: id, name, project_id, created_at
- units: id, unit_number, building_id, project_id, status(occupied/vacant/reserved), floor, bedrooms, bathrooms
- residents: id, full_name, email, phone, unit_id, move_in_date
- maintenance_tickets: id, category(plumbing/electrical/hvac/painting/cleaning/other), description, status(open/in_progress/completed/cancelled), priority(low/medium/high), unit_id, project_id, created_at
- visitor_passes: id, visitor_name, resident_id, unit_id, status(active/pending/expired/cancelled), created_at
- amenity_bookings: id, amenity_id, resident_id, date, time_slot, status(confirmed/pending/cancelled)
- ai_design_requests: id, resident_id, unit_id, room_type, style, status(pending/processing/completed/failed), created_at
- service_providers: id, name, specialty, is_active, rating
- posts: id, content, author_name, is_operator, created_at, likes
- events: id, name, date, time, location, capacity, rsvp_count
`

type Filter = { column: string; operator: string; value: string }

export async function POST(req: NextRequest) {
  try {
    const { question } = await req.json()
    if (!question?.trim()) return NextResponse.json({ error: 'Question required' }, { status: 400 })

    const message = await anthropic.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 512,
      messages: [
        {
          role: 'user',
          content: `You are a data assistant for a real estate management platform. Given a question, return a structured query plan.

Database schema:
${SCHEMA_SUMMARY}

Question: "${question}"

Return ONLY a valid JSON object, no markdown, no explanation:
{
  "table": "table_name",
  "select": "id, name, status",
  "filters": [
    {"column": "col", "operator": "eq", "value": "val"}
  ],
  "limit": 10,
  "order_by": {"column": "created_at", "ascending": false},
  "description": "Human-readable description of what this query returns",
  "is_aggregate": false
}

Important rules:
- "select" must be a comma-separated list of column names — NEVER use count(*) or SQL functions
- ONLY use columns that are explicitly listed in the schema above — do NOT invent columns
- Set "is_aggregate": true when the question asks for a count/total/number of something
- When "is_aggregate" is true, set "select" to just "id"
- "filters" should be an EMPTY array [] unless the user explicitly asks to filter by something
- "operator" must be one of: eq, ilike, gt, lt, gte, lte
- Use "ilike" with value "%term%" for partial text search
- For status fields use exact values from schema (e.g. "open", "vacant")
- If question is in Arabic, write the "description" in Arabic
- If unanswerable, return: {"error": "Cannot answer this question with available data"}`,
        },
      ],
    })

    const raw = (message.content[0] as { type: string; text: string }).text.trim()
    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('No JSON in Claude response')
    const plan = JSON.parse(jsonMatch[0])

    if (plan.error) return NextResponse.json({ error: plan.error }, { status: 422 })

    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // For both aggregate and list queries, always fetch rows (never count API)
    // This avoids Supabase count quirks. For aggregates we just count the returned rows.
    const safeSelect = plan.is_aggregate
      ? 'id'
      : (plan.select ?? 'id, name, status').replace(/count\s*\(\s*\*\s*\)/gi, 'id')

    let query = adminClient.from(plan.table).select(safeSelect)

    // Apply filters
    if (Array.isArray(plan.filters)) {
      for (const f of plan.filters as Filter[]) {
        if (!f.column || !f.operator) continue
        switch (f.operator) {
          case 'eq':    query = (query as any).eq(f.column, f.value);    break
          case 'ilike': query = (query as any).ilike(f.column, f.value); break
          case 'gt':    query = (query as any).gt(f.column, f.value);    break
          case 'lt':    query = (query as any).lt(f.column, f.value);    break
          case 'gte':   query = (query as any).gte(f.column, f.value);   break
          case 'lte':   query = (query as any).lte(f.column, f.value);   break
        }
      }
    }

    if (plan.order_by?.column && !plan.is_aggregate) {
      query = (query as any).order(plan.order_by.column, { ascending: plan.order_by.ascending ?? false })
    }

    // For aggregates fetch up to 1000 to count; for lists cap at limit
    query = (query as any).limit(plan.is_aggregate ? 1000 : (plan.limit ?? 10))

    const { data, error } = await (query as any)

    if (error) {
      console.error('[ai/query] Supabase error:', JSON.stringify(error))
      return NextResponse.json(
        { error: `Query failed: ${error.message ?? 'unknown error'}` },
        { status: 500 }
      )
    }

    const rows = (data ?? []) as Record<string, unknown>[]

    return NextResponse.json({
      success: true,
      description: plan.description,
      table: plan.table,
      is_aggregate: plan.is_aggregate,
      count: plan.is_aggregate ? rows.length : undefined,
      rows: plan.is_aggregate ? undefined : rows,
      total: rows.length,
    })

  } catch (err: unknown) {
    console.error('[ai/query]', err)
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: `Failed to process query: ${msg}` }, { status: 500 })
  }
}
