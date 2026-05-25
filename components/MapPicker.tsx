'use client'

import { useEffect, useRef, useState } from 'react'

interface Props {
  lat: number | null
  lng: number | null
  onChange: (lat: number, lng: number) => void
}

export default function MapPicker({ lat, lng, onChange }: Props) {
  const mapRef      = useRef<HTMLDivElement>(null)
  const mapInstance = useRef<any>(null)
  const markerRef   = useRef<any>(null)
  const [search, setSearch] = useState('')
  const [searching, setSearching] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined' || mapInstance.current) return

    // Dynamically import leaflet to avoid SSR issues
    import('leaflet').then(L => {
      // Fix default icon path issue with webpack
      delete (L.Icon.Default.prototype as any)._getIconUrl
      L.Icon.Default.mergeOptions({
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      })

      const initialLat = lat ?? 24.7136
      const initialLng = lng ?? 46.6753

      const map = L.map(mapRef.current!, { zoomControl: true }).setView([initialLat, initialLng], 12)
      mapInstance.current = map

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(map)

      // Place marker if coords exist
      if (lat && lng) {
        markerRef.current = L.marker([lat, lng]).addTo(map)
      }

      // Click to set location
      map.on('click', (e: any) => {
        const { lat: clickLat, lng: clickLng } = e.latlng
        if (markerRef.current) {
          markerRef.current.setLatLng([clickLat, clickLng])
        } else {
          markerRef.current = L.marker([clickLat, clickLng]).addTo(map)
        }
        onChange(Math.round(clickLat * 1e6) / 1e6, Math.round(clickLng * 1e6) / 1e6)
      })
    })

    // Add Leaflet CSS
    if (!document.getElementById('leaflet-css')) {
      const link = document.createElement('link')
      link.id   = 'leaflet-css'
      link.rel  = 'stylesheet'
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
      document.head.appendChild(link)
    }

    return () => {
      if (mapInstance.current) {
        mapInstance.current.remove()
        mapInstance.current = null
        markerRef.current   = null
      }
    }
  }, []) // eslint-disable-line

  // Update marker when props change externally
  useEffect(() => {
    if (!mapInstance.current || !lat || !lng) return
    import('leaflet').then(L => {
      if (markerRef.current) {
        markerRef.current.setLatLng([lat, lng])
      } else {
        markerRef.current = L.marker([lat, lng]).addTo(mapInstance.current)
      }
      mapInstance.current.setView([lat, lng], 14)
    })
  }, [lat, lng])

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    if (!search.trim()) return
    setSearching(true)
    try {
      const res  = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(search)}&format=json&limit=1&countrycodes=sa`
      )
      const data = await res.json()
      if (data[0]) {
        const searchLat = parseFloat(data[0].lat)
        const searchLng = parseFloat(data[0].lon)
        onChange(Math.round(searchLat * 1e6) / 1e6, Math.round(searchLng * 1e6) / 1e6)
        mapInstance.current?.setView([searchLat, searchLng], 15)
      }
    } catch { /* ignore */ }
    setSearching(false)
  }

  return (
    <div className="space-y-2">
      {/* Search bar */}
      <form onSubmit={handleSearch} className="flex gap-2">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search area, street, or neighbourhood…"
          className="flex-1 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-forest"
        />
        <button
          type="submit"
          disabled={searching}
          className="bg-forest text-white text-sm px-4 py-2 rounded-lg hover:bg-deep transition-colors disabled:opacity-50 shrink-0"
        >
          {searching ? '…' : 'Find'}
        </button>
      </form>

      {/* Map */}
      <div
        ref={mapRef}
        className="w-full h-56 rounded-xl border border-border overflow-hidden"
        style={{ zIndex: 0 }}
      />

      {lat && lng ? (
        <p className="text-xs text-slate">
          📍 {lat}, {lng} — <span className="text-fog">click map to adjust</span>
        </p>
      ) : (
        <p className="text-xs text-fog">Click on the map to pin the project location</p>
      )}
    </div>
  )
}
