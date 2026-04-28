import { logger } from '@/lib/logger'

interface SendEmailParams {
  to: string | string[]
  subject: string
  html: string
}

export class EmailService {
  private static apiKey = process.env.RESEND_API_KEY
  private static fromEmail = process.env.EMAIL_FROM || 'Heard Again <no-reply@heardagain.com>'

  /**
   * Send an email using Resend API
   */
  static async sendEmail(params: SendEmailParams): Promise<boolean> {
    if (!this.apiKey) {
      logger.warn('[EmailService] RESEND_API_KEY not configured; logging email content instead')
      logger.info({
        to: params.to,
        subject: params.subject,
        htmlSnippet: params.html.substring(0, 200) + '...'
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
}
