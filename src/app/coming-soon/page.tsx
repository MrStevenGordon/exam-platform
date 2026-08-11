import type { Metadata } from 'next'
import WaitlistForm from '@/components/WaitlistForm'

const TITLE = 'Smart Assess Ja: Coming Soon'
const DESCRIPTION = 'A modern exam and assessment platform, built from the ground up for schools and organizations across Jamaica. Join the waitlist to be first to know when we launch.'
const URL = 'https://smartassessja.com'
const IMAGE = `${URL}/og/coming-soon.png`

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: URL,
    siteName: 'Smart Assess Ja',
    type: 'website',
    locale: 'en_JM',
    images: [{ url: IMAGE, width: 1200, height: 630, alt: 'Smart Assess Ja — Something great is on its way.' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: TITLE,
    description: DESCRIPTION,
    images: [IMAGE],
  },
}

const FEATURES = [
  {
    label: 'Proctored online exams',
    icon: (
      <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M8 1.5 13 3.5v4c0 3.2-2.1 5.6-5 7-2.9-1.4-5-3.8-5-7v-4L8 1.5Z" />
        <path d="m5.6 7.6 1.7 1.7 3.1-3.3" />
      </svg>
    ),
  },
  {
    label: 'Built for Jamaican schools',
    icon: (
      <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M1.5 6 8 3l6.5 3L8 9 1.5 6Z" />
        <path d="M4 7.4v3.4c2.5 1.5 5.5 1.5 8 0V7.4" />
        <path d="M14.5 6v3.5" />
      </svg>
    ),
  },
  {
    label: 'Works even when the internet doesn’t',
    icon: (
      <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M2 6.8a9 9 0 0 1 12 0" />
        <path d="M4.6 9.4a5.4 5.4 0 0 1 6.8 0" />
        <circle cx="8" cy="12.2" r="0.9" fill="currentColor" stroke="none" />
        <path d="m3 2.5 10 11" />
      </svg>
    ),
  },
]

