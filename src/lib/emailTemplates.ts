function wrapper(bodyHtml: string) {
  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #1A0E06; max-width: 480px; margin: 0 auto;">
      <div style="font-size: 11px; font-weight: 700; letter-spacing: 1.5px; color: #7A6A5A; text-transform: uppercase;">Smart Assess Ja</div>
      ${bodyHtml}
      <p style="font-size: 12px; color: #7A6A5A; margin-top: 32px;">— The Smart Assess team</p>
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
      <p>Great news — your request for <strong>${schoolName}</strong> has been accepted.</p>
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
      <p>Thanks for your payment — your Smart Assess subscription (${planLabel}) is now active through ${new Date(periodEnd).toLocaleDateString()}.</p>
      <table style="margin: 16px 0; font-size: 14px;">
        <tr><td style="padding: 4px 12px 4px 0; color: #7A6A5A;">License key</td><td><strong>${licenseKey}</strong></td></tr>
      </table>
      <p>Keep this for your records. You can publish exams right away — no further action needed.</p>
    `),
  }
}

export function schoolLicenseKeyEmail(schoolName: string, licenseKey: string, planLabel: string, periodEnd: string, downloadUrl: string) {
  return {
    subject: `${schoolName}'s Smart Assess subscription is active`,
    html: wrapper(`
      <p>Hi ${schoolName},</p>
      <p>Thanks for your payment — your Smart Assess subscription (${planLabel}) is now active through ${new Date(periodEnd).toLocaleDateString()}.</p>
      <table style="margin: 16px 0; font-size: 14px;">
        <tr><td style="padding: 4px 12px 4px 0; color: #7A6A5A;">License key</td><td><strong>${licenseKey}</strong></td></tr>
      </table>
      <p>Download the Smart Assess desktop app and enter this key when prompted to activate it:</p>
      <p style="margin: 20px 0;"><a href="${downloadUrl}" style="display: inline-block; background: #D4762A; color: white; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-weight: 700;">Download Smart Assess</a></p>
      <p style="font-size: 12px; color: #7A6A5A;">Keep this key for your records — you'll only need to enter it once per computer.</p>
    `),
  }
}

export function credentialsEmail(schoolName: string, contactName: string, setupLink: string) {
  return {
    subject: `${schoolName}'s Smart Assess portal is ready`,
    html: wrapper(`
      <p>Hi ${contactName},</p>
      <p><strong>${schoolName}</strong>'s Smart Assess portal is ready.</p>
      <p>Click below to create your admin account — you'll be the first administrator for your school's portal:</p>
      <p style="margin: 20px 0;"><a href="${setupLink}" style="display: inline-block; background: #D4762A; color: white; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-weight: 700;">Set up my school</a></p>
      <p style="font-size: 12px; color: #7A6A5A;">This link can only be used once. If it's already been used, contact us for a new one.</p>
    `),
  }
}
