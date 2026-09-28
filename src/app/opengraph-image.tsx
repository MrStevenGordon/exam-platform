import { ImageResponse } from 'next/og'

export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

// Generated at request/build time rather than a static asset, so the share image can never go
// stale against the brand colors defined in globals.css, and there's no design file to keep in
// sync. Matches the warm-cream / burnt-orange palette used across the rest of the site.
export default async function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#FDF8F3',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 36 }}>
          <div
            style={{
              width: 84,
              height: 84,
              background: '#D4762A',
              borderRadius: 20,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <svg width="46" height="46" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
              <rect x="9" y="3" width="6" height="4" rx="1" />
              <path d="M9 14l2 2 4-4" />
            </svg>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: 4, color: '#A08060', textTransform: 'uppercase' }}>Smart Assess Ja</div>
          </div>
        </div>
        <div style={{ display: 'flex', fontSize: 64, fontWeight: 800, color: '#1E1208', letterSpacing: -1.5, textAlign: 'center', maxWidth: 900 }}>
          Exams, lessons and practice, all in one platform
        </div>
        <div style={{ display: 'flex', gap: 14, marginTop: 40 }}>
          {['Smart Assess', 'Smart Learning', 'Smart Play'].map((label) => (
            <div
              key={label}
              style={{
                display: 'flex',
                fontSize: 22,
                fontWeight: 700,
                color: '#8C6020',
                background: '#FEF5E4',
                border: '1px solid #EAD9C4',
                borderRadius: 100,
                padding: '10px 24px',
              }}
            >
              {label}
            </div>
          ))}
        </div>
      </div>
    ),
    { ...size }
  )
}
