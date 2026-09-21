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
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: '2.5rem' }}>Last updated: August 2026</p>

        <div style={{ marginBottom: '3rem', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--page-bg)' }}>
                <th style={{ textAlign: 'left', padding: '10px 14px', fontWeight: 700, color: 'var(--text-secondary)', borderBottom: '1px solid var(--border)' }}>Data category</th>
                <th style={{ textAlign: 'left', padding: '10px 14px', fontWeight: 700, color: 'var(--text-secondary)', borderBottom: '1px solid var(--border)' }}>Collected from</th>
                <th style={{ textAlign: 'left', padding: '10px 14px', fontWeight: 700, color: 'var(--text-secondary)', borderBottom: '1px solid var(--border)' }}>Used for</th>
                <th style={{ textAlign: 'left', padding: '10px 14px', fontWeight: 700, color: 'var(--text-secondary)', borderBottom: '1px solid var(--border)' }}>Sold or used for ads?</th>
              </tr>
            </thead>
            <tbody>
              {[
                ['Identity & contact', 'Students, staff, orgs', 'Login, communication, class rosters'],
                ['Exam content & answers', 'Students, teachers, orgs', 'Delivering, grading, and reporting on exams'],
                ['Exam integrity signals', 'Students (during proctored exams)', 'Flagging possible integrity concerns for a teacher to review'],
                ['Payment records', 'Schools, organizations', 'Billing (plan, amount, reference note only, never card or bank login details)'],
                ['Technical & error data', 'Everyone', 'Keeping you logged in, diagnosing bugs (including short screen replays and click-frustration signals to help us find and fix problems)'],
                ['Chat assistant messages', 'Everyone (site visitors and logged-in users)', 'Answering questions and reviewing/improving the assistant’s answers'],
              ].map(([cat, from, use], i, arr) => (
                <tr key={cat} style={{ borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none' }}>
                  <td style={{ padding: '10px 14px', fontWeight: 600 }}>{cat}</td>
                  <td style={{ padding: '10px 14px', color: 'var(--text-secondary)' }}>{from}</td>
                  <td style={{ padding: '10px 14px', color: 'var(--text-secondary)' }}>{use}</td>
                  <td style={{ padding: '10px 14px', color: 'var(--text-secondary)' }}>Never</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <Section title="Who this applies to">
          Smart Assess (&quot;we&quot;, &quot;us&quot;) is an exam and assessment platform used by schools, their students
          and staff, and by organizations running one-off assessments. Schools and organizations are our direct
          customers; students and staff use the platform through their school&apos;s account. This policy covers
          all of them.
        </Section>

        <Section title="What we collect">
          <p style={{ marginBottom: 12 }}><strong>Students:</strong> full name, student ID, birth date, gender, grade level,
          department/class enrollment, a school email address (used for notifications like results being
          released, kept separate from the ID used to log in), exam answers and scores, and integrity
          signals during proctored exams: things like typing rhythm, fullscreen/tab-switch events, and
          paste attempts. We do not record keystroke content itself, only behavioral patterns used to flag
          possible academic integrity concerns for a teacher to review. If a teacher, supervisor, or school
          admin enables a text-to-speech accommodation for you, that setting is stored on your profile.</p>
          <p style={{ marginBottom: 12 }}><strong>Staff (teachers, HODs, school admins):</strong> full name, email address, role,
          department, and two-factor authentication enrollment status (the actual authenticator secret is
          managed by our authentication provider, Supabase, not stored by us directly).</p>
          <p style={{ marginBottom: 12 }}><strong>Organizations:</strong> organization name, contact name and email, exams and questions you
          create, whatever fields you configure to collect from your own respondents, and payment records
          (plan, amount, and a reference note for wire transfers; we never handle card numbers or bank
          login credentials).</p>
          <p style={{ marginBottom: 12 }}><strong>Everyone:</strong> basic technical data needed to run the service, such as session tokens (to keep you
          logged in), and error reports sent to our error-tracking tool (Sentry) when something breaks, which
          may include technical context like the page you were on but is not used to build a profile of you.
          When an error happens, Sentry also captures a short visual replay (roughly the 60 seconds leading up
          to it) of what was on screen, to help us understand and fix the problem; text and media are masked
          by default so exam content isn&apos;t captured in the clear. We also detect repeated frustrated
          clicking on something that isn&apos;t responding (a &quot;rage click&quot;) and report it the same
          way, with the page and element involved, so we can find and fix broken interactions.</p>
          <p>If you use the chat assistant (the &quot;?&quot; icon), we store the messages you send it and its
          replies, so we can review and improve its answers. If you&apos;re logged in when you use it, we also
          store your role (e.g. teacher, student) at the time, so we know what kind of question it was
          answering. The assistant itself is never given access to your actual account data, exam results,
          or session status, only general information about how the platform works.</p>
        </Section>

        <Section title="Why we collect it">
          Strictly to run the platform: authenticating you, delivering and grading exams, routing work to the
          right teacher, detecting technical issues, and (for organizations) billing. We do not use student or
          staff data for advertising, and we do not sell personal data to anyone, ever.
        </Section>

        <Section title="Our use of AI">
          <p style={{ marginBottom: 12 }}>Two optional features use a third-party AI service (Anthropic): polishing the wording of a question a
          teacher is writing, and extracting questions from a PDF a teacher uploads. Both are opt-in, both only
          process content a staff member explicitly submits in that moment, and both produce suggestions only.
          A human teacher always reviews and decides whether to use the output.</p>
          <p style={{ marginBottom: 12 }}>The chat assistant (the &quot;?&quot; icon) also uses Anthropic to generate its replies. It only answers
          general questions about how the platform works, using information we&apos;ve given it. It has no access
          to your account, your data, or anyone else&apos;s, and is instructed to say so and point you to a real
          person rather than guess if you ask it something account-specific.</p>
          <p>When a school or organization submits a sign-up request, we also use Anthropic to draft a short
          internal summary of that request for our own staff to review. It&apos;s never shown to the requester,
          never changes what you submitted, and never approves or rejects anything on its own; a person always
          makes that decision. We do not use AI to grade students, make integrity determinations, or make any
          decision about a student without a human reviewing it first.</p>
        </Section>

        <Section title="Who we share it with">
          <p style={{ marginBottom: 12 }}>Within a school, access is role-based and enforced at the database level. A teacher only sees
          their own students and classes, a head of department only their own department, and so on. We
          never share student data across schools or organizations; each runs on its own isolated database.</p>
          <p>We use a small number of service providers to actually run Smart Assess, each only with the access
          they need to do their specific job: Supabase (database, authentication, and file storage), Vercel
          (hosting), Resend (sending transactional email like password resets and notifications), Anthropic
          (processing exam questions you explicitly submit for AI-assisted polishing or PDF import,
          generating chat assistant replies, and drafting an internal summary of a new school/organization
          sign-up request for our staff), Sentry (error monitoring and the session replay described above),
          and Cloudflare Turnstile (verifying that submissions to public forms, like contact and signup
          requests, aren&apos;t automated bots). None of these providers can use your data for their own
          purposes.</p>
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

        <Section title="Your rights under Jamaica's Data Protection Act">
          <p style={{ marginBottom: 12 }}>We handle personal data consistent with Jamaica&apos;s Data Protection Act, 2020: we only use data
          for the purpose it was collected for, keep it secure, and don&apos;t retain it longer than necessary.
          As a data subject, you have the right to:</p>
          <ul style={{ paddingLeft: 20, marginBottom: 12 }}>
            <li style={{ marginBottom: 6 }}>Know what personal data we hold about you and why</li>
            <li style={{ marginBottom: 6 }}>Request a copy of it</li>
            <li style={{ marginBottom: 6 }}>Ask us to correct it if it&apos;s inaccurate</li>
            <li style={{ marginBottom: 6 }}>Ask us to delete it, subject to any legal or billing retention requirements</li>
            <li>Withdraw consent at any time, where processing is based on consent</li>
          </ul>
          <p style={{ marginBottom: 12 }}>To exercise any of these, contact us at the email below. Students should generally go through
          their school, since the school is our direct customer and the party best placed to verify the
          request and handle guardian consent.</p>
          <p>If we experience a data breach that affects or could affect your personal data, we will notify
          the Office of the Information Commissioner of Jamaica and affected individuals within 72 hours of
          becoming aware of it, as required by the Act. If you believe your data has been mishandled, you can
          also contact the Office of the Information Commissioner of Jamaica directly.</p>
        </Section>

        <Section title="Cookies and local storage">
          We use browser storage (cookies/local storage) to keep you logged in, and, for student accounts, to
          remember a device token used to enforce single-device login (a student can only be signed in on one
          device at a time; logging in elsewhere signs out the other session). The desktop app and exam-taking
          pages also store exam answers locally on your device (using your browser or OS&apos;s built-in
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
