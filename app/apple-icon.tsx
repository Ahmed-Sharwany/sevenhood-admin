import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const size    = { width: 180, height: 180 }
export const contentType = 'image/png'

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 180,
          height: 180,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0B0C0A',
          borderRadius: 40,
        }}
      >
        <span
          style={{
            color: '#C9A56B',
            fontSize: 108,
            fontWeight: 600,
            fontFamily: 'serif',
            lineHeight: 1,
          }}
        >
          S
        </span>
      </div>
    ),
    { ...size },
  )
}
