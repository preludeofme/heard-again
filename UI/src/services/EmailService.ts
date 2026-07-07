import { logger } from '@/lib/logger'

interface SendEmailParams {
  to: string | string[]
  subject: string
  html: string
  replyTo?: string
}

export class EmailService {
  private static apiKey = process.env.RESEND_API_KEY
  private static fromEmail = process.env.EMAIL_FROM || 'Heard Again <no-reply@heardagain.com>'
  private static supportEmail = process.env.SUPPORT_EMAIL || 'ryan@trubuckdesign.com'

  /**
   * Send an email using Resend API
   */
  static async sendEmail(params: SendEmailParams): Promise<boolean> {
    if (!this.apiKey) {
      logger.warn('[EmailService] RESEND_API_KEY not configured; logging email content instead')
      logger.info({
        to: params.to,
        subject: params.subject,
        htmlSnippet: params.html.substring(0, 200) + '...',
        ...(params.replyTo ? { replyTo: params.replyTo } : {})
      }, 'Simulated Email Sent')
      return true
    }

    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: this.fromEmail,
          to: Array.isArray(params.to) ? params.to : [params.to],
          subject: params.subject,
          html: params.html,
          ...(params.replyTo ? { reply_to: params.replyTo } : {}),
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        logger.error('[EmailService] Resend API error:', errorData)
        return false
      }

