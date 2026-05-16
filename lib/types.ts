export interface Project {
  id: string
  name: string
  location: string | null
  description: string | null
  created_at: string
}

export interface Building {
  id: string
  project_id: string | null
  name: string
  floors: number | null
  created_at: string
  projects?: Project
}

export type UnitStatus = 'occupied' | 'vacant' | 'reserved'
export type TicketStatus = 'open' | 'in_progress' | 'completed' | 'cancelled'
export type Priority = 'low' | 'medium' | 'high'
export type PassStatus = 'active' | 'pending' | 'expired' | 'cancelled'
export type PaymentStatus = 'paid' | 'upcoming' | 'overdue'

export interface Unit {
  id: string
  unit_number: string
  floor: number
  tower: string | null
  building_id: string | null
  bedrooms: number
  bathrooms: number
  area_sqm: number | null
  status: UnitStatus
  created_at: string
  buildings?: Building
}

export interface Resident {
  id: string
  full_name: string
  email: string | null
  phone: string | null
  unit_id: string | null
  role: 'owner' | 'tenant' | 'family'
  move_in_date: string | null
  avatar_url: string | null
  created_at: string
  units?: Unit
}

export interface Post {
  id: string
  author_id: string | null
  author_name: string | null
  content: string
  likes: number
  comments: number
  is_operator: boolean
  created_at: string
}

export interface Event {
  id: string
  name: string
  date: string
  time: string | null
  location: string | null
  capacity: number | null
  rsvp_count: number
  emoji: string | null
  created_at: string
}

export interface MaintenanceTicket {
  id: string
  unit_id: string | null
  resident_id: string | null
  category: string
  description: string
  status: TicketStatus
  priority: Priority
  assigned_to: string | null
  eta: string | null
  created_at: string
  updated_at: string
  units?: Unit
  residents?: Resident
}

export interface VisitorPass {
  id: string
  unit_id: string | null
  resident_id: string | null
  visitor_name: string
  detail: string | null
  pass_type: 'one-time' | 'recurring' | 'temporary'
  status: PassStatus
  valid_until: string | null
  created_at: string
  units?: Unit
  residents?: Resident
}

export interface Vendor {
  id: string
  name: string
  category: string
  rating: number
  reviews: number
  price_from: number | null
  image_url: string | null
  verified: boolean
  tags: string[] | null
  created_at: string
}
