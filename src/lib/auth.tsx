import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
// Reads the e-mail link's URL parameters now, before supabase-js clears them
import './authFlow'
import type { Profile } from '../lib/database.types'

type AuthContextValue = {
  session: Session | null
  user: User | null
  profile: Profile | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<void>
  /** needsConfirmation: the account exists but the link from the e-mail has to be clicked first */
  signUp: (
    email: string,
    password: string,
    displayName: string,
    phone: string,
    captchaToken?: string,
  ) => Promise<{ needsConfirmation: boolean }>
  resendConfirmation: (email: string) => Promise<void>
  requestPasswordReset: (email: string) => Promise<void>
  /** True after the user came from a reset link (Supabase PASSWORD_RECOVERY) until the password is set */
  recovery: boolean
  updatePassword: (password: string) => Promise<void>
  changeEmail: (email: string) => Promise<void>
  /** Checks the current password first; other sessions stay signed in */
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [recovery, setRecovery] = useState(false)

  const loadProfile = useCallback(async (userId: string) => {
    // Own row incl. phone — direct selects can't read phone (column privileges)
    const { data } = await supabase.rpc('my_profile')
    const row = data as Profile | null
    setProfile(row && row.id === userId ? row : null)
  }, [])

  const refreshProfile = useCallback(async () => {
    if (session?.user?.id) await loadProfile(session.user.id)
  }, [loadProfile, session?.user?.id])

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      if (data.session?.user) {
        loadProfile(data.session.user.id).finally(() => setLoading(false))
      } else {
        setLoading(false)
      }
    })

    const { data: sub } = supabase.auth.onAuthStateChange((event, next) => {
      if (event === 'PASSWORD_RECOVERY') setRecovery(true)
      if (event === 'SIGNED_OUT') setRecovery(false)
      setSession(next)
      if (next?.user) void loadProfile(next.user.id)
      else setProfile(null)
    })

    return () => sub.subscription.unsubscribe()
  }, [loadProfile])

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
  }, [])

  const signUp = useCallback(async (email: string, password: string, displayName: string, phone: string, captchaToken?: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/potwierdzono`,
        captchaToken,
        data: {
          display_name: displayName,
          username: displayName.toLowerCase().replace(/\s+/g, ''),
          phone,
        },
      },
    })
    if (error) throw error
    // With "Confirm email" on, Supabase returns the user but no session
    return { needsConfirmation: !data.session }
  }, [])

  const resendConfirmation = useCallback(async (email: string) => {
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/potwierdzono` },
    })
    if (error) throw error
  }, [])

  const requestPasswordReset = useCallback(async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/nowe-haslo`,
    })
    if (error) throw error
  }, [])

  const updatePassword = useCallback(async (password: string) => {
    const { error } = await supabase.auth.updateUser({ password })
    if (error) throw error
    setRecovery(false)
  }, [])

  const changeEmail = useCallback(async (email: string) => {
    const { error } = await supabase.auth.updateUser(
      { email },
      { emailRedirectTo: `${window.location.origin}/auth/potwierdzono?zmiana=email` },
    )
    if (error) throw error
  }, [])

  const changePassword = useCallback(
    async (currentPassword: string, newPassword: string) => {
      const email = session?.user?.email
      if (!email) throw new Error('Sesja wygasła. Zaloguj się ponownie.')
      // Proves the current password (and satisfies "secure password change"); a sign-in does not end other sessions
      const { error: authError } = await supabase.auth.signInWithPassword({ email, password: currentPassword })
      if (authError) throw authError
      const { error } = await supabase.auth.updateUser({ password: newPassword })
      if (error) throw error
    },
    [session?.user?.email],
  )

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
  }, [])

  const value = useMemo(
    () => ({
      session,
      user: session?.user ?? null,
      profile,
      loading,
      signIn,
      signUp,
      resendConfirmation,
      requestPasswordReset,
      recovery,
      updatePassword,
      changeEmail,
      changePassword,
      signOut,
      refreshProfile,
    }),
    [
      session,
      profile,
      loading,
      recovery,
      signIn,
      signUp,
      resendConfirmation,
      requestPasswordReset,
      updatePassword,
      changeEmail,
      changePassword,
      signOut,
      refreshProfile,
    ],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth outside AuthProvider')
  return ctx
}
