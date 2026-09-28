import { ImageResponse } from 'next/og'

export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

// iOS's "Add to Home Screen" (and some older browsers) look for this PNG specifically — icon.svg
// alone isn't picked up there, so without this the home-screen icon fell back to a generic
// screenshot thumbnail instead of the brand mark. Same checkmark as icon.svg, rendered as a PNG.
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#1A0E06',
          // No border-radius here — iOS applies its own corner mask to home-screen icons, so a
          // square, full-bleed image is what Apple's own guidance asks for.
        }}
      >
        <svg width="112" height="112" viewBox="0 0 32 32">
          <path d="M9 16.5l4.5 4.5L23 11" stroke="#D4762A" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </svg>
      </div>
    ),
    { ...size }
  )
}
