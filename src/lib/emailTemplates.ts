// Needed for any template below that interpolates free-text input from a
// staff member or an unauthenticated public form (contact/investor/waitlist/
// school/org requests, pitch NDA acceptance), rather than values already
// constrained elsewhere in the app.
function escapeHtml(text: string) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

// Same warm orange/cream palette as globals.css (--accent, --page-bg, etc).
// Hardcoded rather than referencing CSS variables because email clients
// don't reliably support them.
const COLOR = {
  pageBg: '#FDF8F3',
  cardBg: '#FFFFFF',
  accent: '#D4762A',
  accentDark: '#A85A18',
  accentMid: '#E8924A',
  accentLight: '#FAE8D4',
  textPrimary: '#1E1208',
  textSecondary: '#6B4F35',
  textMuted: '#A08060',
  border: '#EAD9C4',
  successFg: '#2D7A4F',
  successBg: '#E6F4ED',
  warningFg: '#8C6020',
  warningBg: '#FEF5E4',
}

const FONT = "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"

function wrapper(bodyHtml: string) {
  return `
    <div style="background: ${COLOR.pageBg}; padding: 40px 16px; font-family: ${FONT};">
      <div style="max-width: 560px; margin: 0 auto; background: ${COLOR.cardBg}; border: 1px solid ${COLOR.border}; border-radius: 14px; overflow: hidden; box-shadow: 0 1px 2px rgba(80,40,10,0.06);">
        <div style="height: 4px; background: linear-gradient(90deg, ${COLOR.accent}, ${COLOR.accentMid});"></div>
        <div style="padding: 30px 36px 4px;">
          <div style="font-size: 11px; font-weight: 700; letter-spacing: 2px; color: ${COLOR.textMuted}; text-transform: uppercase;">Smart Assess Ja</div>
        </div>
        <div style="padding: 10px 36px 32px; color: ${COLOR.textPrimary}; font-size: 15px; line-height: 1.65;">
          ${bodyHtml}
        </div>
        <div style="padding: 18px 36px; background: ${COLOR.pageBg}; border-top: 1px solid ${COLOR.border};">
          <p style="font-size: 12px; color: ${COLOR.textMuted}; margin: 0;">
            The Smart Assess Ja team &middot; <a href="https://smartassessja.com" style="color: ${COLOR.textMuted};">smartassessja.com</a>
          </p>
        </div>
      </div>
    </div>
  `
}

function badge(label: string, tone: 'success' | 'warning' | 'accent' = 'accent') {
  const tones = {
    success: { bg: COLOR.successBg, fg: COLOR.successFg },
    warning: { bg: COLOR.warningBg, fg: COLOR.warningFg },
    accent: { bg: COLOR.accentLight, fg: COLOR.accentDark },
  }
  const c = tones[tone]
  return `<span style="display: inline-block; background: ${c.bg}; color: ${c.fg}; font-size: 11.5px; font-weight: 700; letter-spacing: 0.5px; text-transform: uppercase; padding: 5px 12px; border-radius: 100px; margin-bottom: 16px;">${label}</span>`
}

function button(label: string, href: string) {
  return `<p style="margin: 24px 0;"><a href="${href}" style="display: inline-block; background: ${COLOR.accent}; color: #FFFFFF; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 700; font-size: 14px;">${label}</a></p>`
}

function infoBox(rows: Array<[string, string]>) {
  const rowsHtml = rows
    .map(
      ([label, value]) => `
        <tr>
          <td style="padding: 6px 0; color: ${COLOR.textMuted}; font-size: 13px; width: 130px; vertical-align: top; white-space: nowrap;">${label}</td>
          <td style="padding: 6px 0; color: ${COLOR.textPrimary}; font-size: 14px; font-weight: 600;">${value}</td>
        </tr>
      `
    )
    .join('')
  return `
    <div style="background: ${COLOR.pageBg}; border: 1px solid ${COLOR.border}; border-radius: 10px; padding: 14px 20px; margin: 18px 0;">
      <table style="width: 100%; border-collapse: collapse;"><tbody>${rowsHtml}</tbody></table>
    </div>
  `
}

function finePrint(text: string) {
  return `<p style="font-size: 12px; color: ${COLOR.textMuted}; margin-top: 24px;">${text}</p>`
}

export function submissionReceivedEmail(schoolName: string, contactName: string) {
  return {
    subject: `We've received your Smart Assess request for ${schoolName}`,
    html: wrapper(`
      ${badge('Request received')}
      <p>Hi ${contactName},</p>
      <p>Thanks for your interest in Smart Assess for <strong>${schoolName}</strong>. Your request has been submitted and is now under review.</p>
      <p>We'll follow up once we've had a chance to look it over.</p>
    `),
  }
}

