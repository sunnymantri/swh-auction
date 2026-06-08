import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

// Routes the user to the right home screen based on session + role.
export default function Landing() {
  const { session, role, loading } = useAuth()
  if (loading) {
    return <div className="min-h-screen grid place-items-center text-teal-400">Loading…</div>
  }
  if (!session) return <Navigate to="/public-live" replace />
  if (role === 'admin') return <Navigate to="/auction" replace />
  if (role === 'team_owner') return <Navigate to="/team-bidding" replace />
  return <Navigate to="/public-live" replace />
}
