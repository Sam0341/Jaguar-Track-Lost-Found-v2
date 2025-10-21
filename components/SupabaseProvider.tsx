"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabaseClient";

type SupabaseContextType = {
  user: User | null;
  session: Session | null;
  loading: boolean;
};

const SupabaseContext = createContext<SupabaseContextType>({
  user: null,
  session: null,
  loading: true,
});

export function SupabaseProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Load current session on first render
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    // Listen for auth state changes
    const { data: subscription } = supabase.auth.onAuthStateChange(
      (_event, newSession) => {
        setSession(newSession);
      }
    );

    return () => {
      subscription.subscription.unsubscribe();
    };
  }, []);

  return (
    <SupabaseContext.Provider value={{ user: session?.user ?? null, session, loading }}>
      {children}
    </SupabaseContext.Provider>
  );
}

export function useSupabaseAuth() {
  return useContext(SupabaseContext);
}
