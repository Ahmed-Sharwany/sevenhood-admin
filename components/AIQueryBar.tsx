'use client'

import { useState, useRef } from 'react'

type QueryResult = {
  description: string
  is_aggregate: boolean
  count?: number
  rows?: Record<string, unknown>[]
  total?: number
  table?: string
}

const EXAMPLE_QUERIES = [
  'How many open tickets are there?',
  'Show vacant units',
  'Recent maintenance tickets',
  'كم عدد السكان؟',
  'Active service providers',
]

export default function AIQueryBar() {
  const [query, setQuery]     = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult]   = useState<QueryResult | null>(null)
  const [error, setError]     = useState('')
  const [open, setOpen]       = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleQuery(q?: string) {
    const text = (q ?? query).trim()
    if (!text) return
    setQuery(text)
    setLoading(true)
    setError('')
    setResult(null)
    setOpen(true)

    try {
      const res = await fetch('/api/ai/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: text }),
      })
      const data = await res.json()
      if (!res.ok || data.error) {
        setError(data.error ?? 'Failed to process query.')
      } else {
        setResult(data)
      }
    } catch {
      setError('Network error. Please try again.')
    }
    setLoading(false)
  }

  function formatValue(val: unknown): string {
    if (val === null || val === undefined) return '—'
    if (typeof val === 'boolean') return val ? 'Yes' : 'No'
    if (typeof val === 'object') return JSON.stringify(val)
    return String(val)
  }

  const tableHeaders = result?.rows && result.rows.length > 0
    ? Object.keys(result.rows[0]).filter(k => !k.endsWith('_id') && k !== 'id').slice(0, 6)
    : []

  return (
    <div className="mb-8">
      {/* Search bar */}
      <div className="bg-white border border-border rounded-2xl shadow-sm overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-3">
          <div className="text-lg">✨</div>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleQuery()}
            placeholder="Ask anything about your platform... e.g. &quot;How many open tickets?&quot; or &quot;كم عدد الوحدات الشاغرة؟&quot;"
            className="flex-1 text-sm text-ink placeholder:text-fog bg-transparent focus:outline-none"
          />
          {loading ? (
            <div className="w-5 h-5 border-2 border-forest/30 border-t-forest rounded-full animate-spin shrink-0" />
          ) : (
            <button
              onClick={() => handleQuery()}
              disabled={!query.trim()}
              className="bg-forest text-white px-4 py-1.5 rounded-lg text-xs font-semibold hover:bg-deep transition-colors disabled:opacity-40"
            >
              Ask →
            </button>
          )}
        </div>

        {/* Example chips */}
        {!open && (
          <div className="flex flex-wrap gap-2 px-4 pb-3">
            {EXAMPLE_QUERIES.map(q => (
              <button
                key={q}
                onClick={() => handleQuery(q)}
                className="text-xs bg-cream border border-border rounded-full px-3 py-1 text-slate hover:border-forest hover:text-forest transition-colors"
              >
                {q}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Results panel */}
      {open && (result || error || loading) && (
        <div className="mt-2 bg-white border border-border rounded-2xl shadow-sm p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold text-slate uppercase tracking-wide">
              {loading ? 'Thinking...' : result?.description ?? 'Result'}
            </p>
            <button
              onClick={() => { setOpen(false); setResult(null); setError(''); setQuery('') }}
              className="text-fog hover:text-slate text-xs"
            >
              ✕ Close
            </button>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {result?.is_aggregate && (
            <div className="flex items-center gap-3">
              <span className="text-5xl font-bold text-ink">
                {result.count ?? result.total ?? 0}
              </span>
              <span className="text-slate text-sm">{result.description}</span>
            </div>
          )}

          {!result?.is_aggregate && result?.rows && result.rows.length === 0 && (
            <p className="text-slate text-sm">No results found.</p>
          )}

          {!result?.is_aggregate && result?.rows && result.rows.length > 0 && (
            <>
              <p className="text-xs text-fog mb-3">{result.total} result{result.total !== 1 ? 's' : ''}</p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-slate uppercase tracking-wide border-b border-border">
                      {tableHeaders.map(h => (
                        <th key={h} className="text-left py-2 pr-4 font-semibold">
                          {h.replace(/_/g, ' ')}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {result.rows.slice(0, 10).map((row, i) => (
                      <tr key={i} className="border-b border-border/50 hover:bg-cream/30 transition-colors">
                        {tableHeaders.map(h => (
                          <td key={h} className="py-2 pr-4 text-ink">
                            {formatValue(row[h])}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {result.rows.length > 10 && (
                  <p className="text-xs text-fog mt-2">Showing first 10 of {result.total} results</p>
                )}
              </div>
            </>
          )}

          {/* Ask another */}
          {!loading && (
            <div className="mt-4 pt-3 border-t border-border">
              <div className="flex gap-2 flex-wrap">
                {EXAMPLE_QUERIES.slice(0, 3).map(q => (
                  <button
                    key={q}
                    onClick={() => handleQuery(q)}
                    className="text-xs bg-cream border border-border rounded-full px-3 py-1 text-slate hover:border-forest hover:text-forest transition-colors"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
