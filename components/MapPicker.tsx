'use client'

import { useEffect, useRef, useState, useCallback } from 'react'

interface Props {
  lat: number | null
  lng: number | null
  onChange: (lat: number, lng: number, address?: string) => void
}

interface Suggestion {
  place_id: number
  display_name: string
  lat: string
  lon: string
}

export default function MapPicker({ lat, lng, onChange }: Props) {
  const mapRef      = useRef<HTMLDivElement>(null)
  const mapInstance = useRef<any>(null)
  const markerRef   = useRef<any>(null)

  const [query,       setQuery]       = useState('')
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [searching,   setSearching]   = useState(false)
  const [showDrop,    setShowDrop]    = useState(false)
  const debounceRef   = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Init map ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (typeof window === 'undefined' || mapInstance.current) return

    // Inject Leaflet CSS
    if (!document.getElementById('leaflet-css')) {
      const link  = document.createElement('link')
      link.id     = 'leaflet-css'
      link.rel    = 'stylesheet'
      link.href   = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
      document.head.appendChild(link)
    }

    import('leaflet').then(L => {
      delete (L.Icon.Default.prototype as any)._getIconUrl
      L.Icon.Default.mergeOptions({
        iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      })

      const initLat = lat ?? 24.7136
      const initLng = lng ?? 46.6753
      const map = L.map(mapRef.current!, { zoomControl: true }).setView([initLat, initLng], lat ? 14 : 11)
      mapInstance.current = map

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap',
        maxZoom: 19,
      }).addTo(map)

      if (lat && lng) {
        markerRef.current = L.marker([lat, lng], { draggable: true }).addTo(map)
        markerRef.current.on('dragend', (e: any) => {
          const pos = e.target.getLatLng()
          onChange(
            Math.round(pos.lat * 1e6) / 1e6,
            Math.round(pos.lng * 1e6) / 1e6,
          )
        })
      }

      map.on('click', (e: any) => {
        placeMarker(L, map, e.latlng.lat, e.latlng.lng)
      })
    })

    return () => {
      mapInstance.current?.remove()
      mapInstance.current = null
      markerRef.current   = null
    }
  }, []) // eslint-disable-line

  function placeMarker(L: any, map: any, newLat: number, newLng: number) {
    const roundLat = Math.round(newLat * 1e6) / 1e6
    const roundLng = Math.round(newLng * 1e6) / 1e6
    if (markerRef.current) {
      markerRef.current.setLatLng([roundLat, roundLng])
    } else {
      markerRef.current = L.marker([roundLat, roundLng], { draggable: true }).addTo(map)
      markerRef.current.on('dragend', (e: any) => {
        const pos = e.target.getLatLng()
        onChange(Math.round(pos.lat * 1e6) / 1e6, Math.round(pos.lng * 1e6) / 1e6)
      })
    }
    map.setView([roundLat, roundLng], 15)
    onChange(roundLat, roundLng)
  }

  // ── Live search with debounce ─────────────────────────────────────────────
  const fetchSuggestions = useCallback(async (q: string) => {
    if (q.length < 3) { setSuggestions([]); setShowDrop(false); return }
    setSearching(true)
    try {
      const res  = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=6&countrycodes=sa&addressdetails=1`,
        { headers: { 'Accept-Language': 'en' } }
      )
      const data: Suggestion[] = await res.json()
      setSuggestions(data)
      setShowDrop(data.length > 0)
    } catch { /* ignore */ }
    setSearching(false)
  }, [])

  function handleInput(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value
    setQuery(val)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => fetchSuggestions(val), 350)
  }

  function selectSuggestion(s: Suggestion) {
    setQuery(s.display_name.split(',').slice(0, 2).join(','))
    setSuggestions([])
    setShowDrop(false)

    import('leaflet').then(L => {
      if (!mapInstance.current) return
      placeMarker(L, mapInstance.current, parseFloat(s.lat), parseFloat(s.lon))
      onChange(
        Math.round(parseFloat(s.lat) * 1e6) / 1e6,
        Math.round(parseFloat(s.lon) * 1e6) / 1e6,
        s.display_name,
      )
    })
  }

  return (
    <div className="space-y-2">
      {/* Search with autocomplete */}
      <div className="relative">
        <div className="flex items-center gap-2 border border-border rounded-xl px-3 py-2 bg-white focus-within:border-forest transition-colors">
          <span className="text-slate text-sm">🔍</span>
          <input
            type="text"
            value={query}
            onChange={handleInput}
            onFocus={() => suggestions.length > 0 && setShowDrop(true)}
            onBlur={() => setTimeout(() => setShowDrop(false), 150)}
            placeholder="Search neighbourhood, street, or landmark…"
            className="flex-1 text-sm focus:outline-none bg-transparent"
          />
          {searching && (
            <div className="w-4 h-4 border-2 border-forest border-t-transparent rounded-full animate-spin shrink-0" />
          )}
        </div>

        {/* Dropdown suggestions */}
        {showDrop && suggestions.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-border rounded-xl shadow-xl z-[9999] overflow-hidden">
            {suggestions.map(s => (
              <button
                key={s.place_id}
                type="button"
                onMouseDown={() => selectSuggestion(s)}
                className="w-full text-left px-4 py-3 text-sm hover:bg-cream transition-colors flex items-start gap-2.5 border-b border-border last:border-0"
              >
                <span className="text-forest mt-0.5 shrink-0">📍</span>
                <span className="text-ink line-clamp-2 leading-snug">
                  {s.display_name}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Map */}
      <div className="relative rounded-xl overflow-hidden border border-border" style={{ height: 240 }}>
        <div ref={mapRef} style={{ width: '100%', height: '100%', zIndex: 0 }} />
        {/* Overlay hint */}
        {!lat && !lng && (
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-black/60 text-white text-xs px-3 py-1.5 rounded-full pointer-events-none z-10 whitespace-nowrap">
            Search above or click on map to pin location
          </div>
        )}
      </div>

      {/* Coordinates */}
      {lat && lng ? (
        <div className="flex items-center gap-2 text-xs text-slate bg-cream rounded-lg px-3 py-2">
          <span className="text-forest">✓</span>
          <span>Location pinned · {lat}, {lng}</span>
          <span className="text-fog ml-auto">Drag pin to adjust</span>
        </div>
      ) : (
        <p className="text-xs text-fog">No location set yet</p>
      )}
    </div>
  )
}
