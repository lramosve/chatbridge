import type { Session, User } from '@supabase/supabase-js'
import { create } from 'zustand'
import { getSupabase } from '../setup/supabase_init'

interface SupabaseAuthState {
  user: User | null
  session: Session | null
  loading: boolean
  initialized: boolean
  setSession: (session: Session | null) => void
  setLoading: (loading: boolean) => void
  signInWithEmail: (email: string, password: string) => Promise<{ error: string | null }>
  signUpWithEmail: (email: string, password: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
  initialize: () => Promise<void>
}

export const useSupabaseAuth = create<SupabaseAuthState>((set, get) => ({
  user: null,
  session: null,
  loading: false,
  initialized: false,

  setSession: (session) => {
    set({ session, user: session?.user ?? null })
  },

  setLoading: (loading) => set({ loading }),

  signInWithEmail: async (email, password) => {
    const supabase = getSupabase()
    if (!supabase) return { error: 'Supabase not configured' }

    set({ loading: true })
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    set({ loading: false })

    if (error) return { error: error.message }
    set({ session: data.session, user: data.user })
    return { error: null }
  },

  signUpWithEmail: async (email, password) => {
    const supabase = getSupabase()
    if (!supabase) return { error: 'Supabase not configured' }

    set({ loading: true })
    const { data, error } = await supabase.auth.signUp({ email, password })
    set({ loading: false })

    if (error) return { error: error.message }
    if (data.session) {
      set({ session: data.session, user: data.user })
    }
    return { error: null }
  },

  signOut: async () => {
    const supabase = getSupabase()
    if (!supabase) return

    await supabase.auth.signOut()
    set({ session: null, user: null })
  },

  initialize: async () => {
    const supabase = getSupabase()
    if (!supabase) {
      set({ initialized: true })
      return
    }

    const { data } = await supabase.auth.getSession()
    set({
      session: data.session,
      user: data.session?.user ?? null,
      initialized: true,
    })

    supabase.auth.onAuthStateChange((_event, session) => {
      set({ session, user: session?.user ?? null })
    })
  },
}))
