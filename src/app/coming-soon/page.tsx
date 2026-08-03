import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Smart Assess — Coming Soon',
  description: 'Smart Assess is launching soon — online exams built for schools across Jamaica.',
}

const FEATURES = [
  'Proctored online exams',
  'Built for Jamaican schools',
  'Works even when the internet doesn’t',
]

export default function ComingSoonPage() {
  return (
    <div className="cs-page">
      <div className="cs-blob cs-blob-a" />
      <div className="cs-blob cs-blob-b" />

      <div className="cs-content">
        <div className="cs-wordmark">
          <div className="cs-wordmark-small">SMART ASSESS JA</div>
          <div className="cs-wordmark-big">Smart Assess</div>
        </div>

        <div className="cs-badge">
          <span className="cs-badge-dot" />
          Launching soon
        </div>

        <h1 className="cs-headline">Something great is on its way.</h1>
        <p className="cs-sub">
          A modern exam and assessment platform, built from the ground up for schools
          and organizations across Jamaica. We&apos;re putting on the finishing touches —
          check back soon.
        </p>

        <div className="cs-features">
          {FEATURES.map((f) => (
            <span key={f} className="cs-feature">{f}</span>
          ))}
        </div>
      </div>

      <div className="cs-footer">&copy; 2026 Smart Assess Ja</div>

      <style>{`
        .cs-page {
          position: relative;
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          overflow: hidden;
          background: linear-gradient(160deg, #FDF8F3 0%, #FBEEDD 55%, #F8E2C4 100%);
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          padding: 24px;
        }

        .cs-blob {
          position: absolute;
          border-radius: 50%;
          filter: blur(60px);
          opacity: 0.35;
          pointer-events: none;
        }

        .cs-blob-a {
          width: 480px;
          height: 480px;
          background: #E8924A;
          top: -160px;
          left: -140px;
          animation: cs-float-a 14s ease-in-out infinite;
        }

        .cs-blob-b {
          width: 380px;
          height: 380px;
          background: #D4762A;
          bottom: -140px;
          right: -100px;
          opacity: 0.25;
          animation: cs-float-b 16s ease-in-out infinite;
        }

        @keyframes cs-float-a {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(30px, 40px) scale(1.08); }
        }

        @keyframes cs-float-b {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(-30px, -30px) scale(1.06); }
        }

        .cs-content {
          position: relative;
          z-index: 1;
          max-width: 560px;
          text-align: center;
          animation: cs-rise 0.7s cubic-bezier(0.16, 1, 0.3, 1) both;
        }

        @keyframes cs-rise {
          from { opacity: 0; transform: translateY(14px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .cs-wordmark { margin-bottom: 40px; }

        .cs-wordmark-small {
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 3px;
          color: #A08060;
          text-transform: uppercase;
        }

        .cs-wordmark-big {
          font-size: 20px;
          font-weight: 800;
          color: #1E1208;
          margin-top: 2px;
        }

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
          margin-bottom: 24px;
          text-transform: uppercase;
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
          font-size: clamp(28px, 4.5vw, 42px);
          font-weight: 800;
          letter-spacing: -0.5px;
          color: #1E1208;
          margin: 0 0 16px;
          line-height: 1.2;
          text-transform: none;
        }

        .cs-sub {
          font-size: 16px;
          line-height: 1.65;
          color: #6B4F35;
          margin: 0 0 32px;
        }

        .cs-features {
          display: flex;
          flex-wrap: wrap;
          justify-content: center;
          gap: 10px;
        }

        .cs-feature {
          font-size: 12.5px;
          font-weight: 600;
          color: #A85A18;
          background: rgba(255, 255, 255, 0.6);
          border: 1px solid #EAD9C4;
          padding: 7px 14px;
          border-radius: 100px;
          backdrop-filter: blur(4px);
        }

        .cs-footer {
          position: relative;
          z-index: 1;
          margin-top: 56px;
          font-size: 12px;
          color: #A08060;
        }

        @media (max-width: 480px) {
          .cs-sub { font-size: 14.5px; }
          .cs-feature { font-size: 11.5px; padding: 6px 12px; }
        }
      `}</style>
    </div>
  )
}
