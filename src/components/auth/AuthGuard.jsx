import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'

export default function AuthGuard() {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) return null

  if (!user) {
    // Save intended destination so we can redirect after login
    return <Navigate to="/" state={{ from: location }} replace />
  }

  return <Outlet />
}
