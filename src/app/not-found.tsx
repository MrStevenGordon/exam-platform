import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Page Not Found | Smart Assess Ja',
  description: 'This page could not be found.',
}

export default function NotFound() {
  return (
    <div className="nf-page">
      <div className="nf-topline" />

      <main className="nf-content">
        <div className="nf-wordmark">
          <div className="nf-wordmark-small">SMART ASSESS JA</div>
          <div className="nf-wordmark-big">
            Smart <span className="nf-wordmark-accent">Assess</span>
          </div>
        </div>

        <div className="nf-code">404</div>
        <h1 className="nf-headline">Page not found.</h1>
        <p className="nf-sub">
          The page you&apos;re looking for doesn&apos;t exist, or the link may be out of date.
        </p>

        <Link href="/" className="nf-home-link">Back to home</Link>
      </main>

      <footer className="nf-footer">&copy; 2026 Smart Assess Ja</footer>

      <style>{`
        .nf-page {
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

        .nf-topline {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 3px;
          background: #8C6020;
        }

        .nf-content { max-width: 480px; }

        .nf-wordmark { margin-bottom: 36px; }

        .nf-wordmark-small {
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 3px;
          color: #A08060;
          text-transform: uppercase;
        }

        .nf-wordmark-big {
          font-size: 21px;
          font-weight: 800;
          color: #1E1208;
          margin-top: 2px;
          letter-spacing: -0.3px;
        }

        .nf-wordmark-accent { color: #D4762A; }

        .nf-code {
          font-size: 15px;
          font-weight: 700;
          letter-spacing: 0.4px;
          color: #8C6020;
          background: #FEF5E4;
          border: 1px solid #EAD9C4;
          padding: 6px 14px;
          border-radius: 100px;
          margin-bottom: 22px;
          display: inline-block;
        }

        .nf-headline {
          font-size: clamp(28px, 4.5vw, 40px);
          font-weight: 800;
          letter-spacing: -0.7px;
          color: #1E1208;
          margin: 0 0 16px;
          line-height: 1.2;
        }

        .nf-sub {
          font-size: 16px;
          line-height: 1.65;
          color: #6B4F35;
          margin: 0 0 28px;
        }

        .nf-home-link {
          display: inline-block;
          font-size: 14px;
          font-weight: 700;
          color: #FFFFFF;
          background: #D4762A;
          padding: 12px 24px;
          border-radius: 8px;
          text-decoration: none;
        }

        .nf-home-link:hover { background: #B85F1D; }

        .nf-footer {
          position: relative;
          margin-top: 40px;
          font-size: 12px;
          color: #A08060;
        }

        @media (max-width: 480px) {
          .nf-sub { font-size: 14.5px; }
        }
      `}</style>
    </div>
  )
}
