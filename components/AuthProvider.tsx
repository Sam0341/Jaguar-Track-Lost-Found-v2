"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import type { Session, User } from "@supabase/supabase-js";

type ProfileType = {
  id: string;
  email: string;
  full_name: string | null;
  role: string | null;
};

type AuthContextType = {
  session: Session | null;
  user: User | null;
  profile: ProfileType | null;
  loading: boolean;
};

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  profile: null,
  loading: true,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<ProfileType | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadProfile(userId: string) {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();

    setProfile(data || null);
  }

  useEffect(() => {
    // Initial load
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);

      if (session?.user?.id) {
        await loadProfile(session.user.id);
      }

      setLoading(false);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session);

      if (session?.user?.id) {
        await loadProfile(session.user.id);
      } else {
        setProfile(null);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        profile,
        loading,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
