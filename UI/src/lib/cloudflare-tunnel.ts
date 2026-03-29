/**
 * Cloudflare Tunnel API Client
 * 
 * Handles creation and management of named Cloudflare Tunnels via the Cloudflare API.
 * Named tunnels are persistent and reconnect automatically.
 */

const CLOUDFLARE_API_BASE = 'https://api.cloudflare.com/client/v4'

interface CloudflareTunnel {
  id: string
  name: string
  created_at: string
  deleted_at: string | null
  connections: any[]
}

interface CloudflareCredentials {
  AccountTag: string
  TunnelSecret: string
  TunnelID: string
}

interface CreateTunnelResponse {
  success: boolean
  result: CloudflareTunnel
  errors: any[]
  messages: any[]
}

interface TunnelTokenResponse {
  success: boolean
  result: string  // The tunnel token
  errors: any[]
  messages: any[]
}

interface DnsRecordResponse {
  success: boolean
  result: {
    id: string
    name: string
    type: string
    content: string
  }
  errors: any[]
  messages: any[]
}

export class CloudflareTunnelService {
  private apiToken: string
  private accountId: string
  private zoneId: string | null

  constructor(apiToken: string, accountId: string, zoneId?: string) {
    this.apiToken = apiToken
    this.accountId = accountId
    this.zoneId = zoneId || null
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${CLOUDFLARE_API_BASE}${endpoint}`
    
    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.apiToken}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Cloudflare API error (${response.status}): ${error}`)
    }

    return response.json() as Promise<T>
  }

  /**
   * Create a new named tunnel
   */
  async createTunnel(name: string, config: { 
    tunnelSecret?: string 
  } = {}): Promise<{
    tunnel: CloudflareTunnel
    credentials: CloudflareCredentials
    tunnelToken: string
  }> {
    // 1. Create the tunnel
    const createResponse = await this.request<CreateTunnelResponse>(
      `/accounts/${this.accountId}/tunnels`,
      {
        method: 'POST',
        body: JSON.stringify({
          name,
          config_src: 'cloudflare',
        }),
      }
    )

    if (!createResponse.success) {
      throw new Error(`Failed to create tunnel: ${JSON.stringify(createResponse.errors)}`)
    }

    const tunnel = createResponse.result

    // 2. Generate tunnel token (for cloudflared authentication)
    const tokenResponse = await this.request<TunnelTokenResponse>(
      `/accounts/${this.accountId}/tunnels/${tunnel.id}/token`,
      { method: 'GET' }
    )

    if (!tokenResponse.success) {
      throw new Error(`Failed to get tunnel token: ${JSON.stringify(tokenResponse.errors)}`)
    }

    // 3. Create credentials structure
    const credentials: CloudflareCredentials = {
      AccountTag: this.accountId,
      TunnelSecret: config.tunnelSecret || this.generateTunnelSecret(),
      TunnelID: tunnel.id,
    }

    return {
      tunnel,
      credentials,
      tunnelToken: tokenResponse.result,
    }
  }

  /**
   * Create a DNS record for the tunnel (CNAME to cfargotunnel.com)
   */
  async createDnsRecord(hostname: string, tunnelId: string): Promise<string> {
    if (!this.zoneId) {
      throw new Error('Zone ID is required to create DNS records')
    }

    const response = await this.request<DnsRecordResponse>(
      `/zones/${this.zoneId}/dns_records`,
      {
        method: 'POST',
        body: JSON.stringify({
          type: 'CNAME',
          name: hostname,
          content: `${tunnelId}.cfargotunnel.com`,
          ttl: 1, // Auto
          proxied: true,
        }),
      }
    )

    if (!response.success) {
      throw new Error(`Failed to create DNS record: ${JSON.stringify(response.errors)}`)
    }

    return response.result.id
  }

  /**
   * List all tunnels for the account
   */
  async listTunnels(): Promise<CloudflareTunnel[]> {
    const response = await this.request<{ success: boolean; result: CloudflareTunnel[] }>(
      `/accounts/${this.accountId}/tunnels`,
      { method: 'GET' }
    )

    if (!response.success) {
      throw new Error('Failed to list tunnels')
    }

    return response.result
  }

  /**
   * Get tunnel details
   */
  async getTunnel(tunnelId: string): Promise<CloudflareTunnel> {
    const response = await this.request<{ success: boolean; result: CloudflareTunnel }>(
      `/accounts/${this.accountId}/tunnels/${tunnelId}`,
      { method: 'GET' }
    )

    if (!response.success) {
      throw new Error('Failed to get tunnel')
    }

    return response.result
  }

  /**
   * Delete a tunnel
   */
  async deleteTunnel(tunnelId: string): Promise<void> {
    await this.request(
      `/accounts/${this.accountId}/tunnels/${tunnelId}`,
      { method: 'DELETE' }
    )
  }

  /**
   * Get tunnel configuration (ingress rules, etc.)
   */
  async getTunnelConfig(tunnelId: string): Promise<any> {
    const response = await this.request<{ success: boolean; result: any }>(
      `/accounts/${this.accountId}/tunnels/${tunnelId}/configurations`,
      { method: 'GET' }
    )

    if (!response.success) {
      throw new Error('Failed to get tunnel config')
    }

    return response.result
  }

  /**
   * Update tunnel configuration with ingress rules
   */
  async updateTunnelConfig(
    tunnelId: string, 
    ingress: Array<{ hostname?: string; service: string; path?: string }>
  ): Promise<void> {
    const response = await this.request<{ success: boolean; errors: any[] }>(
      `/accounts/${this.accountId}/tunnels/${tunnelId}/configurations`,
      {
        method: 'PUT',
        body: JSON.stringify({
          config: {
            ingress,
            originRequest: {
              connectTimeout: 30,
              tlsTimeout: 30,
              tcpKeepAlive: 30,
            },
          },
        }),
      }
    )

    if (!response.success) {
      throw new Error(`Failed to update tunnel config: ${JSON.stringify(response.errors)}`)
    }
  }

  /**
   * Generate cloudflared config file content
   */
  generateConfigFile(tunnelToken: string, ingressRules: Array<{ hostname: string; service: string }>): string {
    const config = {
      tunnel: tunnelToken,
      'credentials-file': '/etc/cloudflared/credentials.json',
      ingress: [
        ...ingressRules.map(rule => ({
          hostname: rule.hostname,
          service: rule.service,
        })),
        { service: 'http_status:404' }, // Catch-all
      ],
    }

    return JSON.stringify(config, null, 2)
  }

  /**
   * Generate credentials JSON file content
   */
  generateCredentialsFile(credentials: CloudflareCredentials): string {
    return JSON.stringify({
      'AccountTag': credentials.AccountTag,
      'TunnelSecret': credentials.TunnelSecret,
      'TunnelID': credentials.TunnelID,
    }, null, 2)
  }

  /**
   * Generate Docker Compose file for running cloudflared
   */
  generateDockerCompose(tunnelToken: string): string {
    return `version: '3'
services:
  cloudflared:
    image: cloudflare/cloudflared:latest
    restart: unless-stopped
    command: tunnel run --token ${tunnelToken}
    networks:
      - heardagain
    depends_on:
      - app

  app:
    image: heardagain:latest
    ports:
      - "3002:3002"
    networks:
      - heardagain

networks:
  heardagain:
    driver: bridge
`
  }

  /**
   * Generate systemd service file
   */
  generateSystemdService(tunnelToken: string): string {
    return `[Unit]
Description=Cloudflare Tunnel for Heard Again
After=network.target

[Service]
Type=simple
ExecStart=/usr/local/bin/cloudflared tunnel run --token ${tunnelToken}
Restart=always
RestartSec=5
User=cloudflared
Group=cloudflared

[Install]
WantedBy=multi-user.target
`
  }

  private generateTunnelSecret(): string {
    const array = new Uint8Array(32)
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      crypto.getRandomValues(array)
    } else {
      // Node.js fallback
      for (let i = 0; i < 32; i++) {
        array[i] = Math.floor(Math.random() * 256)
      }
    }
    return Buffer.from(array).toString('base64')
  }
}

// Factory function to create service from environment
export function createCloudflareService(): CloudflareTunnelService {
  const apiToken = process.env.CLOUDFLARE_API_TOKEN
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID
  const zoneId = process.env.CLOUDFLARE_ZONE_ID || null

  if (!apiToken || !accountId) {
    throw new Error('CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID must be set')
  }

  return new CloudflareTunnelService(apiToken, accountId, zoneId || undefined)
}
