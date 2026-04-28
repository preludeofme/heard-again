import crypto from 'crypto'

export interface ConsentTokenPayload {
  familyspaceId: string
  profileId: string
  consentId: string
  exp: number // Expiration timestamp
}

export class ConsentTokenService {
  private secret: string

  constructor(secret: string = process.env.TTS_SERVICE_SECRET || 'dev-secret') {
    this.secret = secret
  }

  /**
   * Issue a short-lived signed consent token
   */
  issueToken(payload: Omit<ConsentTokenPayload, 'exp'>, ttlSeconds: number = 300): string {
    const exp = Math.floor(Date.now() / 1000) + ttlSeconds
    const fullPayload: ConsentTokenPayload = { ...payload, exp }
    
    const data = JSON.stringify(fullPayload)
    const signature = crypto
      .createHmac('sha256', this.secret)
      .update(data)
      .digest('hex')
    
    // Return base64 encoded JSON + signature
    const body = Buffer.from(data).toString('base64')
    return `${body}.${signature}`
  }
}

export const consentTokenService = new ConsentTokenService()
