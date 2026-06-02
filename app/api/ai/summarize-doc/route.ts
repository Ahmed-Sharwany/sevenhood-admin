import { NextRequest, NextResponse } from 'next/server'
import { anthropic } from '@/lib/anthropic'

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const docType = (formData.get('doc_type') as string) ?? 'lease'

    if (!file) return NextResponse.json({ error: 'File required' }, { status: 400 })

    const maxSize = 10 * 1024 * 1024 // 10 MB
    if (file.size > maxSize) {
      return NextResponse.json({ error: 'File too large. Maximum 10 MB.' }, { status: 413 })
    }

    const allowedTypes = ['application/pdf', 'text/plain']
    if (!allowedTypes.includes(file.type) && !file.name.endsWith('.pdf') && !file.name.endsWith('.txt')) {
      return NextResponse.json({ error: 'Only PDF and TXT files are supported.' }, { status: 415 })
    }

    const buffer = await file.arrayBuffer()
    const base64 = Buffer.from(buffer).toString('base64')

    const typePrompts: Record<string, string> = {
      lease: 'lease agreement or rental contract',
      management: 'property management agreement',
      contractor: 'contractor or service agreement',
      other: 'legal or business document',
    }

    const message = await anthropic.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 2048,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'document',
              source: {
                type: 'base64',
                media_type: 'application/pdf',
                data: base64,
              },
            } as any,
            {
              type: 'text',
              text: `Analyze this ${typePrompts[docType] ?? typePrompts.other} and extract key information.

Return ONLY a JSON object:
{
  "document_type": "Lease Agreement / Management Contract / etc.",
  "parties": [
    { "role": "Landlord/Tenant/etc.", "name": "Party Name", "id_or_cr": "ID or CR number if present" }
  ],
  "key_dates": [
    { "label": "Contract Start Date", "date": "YYYY-MM-DD or as written" }
  ],
  "financials": [
    { "label": "Monthly Rent", "value": "SAR 5,000" }
  ],
  "key_clauses": [
    { "title": "Clause title", "summary": "Brief plain-English summary" }
  ],
  "red_flags": [
    "Any unusual, risky, or potentially problematic clause"
  ],
  "language": "Arabic|English|Bilingual",
  "summary": "2-3 sentence executive summary of the document"
}

If this is not a readable document or is an image-only scan, return: {"error": "Document could not be read. Please ensure it is a text-based PDF."}`,
            },
          ],
        },
      ],
    })

    const raw = (message.content[0] as { type: string; text: string }).text.trim()
    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('No JSON in response')
    const result = JSON.parse(jsonMatch[0])

    if (result.error) return NextResponse.json({ error: result.error }, { status: 422 })

    return NextResponse.json({ success: true, filename: file.name, ...result })
  } catch (err) {
    console.error('[ai/summarize-doc]', err)
    return NextResponse.json({ error: 'Failed to analyze document.' }, { status: 500 })
  }
}
