'use client'

import { useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'

interface Props {
  value: string        // current URL
  onChange: (url: string) => void
  folder?: string      // e.g. 'projects' | 'buildings'
}

export default function ImageUpload({ value, onChange, folder = 'general' }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setError('')
    setUploading(true)

    const ext  = file.name.split('.').pop()
    const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

    const { error: uploadError } = await supabase.storage
      .from('images')
      .upload(path, file, { upsert: true })

    if (uploadError) {
      setError('Upload failed. Make sure the "images" bucket exists and is public.')
      setUploading(false)
      return
    }

    const { data } = supabase.storage.from('images').getPublicUrl(path)
    onChange(data.publicUrl)
    setUploading(false)
  }

  function handleRemove() {
    onChange('')
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <div>
      {value ? (
        <div className="relative group w-full h-40 rounded-xl overflow-hidden border border-border">
          <img src={value} alt="Preview" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="bg-white text-ink text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-cream transition-colors"
            >
              Change
            </button>
            <button
              type="button"
              onClick={handleRemove}
              className="bg-red-500 text-white text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-red-600 transition-colors"
            >
              Remove
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="w-full h-32 border-2 border-dashed border-border rounded-xl flex flex-col items-center justify-center gap-2 text-slate hover:border-forest hover:text-forest transition-colors disabled:opacity-50"
        >
          {uploading ? (
            <>
              <div className="w-6 h-6 border-2 border-forest border-t-transparent rounded-full animate-spin" />
              <span className="text-xs">Uploading…</span>
            </>
          ) : (
            <>
              <span className="text-2xl">📷</span>
              <span className="text-xs font-medium">Click to upload image</span>
              <span className="text-xs text-fog">JPG, PNG, WebP up to 5 MB</span>
            </>
          )}
        </button>
      )}

      {error && <p className="text-red-500 text-xs mt-1">{error}</p>}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFile}
      />
    </div>
  )
}
