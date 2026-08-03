import Link from 'next/link'

export const metadata = { title: 'Terms of Service — Smart Assess' }

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: '2.5rem' }}>
      <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: '0.75rem', textTransform: 'none', color: 'var(--text-primary)' }}>{title}</h2>
      <div style={{ fontSize: 15, color: 'var(--text-secondary)', lineHeight: 1.75 }}>{children}</div>
    </section>
  )
}

export default function TermsOfServicePage() {
  return (
    <div style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', color: 'var(--text-primary)' }}>
      <nav style={{ padding: '1.25rem 3rem', borderBottom: '1px solid var(--border)', background: 'var(--card-bg)' }}>
        <Link href="/" style={{ textDecoration: 'none' }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.5, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Smart Assess Ja</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginTop: -2 }}>Smart Assess</div>
        </Link>
      </nav>

      <div style={{ maxWidth: 720, margin: '0 auto', padding: '4rem 24px' }}>
        <h1 style={{ fontSize: 32, fontWeight: 800, marginBottom: 8, textTransform: 'none' }}>Terms of Service</h1>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: '3rem' }}>Last updated: August 2026</p>

        <div className="banner banner-warning" style={{ marginBottom: '2.5rem', fontSize: 13 }}>
          This is a plain-language draft describing how Smart Assess is actually meant to be used. It has
          not been reviewed by a lawyer and isn&apos;t a substitute for one if you need a formally vetted
          contract.
        </div>

        <Section title="1. Agreement to these terms">
          By creating an account, submitting a Build My School request, signing up as an organization, or
          using Smart Assess in any way, you agree to these terms. If you&apos;re agreeing on behalf of a
          school or organization, you&apos;re confirming you have the authority to do so.
        </Section>

        <Section title="2. What Smart Assess is">
          Smart Assess is an online exam and assessment platform. Schools get a fully configured portal for
          creating, reviewing, publishing, and grading exams, with a review workflow that adapts to how the
          school actually operates. Organizations can publish one-off assessments for anonymous respondents
          without setting up a full roster. A desktop app is available for students taking exams, built for
          resilience against unreliable internet connections.
        </Section>

        <Section title="3. Accounts and responsibilities">
          <p style={{ marginBottom: 12 }}>You&apos;re responsible for keeping your login credentials confidential and for all activity under
          your account. Staff accounts require two-factor authentication. If you believe your account has
          been compromised, contact us immediately.</p>
          <p>Schools are responsible for the accuracy of student and staff data they enter, for obtaining any
          consent required from students or guardians, and for how their staff use the platform. Organizations
          are responsible for the content of exams they publish and for how they collect and use respondent
          data through Smart Assess.</p>
        </Section>

        <Section title="4. Acceptable use">
          You agree not to: use the platform to cheat on or facilitate cheating in an exam you&apos;re taking;
          attempt to access another school&apos;s or organization&apos;s data; attempt to bypass exam integrity
          features (fullscreen lock, tab-switch detection, single-device login); upload unlawful, harmful, or
          infringing content; or attempt to disrupt, flood, or gain unauthorized access to the platform,
          including through automated bots or scripts.
        </Section>

        <Section title="5. Subscriptions and payment">
          <p style={{ marginBottom: 12 }}>Schools and organizations pay for Smart Assess on a subscription basis (3-month, 6-month, or
          yearly plans). Given regional payment processor limitations, payment is currently handled by bank
          wire transfer — you send proof of payment, and we manually activate or renew your subscription
          once confirmed. We don&apos;t store your card or bank login details at any point.</p>
          <p>If a subscription lapses, access for that school or organization&apos;s accounts is suspended until
          it&apos;s renewed. We&apos;ll make reasonable efforts to notify you before this happens.</p>
        </Section>

        <Section title="6. Exam integrity features">
          Timed and proctored exams use fullscreen lock, tab-switch detection, and single-device login to
          help maintain exam integrity, and log signals a teacher can review for potential academic integrity
          concerns. These tools are aids for the school&apos;s own review process — Smart Assess never
          automatically penalizes a student based on these signals; a human always makes that call.
        </Section>

        <Section title="7. Availability and changes">
          We aim to keep Smart Assess available and reliable, but we don&apos;t guarantee uninterrupted access
          — maintenance, third-party outages, or unforeseen issues can occasionally affect availability. We
          may update or add features over time, and may update these terms; material changes will be
          communicated to school administrators.
        </Section>

        <Section title="8. Limitation of liability">
          Smart Assess is provided on an &quot;as is&quot; basis. To the fullest extent permitted by law, we
          aren&apos;t liable for indirect or consequential damages arising from use of the platform. Nothing
          in these terms limits liability that can&apos;t be limited under Jamaican law.
        </Section>

        <Section title="9. Termination">
          We may suspend or terminate an account that violates these terms, particularly the acceptable use
          section. Schools and organizations may cancel their subscription at any time; access continues
          through the end of the paid period.
        </Section>

        <Section title="10. Governing law">
          These terms are governed by the laws of Jamaica.
        </Section>

        <Section title="11. Contact">
          Questions about these terms can be sent to{' '}
          <a href="mailto:legal@smartassessja.com" style={{ color: 'var(--accent-dark)', fontWeight: 600 }}>legal@smartassessja.com</a>.
        </Section>

        <p style={{ marginTop: '3rem' }}>
          <Link href="/privacy" style={{ color: 'var(--accent-dark)', fontWeight: 600, fontSize: 14 }}>Read our Privacy Policy →</Link>
        </p>
      </div>
    </div>
  )
}
