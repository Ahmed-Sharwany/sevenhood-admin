export type UnitStatus = 'occupied' | 'vacant' | 'reserved'
export type TicketStatus = 'open' | 'in_progress' | 'completed' | 'cancelled'
export type Priority = 'low' | 'medium' | 'high'
export type PassStatus = 'active' | 'pending' | 'expired' | 'cancelled'
export type PaymentStatus = 'paid' | 'upcoming' | 'overdue'
export type AccountRole = 'super_admin' | 'project_owner' | 'service_provider'
export type ProjectStatus = 'active' | 'inactive' | 'pending'
export type AIDesignStatus = 'pending' | 'processing' | 'completed' | 'failed'

export interface City {
  id: string
  name: string
  country: string
  created_at: string
}

export interface Account {
  id: string
  email: string
  full_name: string
  role: AccountRole
  company_name: string | null
  phone: string | null
  is_active: boolean
  created_at: string
}

export interface Project {
  id: string
  name: string
  location: string | null
  description: string | null
  city_id: string | null
  owner_name: string | null
  owner_company: string | null
  lat: number | null
  lng: number | null
  amenities: string[]
  image_url: string | null
  contract_start: string | null
  contract_end: string | null
  monthly_fee: number
  status: ProjectStatus
  total_units: number
  created_at: string
  cities?: City
}

export interface Building {
  id: string
  project_id: string | null
  name: string
  floors: number | null
  units_count: number
  description: string | null
  image_url: string | null
  city_id: string | null
  created_at: string
  projects?: Project
  cities?: City
}

export interface Unit {
  id: string
  unit_number: string
  floor: number
  tower: string | null
  building_id: string | null
  project_id: string | null
  bedrooms: number
  bathrooms: number
  living_rooms: number
  has_kitchen: boolean
  area_sqm: number | null
  description: string | null
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

export interface ServiceProvider {
  id: string
  name: string
  services: string[]
  city_id: string | null
  coverage_area: string | null
  lat: number | null
  lng: number | null
  working_hours_start: string | null
  working_hours_end: string | null
  logo_url: string | null
  description: string | null
  contact_phone: string | null
  contact_email: string | null
  rating: number
  total_jobs: number
  response_time_hrs: number | null
  is_active: boolean
  created_at: string
  cities?: City
}

export interface MaintenanceTicket {
  id: string
  unit_id: string | null
  building_id: string | null
  project_id: string | null
  resident_id: string | null
  service_provider_id: string | null
  category: string
  description: string
  status: TicketStatus
  priority: Priority
  assigned_to: string | null
  preferred_time: string | null
  eta: string | null
  created_at: string
  updated_at: string
  units?: Unit
  residents?: Resident
  service_providers?: ServiceProvider
  projects?: Project
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
  is_recurring: boolean
  qr_code: string | null
  created_at: string
  units?: Unit
  residents?: Resident
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

export interface AIDesignRequest {
  id: string
  resident_id: string | null
  unit_id: string | null
  room_type: string | null
  style: string | null
  original_image_url: string | null
  generated_image_url: string | null
  status: AIDesignStatus
  service_provider_id: string | null
  execution_requested: boolean
  notes: string | null
  created_at: string
  residents?: Resident
  units?: Unit
  service_providers?: ServiceProvider
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
