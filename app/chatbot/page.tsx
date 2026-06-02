'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

type Message = { role: 'user' | 'assistant'; content: string }

type Conversation = {
  id: string
  resident_id: string | null
  messages: Message[]
  last_message_at: string
  resident?: { full_name: string; units?: { unit_number: string } }
}

// ── Standalone chatbot widget (test / admin-side chat) ────────────────────────

export default function ChatbotPage() {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [selected, setSelected]           = useState<Conversation | null>(null)
  const [loading, setLoading]             = useState(true)

  // Test chat state
  const [testMsg, setTestMsg]   = useState('')
  const [testHistory, setTestHistory] = useState<Message[]>([])
  const [testLoading, setTestLoading] = useState(false)
  const [testError, setTestError]     = useState('')

  async function loadConversations() {
    setLoading(true)
    const { data } = await supabase
      .from('chatbot_conversations')
      .select('*, residents(full_name, units(unit_number))')
      .order('last_message_at', { ascending: false })
      .limit(50)
    setConversations((data ?? []) as Conversation[])
    setLoading(false)
  }

  useEffect(() => { loadConversations() }, [])

  async function handleTestSend(e: React.FormEvent) {
    e.preventDefault()
    if (!testMsg.trim()) return
    const userMsg = testMsg.trim()
    setTestMsg('')
    setTestLoading(true)
    setTestError('')

    const updatedHistory: Message[] = [...testHistory, { role: 'user', content: userMsg }]
    setTestHistory(updatedHistory)

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMsg,
          conversation_history: testHistory,
        }),
      })
      const data = await res.json()
      if (!res.ok || data.error) {
        setTestError(data.error ?? 'Failed to get response.')
        setTestHistory(prev => prev.slice(0, -1))
      } else {
        setTestHistory([...updatedHistory, { role: 'assistant', content: data.reply }])
        if (data.ticket_created) {
          setTestError(`✅ Maintenance ticket created automatically (ID: ${data.ticket_created})`)
        }
      }
    } catch {
      setTestError('Network error.')
      setTestHistory(prev => prev.slice(0, -1))
    }
    setTestLoading(false)
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-ink flex items-center gap-2">
          🤖 AI Concierge Chatbot
        </h1>
        <p className="text-slate text-sm mt-1">
          Resident-facing AI assistant. Test the bot below, and view past conversations.
        </p>
      </div>

      <div className="grid grid-cols-5 gap-6">

        {/* ── Conversations list ─────────────────────────────────────────── */}
        <div className="col-span-2">
          <div className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden">
            <div className="px-5 py-3.5 border-b border-border flex items-center justify-between">
              <h2 className="font-semibold text-ink text-sm">Conversations</h2>
              <button
                onClick={loadConversations}
                className="text-xs text-slate hover:text-forest transition-colors"
              >
                Refresh
              </button>
            </div>
            {loading && (
              <div className="p-6 text-slate text-sm text-center">Loading...</div>
            )}
            {!loading && conversations.length === 0 && (
              <div className="p-6 text-slate text-sm text-center">
                <div className="text-3xl mb-2">💬</div>
                <p>No conversations yet.</p>
                <p className="text-xs text-fog mt-1">
                  Conversations appear here once residents start chatting.
                </p>
              </div>
            )}
            <div className="divide-y divide-border">
              {conversations.map(c => {
                const lastMsg = c.messages?.[c.messages.length - 1]
                const residentName = c.resident?.full_name ?? 'Unknown Resident'
                const unitNum = (c.resident as any)?.units?.unit_number ?? ''
                return (
                  <button
                    key={c.id}
                    onClick={() => setSelected(c)}
                    className={`w-full text-left px-5 py-3.5 hover:bg-cream/50 transition-colors ${selected?.id === c.id ? 'bg-forest/5' : ''}`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-full bg-gold/20 flex items-center justify-center text-gold font-bold text-xs shrink-0">
                        {residentName[0]?.toUpperCase() ?? '?'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-semibold text-ink truncate">{residentName}</span>
                          {unitNum && <span className="text-xs text-fog shrink-0 ml-2">Unit {unitNum}</span>}
                        </div>
                        {lastMsg && (
                          <p className="text-xs text-slate truncate mt-0.5">{lastMsg.content}</p>
                        )}
                        <p className="text-xs text-fog mt-0.5">
                          {new Date(c.last_message_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {/* ── Right panel: test chat OR conversation detail ──────────────── */}
        <div className="col-span-3 space-y-5">

          {/* Test Chat Widget */}
          <div className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden">
            <div className="px-5 py-3.5 border-b border-border bg-gradient-to-r from-forest to-garden">
              <h2 className="font-semibold text-white text-sm flex items-center gap-2">
                🤖 Test the Concierge Bot
              </h2>
              <p className="text-white/60 text-xs mt-0.5">Try it as a resident — Arabic or English</p>
            </div>

            {/* Chat messages */}
            <div className="h-80 overflow-y-auto p-4 space-y-3 bg-cream/30">
              {testHistory.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <div className="text-4xl mb-3">💬</div>
                  <p className="text-slate text-sm">Say hello to the AI concierge!</p>
                  <div className="flex flex-wrap gap-2 justify-center mt-4">
                    {['I have a water leak in my bathroom', 'What are the gym hours?', 'مرحبا، أريد الإبلاغ عن عطل'].map(q => (
                      <button
                        key={q}
                        onClick={() => { setTestMsg(q); }}
                        className="text-xs bg-white border border-border rounded-full px-3 py-1 text-slate hover:border-forest hover:text-forest transition-colors"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {testHistory.map((m, i) => (
                <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${
                    m.role === 'user'
                      ? 'bg-forest text-white rounded-br-sm'
                      : 'bg-white border border-border text-ink rounded-bl-sm'
                  }`}>
                    {m.content}
                  </div>
                </div>
              ))}
              {testLoading && (
                <div className="flex justify-start">
                  <div className="bg-white border border-border rounded-2xl rounded-bl-sm px-4 py-2.5">
                    <div className="flex gap-1">
                      <span className="w-2 h-2 rounded-full bg-slate animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-2 h-2 rounded-full bg-slate animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-2 h-2 rounded-full bg-slate animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {testError && !testError.startsWith('✅') && (
              <div className="mx-4 mb-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2 text-xs text-red-700">
                {testError}
              </div>
            )}
            {testError && testError.startsWith('✅') && (
              <div className="mx-4 mb-2 bg-green-50 border border-green-200 rounded-xl px-3 py-2 text-xs text-green-700">
                {testError}
              </div>
            )}

            <form onSubmit={handleTestSend} className="flex gap-2 p-4 border-t border-border">
              <input
                type="text"
                value={testMsg}
                onChange={e => setTestMsg(e.target.value)}
                placeholder="Type a message (English or Arabic)..."
                className="flex-1 border border-border rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-forest"
              />
              <button
                type="submit"
                disabled={testLoading || !testMsg.trim()}
                className="bg-forest text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-deep disabled:opacity-50 transition-colors"
              >
                Send
              </button>
              {testHistory.length > 0 && (
                <button
                  type="button"
                  onClick={() => { setTestHistory([]); setTestError('') }}
                  className="border border-border text-slate px-3 py-2 rounded-xl text-sm hover:bg-cream transition-colors"
                >
                  Clear
                </button>
              )}
            </form>
          </div>

          {/* Selected conversation detail */}
          {selected && (
            <div className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden">
              <div className="px-5 py-3.5 border-b border-border flex items-center justify-between">
                <div>
                  <h2 className="font-semibold text-ink text-sm">
                    {selected.resident?.full_name ?? 'Unknown Resident'}
                  </h2>
                  <p className="text-xs text-fog">
                    {(selected.resident as any)?.units?.unit_number
                      ? `Unit ${(selected.resident as any).units.unit_number}`
                      : 'No unit'
                    } · {new Date(selected.last_message_at).toLocaleDateString()}
                  </p>
                </div>
                <button onClick={() => setSelected(null)} className="text-fog hover:text-slate text-sm">✕</button>
              </div>
              <div className="h-64 overflow-y-auto p-4 space-y-2">
                {selected.messages?.map((m, i) => (
                  <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${
                      m.role === 'user'
                        ? 'bg-forest text-white rounded-br-sm'
                        : 'bg-cream text-ink rounded-bl-sm'
                    }`}>
                      {m.content}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* WhatsApp Integration Setup Card */}
          <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl border border-green-200 p-5">
            <h3 className="font-semibold text-green-800 flex items-center gap-2 mb-2">
              <span className="text-lg">📱</span> Connect WhatsApp
            </h3>
            <p className="text-sm text-green-700 mb-3">
              Deploy the chatbot on WhatsApp so residents can message the Sevenhood concierge directly from their phones.
            </p>
            <div className="space-y-2 text-xs text-green-700">
              <div className="flex gap-2">
                <span className="w-5 h-5 rounded-full bg-green-200 flex items-center justify-center font-bold shrink-0">1</span>
                <span>Create a <strong>WhatsApp Business Account</strong> via Meta Business Manager</span>
              </div>
              <div className="flex gap-2">
                <span className="w-5 h-5 rounded-full bg-green-200 flex items-center justify-center font-bold shrink-0">2</span>
                <span>Get a phone number &amp; <strong>Twilio or Meta Cloud API</strong> credentials</span>
              </div>
              <div className="flex gap-2">
                <span className="w-5 h-5 rounded-full bg-green-200 flex items-center justify-center font-bold shrink-0">3</span>
                <span>Point the webhook to <code className="bg-green-100 px-1 rounded">POST /api/ai/chat</code> on this server</span>
              </div>
            </div>
            <p className="text-xs text-green-600 mt-3">
              The chatbot backend is already built — just needs the WhatsApp webhook wired in.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
