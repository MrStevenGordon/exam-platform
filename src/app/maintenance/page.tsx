import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Smart Assess: Down for Maintenance',
  description: 'Smart Assess is briefly offline for maintenance. We will be back shortly.',
}

export default function MaintenancePage() {
  const message = process.env.NEXT_PUBLIC_MAINTENANCE_MESSAGE

  return (
    <div className="mnt-page">
      <div className="mnt-topline" />

      <main className="mnt-content">
        <div className="mnt-wordmark">
          <div className="mnt-wordmark-small">SMART ASSESS JA</div>
          <div className="mnt-wordmark-big">
            Smart <span className="mnt-wordmark-accent">Assess</span>
          </div>
        </div>

        <div className="mnt-badge">
          <span className="mnt-badge-dot" />
          Under maintenance
        </div>

        <h1 className="mnt-headline">We&apos;ll be right back.</h1>
        <p className="mnt-sub">
          {message || 'Smart Assess is briefly offline for scheduled maintenance. This usually only takes a few minutes. Please check back shortly.'}
        </p>

        <p className="mnt-note">
          If you were in the middle of an exam, don&apos;t worry: answers already entered are saved on your device and will sync automatically once the site is back.
        </p>
      </main>

      <footer className="mnt-footer">&copy; 2026 Smart Assess Ja</footer>

      <style>{`
        .mnt-page {
          position: relative;
          min-height: 100vh;
          min-height: 100svh;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          background: #FDF8F3;
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          padding: 32px 24px 24px;
          text-align: center;
        }

        .mnt-topline {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 3px;
          background: #8C6020;
        }

        .mnt-content {
          max-width: 480px;
        }

        .mnt-wordmark { margin-bottom: 36px; }

        .mnt-wordmark-small {
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 3px;
          color: #A08060;
          text-transform: uppercase;
        }

        .mnt-wordmark-big {
          font-size: 21px;
          font-weight: 800;
          color: #1E1208;
          margin-top: 2px;
          letter-spacing: -0.3px;
        }

        .mnt-wordmark-accent { color: #D4762A; }

        .mnt-badge {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0.4px;
          color: #8C6020;
          background: #FEF5E4;
          border: 1px solid #EAD9C4;
          padding: 6px 14px;
          border-radius: 100px;
          margin-bottom: 22px;
          text-transform: uppercase;
        }

        .mnt-badge-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #8C6020;
          animation: mnt-pulse 1.8s ease-in-out infinite;
        }

        @keyframes mnt-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(1.4); }
        }

        .mnt-headline {
          font-size: clamp(28px, 4.5vw, 40px);
          font-weight: 800;
          letter-spacing: -0.7px;
          color: #1E1208;
          margin: 0 0 16px;
          line-height: 1.2;
          text-transform: none;
        }

        .mnt-sub {
          font-size: 16px;
          line-height: 1.65;
          color: #6B4F35;
          margin: 0 0 20px;
        }

        .mnt-note {
          font-size: 13px;
          line-height: 1.6;
          color: #A08060;
          background: #FFFFFF;
          border: 1px solid #EAD9C4;
          border-radius: 10px;
          padding: 14px 18px;
          margin: 0;
        }

        .mnt-footer {
          position: relative;
          margin-top: 40px;
          font-size: 12px;
          color: #A08060;
        }

        @media (max-width: 480px) {
          .mnt-sub { font-size: 14.5px; }
          .mnt-note { font-size: 12.5px; padding: 12px 14px; }
        }
      `}</style>
    </div>
  )
}