export function acceptedEmail(schoolName: string, contactName: string) {
  return {
    subject: `${schoolName} has been accepted onto Smart Assess`,
    html: wrapper(`
      ${badge('Accepted', 'success')}
      <p>Hi ${contactName},</p>
      <p>Great news! Your request for <strong>${schoolName}</strong> has been accepted.</p>
      <p>We'll be in touch shortly to begin building your school's portal. This typically takes 2–3 weeks. Once it's ready, we'll send your login details in a follow-up email.</p>
    `),
  }
}

export function rejectedEmail(schoolName: string, contactName: string) {
  return {
    subject: `Update on your Smart Assess request for ${schoolName}`,
    html: wrapper(`
      <p>Hi ${contactName},</p>
      <p>Thank you for your interest in Smart Assess for <strong>${schoolName}</strong>. After review, we're not able to move forward with this request at this time.</p>
    `),
  }
}

export function licenseKeyEmail(orgName: string, licenseKey: string, planLabel: string, periodEnd: string) {
  return {
    subject: `${orgName}'s Smart Assess subscription is active`,
    html: wrapper(`
      ${badge('Subscription active', 'success')}
      <p>Hi ${orgName},</p>
      <p>Thanks for your payment. Your Smart Assess subscription (${planLabel}) is now active through ${new Date(periodEnd).toLocaleDateString()}.</p>
      ${infoBox([['License key', `<span style="font-family: ui-monospace, SFMono-Regular, Menlo, monospace;">${licenseKey}</span>`]])}
      <p>Keep this for your records. You can publish exams right away. No further action needed.</p>
    `),
  }
}

export function schoolSubscriptionActiveEmail(schoolName: string, planLabel: string, periodEnd: string) {
  return {
    subject: `${schoolName}'s Smart Assess subscription is active`,
    html: wrapper(`
      ${badge('Subscription active', 'success')}
      <p>Hi ${schoolName},</p>
      <p>Thanks for your payment. Your Smart Assess subscription (${planLabel}) is now active through ${new Date(periodEnd).toLocaleDateString()}.</p>
      <p>No further action needed. Everyone at your school can log in normally, on the website or the desktop app, right away.</p>
    `),
  }
}

export function contactInquiryEmail(name: string, org: string, email: string, message: string) {
  return {
    subject: `New inquiry from ${org}`,
    html: wrapper(`
      <p>New message from the homepage contact form:</p>
      ${infoBox([
        ['Name', escapeHtml(name)],
        ['School / organization', escapeHtml(org)],
        ['Email', escapeHtml(email)],
      ])}
      <p style="white-space: pre-wrap; padding: 14px 18px; background: ${COLOR.pageBg}; border-left: 3px solid ${COLOR.accent}; border-radius: 4px;">${escapeHtml(message)}</p>
    `),
  }
}

export function waitlistJoinedEmail(email: string) {
  return {
    subject: `You're on the Smart Assess Ja waitlist`,
    html: wrapper(`
      ${badge("You're on the list")}
      <p>Hi there,</p>
      <p>Thanks for signing up with <strong>${email}</strong>. We'll email you as soon as Smart Assess Ja is ready for schools.</p>
    `),
  }
}

export function investorInquiryReceivedEmail(name: string) {
  return {
    subject: `Thanks for your interest in Smart Assess Ja`,
    html: wrapper(`
      ${badge('Received')}
      <p>Hi ${name},</p>
      <p>Thanks for reaching out about Smart Assess Ja. We've received your details and someone from our team will follow up directly.</p>
    `),
  }
}

export function newInvestorInquiryStaffEmail(name: string, email: string, firm: string, note: string) {
  return {
    subject: `New investor inquiry: ${name}${firm ? ` (${firm})` : ''}`,
    html: wrapper(`
      <p>A new investor inquiry came in from the coming-soon page:</p>
      ${infoBox([
        ['Name', escapeHtml(name)],
        ['Email', escapeHtml(email)],
        ...(firm ? [['Firm', escapeHtml(firm)] as [string, string]] : []),
      ])}
      ${note ? `<p style="white-space: pre-wrap; padding: 14px 18px; background: ${COLOR.pageBg}; border-left: 3px solid ${COLOR.accent}; border-radius: 4px;">${escapeHtml(note)}</p>` : ''}
    `),
  }
}

export function newPitchNdaAcceptanceStaffEmail(deck: string, name: string, organization: string, email: string) {
  return {
    subject: `NDA accepted: ${organization} (${deck} deck)`,
    html: wrapper(`
      <p>Someone just agreed to the NDA and viewed the pitch deck:</p>
      ${infoBox([
        ['Deck', escapeHtml(deck)],
        ['Name', escapeHtml(name)],
        ['Organization', escapeHtml(organization)],
        ['Email', escapeHtml(email)],
      ])}
    `),
  }
}

export function newWaitlistSignupStaffEmail(email: string, name: string, schoolName: string) {
  return {
    subject: `New waitlist signup: ${email}`,
    html: wrapper(`
      <p>A new waitlist signup came in from the coming-soon page:</p>
      ${infoBox([
        ['Email', escapeHtml(email)],
        ...(name ? [['Name', escapeHtml(name)] as [string, string]] : []),
        ...(schoolName ? [['School', escapeHtml(schoolName)] as [string, string]] : []),
      ])}
    `),
  }
}

