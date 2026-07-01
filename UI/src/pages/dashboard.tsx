import { useEffect } from 'react'
import { useRouter } from 'next/router'

/**
 * Redirect /dashboard → /admin/dashboard.
 * The admin dashboard was moved to /admin/dashboard 
 * with full admin role protection.
 */
export default function DashboardRedirect() {
  const router = useRouter()

  useEffect(() => {
    router.replace('/admin/dashboard')
  }, [router])

  return null
}
