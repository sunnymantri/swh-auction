import { useAuth } from '../../context/AuthContext'

export default function RoleGate({ allow, children }) {
  const { role } = useAuth()
  if (!allow.includes(role)) {
    return (
      <div className="rounded-xl border border-live/40 bg-live/10 text-live p-4 text-sm">
        This screen is not available for your current role.
      </div>
    )
  }
  return children
}

