import { logger } from '@/lib/logger'
import { prisma } from '@/lib/prisma'
import { apiHandler, successResponse, Errors } from '@/lib/api-helpers'
import { getAuthUserWithFamilyspace, requireFamilyspaceRole } from '@/lib/auth-helpers'
import { createCloudflareService, CloudflareTunnelService } from '@/lib/cloudflare-tunnel'
import { validate, rules } from '@/lib/validation'

// Generate a secure random token
function generateToken(length = 32): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let result = ''
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

// Check if Cloudflare API is configured
function isCloudflareConfigured(): boolean {
  return !!(process.env.CLOUDFLARE_API_TOKEN && process.env.CLOUDFLARE_ACCOUNT_ID)
}

export default apiHandler({
  // POST /api/instance/tunnel - Create, configure, or manage named tunnel
  POST: async (req, res) => {
    const user = await getAuthUserWithFamilyspace(req, res)
    await requireFamilyspaceRole(user.id, user.familyspaceId, 'OWNER')

    const { valid, errors } = validate(req.body, {
      action: [rules.required, rules.oneOf([
        'create-named',      // Create new named tunnel via API
        'delete-named',      // Delete named tunnel
        'regenerate-token',  // Rotate tunnel token
        'get-credentials',   // Download credential files
        'enable',            // Legacy: enable quick tunnel
        'disable',           // Disable tunnel
        'rotate-token',      // Legacy: rotate quick tunnel token
      ])],
    })

    if (!valid) {
      throw Errors.badRequest('Validation failed', errors)
    }

    const { action } = req.body

    let instance = await prisma.instance.findFirst({
      where: { familyspaceId: user.familyspaceId },
    })

    // Auto-create instance if none exists
    if (!instance && ['create-named', 'enable'].includes(action)) {
      instance = await prisma.instance.create({
        data: {
          familyspaceId: user.familyspaceId,
          type: 'LOCAL',
          status: 'ACTIVE',
          version: '1.0.0',
          computeMode: 'LOCAL',
          dataMode: 'LOCAL',
          tunnelEnabled: false,
          registeredAt: new Date(),
        },
      })
    }

    if (!instance) {
      throw Errors.notFound('Instance')
    }

    // Check plan supports tunnel
    const subscription = await prisma.subscription.findUnique({
      where: { familyspaceId: user.familyspaceId },
      include: { plan: true },
    })

    if (!subscription?.plan?.tunnelEnabled) {
      throw Errors.forbidden('Your plan does not support tunnel/connected mode. Please upgrade.')
    }

    let updatedInstance
    let cloudflareService: CloudflareTunnelService | null = null

    // Initialize Cloudflare service if configured
    if (isCloudflareConfigured()) {
      try {
        cloudflareService = createCloudflareService()
      } catch (err) {
        logger.warn('Cloudflare API not configured:', err)
      }
    }

    switch (action) {
      case 'create-named':
        if (!cloudflareService) {
          throw Errors.badRequest('Cloudflare API is not configured. Please set CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID.')
        }

        if (instance.tunnelId) {
          throw Errors.badRequest('Named tunnel already exists. Delete it first to create a new one.')
        }

        // Generate unique tunnel name and hostname
        const familyspace = await prisma.familyspace.findUnique({
          where: { id: user.familyspaceId },
          select: { slug: true, name: true },
        })

        const baseSlug = familyspace?.slug || 'instance'
        const uniqueId = Math.random().toString(36).substring(2, 6)
        const tunnelName = `heardagain-${baseSlug}-${uniqueId}`
        const hostname = `${baseSlug}-${uniqueId}.${process.env.CLOUDFLARE_TUNNEL_DOMAIN || 'heardagain.com'}`

        try {
          // Create tunnel via Cloudflare API
          const { tunnel, credentials, tunnelToken } = await cloudflareService.createTunnel(tunnelName)

          // Create DNS record if zone ID is configured
          let dnsRecordId: string | null = null
          if (process.env.CLOUDFLARE_ZONE_ID) {
            try {
              dnsRecordId = await cloudflareService.createDnsRecord(hostname, tunnel.id)
            } catch (err) {
              logger.warn('Failed to create DNS record:', err)
              // Continue without DNS - user can manually configure
            }
          }

          // Configure tunnel with ingress rules
          await cloudflareService.updateTunnelConfig(tunnel.id, [
            { hostname, service: 'http://localhost:4777' },
          ])

          // Update instance with tunnel info
          updatedInstance = await prisma.instance.update({
            where: { id: instance.id },
            data: {
              tunnelEnabled: true,
              tunnelId: tunnel.id,
              tunnelName: tunnel.name,
              tunnelSubdomain: hostname,
              tunnelToken: tunnelToken,
              tunnelCredentials: JSON.stringify(credentials),
              tunnelDnsRecordId: dnsRecordId,
              tunnelTokenExpiresAt: null, // Named tunnels don't expire
            },
          })

          // Update familyspace deployment mode
          await prisma.familyspace.update({
            where: { id: user.familyspaceId },
            data: { deploymentMode: 'TUNNELED' },
          })

          return successResponse(res, {
            tunnel: {
              enabled: true,
              type: 'named',
              id: tunnel.id,
              name: tunnel.name,
              hostname,
              publicUrl: `https://${hostname}`,
              credentials: {
                accountTag: credentials.AccountTag,
                tunnelId: credentials.TunnelID,
              },
              tunnelToken: tunnelToken.substring(0, 20) + '...', // Truncate for display
              dnsConfigured: !!dnsRecordId,
            },
            message: 'Named tunnel created successfully via Cloudflare API',
            nextSteps: [
              'Download credentials from /api/instance/tunnel with action: get-credentials',
              'Install cloudflared on your server',
              'Run: cloudflared tunnel run --token <your-token>',
              'Or use the provided Docker Compose or systemd service files',
            ],
          })
        } catch (err: any) {
          logger.error('Failed to create named tunnel:', err)
          throw Errors.internal(`Failed to create Cloudflare tunnel: ${err.message}`)
        }

      case 'delete-named':
        if (!instance.tunnelId || !cloudflareService) {
          throw Errors.badRequest('No named tunnel exists to delete')
        }

        try {
          // Delete tunnel from Cloudflare
          await cloudflareService.deleteTunnel(instance.tunnelId)
        } catch (err) {
          logger.warn('Failed to delete tunnel from Cloudflare:', err)
          // Continue to clean up local state
        }

        // Clear tunnel data from instance
        updatedInstance = await prisma.instance.update({
          where: { id: instance.id },
          data: {
            tunnelEnabled: false,
            tunnelId: null,
            tunnelName: null,
            tunnelSubdomain: null,
            tunnelToken: null,
            tunnelCredentials: null,
            tunnelDnsRecordId: null,
            tunnelTokenExpiresAt: null,
          },
        })

        // Update familyspace deployment mode
        await prisma.familyspace.update({
          where: { id: user.familyspaceId },
          data: { deploymentMode: 'LOCAL' },
        })

        return successResponse(res, {
          tunnel: { enabled: false },
          message: 'Named tunnel deleted successfully',
        })

      case 'regenerate-token':
        if (!instance.tunnelId || !cloudflareService) {
          throw Errors.badRequest('No named tunnel exists')
        }

        // Get new token from Cloudflare
        try {
          const tokenResponse = await fetch(
            `https://api.cloudflare.com/client/v4/accounts/${process.env.CLOUDFLARE_ACCOUNT_ID}/tunnels/${instance.tunnelId}/token`,
            {
              method: 'GET',
              headers: {
                'Authorization': `Bearer ${process.env.CLOUDFLARE_API_TOKEN}`,
              },
            }
          )
          
          if (!tokenResponse.ok) {
            throw new Error('Failed to get new token')
          }

          const data = await tokenResponse.json()
          if (!data.success) {
            throw new Error('Cloudflare API returned error')
          }

          updatedInstance = await prisma.instance.update({
            where: { id: instance.id },
            data: {
              tunnelToken: data.result,
            },
          })

          return successResponse(res, {
            tunnel: {
              enabled: true,
              type: 'named',
              id: instance.tunnelId,
              tunnelToken: data.result.substring(0, 20) + '...',
            },
            message: 'Tunnel token regenerated successfully',
            warning: 'Update your cloudflared configuration with the new token',
          })
        } catch (err: any) {
          throw Errors.internal(`Failed to regenerate token: ${err.message}`)
        }

      case 'get-credentials':
        if (!instance.tunnelId || !instance.tunnelCredentials) {
          throw Errors.badRequest('No named tunnel credentials available')
        }

        const credentials = JSON.parse(instance.tunnelCredentials)
        const tunnelToken = instance.tunnelToken

        if (!cloudflareService || !tunnelToken) {
          throw Errors.badRequest('Cannot generate credential files')
        }

        // Generate all configuration files
        const configFiles = {
          'cloudflared-config.yml': cloudflareService.generateConfigFile(tunnelToken, [
            { hostname: instance.tunnelSubdomain!, service: 'http://localhost:4777' },
          ]),
          'credentials.json': cloudflareService.generateCredentialsFile({
            AccountTag: credentials.AccountTag,
            TunnelSecret: credentials.TunnelSecret,
            TunnelID: credentials.TunnelID,
          }),
          'docker-compose.yml': cloudflareService.generateDockerCompose(tunnelToken),
          'cloudflared.service': cloudflareService.generateSystemdService(tunnelToken),
          'README.md': generateReadme(instance.tunnelSubdomain!, tunnelToken),
        }

        return successResponse(res, {
          files: configFiles,
          instructions: [
            `1. Create directory: sudo mkdir -p /etc/cloudflared`,
            `2. Save credentials.json to /etc/cloudflared/`,
            `3. Save cloudflared-config.yml to /etc/cloudflared/config.yml`,
            `4. Run: sudo cloudflared service install`,
            `5. Start: sudo systemctl start cloudflared`,
          ],
        })

      // Legacy quick tunnel support
      case 'enable':
        if (instance.tunnelEnabled) {
          throw Errors.badRequest('Tunnel is already enabled')
        }

        const ws = await prisma.familyspace.findUnique({
          where: { id: user.familyspaceId },
          select: { slug: true },
        })

        const base = ws?.slug || 'instance'
        const subdomain = `${base}-${Math.random().toString(36).substring(2, 6)}`.toLowerCase()

        updatedInstance = await prisma.instance.update({
          where: { id: instance.id },
          data: {
            tunnelEnabled: true,
            tunnelSubdomain: subdomain,
            tunnelToken: generateToken(48),
            tunnelTokenExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          },
        })

        await prisma.familyspace.update({
          where: { id: user.familyspaceId },
          data: { deploymentMode: 'TUNNELED' },
        })

        return successResponse(res, {
          tunnel: {
            enabled: true,
            type: 'quick',
            subdomain: updatedInstance.tunnelSubdomain,
            publicUrl: `https://${updatedInstance.tunnelSubdomain}.${process.env.CLOUDFLARE_TUNNEL_DOMAIN || 'heardagain.com'}`,
            token: updatedInstance.tunnelToken,
            expiresAt: updatedInstance.tunnelTokenExpiresAt,
            instructions: [
              'Install cloudflared: https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation/',
              `Run: cloudflared tunnel --url http://localhost:4777 --hostname ${updatedInstance.tunnelSubdomain}.${process.env.CLOUDFLARE_TUNNEL_DOMAIN || 'heardagain.com'}`,
            ],
          },
          message: 'Quick tunnel enabled successfully',
        })

      case 'disable':
        if (!instance.tunnelEnabled) {
          throw Errors.badRequest('Tunnel is already disabled')
        }

        // If it's a named tunnel, also try to delete from Cloudflare
        if (instance.tunnelId && cloudflareService) {
          try {
            await cloudflareService.deleteTunnel(instance.tunnelId)
          } catch (err) {
            logger.warn('Failed to delete named tunnel from Cloudflare:', err)
          }
        }

        updatedInstance = await prisma.instance.update({
          where: { id: instance.id },
          data: {
            tunnelEnabled: false,
            tunnelId: null,
            tunnelName: null,
            tunnelSubdomain: null,
            tunnelToken: null,
            tunnelCredentials: null,
            tunnelDnsRecordId: null,
            tunnelTokenExpiresAt: null,
          },
        })

        await prisma.familyspace.update({
          where: { id: user.familyspaceId },
          data: { deploymentMode: 'LOCAL' },
        })

        return successResponse(res, {
          tunnel: { enabled: false },
          message: 'Tunnel disabled successfully',
        })

      case 'rotate-token':
        if (!instance.tunnelEnabled) {
          throw Errors.badRequest('Tunnel is not enabled')
        }

        updatedInstance = await prisma.instance.update({
          where: { id: instance.id },
          data: {
            tunnelToken: generateToken(48),
            tunnelTokenExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          },
        })

        return successResponse(res, {
          tunnel: {
            enabled: true,
            token: updatedInstance.tunnelToken,
            expiresAt: updatedInstance.tunnelTokenExpiresAt,
          },
          message: 'Quick tunnel token rotated successfully',
        })

      default:
        throw Errors.badRequest('Invalid action')
    }
  },
})

