import type { Session, User } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  role: string | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  role: null,
  loading: true,
  signOut: async () => {},
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const roleFetchInFlight = useRef<Promise<void> | null>(null);
  const roleFetchToken = useRef<string | null>(null);

  const fetchUserRole = async (accessToken: string) => {
    if (roleFetchInFlight.current && roleFetchToken.current === accessToken) {
      return roleFetchInFlight.current;
    }
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 15000);

    roleFetchToken.current = accessToken;
    roleFetchInFlight.current = (async () => {
      try {
        const resp = await fetch(`${import.meta.env.VITE_API_URL}/api/v1/auth/me`, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
          signal: controller.signal,
        });

        if (!resp.ok) {
          throw new Error(`Failed to fetch role: ${resp.status} ${resp.statusText}`);
        }

        const me = await resp.json();
        console.log('Role from /auth/me:', me.role);
        const resolvedRole = me.role || 'athlete';
        setRole(resolvedRole);
        try {
          localStorage.setItem('last_role', resolvedRole);
        } catch (e) {
          void e;
        }
      } catch (e) {
        const name = (e as any)?.name;
        if (name === 'AbortError') {
          return;
        }
        console.error('Error fetching role:', e);
      } finally {
        window.clearTimeout(timeoutId);
        roleFetchInFlight.current = null;
        roleFetchToken.current = null;
      }
    })();

    return roleFetchInFlight.current;
  };

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.access_token) {
          try {
            const cached = localStorage.getItem('last_role');
            if (cached) setRole(cached);
          } catch (e) {
            void e;
          }
          void fetchUserRole(session.access_token);
        } else {
          setRole(null);
        }
      } finally {
        setLoading(false);
      }
    };

    void init();

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setLoading(true);
      try {
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.access_token) {
          try {
            const cached = localStorage.getItem('last_role');
            if (cached) setRole(cached);
          } catch (e) {
            void e;
          }
          void fetchUserRole(session.access_token);
        } else {
          setRole(null);
        }
      } finally {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, session, role, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
