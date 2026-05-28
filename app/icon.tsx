import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const size    = { width: 32, height: 32 }
export const contentType = 'image/png'

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 32,
          height: 32,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0B0C0A',
          borderRadius: 8,
        }}
      >
        <span
          style={{
            color: '#C9A56B',
            fontSize: 18,
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