function generateReadme(hostname: string, tunnelToken: string): string {
  return `# Heard Again - Cloudflare Tunnel Setup

## Your Tunnel Configuration

**Public URL:** https://${hostname}
**Hostname:** ${hostname}

## Quick Start

### Option 1: Docker Compose (Recommended)

1. Save \`docker-compose.yml\` in your project directory
2. Run: \`docker-compose up -d\`

### Option 2: Systemd Service (Linux)

1. Install cloudflared:
   \`\`\`bash
   # Debian/Ubuntu
   wget -q https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
   sudo dpkg -i cloudflared-linux-amd64.deb
   
   # Or use Homebrew on macOS
   brew install cloudflared
   \`\`\`

2. Save \`cloudflared.service\` to \`/etc/systemd/system/\`
3. Reload systemd: \`sudo systemctl daemon-reload\`
4. Start service: \`sudo systemctl start cloudflared\`
5. Enable auto-start: \`sudo systemctl enable cloudflared\`

### Option 3: Manual with Token

Run directly:
\`\`\`bash
cloudflared tunnel run --token ${tunnelToken.substring(0, 20)}...
\`\`\`

## Troubleshooting

- Check tunnel status: \`sudo systemctl status cloudflared\`
- View logs: \`sudo journalctl -u cloudflared -f\`
- Test locally: \`curl http://localhost:4777\`

## Security Notes

- Keep your tunnel token secret - anyone with this token can access your instance
- The token provides secure access without opening firewall ports
- HTTPS is automatically enabled via Cloudflare's edge
`
}
