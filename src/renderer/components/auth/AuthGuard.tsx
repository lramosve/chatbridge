import { useNavigate, useLocation } from '@tanstack/react-router'
import { useEffect } from 'react'
import { CHATBOX_BUILD_PLATFORM } from '@/variables'
import { getSupabase } from '@/setup/supabase_init'
import { useSupabaseAuth } from '@/stores/supabaseAuthStore'

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, initialized, initialize } = useSupabaseAuth()
  const navigate = useNavigate()
  const location = useLocation()

  // Only enforce auth on web builds with Supabase configured
  const supabase = getSupabase()
  const authEnabled = CHATBOX_BUILD_PLATFORM === 'web' && supabase !== null

  useEffect(() => {
    if (authEnabled && !initialized) {
      initialize()
    }
  }, [authEnabled, initialized, initialize])

  useEffect(() => {
    if (!authEnabled || !initialized) return
    if (!user && location.pathname !== '/login') {
      navigate({ to: '/login', replace: true })
    }
  }, [authEnabled, initialized, user, location.pathname, navigate])

  if (!authEnabled) return <>{children}</>
  if (!initialized) return null
  if (!user && location.pathname !== '/login') return null

  return <>{children}</>
}
