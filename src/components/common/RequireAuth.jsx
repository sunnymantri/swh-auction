import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

// Gate protected routes behind a session. While auth is resolving we render
// nothing to avoid a flash. Unauthenticated users are sent to /login.
export default function RequireAuth({ children }) {
  const { session, loading } = useAuth()
  const loc = useLocation()

  if (loading) {
    return <div className="min-h-screen grid place-items-center text-teal-400">Loading…</div>
  }
  if (!session) {
    return <Navigate to="/login" replace state={{ from: loc.pathname }} />
  }
  return children
}