      return true
    } catch (error) {
      logger.error('[EmailService] Failed to send email:', error)
      return false
    }
  }

  /**
   * Send familyspace invitation email
   */
  static async sendInviteEmail(params: {
    to: string
    invitedByName: string
    familyspaceName: string
    inviteToken: string
    baseUrl: string
  }): Promise<boolean> {
    const inviteUrl = `${params.baseUrl}/invites/accept?token=${params.inviteToken}`
    
    return this.sendEmail({
      to: params.to,
      subject: `Join ${params.familyspaceName} on Heard Again`,
      html: `
        <div style="font-family: 'Newsreader', serif, Arial; line-height: 1.6; color: #16334a; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #d0e3e6; borderRadius: 8px;">
          <h2 style="color: #16334a; border-bottom: 2px solid #16334a; padding-bottom: 10px;">You've been invited!</h2>
          <p>Hi there,</p>
          <p><strong>${params.invitedByName}</strong> has invited you to join the <strong>${params.familyspaceName}</strong> familyspace on <strong>Heard Again</strong>.</p>
          <p>Heard Again is a family history preservation platform where we collect stories, digitize memories, and preserve the voices of our loved ones.</p>
          <div style="margin: 30px 0; text-align: center;">
            <a href="${inviteUrl}" style="background-color: #16334a; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold; display: inline-block;">Accept Invitation</a>
          </div>
          <p style="font-size: 0.9rem; color: #546669;">If you don't have an account yet, you'll be able to create one for free after clicking the button above.</p>
          <p style="font-size: 0.8rem; color: #8a9a9d; margin-top: 40px; border-top: 1px solid #f0ede8; padding-top: 20px;">
            This invitation was sent by ${params.invitedByName} via <a href="${params.baseUrl}" style="color: #16334a;">Heard Again</a>.
          </p>
        </div>
      `
    })
  }

  /**
   * Send welcome email to new users
   */
  static async sendWelcomeEmail(params: {
    to: string
    userName: string
    baseUrl: string
  }): Promise<boolean> {
    return this.sendEmail({
      to: params.to,
      subject: 'Welcome to Heard Again — Start preserving your family stories',
      html: `
        <div style="font-family: 'Newsreader', serif, Arial; line-height: 1.6; color: #16334a; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #d0e3e6; borderRadius: 8px;">
          <h2 style="color: #16334a; border-bottom: 2px solid #16334a; padding-bottom: 10px;">Welcome, ${params.userName}!</h2>
          <p>Thank you for joining <strong>Heard Again</strong>. You've taken the first step toward preserving the voices, stories, and memories of your family for generations to come.</p>
          <p>Here's how to get started:</p>
          <ol style="padding-left: 20px;">
            <li style="margin-bottom: 8px;"><strong>Add your first family member</strong> — Start with someone whose story you want to preserve.</li>
            <li style="margin-bottom: 8px;"><strong>Share a memory</strong> — Write a story, upload a recording, or scan a photo.</li>
            <li style="margin-bottom: 8px;"><strong>Invite family</strong> — The richest legacies are built together.</li>
          </ol>
          <div style="margin: 30px 0; text-align: center;">
            <a href="${params.baseUrl}/legacy" style="background-color: #16334a; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold; display: inline-block;">Go to Your Legacy Dashboard</a>
          </div>
          <p style="font-size: 0.9rem; color: #546669;">Heard Again is 100% open source. Your family's memories are never sold, never used to train public models, and never shared with third parties.</p>
          <p style="font-size: 0.8rem; color: #8a9a9d; margin-top: 40px; border-top: 1px solid #f0ede8; padding-top: 20px;">
            — The Heard Again Team
          </p>
        </div>
      `
    })
  }

  /**
   * Send MFA backup codes via email
   */
  static async sendMFABackupCodesEmail(params: {
    to: string
    userName: string
    backupCodes: string[]
  }): Promise<boolean> {
    const codesDisplay = params.backupCodes.join('<br/>')
    return this.sendEmail({
      to: params.to,
      subject: 'Your Heard Again MFA Backup Codes',
      html: `
        <div style="font-family: 'Newsreader', serif, Arial; line-height: 1.6; color: #16334a; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #d0e3e6; borderRadius: 8px;">
          <h2 style="color: #16334a; border-bottom: 2px solid #16334a; padding-bottom: 10px;">MFA Backup Codes</h2>
          <p>Hi ${params.userName},</p>
          <p>You've enabled two-factor authentication on your Heard Again account. Below are your backup codes — <strong>store these in a safe place</strong>. Each code can only be used once.</p>
          <div style="background-color: #f5f9fa; border: 1px solid #d0e3e6; border-radius: 6px; padding: 16px; margin: 20px 0; font-family: monospace; font-size: 1.1rem; letter-spacing: 2px; text-align: center; line-height: 2;">
            ${codesDisplay}
          </div>
          <p style="font-size: 0.9rem; color: #546669;">If you lose access to your authenticator app, use one of these codes to sign in. Each code can only be used once.</p>
          <p style="font-size: 0.8rem; color: #8a9a9d; margin-top: 40px; border-top: 1px solid #f0ede8; padding-top: 20px;">
            If you did not enable MFA, please secure your account immediately by resetting your password.
          </p>
        </div>
      `
    })
  }

  /**
   * Send password reset email
   */
  static async sendPasswordResetEmail(params: {
    to: string
    resetUrl: string
    userName: string
  }): Promise<boolean> {
    return this.sendEmail({
      to: params.to,
      subject: 'Reset your Heard Again password',
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #16334a;">
          <h2>Password reset request</h2>
          <p>Hi ${params.userName},</p>
          <p>We received a request to reset your Heard Again password.</p>
          <p>
            <a href="${params.resetUrl}" style="display:inline-block;padding:10px 16px;background:#16334a;color:#fff;text-decoration:none;border-radius:6px;">
              Reset password
            </a>
          </p>
          <p>If you did not request this, you can safely ignore this email.</p>
          <p>This link expires in 1 hour.</p>
        </div>
      `
    })
  }

  /**
   * Send a support contact request email to the support email address
   */
  static async sendSupportContactEmail(params: {
    name?: string
    email: string
    subject: string
    message: string
  }): Promise<boolean> {
    const nameStr = params.name ? params.name : 'Anonymous User'
    return this.sendEmail({
      to: this.supportEmail,
      replyTo: params.email,
      subject: `[Heard Again Support] ${params.subject}`,
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #16334a; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #d0e3e6; border-radius: 8px;">
          <h2 style="color: #16334a; border-bottom: 2px solid #16334a; padding-bottom: 10px; margin-top: 0;">New Support Request</h2>
          <p>You have received a new support contact request from the Heard Again application contact form.</p>
          
          <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
            <tr>
              <td style="padding: 8px; font-weight: bold; width: 120px; border-bottom: 1px solid #f0ede8;">From Name:</td>
              <td style="padding: 8px; border-bottom: 1px solid #f0ede8;">${nameStr}</td>
            </tr>
            <tr>
              <td style="padding: 8px; font-weight: bold; border-bottom: 1px solid #f0ede8;">From Email:</td>
              <td style="padding: 8px; border-bottom: 1px solid #f0ede8;"><a href="mailto:${params.email}" style="color: #16334a;">${params.email}</a></td>
            </tr>
            <tr>
              <td style="padding: 8px; font-weight: bold; border-bottom: 1px solid #f0ede8;">Subject:</td>
              <td style="padding: 8px; border-bottom: 1px solid #f0ede8;">${params.subject}</td>
            </tr>
          </table>
          
          <div style="background-color: #f5f9fa; border: 1px solid #d0e3e6; border-radius: 6px; padding: 16px; margin: 20px 0; white-space: pre-wrap;">
${params.message}
          </div>
          
          <p style="font-size: 0.9rem; color: #546669; margin-top: 30px;">
            To reply to this support request, simply reply directly to this email (the Reply-To header has been set to the user's email address).
          </p>
          
          <p style="font-size: 0.8rem; color: #8a9a9d; margin-top: 40px; border-top: 1px solid #f0ede8; padding-top: 20px;">
            Heard Again System Notification
          </p>
        </div>
      `
    })
  }

  /**
   * Send subscription confirmation email
   */
  static async sendSubscriptionConfirmationEmail(params: {
    to: string
    userName: string
    planName: string
    priceDisplay: string
    billingCycle: string
    baseUrl: string
  }): Promise<boolean> {
    return this.sendEmail({
      to: params.to,
      subject: 'Your Heard Again Subscription is Active!',
      html: `
        <div style="font-family: 'Newsreader', serif, Arial; line-height: 1.6; color: #16334a; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #d0e3e6; border-radius: 8px;">
          <h2 style="color: #16334a; border-bottom: 2px solid #16334a; padding-bottom: 10px;">Subscription Confirmed!</h2>
          <p>Hi ${params.userName},</p>
          <p>Thank you for subscribing to the <strong>${params.planName}</strong> plan on <strong>Heard Again</strong>!</p>
          
          <div style="background-color: #f5f9fa; border: 1px solid #d0e3e6; border-radius: 6px; padding: 16px; margin: 20px 0;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 6px 0; font-weight: bold; color: #16334a;">Plan:</td>
                <td style="padding: 6px 0; text-align: right; color: #16334a;">${params.planName}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; font-weight: bold; color: #16334a;">Price:</td>
                <td style="padding: 6px 0; text-align: right; color: #16334a;">$${params.priceDisplay} / ${params.billingCycle}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; font-weight: bold; color: #16334a;">Status:</td>
                <td style="padding: 6px 0; text-align: right; color: green; font-weight: bold;">Active</td>
              </tr>
            </table>
          </div>

          <p>Your subscription includes access to advanced features such as cloud storage quotas, generation minutes for voice narration/synthesis, and family member spaces.</p>
          
          <div style="margin: 30px 0; text-align: center;">
            <a href="${params.baseUrl}/account?tab=subscription" style="background-color: #16334a; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold; display: inline-block;">Manage Your Subscription</a>
          </div>
          
          <p style="font-size: 0.9rem; color: #546669;">If you have any questions or need support, reply to this email or contact us at ${this.supportEmail}.</p>
          <p style="font-size: 0.8rem; color: #8a9a9d; margin-top: 40px; border-top: 1px solid #f0ede8; padding-top: 20px;">
            — The Heard Again Team
          </p>
        </div>
      `
    })
  }
}
