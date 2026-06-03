import { ImageResponse } from 'next/og'

export const runtime     = 'edge'
export const size        = { width: 180, height: 180 }
export const contentType = 'image/png'

// Sevenhood S-curve mark — same SVG used in the sidebar logo
const SVG_MARK = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect x="0" y="0" width="64" height="64" rx="14" fill="#0B0C0A"/>
  <defs>
    <mask id="m" maskUnits="userSpaceOnUse" x="0" y="0" width="64" height="64">
      <rect x="8" y="8" width="48" height="48" rx="11" fill="white"/>
      <path d="M 46 22 C 14 22 14 32 32 32 C 50 32 50 42 18 42"
        stroke="black" stroke-width="5.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
    </mask>
  </defs>
  <rect x="8" y="8" width="48" height="48" rx="11" fill="#C9A56B" mask="url(#m)"/>
</svg>`

const DATA_URI = `data:image/svg+xml;base64,${Buffer.from(SVG_MARK).toString('base64')}`

export default function AppleIcon() {
  return new ImageResponse(
    (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={DATA_URI} width={180} height={180} alt="Sevenhood" />
    ),
    { ...size },
  )
}
