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
          background: '#0D2818',
          borderRadius: 40,
        }}
      >
        <div
          style={{
            position: 'absolute',
            width: 148,
            height: 148,
            borderRadius: 30,
            border: '2px solid rgba(200, 124, 42, 0.3)',
            display: 'flex',
          }}
        />
        <span
          style={{
            color: '#C87C2A',
            fontSize: 108,
            fontWeight: 900,
            fontFamily: 'serif',
            lineHeight: 1,
            marginTop: 6,
          }}
        >
          7
        </span>
      </div>
    ),
    { ...size },
  )
}
