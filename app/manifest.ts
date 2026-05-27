import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Sevenhood Admin',
    short_name: 'Admin',
    description: 'Sevenhood Operator Console',
    start_url: '/',
    display: 'standalone',
    background_color: '#0D2818',
    theme_color: '#0D2818',
    icons: [
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
      { src: '/apple-icon', sizes: '180x180', type: 'image/png' },
      { src: '/icon',       sizes: '32x32',   type: 'image/png' },
    ],
  }
}
