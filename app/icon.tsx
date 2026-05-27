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
          background: '#0D2818',
          borderRadius: 7,
        }}
      >
        <div
          style={{
            position: 'absolute',
            width: 26,
            height: 26,
            borderRadius: 5,
            border: '1px solid rgba(200, 124, 42, 0.3)',
            display: 'flex',
          }}
        />
        <span
          style={{
            color: '#C87C2A',
            fontSize: 19,
            fontWeight: 900,
            fontFamily: 'serif',
            lineHeight: 1,
            marginTop: 1,
          }}
        >
          7
        </span>
      </div>
    ),
    { ...size },
  )
}
