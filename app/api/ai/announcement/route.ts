import { NextRequest, NextResponse } from 'next/server'
import { anthropic } from '@/lib/anthropic'

export async function POST(req: NextRequest) {
  try {
    const { type, details, tone, project_name } = await req.json()

    const toneMap: Record<string, string> = {
      formal:    'formal and professional',
      friendly:  'warm and friendly',
      urgent:    'urgent and important',
      reminder:  'gentle reminder',
    }

    const typeMap: Record<string, string> = {
      maintenance: 'Maintenance Notice',
      amenity:     'Amenity Update',
      security:    'Security Notice',
      event:       'Event / Activity',
      welcome:     'Welcome Message',
      rule:        'Community Rule Reminder',
      general:     'General Announcement',
    }

    const message = await anthropic.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: `You are writing a community announcement for a premium residential complex${project_name ? ` called "${project_name}"` : ''} in Saudi Arabia.

Generate a professional bilingual announcement (English + Arabic) of type: ${typeMap[type] ?? type}
Tone: ${toneMap[tone] ?? tone}
Details from the operator: ${details}

Return ONLY a JSON object in this exact format, no extra text:
{
  "title_en": "Short English title (max 10 words)",
  "title_ar": "عنوان عربي قصير",
  "body_en": "Full announcement body in English (2-4 sentences)",
  "body_ar": "نص الإعلان بالكامل بالعربية"
}`,
        },
      ],
    })

    const raw = (message.content[0] as { type: string; text: string }).text.trim()
    // Extract JSON even if Claude adds markdown code fences
    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('No JSON in response')
    const parsed = JSON.parse(jsonMatch[0])

    return NextResponse.json({ success: true, ...parsed })
  } catch (err) {
    console.error('[ai/announcement]', err)
    return NextResponse.json({ error: 'Failed to generate announcement.' }, { status: 500 })
  }
}
