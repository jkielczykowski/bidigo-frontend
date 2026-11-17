import { useCallback, useEffect, useState } from 'react'
import { useAuth } from './auth'
import { parseAfStatus, type AfStatus } from './antifraud'
import { supabase } from './supabase'

/** public.my_antifraud_status(): warnings 1/3 – 2/3, the block, the user's incidents and system ratings */
export function useAntifraud() {
  const { user } = useAuth()
  const [status, setStatus] = useState<AfStatus | null>(null)

  const reload = useCallback(async () => {
    if (!user) {
      setStatus(null)
      return
    }
    const { data, error } = await supabase.rpc('my_antifraud_status')
    setStatus(error ? null : parseAfStatus(data))
  }, [user])

  useEffect(() => {
    void reload()
  }, [reload])

  return { status, reload }
}
