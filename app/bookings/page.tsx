'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { AmenityBooking, BookingStatus } from '@/lib/types'

type BookingRow = AmenityBooking

const STATUS_STYLES: Record<string, string> = {
  pending:   'bg-amber-100 text-amber-700',
  approved:  'bg-green-100 text-green-700',
  rejected:  'bg-red-100 text-red-700',
  completed: 'bg-blue-100 text-blue-700',
  cancelled: 'bg-gray-100 text-gray-500',
}

const CATEGORY_ICON: Record<string, string> = {
  fitness:       '💪',
  social:        '👥',
  workspace:     '💼',
  entertainment: '🎬',
  outdoor:       '🌿',
  sports:        '⚽',
  other:         '✨',
}

type AmenityOption = {
  id: string
  name: string
  amenity_booking_rules?: { allowed_durations: number[] } | null
}

type ResidentOption = { id: string; full_name: string }
type UnitOption    = { id: string; unit_number: string }

function addMinutes(time: string, mins: number): string {
  const [h, m] = time.split(':').map(Number)
  const total = h * 60 + m + mins
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

function fmtDuration(mins: number): string {
  const h = Math.floor(mins / 60)
  const m = mins % 60
  if (h === 0) return `${m}m`
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}

function getMondayOfWeek(d: Date): string {
  const day = d.getDay() // 0=Sun
  const diff = day === 0 ? -6 : 1 - day
  const mon = new Date(d)
  mon.setDate(d.getDate() + diff)
  return mon.toISOString().split('T')[0]
}

function getSundayOfWeek(d: Date): string {
  const mon = getMondayOfWeek(d)
  const sun = new Date(mon)
  sun.setDate(sun.getDate() + 6)
  return sun.toISOString().split('T')[0]
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const DEFAULT_DURATIONS = [30, 60, 90, 120]

export default function BookingsPage() {
  const today   = new Date().toISOString().split('T')[0]
  const weekMon = getMondayOfWeek(new Date())
  const weekSun = getSundayOfWeek(new Date())

  // ── data ──────────────────────────────────────────────────────────────────
  const [bookings, setBookings] = useState<BookingRow[]>([])
  const [loading,  setLoading]  = useState(true)

  // filter bar
  const [dateFrom,        setDateFrom]        = useState('')
  const [dateTo,          setDateTo]          = useState('')
  const [statusFilter,    setStatusFilter]    = useState<BookingStatus | 'all'>('all')
  const [amenityFilter,   setAmenityFilter]   = useState('')
  const [residentSearch,  setResidentSearch]  = useState('')

  // reject modal
  const [rejectingId,  setRejectingId]  = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('')

  // add booking modal
  const [showAdd,        setShowAdd]        = useState(false)
  const [amenityOptions, setAmenityOptions] = useState<AmenityOption[]>([])
  const [residentOptions,setResidentOptions]= useState<ResidentOption[]>([])
  const [unitOptions,    setUnitOptions]    = useState<UnitOption[]>([])

  const [newAmenityId,   setNewAmenityId]   = useState('')
  const [newResidentId,  setNewResidentId]  = useState('')
  const [newUnitId,      setNewUnitId]      = useState('')
  const [newDate,        setNewDate]        = useState('')
  const [newStartTime,   setNewStartTime]   = useState('')
  const [newDuration,    setNewDuration]    = useState(60)
  const [newAttendees,   setNewAttendees]   = useState(1)
  const [newNotes,       setNewNotes]       = useState('')
  const [newStatus,      setNewStatus]      = useState<'pending' | 'approved'>('pending')
  const [addLoading,     setAddLoading]     = useState(false)

  // ── load bookings ─────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('amenity_bookings')
      .select('*, amenities(id,name,category), residents(id,full_name,phone), units(id,unit_number)')
      .order('booking_date', { ascending: false })
      .order('start_time', { ascending: false })
    setBookings((data as BookingRow[]) ?? [])
    setLoading(false)
  }, [])

  // ── load dropdowns ────────────────────────────────────────────────────────
  const loadDropdowns = useCallback(async () => {
    const [{ data: ams }, { data: res }, { data: units }] = await Promise.all([
      supabase.from('amenities').select('id, name, amenity_booking_rules(allowed_durations)').eq('is_active', true),
      supabase.from('residents').select('id, full_name'),
      supabase.from('units').select('id, unit_number'),
    ])
    // Supabase returns amenity_booking_rules as an array (one-to-one join); normalise to object
    const normAms: AmenityOption[] = (ams ?? []).map((a: any) => ({
      id:   a.id,
      name: a.name,
      amenity_booking_rules: Array.isArray(a.amenity_booking_rules)
        ? a.amenity_booking_rules[0] ?? null
        : a.amenity_booking_rules ?? null,
    }))
    setAmenityOptions(normAms)
    setResidentOptions(res ?? [])
    setUnitOptions(units ?? [])
  }, [])

  useEffect(() => {
    load()
    loadDropdowns()
  }, [load, loadDropdowns])

  // ── actions ───────────────────────────────────────────────────────────────
  async function approve(id: string) {
    await supabase.from('amenity_bookings').update({ status: 'approved' }).eq('id', id)
    load()
  }

  async function reject(id: string, reason: string) {
    await supabase
      .from('amenity_bookings')
      .update({ status: 'rejected', rejection_reason: reason })
      .eq('id', id)
    setRejectingId(null)
    setRejectReason('')
    load()
  }

  async function updateStatus(id: string, status: string) {
    await supabase.from('amenity_bookings').update({ status }).eq('id', id)
    load()
  }

  async function deleteBooking(id: string) {
    await supabase.from('amenity_bookings').delete().eq('id', id)
    load()
  }

  async function handleAddBooking() {
    if (!newAmenityId || !newResidentId || !newDate || !newStartTime) return
    setAddLoading(true)
    const endTime = addMinutes(newStartTime, newDuration)
    await supabase.from('amenity_bookings').insert({
      amenity_id:      newAmenityId,
      resident_id:     newResidentId,
      unit_id:         newUnitId || null,
      booking_date:    newDate,
      start_time:      newStartTime,
      end_time:        endTime,
      duration_mins:   newDuration,
      attendees_count: newAttendees,
      notes:           newNotes || null,
      status:          newStatus,
    })
    setAddLoading(false)
    setShowAdd(false)
    resetAddForm()
    load()
  }

  function resetAddForm() {
    setNewAmenityId('')
    setNewResidentId('')
    setNewUnitId('')
    setNewDate('')
    setNewStartTime('')
    setNewDuration(60)
    setNewAttendees(1)
    setNewNotes('')
    setNewStatus('pending')
  }

  // ── computed stats ────────────────────────────────────────────────────────
  const pendingBookings   = bookings.filter(b => b.status === 'pending')
  const todayBookings     = bookings.filter(b => b.booking_date === today)
  const weekBookings      = bookings.filter(b => b.booking_date >= weekMon && b.booking_date <= weekSun)
  const approvedBookings  = bookings.filter(b => b.status === 'approved')

  // most booked amenity
  const amenityCount: Record<string, { name: string; count: number }> = {}
  for (const b of bookings) {
    if (!b.amenities) continue
    const key = b.amenity_id ?? ''
    if (!amenityCount[key]) amenityCount[key] = { name: b.amenities.name, count: 0 }
    amenityCount[key].count++
  }
  const sortedAmenities = Object.values(amenityCount).sort((a, b) => b.count - a.count)
  const mostBookedAmenity = sortedAmenities[0]

  // peak day
  const dayCount: Record<number, number> = {}
  for (const b of bookings) {
    const day = new Date(b.booking_date + 'T12:00:00').getDay()
    dayCount[day] = (dayCount[day] ?? 0) + 1
  }
  const peakDayEntry = Object.entries(dayCount).sort((a, b) => b[1] - a[1])[0]
  const peakDay = peakDayEntry ? DAY_NAMES[Number(peakDayEntry[0])] : '—'

  // avg duration
  const avgDuration = bookings.length
    ? Math.round(bookings.reduce((s, b) => s + (b.duration_mins ?? 0), 0) / bookings.length)
    : 0

  // utilization chart
  const utilizationMax = sortedAmenities[0]?.count ?? 1

  // amenity filter options (from actual bookings + amenityOptions)
  const amenityFilterOptions = Array.from(
    new Map(
      bookings
        .filter(b => b.amenities)
        .map(b => [b.amenity_id, b.amenities!.name])
    ).entries()
  )

  // ── filtered rows ─────────────────────────────────────────────────────────
  const filtered = bookings.filter(b => {
    if (dateFrom && b.booking_date < dateFrom) return false
    if (dateTo   && b.booking_date > dateTo)   return false
    if (statusFilter !== 'all' && b.status !== statusFilter) return false
    if (amenityFilter && b.amenity_id !== amenityFilter) return false
    if (residentSearch) {
      const name = b.residents?.full_name?.toLowerCase() ?? ''
      if (!name.includes(residentSearch.toLowerCase())) return false
    }
    return true
  })

  const hasFilter = !!(dateFrom || dateTo || statusFilter !== 'all' || amenityFilter || residentSearch)

  // ── selected amenity durations ────────────────────────────────────────────
  const selectedAmenity = amenityOptions.find(a => a.id === newAmenityId)
  const durationChoices: number[] =
    (selectedAmenity?.amenity_booking_rules?.allowed_durations?.length ?? 0) > 0
      ? selectedAmenity!.amenity_booking_rules!.allowed_durations
      : DEFAULT_DURATIONS

  const computedEndTime = newStartTime ? addMinutes(newStartTime, newDuration) : ''

  // ── render ────────────────────────────────────────────────────────────────
  return (
    <div className="p-8 space-y-6">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink">Amenity Bookings</h1>
          <p className="text-slate text-sm mt-1">
            {bookings.length} total · {pendingBookings.length} pending
          </p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 px-4 py-2 bg-forest text-white rounded-xl text-sm font-medium hover:bg-deep transition-colors"
        >
          + New Booking
        </button>
      </div>

      {/* ── Pending Alert Banner ─────────────────────────────────────────── */}
      {pendingBookings.length > 0 && (
        <div className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-2xl px-5 py-3.5">
          <span className="text-amber-800 font-medium text-sm">
            ⏳&nbsp;&nbsp;{pendingBookings.length} booking{pendingBookings.length !== 1 ? 's' : ''} pending approval
          </span>
          <button
            onClick={() => setStatusFilter('pending')}
            className="text-amber-700 font-semibold text-sm hover:text-amber-900 transition-colors"
          >
            Review →
          </button>
        </div>
      )}

      {/* ── Stats Row ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-5 gap-4">
        {/* Today */}
        <div className="bg-white border border-border rounded-2xl p-4 shadow-sm">
          <p className="text-xs text-slate font-medium uppercase tracking-wide mb-1">Today</p>
          <p className="text-3xl font-bold text-ink">{todayBookings.length}</p>
          <p className="text-xs text-fog mt-1">bookings today</p>
        </div>
        {/* Pending */}
        <div className="bg-gold/10 border border-gold/30 rounded-2xl p-4 shadow-sm">
          <p className="text-xs text-amber-700 font-medium uppercase tracking-wide mb-1">Pending</p>
          <p className="text-3xl font-bold text-amber-700">{pendingBookings.length}</p>
          <p className="text-xs text-amber-600/70 mt-1">awaiting approval</p>
        </div>
        {/* This Week */}
        <div className="bg-forest rounded-2xl p-4 shadow-sm">
          <p className="text-xs text-white/70 font-medium uppercase tracking-wide mb-1">This Week</p>
          <p className="text-3xl font-bold text-white">{weekBookings.length}</p>
          <p className="text-xs text-white/60 mt-1">{weekMon} – {weekSun}</p>
        </div>
        {/* Approved */}
        <div className="bg-white border border-border rounded-2xl p-4 shadow-sm">
          <p className="text-xs text-slate font-medium uppercase tracking-wide mb-1">Approved</p>
          <p className="text-3xl font-bold text-green-600">{approvedBookings.length}</p>
          <p className="text-xs text-fog mt-1">active bookings</p>
        </div>
        {/* All Time */}
        <div className="bg-white border border-border rounded-2xl p-4 shadow-sm">
          <p className="text-xs text-slate font-medium uppercase tracking-wide mb-1">All Time</p>
          <p className="text-3xl font-bold text-ink">{bookings.length}</p>
          <p className="text-xs text-fog mt-1">total bookings</p>
        </div>
      </div>

      {/* ── Quick Analytics ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white border border-border rounded-2xl p-5 shadow-sm">
          <p className="text-xs text-slate font-medium uppercase tracking-wide mb-2">Most Booked Amenity</p>
          {mostBookedAmenity ? (
            <>
              <p className="text-lg font-semibold text-ink truncate">{mostBookedAmenity.name}</p>
              <p className="text-xs text-fog mt-1">{mostBookedAmenity.count} booking{mostBookedAmenity.count !== 1 ? 's' : ''}</p>
            </>
          ) : (
            <p className="text-sm text-fog">—</p>
          )}
        </div>
        <div className="bg-white border border-border rounded-2xl p-5 shadow-sm">
          <p className="text-xs text-slate font-medium uppercase tracking-wide mb-2">Peak Day</p>
          <p className="text-lg font-semibold text-ink">{peakDay}</p>
          {peakDayEntry && (
            <p className="text-xs text-fog mt-1">{peakDayEntry[1]} bookings on average</p>
          )}
        </div>
        <div className="bg-white border border-border rounded-2xl p-5 shadow-sm">
          <p className="text-xs text-slate font-medium uppercase tracking-wide mb-2">Avg Duration</p>
          <p className="text-lg font-semibold text-ink">{avgDuration ? fmtDuration(avgDuration) : '—'}</p>
          <p className="text-xs text-fog mt-1">per booking session</p>
        </div>
      </div>

      {/* ── Filter Bar ───────────────────────────────────────────────────── */}
      <div className="bg-white border border-border rounded-2xl px-5 py-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          {/* Date from */}
          <div className="flex items-center gap-1.5">
            <label className="text-xs text-slate font-medium">From</label>
            <input
              type="date"
              value={dateFrom}
              onChange={e => setDateFrom(e.target.value)}
              className="border border-border rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:border-forest bg-cream"
            />
          </div>
          {/* Date to */}
          <div className="flex items-center gap-1.5">
            <label className="text-xs text-slate font-medium">To</label>
            <input
              type="date"
              value={dateTo}
              onChange={e => setDateTo(e.target.value)}
              className="border border-border rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:border-forest bg-cream"
            />
          </div>
          {/* Status */}
          <div className="flex gap-1.5 flex-wrap">
            {(['all', 'pending', 'approved', 'rejected', 'completed', 'cancelled'] as const).map(s => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-colors capitalize ${
                  statusFilter === s
                    ? 'bg-forest text-white'
                    : 'bg-cream border border-border text-slate hover:border-forest'
                }`}
              >
                {s === 'all' ? 'All' : s}
              </button>
            ))}
          </div>
          {/* Amenity */}
          <select
            value={amenityFilter}
            onChange={e => setAmenityFilter(e.target.value)}
            className="border border-border rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:border-forest bg-cream text-slate"
          >
            <option value="">All Amenities</option>
            {amenityFilterOptions.map(([id, name]) => (
              <option key={id} value={id ?? ''}>{name}</option>
            ))}
          </select>
          {/* Resident search */}
          <input
            type="text"
            placeholder="Search resident..."
            value={residentSearch}
            onChange={e => setResidentSearch(e.target.value)}
            className="border border-border rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:border-forest bg-cream w-44"
          />
          {/* Clear */}
          {hasFilter && (
            <button
              onClick={() => {
                setDateFrom('')
                setDateTo('')
                setStatusFilter('all')
                setAmenityFilter('')
                setResidentSearch('')
              }}
              className="text-xs text-red-400 hover:text-red-600 font-medium px-2 py-1.5 transition-colors"
            >
              ✕ Clear
            </button>
          )}
        </div>
      </div>

      {/* ── Bookings Table ───────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-slate text-xs uppercase tracking-wide border-b border-border bg-cream/50">
              <th className="px-5 py-3 text-left">Amenity</th>
              <th className="px-5 py-3 text-left">Resident · Unit</th>
              <th className="px-5 py-3 text-left">Date</th>
              <th className="px-5 py-3 text-left">Time Slot</th>
              <th className="px-5 py-3 text-left">Duration</th>
              <th className="px-5 py-3 text-left">Guests</th>
              <th className="px-5 py-3 text-left">Status</th>
              <th className="px-5 py-3 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={8} className="px-5 py-10 text-center text-slate">
                  Loading bookings...
                </td>
              </tr>
            )}

            {!loading && filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="px-5 py-14 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <span className="text-3xl">📅</span>
                    <p className="font-semibold text-ink">No bookings yet</p>
                    <p className="text-slate text-xs">Bookings made by residents from the app will appear here.</p>
                  </div>
                </td>
              </tr>
            )}

            {!loading && filtered.map(b => (
              <>
                <tr key={b.id} className="border-b border-border last:border-0 hover:bg-cream/40 transition-colors">
                  {/* Amenity */}
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <span className="text-base leading-none">
                        {CATEGORY_ICON[b.amenities?.category ?? ''] ?? '✨'}
                      </span>
                      <div>
                        <p className="font-medium text-ink">{b.amenities?.name ?? '—'}</p>
                        <p className="text-xs text-fog capitalize">{b.amenities?.category ?? ''}</p>
                      </div>
                    </div>
                  </td>
                  {/* Resident + Unit */}
                  <td className="px-5 py-3">
                    <p className="font-medium text-ink">{b.residents?.full_name ?? '—'}</p>
                    <p className="text-xs text-fog">
                      {b.units?.unit_number ? `Unit ${b.units.unit_number}` : 'No unit'}
                      {b.residents?.phone ? ` · ${b.residents.phone}` : ''}
                    </p>
                  </td>
                  {/* Date */}
                  <td className="px-5 py-3 text-slate text-xs">
                    {new Date(b.booking_date + 'T12:00:00').toLocaleDateString('en-GB', {
                      weekday: 'short', day: 'numeric', month: 'short',
                    })}
                  </td>
                  {/* Time Slot */}
                  <td className="px-5 py-3 font-mono text-xs text-ink">
                    {b.start_time} – {b.end_time}
                  </td>
                  {/* Duration */}
                  <td className="px-5 py-3 text-slate text-xs">{fmtDuration(b.duration_mins)}</td>
                  {/* Attendees */}
                  <td className="px-5 py-3 text-slate text-xs text-center">{b.attendees_count}</td>
                  {/* Status */}
                  <td className="px-5 py-3">
                    <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-semibold capitalize ${STATUS_STYLES[b.status]}`}>
                      {b.status}
                    </span>
                    {b.rejection_reason && (
                      <p className="text-xs text-fog mt-1 max-w-[10rem] truncate" title={b.rejection_reason}>
                        {b.rejection_reason}
                      </p>
                    )}
                  </td>
                  {/* Actions */}
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {b.status === 'pending' && (
                        <>
                          <button
                            onClick={() => approve(b.id)}
                            className="px-2.5 py-1 bg-green-100 text-green-700 rounded-lg text-xs font-medium hover:bg-green-200 transition-colors"
                          >
                            ✓ Approve
                          </button>
                          <button
                            onClick={() => { setRejectingId(b.id); setRejectReason('') }}
                            className="px-2.5 py-1 bg-red-100 text-red-700 rounded-lg text-xs font-medium hover:bg-red-200 transition-colors"
                          >
                            ✗ Reject
                          </button>
                        </>
                      )}
                      {b.status === 'approved' && (
                        <>
                          <button
                            onClick={() => updateStatus(b.id, 'completed')}
                            className="px-2.5 py-1 bg-blue-100 text-blue-700 rounded-lg text-xs font-medium hover:bg-blue-200 transition-colors"
                          >
                            Mark Complete
                          </button>
                          <button
                            onClick={() => updateStatus(b.id, 'cancelled')}
                            className="px-2.5 py-1 bg-gray-100 text-gray-500 rounded-lg text-xs font-medium hover:bg-gray-200 transition-colors"
                          >
                            Cancel
                          </button>
                        </>
                      )}
                      {b.status !== 'pending' && b.status !== 'approved' && (
                        <button
                          onClick={() => deleteBooking(b.id)}
                          className="text-red-400 hover:text-red-600 text-xs font-medium transition-colors"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </td>
                </tr>

                {/* Inline Reject Modal Row */}
                {rejectingId === b.id && (
                  <tr key={`reject-${b.id}`} className="border-b border-border bg-red-50/40">
                    <td colSpan={8} className="px-5 py-4">
                      <div className="flex items-start gap-3 max-w-lg">
                        <div className="flex-1">
                          <p className="text-xs font-semibold text-red-700 mb-2">Rejection reason for this booking</p>
                          <textarea
                            rows={2}
                            value={rejectReason}
                            onChange={e => setRejectReason(e.target.value)}
                            placeholder="Reason for rejection..."
                            className="w-full border border-red-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-red-400 bg-white resize-none"
                          />
                        </div>
                        <div className="flex gap-2 pt-6">
                          <button
                            onClick={() => reject(b.id, rejectReason)}
                            disabled={!rejectReason.trim()}
                            className="px-3 py-1.5 bg-red-600 text-white rounded-xl text-xs font-medium hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                          >
                            Confirm Rejection
                          </button>
                          <button
                            onClick={() => { setRejectingId(null); setRejectReason('') }}
                            className="px-3 py-1.5 bg-white border border-border rounded-xl text-xs text-slate font-medium hover:border-forest transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Utilization Analytics ────────────────────────────────────────── */}
      {sortedAmenities.length > 0 && (
        <div className="bg-white border border-border rounded-2xl p-6 shadow-sm">
          <h2 className="text-sm font-bold text-ink mb-5">Amenity Utilization</h2>
          <div className="space-y-3">
            {sortedAmenities.map(({ name, count }) => {
              const cat = bookings.find(b => b.amenities?.name === name)?.amenities?.category ?? 'other'
              return (
                <div key={name} className="flex items-center gap-3">
                  <span className="w-5 text-center text-sm leading-none">{CATEGORY_ICON[cat] ?? '✨'}</span>
                  <span className="w-36 text-xs text-slate truncate">{name}</span>
                  <div className="flex-1 bg-cream rounded-full h-2 overflow-hidden">
                    <div
                      style={{ width: `${(count / utilizationMax) * 100}%` }}
                      className="h-2 bg-forest rounded-full transition-all duration-500"
                    />
                  </div>
                  <span className="w-8 text-xs text-fog text-right">{count}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Add Booking Modal ────────────────────────────────────────────── */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-5 border-b border-border">
              <h2 className="text-base font-bold text-ink">New Booking</h2>
              <button
                onClick={() => { setShowAdd(false); resetAddForm() }}
                className="text-fog hover:text-slate transition-colors text-lg leading-none"
              >
                ✕
              </button>
            </div>

            <div className="px-6 py-5 space-y-4">
              {/* Amenity */}
              <div>
                <label className="block text-xs font-semibold text-slate mb-1.5">Amenity *</label>
                <select
                  value={newAmenityId}
                  onChange={e => { setNewAmenityId(e.target.value); setNewDuration(60) }}
                  className="w-full border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-forest bg-cream"
                >
                  <option value="">Select amenity...</option>
                  {amenityOptions.map(a => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              </div>

              {/* Resident */}
              <div>
                <label className="block text-xs font-semibold text-slate mb-1.5">Resident *</label>
                <select
                  value={newResidentId}
                  onChange={e => setNewResidentId(e.target.value)}
                  className="w-full border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-forest bg-cream"
                >
                  <option value="">Select resident...</option>
                  {residentOptions.map(r => (
                    <option key={r.id} value={r.id}>{r.full_name}</option>
                  ))}
                </select>
              </div>

              {/* Unit */}
              <div>
                <label className="block text-xs font-semibold text-slate mb-1.5">Unit (optional)</label>
                <select
                  value={newUnitId}
                  onChange={e => setNewUnitId(e.target.value)}
                  className="w-full border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-forest bg-cream"
                >
                  <option value="">No unit</option>
                  {unitOptions.map(u => (
                    <option key={u.id} value={u.id}>{u.unit_number}</option>
                  ))}
                </select>
              </div>

              {/* Date + Start Time */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate mb-1.5">Date *</label>
                  <input
                    type="date"
                    value={newDate}
                    onChange={e => setNewDate(e.target.value)}
                    className="w-full border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-forest bg-cream"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate mb-1.5">Start Time *</label>
                  <input
                    type="time"
                    step="1800"
                    value={newStartTime}
                    onChange={e => setNewStartTime(e.target.value)}
                    className="w-full border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-forest bg-cream"
                  />
                </div>
              </div>

              {/* Duration + End time preview */}
              <div>
                <label className="block text-xs font-semibold text-slate mb-1.5">Duration *</label>
                <select
                  value={newDuration}
                  onChange={e => setNewDuration(Number(e.target.value))}
                  className="w-full border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-forest bg-cream"
                >
                  {durationChoices.map(d => (
                    <option key={d} value={d}>{fmtDuration(d)}</option>
                  ))}
                </select>
                {computedEndTime && (
                  <p className="text-xs text-fog mt-1.5">
                    Ends at <span className="font-semibold text-ink font-mono">{computedEndTime}</span>
                  </p>
                )}
              </div>

              {/* Attendees */}
              <div>
                <label className="block text-xs font-semibold text-slate mb-1.5">Attendees</label>
                <input
                  type="number"
                  min={1}
                  value={newAttendees}
                  onChange={e => setNewAttendees(Math.max(1, Number(e.target.value)))}
                  className="w-full border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-forest bg-cream"
                />
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-semibold text-slate mb-1.5">Notes (optional)</label>
                <textarea
                  rows={2}
                  value={newNotes}
                  onChange={e => setNewNotes(e.target.value)}
                  placeholder="Any special notes..."
                  className="w-full border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-forest bg-cream resize-none"
                />
              </div>

              {/* Status */}
              <div>
                <label className="block text-xs font-semibold text-slate mb-1.5">Initial Status</label>
                <select
                  value={newStatus}
                  onChange={e => setNewStatus(e.target.value as 'pending' | 'approved')}
                  className="w-full border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-forest bg-cream"
                >
                  <option value="pending">Pending</option>
                  <option value="approved">Approved</option>
                </select>
              </div>

              {/* Conflict warning */}
              {newAmenityId && newDate && newStartTime && (
                <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 text-xs text-amber-700">
                  ⚠ Check for conflicts before saving
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 px-6 py-4 border-t border-border">
              <button
                onClick={() => { setShowAdd(false); resetAddForm() }}
                className="px-4 py-2 border border-border rounded-xl text-sm text-slate hover:border-forest transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAddBooking}
                disabled={addLoading || !newAmenityId || !newResidentId || !newDate || !newStartTime}
                className="px-5 py-2 bg-forest text-white rounded-xl text-sm font-medium hover:bg-deep disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {addLoading ? 'Saving...' : 'Create Booking'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
