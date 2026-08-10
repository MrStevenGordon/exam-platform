// Only needed for templates below that interpolate free-text staff input
// (studentNotificationEmail's message) rather than values already
// constrained elsewhere in the app.
function escapeHtml(text: string) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function wrapper(bodyHtml: string) {
  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #1A0E06; max-width: 480px; margin: 0 auto;">
      <div style="font-size: 11px; font-weight: 700; letter-spacing: 1.5px; color: #7A6A5A; text-transform: uppercase;">Smart Assess Ja</div>
      ${bodyHtml}
      <p style="font-size: 12px; color: #7A6A5A; margin-top: 32px;">The Smart Assess team</p>
    </div>
  `
}

export function submissionReceivedEmail(schoolName: string, contactName: string) {
  return {
    subject: `We've received your Smart Assess request for ${schoolName}`,
    html: wrapper(`
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
      <p>Hi ${orgName},</p>
      <p>Thanks for your payment. Your Smart Assess subscription (${planLabel}) is now active through ${new Date(periodEnd).toLocaleDateString()}.</p>
      <table style="margin: 16px 0; font-size: 14px;">
        <tr><td style="padding: 4px 12px 4px 0; color: #7A6A5A;">License key</td><td><strong>${licenseKey}</strong></td></tr>
      </table>
      <p>Keep this for your records. You can publish exams right away. No further action needed.</p>
    `),
  }
}

export function schoolSubscriptionActiveEmail(schoolName: string, planLabel: string, periodEnd: string) {
  return {
    subject: `${schoolName}'s Smart Assess subscription is active`,
    html: wrapper(`
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
      <table style="margin: 16px 0; font-size: 14px;">
        <tr><td style="padding: 4px 12px 4px 0; color: #7A6A5A;">Name</td><td>${name}</td></tr>
        <tr><td style="padding: 4px 12px 4px 0; color: #7A6A5A;">School / organization</td><td>${org}</td></tr>
        <tr><td style="padding: 4px 12px 4px 0; color: #7A6A5A;">Email</td><td>${email}</td></tr>
      </table>
      <p style="white-space: pre-wrap;">${message}</p>
    `),
  }
}

export function waitlistJoinedEmail(email: string) {
  return {
    subject: `You're on the Smart Assess Ja waitlist`,
    html: wrapper(`
      <p>Hi there,</p>
      <p>Thanks for signing up with <strong>${email}</strong>. We'll email you as soon as Smart Assess Ja is ready for schools.</p>
    `),
  }
}

export function newWaitlistSignupStaffEmail(email: string, name: string, schoolName: string) {
  return {
    subject: `New waitlist signup: ${email}`,
    html: wrapper(`
      <p>A new waitlist signup came in from the coming-soon page:</p>
      <table style="margin: 16px 0; font-size: 14px;">
        <tr><td style="padding: 4px 12px 4px 0; color: #7A6A5A;">Email</td><td>${email}</td></tr>
        ${name ? `<tr><td style="padding: 4px 12px 4px 0; color: #7A6A5A;">Name</td><td>${name}</td></tr>` : ''}
        ${schoolName ? `<tr><td style="padding: 4px 12px 4px 0; color: #7A6A5A;">School</td><td>${schoolName}</td></tr>` : ''}
      </table>
    `),
  }
}

export function newSchoolRequestStaffEmail(schoolName: string, contactName: string, contactEmail: string, reviewUrl: string) {
  return {
    subject: `New school request: ${schoolName}`,
    html: wrapper(`
      <p>A new school request needs review:</p>
      <table style="margin: 16px 0; font-size: 14px;">
        <tr><td style="padding: 4px 12px 4px 0; color: #7A6A5A;">School</td><td>${schoolName}</td></tr>
        <tr><td style="padding: 4px 12px 4px 0; color: #7A6A5A;">Contact</td><td>${contactName} (${contactEmail})</td></tr>
      </table>
      <p style="margin: 20px 0;"><a href="${reviewUrl}" style="display: inline-block; background: #D4762A; color: white; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-weight: 700;">Review request</a></p>
    `),
  }
}

