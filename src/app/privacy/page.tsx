import Link from 'next/link'

export const metadata = { title: 'Privacy Policy | Smart Assess' }

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: '2.5rem' }}>
      <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: '0.75rem', textTransform: 'none', color: 'var(--text-primary)' }}>{title}</h2>
      <div style={{ fontSize: 15, color: 'var(--text-secondary)', lineHeight: 1.75 }}>{children}</div>
    </section>
  )
}

export default function PrivacyPolicyPage() {
  return (
    <div style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', color: 'var(--text-primary)' }}>
      <nav style={{ padding: '1.25rem 3rem', borderBottom: '1px solid var(--border)', background: 'var(--card-bg)' }}>
        <Link href="/" style={{ textDecoration: 'none' }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.5, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Smart Assess Ja</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginTop: -2 }}>Smart Assess</div>
        </Link>
      </nav>

      <div style={{ maxWidth: 720, margin: '0 auto', padding: '4rem 24px' }}>
        <h1 style={{ fontSize: 32, fontWeight: 800, marginBottom: 8, textTransform: 'none' }}>Privacy Policy</h1>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: '3rem' }}>Last updated: August 2026</p>

        <div className="banner banner-warning" style={{ marginBottom: '2.5rem', fontSize: 13 }}>
          This policy describes what Smart Assess actually collects and does with data, in plain terms.
          It has not been reviewed by a lawyer. If you have specific legal or compliance questions, please
          consult one before relying on it for a formal compliance requirement.
        </div>

        <Section title="Who this applies to">
          Smart Assess (&quot;we&quot;, &quot;us&quot;) is an exam and assessment platform used by schools, their students
          and staff, and by organizations running one-off assessments. Schools and organizations are our direct
          customers; students and staff use the platform through their school&apos;s account. This policy covers
          all of them.
        </Section>

        <Section title="What we collect">
          <p style={{ marginBottom: 12 }}><strong>Students:</strong> full name, student ID, birth date, gender, grade level,
          department/class enrollment, exam answers and scores, and integrity signals during proctored
          exams: things like typing rhythm, fullscreen/tab-switch events, and paste attempts. We do not
          record keystroke content itself, only behavioral patterns used to flag possible academic
          integrity concerns for a teacher to review.</p>
          <p style={{ marginBottom: 12 }}><strong>Staff (teachers, supervisors, school admins):</strong> full name, email address, role,
          department, and two-factor authentication enrollment status (the actual authenticator secret is
          managed by our authentication provider, Supabase, not stored by us directly).</p>
          <p style={{ marginBottom: 12 }}><strong>Organizations:</strong> organization name, contact name and email, exams and questions you
          create, whatever fields you configure to collect from your own respondents, and payment records
          (plan, amount, and a reference note for wire transfers; we never handle card numbers or bank
          login credentials).</p>
          <p><strong>Everyone:</strong> basic technical data needed to run the service, such as session tokens (to keep you
          logged in), and error reports sent to our error-tracking tool (Sentry) when something breaks, which
          may include technical context like the page you were on but is not used to build a profile of you.</p>
        </Section>

        <Section title="Why we collect it">
          Strictly to run the platform: authenticating you, delivering and grading exams, routing work to the
          right teacher, detecting technical issues, and (for organizations) billing. We do not use student or
          staff data for advertising, and we do not sell personal data to anyone, ever.
        </Section>

        <Section title="Who we share it with">
          <p style={{ marginBottom: 12 }}>Within a school, access is role-based and enforced at the database level. A teacher only sees
          their own students and classes, a department supervisor only their own department, and so on. We
          never share student data across schools or organizations; each runs on its own isolated database.</p>
          <p>We use a small number of service providers to actually run Smart Assess, each only with the access
          they need to do their specific job: Supabase (database, authentication, and file storage), Vercel
          (hosting), Resend (sending transactional email like password resets and notifications), Anthropic
          (processing exam questions you explicitly submit for AI-assisted polishing or PDF import), and
          Sentry (error monitoring). None of these providers can use your data for their own purposes.</p>
        </Section>

        <Section title="How long we keep it">
          School and student data is retained for as long as your school&apos;s subscription is active, plus a
          reasonable period afterward in case of billing disputes or reinstatement. Anonymous organization
          respondent data is deleted automatically after a retention period your organization configures per
          exam. You can request deletion of your data at any time by contacting us (see below).
        </Section>

        <Section title="How we protect it">
          Every table in our database enforces row-level security, meaning access rules are checked by the
          database itself, not just by application code. Staff accounts require two-factor authentication.
          All traffic is encrypted in transit (HTTPS). We do not store card or bank login details. Payments
          are either handled by a third-party processor or via manual bank transfer with a reference note only.
          We also run periodic internal security reviews of the platform.
        </Section>

        <Section title="Students and children">
          Many of our users are minors. We collect the minimum student data needed to run exams and report
          results, and access to it is scoped to the student&apos;s own school. Because students use Smart Assess
          through their school, the school (as our direct customer) is responsible for obtaining any parental
          or guardian consent required under its own policies and applicable law before enrolling a student.
        </Section>

        <Section title="Jamaica's Data Protection Act">
          We aim to handle personal data consistent with Jamaica&apos;s Data Protection Act, 2020, including
          using data only for the purpose it was collected for, keeping it secure, and not retaining it
          longer than necessary. If you believe your data has been mishandled, you may also contact the
          Office of the Information Commissioner of Jamaica.
        </Section>

        <Section title="Cookies and local storage">
          We use browser storage (cookies/local storage) to keep you logged in and to remember a small amount
          of device information used to enforce single-device login for students during active sessions. The
          desktop app stores exam answers locally on your device (using your browser or OS&apos;s built-in
          storage) so nothing is lost if your internet connection drops, syncing to our servers once
          you&apos;re back online.
        </Section>

        <Section title="Changes to this policy">
          If we make a material change to how we handle data, we&apos;ll update the date at the top of this
          page and, where appropriate, notify school administrators directly.
        </Section>

        <Section title="Contact us">
          Questions about this policy, or requests to access or delete your data, can be sent to{' '}
          <a href="mailto:privacy@smartassessja.com" style={{ color: 'var(--accent-dark)', fontWeight: 600 }}>privacy@smartassessja.com</a>.
        </Section>

        <p style={{ marginTop: '3rem' }}>
          <Link href="/terms" style={{ color: 'var(--accent-dark)', fontWeight: 600, fontSize: 14 }}>Read our Terms of Service →</Link>
        </p>
      </div>
    </div>
  )
}
