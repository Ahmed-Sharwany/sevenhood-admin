'use client'

import { useState, useRef } from 'react'

type DocResult = {
  filename: string
  document_type: string
  language: string
  summary: string
  parties: { role: string; name: string; id_or_cr?: string }[]
  key_dates: { label: string; date: string }[]
  financials: { label: string; value: string }[]
  key_clauses: { title: string; summary: string }[]
  red_flags: string[]
}

const DOC_TYPES = [
  { value: 'lease',      label: '🏠 Lease / Rental Contract' },
  { value: 'management', label: '🏢 Management Agreement' },
  { value: 'contractor', label: '🔧 Contractor / Service Agreement' },
  { value: 'other',      label: '📄 Other Legal Document' },
]

export default function AIDocsPage() {
  const [docType, setDocType] = useState('lease')
  const [file, setFile]       = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult]   = useState<DocResult | null>(null)
  const [error, setError]     = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    const dropped = e.dataTransfer.files[0]
    if (dropped) setFile(dropped)
  }

  async function handleAnalyze(e: React.FormEvent) {
    e.preventDefault()
    if (!file) return
    setLoading(true)
    setError('')
    setResult(null)

    const formData = new FormData()
    formData.append('file', file)
    formData.append('doc_type', docType)

    try {
      const res = await fetch('/api/ai/summarize-doc', {
        method: 'POST',
        body: formData,
      })
      const data = await res.json()
      if (!res.ok || data.error) {
        setError(data.error ?? 'Failed to analyze document.')
      } else {
        setResult(data)
      }
    } catch {
      setError('Network error. Please try again.')
    }
    setLoading(false)
  }

  return (
    <div className="p-8 max-w-5xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-ink flex items-center gap-2">
          📄 AI Document Analysis
        </h1>
        <p className="text-slate text-sm mt-1">
          Upload a lease, management, or contractor agreement — AI extracts key dates, parties, financials, and red flags instantly.
        </p>
      </div>

      {/* Upload form */}
      {!result && (
        <form onSubmit={handleAnalyze} className="space-y-5">
          {/* Doc type */}
          <div className="bg-white rounded-2xl border border-border p-5 shadow-sm">
            <label className="block text-xs font-semibold text-slate mb-3 uppercase tracking-wide">
              Document Type
            </label>
            <div className="grid grid-cols-2 gap-3">
              {DOC_TYPES.map(dt => (
                <button
                  key={dt.value}
                  type="button"
                  onClick={() => setDocType(dt.value)}
                  className={`px-4 py-3 rounded-xl border text-sm font-medium text-left transition-all ${
                    docType === dt.value
                      ? 'border-forest bg-forest/5 text-forest'
                      : 'border-border text-slate hover:border-forest/50'
                  }`}
                >
                  {dt.label}
                </button>
              ))}
            </div>
          </div>

          {/* File drop */}
          <div
            onDrop={handleDrop}
            onDragOver={e => e.preventDefault()}
            onClick={() => fileRef.current?.click()}
            className={`bg-white rounded-2xl border-2 border-dashed p-10 shadow-sm cursor-pointer transition-all text-center ${
              file ? 'border-forest bg-forest/5' : 'border-border hover:border-forest/50'
            }`}
          >
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.txt"
              className="hidden"
              onChange={e => setFile(e.target.files?.[0] ?? null)}
            />
            {file ? (
              <div className="space-y-1">
                <div className="text-3xl">📄</div>
                <p className="font-semibold text-ink text-sm">{file.name}</p>
                <p className="text-xs text-slate">{(file.size / 1024).toFixed(1)} KB</p>
                <button
                  type="button"
                  onClick={e => { e.stopPropagation(); setFile(null) }}
                  className="text-xs text-red-500 hover:text-red-700 mt-1"
                >
                  Remove
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="text-4xl">⬆️</div>
                <p className="font-semibold text-ink text-sm">Drop your PDF here or click to browse</p>
                <p className="text-xs text-fog">PDF and TXT files supported · Max 10 MB</p>
              </div>
            )}
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
              ⚠️ {error}
            </div>
          )}

          <button
            type="submit"
            disabled={!file || loading}
            className="w-full bg-forest text-white rounded-xl py-3 text-sm font-semibold hover:bg-deep transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? (
              <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Analyzing document...</>
            ) : '✨ Analyze Document'}
          </button>
        </form>
      )}

      {/* Results */}
      {result && (
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-ink">{result.document_type}</h2>
              <p className="text-xs text-slate mt-0.5">{result.filename} · {result.language}</p>
            </div>
            <button
              onClick={() => { setResult(null); setFile(null) }}
              className="bg-forest text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-deep transition-colors"
            >
              + Analyze Another
            </button>
          </div>

          {/* Summary */}
          <div className="bg-white rounded-2xl border border-border p-5 shadow-sm">
            <h3 className="text-xs font-semibold text-slate uppercase tracking-wide mb-2">Summary</h3>
            <p className="text-sm text-ink leading-relaxed">{result.summary}</p>
          </div>

          {/* Grid: Parties + Key Dates */}
          <div className="grid grid-cols-2 gap-5">
            <div className="bg-white rounded-2xl border border-border p-5 shadow-sm">
              <h3 className="text-xs font-semibold text-slate uppercase tracking-wide mb-3">Parties</h3>
              <div className="space-y-3">
                {result.parties?.map((p, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-forest/10 flex items-center justify-center text-forest text-xs font-bold shrink-0">
                      {p.role?.[0] ?? '?'}
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-ink">{p.name || '—'}</div>
                      <div className="text-xs text-slate">{p.role}</div>
                      {p.id_or_cr && <div className="text-xs text-fog mt-0.5">{p.id_or_cr}</div>}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-border p-5 shadow-sm">
              <h3 className="text-xs font-semibold text-slate uppercase tracking-wide mb-3">Key Dates</h3>
              <div className="space-y-2">
                {result.key_dates?.map((d, i) => (
                  <div key={i} className="flex items-center justify-between py-1.5 border-b border-border/50 last:border-0">
                    <span className="text-xs text-slate">{d.label}</span>
                    <span className="text-sm font-semibold text-ink">{d.date}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Financials */}
          {result.financials?.length > 0 && (
            <div className="bg-white rounded-2xl border border-border p-5 shadow-sm">
              <h3 className="text-xs font-semibold text-slate uppercase tracking-wide mb-3">Financials</h3>
              <div className="grid grid-cols-3 gap-4">
                {result.financials.map((f, i) => (
                  <div key={i} className="bg-cream rounded-xl p-3">
                    <div className="text-xs text-slate">{f.label}</div>
                    <div className="text-base font-bold text-ink mt-1">{f.value}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Key Clauses */}
          {result.key_clauses?.length > 0 && (
            <div className="bg-white rounded-2xl border border-border p-5 shadow-sm">
              <h3 className="text-xs font-semibold text-slate uppercase tracking-wide mb-3">Key Clauses</h3>
              <div className="space-y-3">
                {result.key_clauses.map((c, i) => (
                  <div key={i} className="flex gap-3">
                    <div className="w-6 h-6 rounded-full bg-forest/10 flex items-center justify-center text-forest text-xs font-bold shrink-0 mt-0.5">
                      {i + 1}
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-ink">{c.title}</div>
                      <div className="text-xs text-slate mt-0.5">{c.summary}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Red Flags */}
          {result.red_flags?.length > 0 && (
            <div className="bg-red-50 rounded-2xl border border-red-200 p-5">
              <h3 className="text-xs font-semibold text-red-700 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                🚩 Red Flags ({result.red_flags.length})
              </h3>
              <div className="space-y-2">
                {result.red_flags.map((flag, i) => (
                  <div key={i} className="flex gap-2 text-sm text-red-700">
                    <span className="shrink-0 mt-0.5">⚠️</span>
                    <span>{flag}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