export function newOrgRequestStaffEmail(orgName: string, contactName: string, contactEmail: string, reviewUrl: string) {
  return {
    subject: `New organization request: ${orgName}`,
    html: wrapper(`
      <p>A new organization request needs review:</p>
      <table style="margin: 16px 0; font-size: 14px;">
        <tr><td style="padding: 4px 12px 4px 0; color: #7A6A5A;">Organization</td><td>${orgName}</td></tr>
        <tr><td style="padding: 4px 12px 4px 0; color: #7A6A5A;">Contact</td><td>${contactName} (${contactEmail})</td></tr>
      </table>
      <p style="margin: 20px 0;"><a href="${reviewUrl}" style="display: inline-block; background: #D4762A; color: white; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-weight: 700;">Review request</a></p>
    `),
  }
}

export function orgRequestReceivedEmail(orgName: string, contactName: string) {
  return {
    subject: `We've received your Smart Assess request for ${orgName}`,
    html: wrapper(`
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
      <p>Hi ${contactName},</p>
      <p>Great news! Your request for <strong>${orgName}</strong> has been accepted.</p>
      <p>Click below to create your account. You'll be the administrator for your organization:</p>
      <p style="margin: 20px 0;"><a href="${setupLink}" style="display: inline-block; background: #D4762A; color: white; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-weight: 700;">Set up my organization</a></p>
      <p style="font-size: 12px; color: #7A6A5A;">This link can only be used once. If it's already been used, contact us for a new one.</p>
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
      <p>Hi ${contactName},</p>
      <p><strong>${schoolName}</strong>'s Smart Assess portal is ready.</p>
      <p>Click below to create your admin account. You'll be the first administrator for your school's portal:</p>
      <p style="margin: 20px 0;"><a href="${setupLink}" style="display: inline-block; background: #D4762A; color: white; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-weight: 700;">Set up my school</a></p>
      <p style="font-size: 12px; color: #7A6A5A;">This link can only be used once. If it's already been used, contact us for a new one.</p>
    `),
  }
}

export function studentWelcomeEmail(fullName: string, loginId: string, tempPassword: string) {
  return {
    subject: `Your Smart Assess account is ready`,
    html: wrapper(`
      <p>Hi ${fullName},</p>
      <p>Your Smart Assess account has been created. Use these details to log in:</p>
      <p style="margin: 16px 0; padding: 14px 16px; background: #FEF5E4; border-radius: 8px;">
        <strong>Login ID:</strong> ${loginId}<br />
        <strong>Temporary password:</strong> ${tempPassword}
      </p>
      <p>You'll be asked to set your own password the first time you log in.</p>
      <p style="font-size: 12px; color: #7A6A5A;">This is a notification-only address — replies to this email aren't monitored.</p>
    `),
  }
}

export function resultsReleasedEmail(fullName: string, examTitle: string) {
  return {
    subject: `Your results for ${examTitle} are available`,
    html: wrapper(`
      <p>Hi ${fullName},</p>
      <p>Your results for <strong>${examTitle}</strong> have been released. Log in to Smart Assess to view them.</p>
      <p style="font-size: 12px; color: #7A6A5A;">This is a notification-only address — replies to this email aren't monitored.</p>
    `),
  }
}

export function studentNotificationEmail(fullName: string, senderName: string, subject: string, message: string) {
  return {
    subject,
    html: wrapper(`
      <p>Hi ${escapeHtml(fullName)},</p>
      <p style="white-space: pre-wrap;">${escapeHtml(message)}</p>
      <p style="font-size: 12px; color: #7A6A5A; margin-top: 24px;">Sent by ${escapeHtml(senderName)} via Smart Assess. This is a notification-only address — replies to this email aren't monitored.</p>
    `),
  }
}