export default function ComingSoonPage() {
  return (
    <div className="cs-page">
      <div className="cs-topline" />

      <main className="cs-hero">
        <div className="cs-copy">
          <div className="cs-wordmark cs-rise" style={{ animationDelay: '0.05s' }}>
            <div className="cs-wordmark-small">SMART ASSESS JA</div>
            <div className="cs-wordmark-big">
              Smart <span className="cs-wordmark-accent">Assess</span>
            </div>
          </div>

          <div className="cs-badge cs-rise" style={{ animationDelay: '0.15s' }}>
            <span className="cs-badge-dot" />
            Launching soon
          </div>

          <h1 className="cs-headline cs-rise" style={{ animationDelay: '0.25s' }}>
            Something great is on its way.
          </h1>
          <p className="cs-sub cs-rise" style={{ animationDelay: '0.35s' }}>
            A modern exam and assessment platform, built from the ground up for schools
            and organizations across Jamaica. We&apos;re putting on the finishing touches.
            Check back soon.
          </p>

          <div className="cs-features cs-rise" style={{ animationDelay: '0.45s' }}>
            {FEATURES.map((f) => (
              <span key={f.label} className="cs-feature">
                <span className="cs-feature-icon">{f.icon}</span>
                {f.label}
              </span>
            ))}
          </div>
        </div>

        <div className="cs-visual cs-rise" style={{ animationDelay: '0.3s' }}>
          <svg
            viewBox="0 0 560 420"
            role="img"
            aria-label="An open book transforming into a laptop running a digital exam"
          >
            {/* dotted orbit */}
            <circle
              className="cs-orbit"
              cx="280"
              cy="232"
              r="170"
              fill="none"
              stroke="#D4762A"
              strokeOpacity="0.18"
              strokeWidth="2"
              strokeDasharray="2 13"
              strokeLinecap="round"
            />

            {/* floating accents */}
            <circle className="cs-float cs-float-1" cx="112" cy="140" r="5" fill="#E8924A" opacity="0.5" />
            <circle className="cs-float cs-float-2" cx="452" cy="112" r="4" fill="#D4762A" opacity="0.45" />
            <circle className="cs-float cs-float-3" cx="466" cy="286" r="3" fill="#A85A18" opacity="0.4" />

            <ellipse className="cs-ground" cx="280" cy="346" rx="152" ry="13" fill="#A85A18" opacity="0.1" />

            {/* laptop base (keyboard deck) */}
            <g className="cs-lap-base">
              <path
                d="M150 302h260l22 26c3 4 0 8-5 8H133c-5 0-8-4-5-8l22-26Z"
                fill="#FFF9F2"
                stroke="#EAD9C4"
                strokeWidth="2"
              />
              <path d="M176 313h208" stroke="#EAD9C4" strokeWidth="4" strokeDasharray="12 7" strokeLinecap="round" />
              <path d="M168 322h224" stroke="#EAD9C4" strokeWidth="4" strokeDasharray="12 7" strokeLinecap="round" />
              <rect x="252" y="328" width="56" height="5" rx="2.5" fill="#F0DFC8" />
              <rect x="200" y="300" width="160" height="6" rx="3" fill="#E4CBA8" />
            </g>

            {/* laptop screen (rises from the hinge) */}
            <g className="cs-lap-screen">
              <rect x="168" y="118" width="224" height="184" rx="14" fill="#2A1A0C" />
              <rect x="178" y="128" width="204" height="156" rx="7" fill="#FFF9F2" />
              <circle cx="280" cy="123" r="2.4" fill="#6B4F35" />

              {/* app top bar */}
              <path d="M178 135a7 7 0 0 1 7-7h190a7 7 0 0 1 7 7v15H178v-15Z" fill="#FAE8D4" />
              <circle cx="192" cy="139" r="3.4" fill="#E8924A" />
              <circle cx="203" cy="139" r="3.4" fill="#D4762A" />
              <circle cx="214" cy="139" r="3.4" fill="#A85A18" />
              <rect x="334" y="132.5" width="40" height="13" rx="6.5" fill="#FDF1E3" />
              <circle className="cs-live" cx="343" cy="139" r="3" fill="#D4762A" />
              <rect x="350" y="136.5" width="18" height="5" rx="2.5" fill="#E8B98C" />

              {/* exam question list */}
              <rect x="192" y="162" width="118" height="9" rx="4.5" fill="#EAD9C4" />

              <rect x="192" y="184" width="14" height="14" rx="4" fill="#FFFFFF" stroke="#D4762A" strokeWidth="1.8" />
              <path
                className="cs-check cs-check-1"
                d="m195.5 191 3 3 5.5-6"
                fill="none"
                stroke="#D4762A"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <rect x="216" y="187.5" width="132" height="7" rx="3.5" fill="#F0DFC8" />

              <rect x="192" y="208" width="14" height="14" rx="4" fill="#FFFFFF" stroke="#D4762A" strokeWidth="1.8" />
              <path
                className="cs-check cs-check-2"
                d="m195.5 215 3 3 5.5-6"
                fill="none"
                stroke="#D4762A"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <rect x="216" y="211.5" width="112" height="7" rx="3.5" fill="#F0DFC8" />

              <rect x="192" y="232" width="14" height="14" rx="4" fill="#FFFFFF" stroke="#D4762A" strokeWidth="1.8" />
              <path
                className="cs-check cs-check-3"
                d="m195.5 239 3 3 5.5-6"
                fill="none"
                stroke="#D4762A"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <rect x="216" y="235.5" width="124" height="7" rx="3.5" fill="#F0DFC8" />

              {/* progress bar */}
              <rect x="192" y="262" width="176" height="9" rx="4.5" fill="#F0DFC8" />
              <rect className="cs-progress" x="192" y="262" width="176" height="9" rx="4.5" fill="#D4762A" />
            </g>

            {/* open book (folds down into the hinge) */}
            <g className="cs-book">
              <path
                d="M280 210 C 246 198, 210 198, 180 208 L180 294 C 210 284, 246 284, 280 296 C 314 284, 350 284, 380 294 L380 208 C 350 198, 314 198, 280 210 Z"
                fill="#D4762A"
              />
              <path
                d="M280 216 C 250 206, 218 206, 190 214 L190 288 C 218 280, 250 280, 280 290 Z"
                fill="#FFF9F2"
                stroke="#EAD9C4"
                strokeWidth="1.5"
              />
              <path
                d="M280 216 C 310 206, 342 206, 370 214 L370 288 C 342 280, 310 280, 280 290 Z"
                fill="#FFF9F2"
                stroke="#EAD9C4"
                strokeWidth="1.5"
              />
              <path d="M280 216v74" stroke="#EAD9C4" strokeWidth="2" />

              {/* text lines on the pages */}
              <rect x="202" y="228" width="52" height="5" rx="2.5" fill="#F0DFC8" />
              <rect x="202" y="239" width="60" height="5" rx="2.5" fill="#F0DFC8" />
              <rect x="202" y="250" width="44" height="5" rx="2.5" fill="#F0DFC8" />
              <rect x="202" y="261" width="56" height="5" rx="2.5" fill="#F0DFC8" />
              <rect x="298" y="228" width="60" height="5" rx="2.5" fill="#F0DFC8" />
              <rect x="298" y="239" width="46" height="5" rx="2.5" fill="#F0DFC8" />
              <rect x="298" y="250" width="58" height="5" rx="2.5" fill="#F0DFC8" />
              <rect x="298" y="261" width="40" height="5" rx="2.5" fill="#F0DFC8" />

              {/* bookmark ribbon */}
              <path d="M272 204h9v16l-4.5-4.5-4.5 4.5Z" fill="#A85A18" />

              {/* turning page, hinged at the spine */}
              <path
                className="cs-flip-page"
                d="M281 218 C 308 209, 338 209, 364 216 L364 286 C 338 279, 308 279, 281 288 Z"
                fill="#FBEEDD"
                stroke="#EAD9C4"
                strokeWidth="1.5"
              />
            </g>
          </svg>
        </div>
      </main>

      <WaitlistForm />

      <footer className="cs-footer">&copy; 2026 Smart Assess Ja</footer>

      <style>{`
        .cs-page {
          position: relative;
          min-height: 100vh;
          min-height: 100svh;
          display: flex;
          flex-direction: column;
          align-items: center;
          overflow: hidden;
          background: #FDF8F3;
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          padding: 32px 24px 24px;
        }

        .cs-topline {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 3px;
          background: #D4762A;
        }

        .cs-hero {
          position: relative;
          z-index: 1;
          margin: auto 0;
          display: grid;
          grid-template-columns: minmax(0, 1.05fr) minmax(0, 1fr);
          align-items: center;
          gap: 24px 56px;
          width: 100%;
          max-width: 1060px;
        }

        .cs-rise {
          animation: cs-rise 0.8s cubic-bezier(0.16, 1, 0.3, 1) both;
        }

        @keyframes cs-rise {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .cs-wordmark { margin-bottom: 36px; }

        .cs-wordmark-small {
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 3px;
          color: #A08060;
          text-transform: uppercase;
        }

        .cs-wordmark-big {
          font-size: 21px;
          font-weight: 800;
          color: #1E1208;
          margin-top: 2px;
          letter-spacing: -0.3px;
        }

        .cs-wordmark-accent { color: #D4762A; }

        .cs-badge {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0.4px;
          color: #A85A18;
          background: #FAE8D4;
          border: 1px solid #EAD9C4;
          padding: 6px 14px;
          border-radius: 100px;
          margin-bottom: 22px;
          text-transform: uppercase;
          box-shadow: 0 2px 10px rgba(168, 90, 24, 0.08);
        }

        .cs-badge-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #D4762A;
          animation: cs-pulse 1.8s ease-in-out infinite;
        }

        @keyframes cs-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(1.4); }
        }

        .cs-headline {
          font-size: clamp(30px, 4.5vw, 48px);
          font-weight: 800;
          letter-spacing: -0.8px;
          color: #1E1208;
          margin: 0 0 16px;
          line-height: 1.15;
          text-transform: none;
        }

        .cs-sub {
          font-size: 16.5px;
          line-height: 1.65;
          color: #6B4F35;
          margin: 0 0 30px;
          max-width: 460px;
        }

        .cs-features {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
        }

        .cs-feature {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          font-size: 12.5px;
          font-weight: 600;
          color: #A85A18;
          background: rgba(255, 255, 255, 0.65);
          border: 1px solid #EAD9C4;
          padding: 7px 14px;
          border-radius: 100px;
          backdrop-filter: blur(4px);
          box-shadow: 0 1px 6px rgba(168, 90, 24, 0.06);
        }

        .cs-feature-icon {
          display: inline-flex;
          color: #D4762A;
        }

        .cs-visual { min-width: 0; }

        .cs-visual svg {
          display: block;
          width: 100%;
          height: auto;
        }

        /* ---- book -> laptop morph (12s loop) ---- */

        .cs-book,
        .cs-lap-screen {
          transform-box: fill-box;
          transform-origin: 50% 100%;
        }

        .cs-book { animation: cs-morph-book 12s ease-in-out infinite; }
        .cs-lap-base { animation: cs-morph-base 12s ease-in-out infinite; }
        .cs-lap-screen { animation: cs-morph-screen 12s ease-in-out infinite; }

        @keyframes cs-morph-book {
          0%, 20% { transform: scaleY(1); opacity: 1; }
          26% { opacity: 1; }
          27%, 87% { transform: scaleY(0.03); opacity: 0; }
          89% { opacity: 1; }
          95%, 100% { transform: scaleY(1); opacity: 1; }
        }

        @keyframes cs-morph-base {
          0%, 23% { opacity: 0; }
          29%, 85% { opacity: 1; }
          91%, 100% { opacity: 0; }
        }

        @keyframes cs-morph-screen {
          0%, 28% { transform: scaleY(0.02); opacity: 0; }
          31% { opacity: 1; }
          37%, 78% { transform: scaleY(1); opacity: 1; }
          81% { opacity: 1; }
          85%, 100% { transform: scaleY(0.02); opacity: 0; }
        }

        .cs-flip-page {
          transform-box: fill-box;
          transform-origin: 0% 50%;
          animation: cs-flip 12s ease-in-out infinite;
        }

        @keyframes cs-flip {
          0%, 4% { transform: scaleX(1); opacity: 1; }
          9% { transform: scaleX(0.06); opacity: 1; }
          14% { transform: scaleX(-0.97); opacity: 1; }
          17% { transform: scaleX(-0.97); opacity: 0; }
          90% { transform: scaleX(-0.97); opacity: 0; }
          91% { transform: scaleX(1); opacity: 0; }
          96%, 100% { transform: scaleX(1); opacity: 1; }
        }

        .cs-check {
          stroke-dasharray: 14;
          stroke-dashoffset: 14;
        }

        .cs-check-1 { animation: cs-check-1 12s ease-in-out infinite; }
        .cs-check-2 { animation: cs-check-2 12s ease-in-out infinite; }
        .cs-check-3 { animation: cs-check-3 12s ease-in-out infinite; }

        @keyframes cs-check-1 {
          0%, 40% { stroke-dashoffset: 14; }
          45%, 84% { stroke-dashoffset: 0; }
          86%, 100% { stroke-dashoffset: 14; }
        }

        @keyframes cs-check-2 {
          0%, 48% { stroke-dashoffset: 14; }
          53%, 84% { stroke-dashoffset: 0; }
          86%, 100% { stroke-dashoffset: 14; }
        }

        @keyframes cs-check-3 {
          0%, 56% { stroke-dashoffset: 14; }
          61%, 84% { stroke-dashoffset: 0; }
          86%, 100% { stroke-dashoffset: 14; }
        }

        .cs-progress {
          transform-box: fill-box;
          transform-origin: 0% 50%;
          animation: cs-progress 12s ease-in-out infinite;
        }

        @keyframes cs-progress {
          0%, 38% { transform: scaleX(0.04); }
          74%, 84% { transform: scaleX(1); }
          86%, 100% { transform: scaleX(0.04); }
        }

        .cs-live { animation: cs-pulse 2s ease-in-out infinite; }

        .cs-orbit {
          transform-box: fill-box;
          transform-origin: 50% 50%;
          animation: cs-orbit-spin 80s linear infinite;
        }

        @keyframes cs-orbit-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        .cs-float { animation: cs-bob 7s ease-in-out infinite; }
        .cs-float-2 { animation-duration: 9s; animation-delay: -3s; }
        .cs-float-3 { animation-duration: 6s; animation-delay: -1.5s; }

        @keyframes cs-bob {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-9px); }
        }

        .cs-ground { animation: cs-ground 12s ease-in-out infinite; }

        @keyframes cs-ground {
          0%, 100% { transform: none; opacity: 0.1; }
          50% { transform: translateY(1px); opacity: 0.13; }
        }

        .cs-footer {
          position: relative;
          z-index: 1;
          margin-top: 40px;
          padding-top: 16px;
          font-size: 12px;
          color: #A08060;
        }

        @media (max-width: 900px) {
          .cs-hero {
            grid-template-columns: 1fr;
            gap: 8px;
            justify-items: center;
            text-align: center;
            max-width: 540px;
          }

          .cs-copy {
            display: flex;
            flex-direction: column;
            align-items: center;
          }

          .cs-wordmark { margin-bottom: 28px; }
          .cs-sub { max-width: none; }
          .cs-features { justify-content: center; }

          .cs-visual {
            width: 100%;
            max-width: 420px;
            margin-top: 4px;
          }
        }

        @media (max-width: 480px) {
          .cs-page { padding: 28px 18px 20px; }
          .cs-sub { font-size: 14.5px; }
          .cs-feature { font-size: 11.5px; padding: 6px 12px; }
          .cs-visual { max-width: 340px; }
          .cs-footer { margin-top: 28px; }
        }

        @media (prefers-reduced-motion: reduce) {
          .cs-page *,
          .cs-page {
            animation: none !important;
          }

          /* static fallback: show the finished laptop, hide the book */
          .cs-book,
          .cs-flip-page { opacity: 0; }
          .cs-check { stroke-dashoffset: 0; }
          .cs-progress { transform: scaleX(0.72); }
        }
      `}</style>
    </div>
  )
}
