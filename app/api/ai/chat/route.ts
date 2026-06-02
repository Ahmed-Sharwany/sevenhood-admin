import { NextRequest, NextResponse } from 'next/server'
import { anthropic } from '@/lib/anthropic'
import { createClient } from '@supabase/supabase-js'

export async function POST(req: NextRequest) {
  try {
    const { message, resident_id, conversation_history } = await req.json()

    if (!message?.trim()) {
      return NextResponse.json({ error: 'Message required' }, { status: 400 })
    }

    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // Fetch resident context if resident_id provided
    let residentContext = ''
    if (resident_id) {
      const { data: resident } = await adminClient
        .from('residents')
        .select('full_name, email, unit_id, units(unit_number, building_id, buildings(name, projects(name)))')
        .eq('id', resident_id)
        .maybeSingle()

      if (resident) {
        const unit = (resident.units as any)
        const building = unit?.buildings
        const project = building?.projects
        residentContext = `
Resident: ${resident.full_name}
Unit: ${unit?.unit_number ?? 'Unknown'}
Building: ${building?.name ?? 'Unknown'}
Project: ${project?.name ?? 'Unknown'}
Email: ${resident.email ?? 'Not provided'}
`
      }
    }

    // Build conversation history for Claude
    const history = Array.isArray(conversation_history)
      ? conversation_history.slice(-10).map((m: { role: string; content: string }) => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        }))
      : []

    const systemPrompt = `You are a helpful AI concierge assistant for Sevenhood, a premium residential community platform in Saudi Arabia.

You help residents with:
- Reporting maintenance issues (acknowledge receipt and say a ticket will be created)
- Answering questions about amenities and facilities
- Information about community rules and guidelines
- Event and booking information
- General community questions

${residentContext ? `Current resident context:\n${residentContext}` : ''}

Guidelines:
- Be warm, professional, and helpful
- Respond in the same language the resident uses (Arabic or English)
- For maintenance issues, acknowledge them and let the resident know their request has been logged
- For questions you cannot answer definitively, offer to escalate to management
- Keep responses concise (2-4 sentences usually)
- Never make up specific booking availability, pricing, or policy details
- Sign off as "Sevenhood Concierge"

If a resident reports a maintenance issue, end your response with exactly this tag on a new line:
[CREATE_TICKET: category|description]
Where category is one of: plumbing, electrical, hvac, painting, cleaning, other`

    const response = await anthropic.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 512,
      system: systemPrompt,
      messages: [
        ...history,
        { role: 'user', content: message },
      ],
    })

    const replyText = (response.content[0] as { type: string; text: string }).text

    // Check if Claude wants to create a ticket
    let ticketCreated = null
    const ticketMatch = replyText.match(/\[CREATE_TICKET:\s*([^|]+)\|([^\]]+)\]/)
    if (ticketMatch && resident_id) {
      const category = ticketMatch[1].trim().toLowerCase()
      const description = ticketMatch[2].trim()

      // Fetch resident's unit_id
      const { data: resident } = await adminClient
        .from('residents')
        .select('unit_id')
        .eq('id', resident_id)
        .maybeSingle()

      if (resident?.unit_id) {
        const { data: ticket } = await adminClient
          .from('maintenance_tickets')
          .insert({
            unit_id: resident.unit_id,
            category: ['plumbing', 'electrical', 'hvac', 'painting', 'cleaning'].includes(category) ? category : 'other',
            description,
            status: 'open',
            priority: 'medium',
            source: 'chatbot',
          })
          .select('id')
          .single()

        ticketCreated = ticket?.id
      }
    }

    // Clean the reply (remove the ticket tag before sending to user)
    const cleanReply = replyText.replace(/\[CREATE_TICKET:[^\]]+\]/g, '').trim()

    // Log conversation to Supabase (table may not exist yet — fail silently)
    try {
      await adminClient.from('chatbot_conversations').upsert({
        resident_id: resident_id ?? null,
        messages: [
          ...(history ?? []),
          { role: 'user', content: message },
          { role: 'assistant', content: cleanReply },
        ],
        last_message_at: new Date().toISOString(),
      }, { onConflict: resident_id ? 'resident_id' : undefined })
    } catch { /* table may not exist yet */ }

    return NextResponse.json({
      success: true,
      reply: cleanReply,
      ticket_created: ticketCreated,
    })

  } catch (err) {
    console.error('[ai/chat]', err)
    return NextResponse.json({ error: 'Failed to process message.' }, { status: 500 })
  }
}
