import { NextRequest, NextResponse } from 'next/server'
import { anthropic } from '@/lib/anthropic'
import { createClient } from '@supabase/supabase-js'

export async function POST(req: NextRequest) {
  try {
    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // Fetch last 6 months of tickets with unit + project info
    const sixMonthsAgo = new Date()
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)

    const { data: tickets } = await adminClient
      .from('maintenance_tickets')
      .select('id, category, status, priority, created_at, unit_id, units(unit_number, building_id), projects(name)')
      .gte('created_at', sixMonthsAgo.toISOString())
      .order('created_at', { ascending: false })

    if (!tickets || tickets.length === 0) {
      return NextResponse.json({
        success: true,
        insights: [],
        summary: 'No ticket data available for the past 6 months.',
      })
    }

    // Summarize ticket data for Claude (to keep tokens low)
    const unitTicketMap: Record<string, { count: number; categories: string[]; priorities: string[]; unit: string; project: string }> = {}

    for (const t of tickets) {
      const unitId = t.unit_id ?? 'unknown'
      const unitNum = (t.units as any)?.unit_number ?? 'Unknown Unit'
      const project = (t.projects as any)?.name ?? 'Unknown Project'
      if (!unitTicketMap[unitId]) {
        unitTicketMap[unitId] = { count: 0, categories: [], priorities: [], unit: unitNum, project }
      }
      unitTicketMap[unitId].count++
      unitTicketMap[unitId].categories.push(t.category)
      unitTicketMap[unitId].priorities.push(t.priority)
    }

    // Build category summary
    const categoryCount: Record<string, number> = {}
    const priorityCount: Record<string, number> = {}
    for (const t of tickets) {
      categoryCount[t.category] = (categoryCount[t.category] ?? 0) + 1
      priorityCount[t.priority] = (priorityCount[t.priority] ?? 0) + 1
    }

    // Find high-frequency units (3+ tickets)
    const hotUnits = Object.values(unitTicketMap)
      .filter(u => u.count >= 3)
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)

    const summaryText = `
Total tickets (last 6 months): ${tickets.length}
By category: ${Object.entries(categoryCount).map(([k, v]) => `${k}: ${v}`).join(', ')}
By priority: ${Object.entries(priorityCount).map(([k, v]) => `${k}: ${v}`).join(', ')}
High-frequency units (3+ tickets): ${hotUnits.map(u => `${u.project} - Unit ${u.unit} (${u.count} tickets, main issue: ${u.categories.sort((a,b) => u.categories.filter(x=>x===b).length - u.categories.filter(x=>x===a).length)[0]})`).join(' | ')}
`

    const message = await anthropic.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: `You are a property maintenance analyst. Analyze this maintenance ticket data from a Saudi Arabia residential complex and provide actionable insights.

Data summary:
${summaryText}

Return ONLY a JSON object:
{
  "summary": "2-3 sentence executive summary of the maintenance situation",
  "risk_units": [
    { "unit": "unit name", "project": "project name", "count": 5, "main_issue": "plumbing", "recommendation": "Schedule preventive inspection" }
  ],
  "top_issues": [
    { "category": "plumbing", "count": 12, "trend": "increasing", "action": "Recommended action" }
  ],
  "recommendations": [
    "Actionable recommendation 1",
    "Actionable recommendation 2",
    "Actionable recommendation 3"
  ],
  "urgency_level": "low|medium|high"
}`,
        },
      ],
    })

    const raw = (message.content[0] as { type: string; text: string }).text.trim()
    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('No JSON in response')
    const insights = JSON.parse(jsonMatch[0])

    return NextResponse.json({ success: true, ...insights, total_analyzed: tickets.length })
  } catch (err) {
    console.error('[ai/maintenance-insights]', err)
    return NextResponse.json({ error: 'Failed to generate insights.' }, { status: 500 })
  }
}
