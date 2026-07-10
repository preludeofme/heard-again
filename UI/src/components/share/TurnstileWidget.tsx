import { useEffect, useRef } from 'react'

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: HTMLElement,
        options: { sitekey: string; callback: (token: string) => void; 'expired-callback'?: () => void }
      ) => string
      remove: (widgetId: string) => void
    }
  }
}

const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js'

interface TurnstileWidgetProps {
  onToken: (token: string | null) => void
}

/**
 * Cloudflare Turnstile CAPTCHA widget for public, unauthenticated forms (see
 * docs/sharing.md). Renders nothing if `NEXT_PUBLIC_TURNSTILE_SITE_KEY` isn't
 * configured — the server side (lib/security/turnstile.ts) skips
 * verification in that case too, so the form still works without it while
 * Turnstile isn't set up yet.
 */
export function TurnstileWidget({ onToken }: TurnstileWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const widgetIdRef = useRef<string | null>(null)
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY

  useEffect(() => {
    if (!siteKey || !containerRef.current) return

    const render = () => {
      if (!containerRef.current || !window.turnstile) return
      widgetIdRef.current = window.turnstile.render(containerRef.current, {
        sitekey: siteKey,
        callback: (token: string) => onToken(token),
        'expired-callback': () => onToken(null),
      })
    }

    if (window.turnstile) {
      render()
    } else {
      const script = document.createElement('script')
      script.src = SCRIPT_SRC
      script.async = true
      script.defer = true
      script.onload = render
      document.head.appendChild(script)
    }

    return () => {
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteKey])

  if (!siteKey) return null

  return <div ref={containerRef} />
}
