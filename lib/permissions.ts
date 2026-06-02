// ── Permissions ──────────────────────────────────────────────────────────────

export interface PermissionDef {
  id:    string
  label: string
  desc:  string
  icon:  string
  group: string
}

export const ALL_PERMISSIONS: PermissionDef[] = [
  // Portfolio
  { id: 'manage_projects',  label: 'Manage Projects',        desc: 'Add / edit projects, buildings, units', icon: '🏗️', group: 'Portfolio'   },
  { id: 'manage_amenities', label: 'Manage Amenities',       desc: 'Configure community amenities',          icon: '🏊', group: 'Portfolio'   },
  { id: 'manage_residents', label: 'Manage Residents',       desc: 'Add, edit, delete resident records',     icon: '👤', group: 'Portfolio'   },
  { id: 'invite_residents', label: 'Invite Residents (App)', desc: 'Send mobile app invitations to residents', icon: '📲', group: 'Portfolio' },
  // Operations
  { id: 'manage_bookings',  label: 'Manage Bookings',        desc: 'Approve / reject amenity bookings',      icon: '📅', group: 'Operations'  },
  { id: 'manage_tickets',   label: 'Maintenance Tickets',    desc: 'Handle maintenance requests',            icon: '🔧', group: 'Operations'  },
  { id: 'manage_visitors',  label: 'Manage Visitors',        desc: 'Approve visitor access passes',          icon: '🔑', group: 'Operations'  },
  { id: 'manage_providers', label: 'Service Providers',      desc: 'Manage service provider accounts',       icon: '⚙️', group: 'Operations'  },
  // Engagement
  { id: 'manage_community', label: 'Community',              desc: 'Post announcements and events',          icon: '👥', group: 'Engagement'  },
  { id: 'view_ai_design',   label: 'AI Design',              desc: 'View and handle AI design requests',     icon: '✨', group: 'Engagement'  },
  // Intelligence
  { id: 'use_ai_docs',      label: 'Document AI',            desc: 'Upload and analyze contracts/documents', icon: '📄', group: 'Intelligence' },
  { id: 'use_ai_chatbot',   label: 'AI Concierge',           desc: 'Manage AI chatbot and conversations',    icon: '🤖', group: 'Intelligence' },
  // Billing
  { id: 'manage_billing',   label: 'Billing & Finance',      desc: 'View and manage invoices, payments, and billing settings', icon: '💰', group: 'Billing' },
]

// Default permissions bundled with each role (shown pre-checked in the modal)
export const ROLE_DEFAULT_PERMISSIONS: Record<string, string[]> = {
  super_admin:      ALL_PERMISSIONS.map(p => p.id),
  org_admin:        ALL_PERMISSIONS.map(p => p.id),
  project_owner:    ALL_PERMISSIONS.map(p => p.id),
  operator:         ['invite_residents', 'manage_bookings', 'manage_tickets', 'manage_visitors'],
  finance:          [],
  service_provider: ['manage_tickets'],
  technician:       ['manage_tickets'],
}

// Which nav href requires which permission (for non-admin roles)
export const HREF_PERMISSION: Record<string, string> = {
  '/projects':   'manage_projects',
  '/buildings':  'manage_projects',
  '/units':      'manage_projects',
  '/amenities':  'manage_amenities',
  '/residents':  'manage_residents',
  '/bookings':   'manage_bookings',
  '/tickets':    'manage_tickets',
  '/visitors':   'manage_visitors',
  '/providers':  'manage_providers',
  '/community':  'manage_community',
  '/ai-design':  'view_ai_design',
  '/ai-docs':              'use_ai_docs',
  '/chatbot':              'use_ai_chatbot',
  '/billing':              'manage_billing',
  '/billing/invoices':     'manage_billing',
  '/billing/settings':     'manage_billing',
}
