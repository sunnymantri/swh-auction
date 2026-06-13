import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { verifyPublicCode } from '../../lib/api'

const SESSION_KEY = 'ca.publicAuth'

export function setPublicAuthGranted() {
  sessionStorage.setItem(SESSION_KEY, 'true')
}

export default function RequirePublicAuth({ children }) {
  const [status, setStatus] = useState(
    sessionStorage.getItem(SESSION_KEY) === 'true' ? 'ok' : 'loading'
  )

  useEffect(() => {
    if (status !== 'loading') return
    // Check whether public access is open (no code configured on any auction)
    verifyPublicCode('').then(open => {
      if (open) {
        sessionStorage.setItem(SESSION_KEY, 'true')
        setStatus('ok')
      } else {
        setStatus('redirect')
      }
    }).catch(() => {
      // RPC not yet deployed — fail open so existing public pages stay accessible
      sessionStorage.setItem(SESSION_KEY, 'true')
      setStatus('ok')
    })
  }, [])

  if (status === 'loading') return null
  if (status === 'redirect') return <Navigate to="/login" state={{ needPublicCode: true }} replace />
  return children
}