export function newSchoolRequestStaffEmail(schoolName: string, contactName: string, contactEmail: string, reviewUrl: string) {
  return {
    subject: `New school request: ${schoolName}`,
    html: wrapper(`
      <p>A new school request needs review:</p>
      ${infoBox([
        ['School', escapeHtml(schoolName)],
        ['Contact', `${escapeHtml(contactName)} (${escapeHtml(contactEmail)})`],
      ])}
      ${button('Review request', reviewUrl)}
    `),
  }
}

export function newOrgRequestStaffEmail(orgName: string, contactName: string, contactEmail: string, reviewUrl: string) {
  return {
    subject: `New organization request: ${orgName}`,
    html: wrapper(`
      <p>A new organization request needs review:</p>
      ${infoBox([
        ['Organization', escapeHtml(orgName)],
        ['Contact', `${escapeHtml(contactName)} (${escapeHtml(contactEmail)})`],
      ])}
      ${button('Review request', reviewUrl)}
    `),
  }
}

export function orgRequestReceivedEmail(orgName: string, contactName: string) {
  return {
    subject: `We've received your Smart Assess request for ${orgName}`,
    html: wrapper(`
      ${badge('Request received')}
      <p>Hi ${contactName},</p>
      <p>Thanks for your interest in Smart Assess for <strong>${orgName}</strong>. Your request has been submitted and is now under review.</p>
      <p>We'll follow up once we've had a chance to look it over.</p>
    `),
  }
}

export function orgRequestAcceptedEmail(orgName: string, contactName: string, setupLink: string) {
  return {
    subject: `${orgName} has been accepted onto Smart Assess`,
    html: wrapper(`
      ${badge('Accepted', 'success')}
      <p>Hi ${contactName},</p>
      <p>Great news! Your request for <strong>${orgName}</strong> has been accepted.</p>
      <p>Click below to create your account. You'll be the administrator for your organization:</p>
      ${button('Set up my organization', setupLink)}
      ${finePrint("This link can only be used once. If it's already been used, contact us for a new one.")}
    `),
  }
}

export function orgRequestRejectedEmail(orgName: string, contactName: string) {
  return {
    subject: `Update on your Smart Assess request for ${orgName}`,
    html: wrapper(`
      <p>Hi ${contactName},</p>
      <p>Thank you for your interest in Smart Assess for <strong>${orgName}</strong>. After review, we're not able to move forward with this request at this time.</p>
    `),
  }
}

export function credentialsEmail(schoolName: string, contactName: string, setupLink: string) {
  return {
    subject: `${schoolName}'s Smart Assess portal is ready`,
    html: wrapper(`
      ${badge('Portal ready', 'success')}
      <p>Hi ${contactName},</p>
      <p><strong>${schoolName}</strong>'s Smart Assess portal is ready.</p>
      <p>Click below to create your admin account. You'll be the first administrator for your school's portal:</p>
      ${button('Set up my school', setupLink)}
      ${finePrint("This link can only be used once. If it's already been used, contact us for a new one.")}
    `),
  }
}

export function studentWelcomeEmail(fullName: string, loginId: string, tempPassword: string) {
  return {
    subject: `Your Smart Assess account is ready`,
    html: wrapper(`
      <p>Hi ${fullName},</p>
      <p>Your Smart Assess account has been created. Use these details to log in:</p>
      ${infoBox([
        ['Login ID', `<span style="font-family: ui-monospace, SFMono-Regular, Menlo, monospace;">${loginId}</span>`],
        ['Temporary password', `<span style="font-family: ui-monospace, SFMono-Regular, Menlo, monospace;">${tempPassword}</span>`],
      ])}
      <p>You'll be asked to set your own password the first time you log in.</p>
      ${finePrint('This is a notification-only address — replies to this email aren\'t monitored.')}
    `),
  }
}

export function resultsReleasedEmail(fullName: string, examTitle: string) {
  return {
    subject: `Your results for ${examTitle} are available`,
    html: wrapper(`
      ${badge('Results ready', 'success')}
      <p>Hi ${fullName},</p>
      <p>Your results for <strong>${examTitle}</strong> have been released. Log in to Smart Assess to view them.</p>
      ${finePrint('This is a notification-only address — replies to this email aren\'t monitored.')}
    `),
  }
}

export function studentNotificationEmail(fullName: string, senderName: string, subject: string, message: string) {
  return {
    subject,
    html: wrapper(`
      <p>Hi ${escapeHtml(fullName)},</p>
      <p style="white-space: pre-wrap;">${escapeHtml(message)}</p>
      ${finePrint(`Sent by ${escapeHtml(senderName)} via Smart Assess. This is a notification-only address — replies to this email aren't monitored.`)}
    `),
  }
}
