// components/SupabaseProvider.tsx
'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import type { Session } from '@supabase/supabase-js'

type SupabaseContextType = {
  session: Session | null
  loading: boolean
}

const SupabaseContext = createContext<SupabaseContextType>({
  session: null,
  loading: true,
})

export const SupabaseProvider = ({ children }: { children: React.ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => subscription.unsubscribe()
  }, [])

  return (
    <SupabaseContext.Provider value={{ session, loading }}>
      {children}
    </SupabaseContext.Provider>
  )
}

export const useAuth = () => useContext(SupabaseContext)