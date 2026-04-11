import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import api from '../services/api';

type AuthUser = {
  id: string;
  email?: string | null;
};

interface AuthContextType {
  user: AuthUser | null;
  accessToken: string | null;
  role: string | null;
  loading: boolean;
  setAuthToken: (token: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  accessToken: null,
  role: null,
  loading: true,
  setAuthToken: async () => {},
  signIn: async () => {},
  signOut: async () => {},
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const roleFetchInFlight = useRef<Promise<void> | null>(null);
  const roleFetchToken = useRef<string | null>(null);

  const fetchUserRole = useCallback(async (token: string) => {
    if (roleFetchInFlight.current && roleFetchToken.current === token) {
      return roleFetchInFlight.current;
    }
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 15000);

    roleFetchToken.current = token;
    roleFetchInFlight.current = (async () => {
      try {
        const resp = await fetch(`${import.meta.env.VITE_API_URL}/api/v1/auth/me`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          signal: controller.signal,
        });

        if (!resp.ok) {
          throw new Error(`Failed to fetch role: ${resp.status} ${resp.statusText}`);
        }

        const me = await resp.json();
        if (me?.user_id) {
          setUser({ id: String(me.user_id), email: me.email ? String(me.email) : null });
        }
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
  }, []);

  const setAuthToken = useCallback(
    async (token: string) => {
    localStorage.setItem('auth_access_token', token);
    setAccessToken(token);
    try {
      const cached = localStorage.getItem('last_role');
      if (cached) setRole(cached);
    } catch (e) {
      void e;
    }
    await fetchUserRole(token);
    },
    [fetchUserRole],
  );

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      try {
        const token = localStorage.getItem('auth_access_token');
        if (token) {
          await setAuthToken(token);
        } else {
          const {
            data: { session },
          } = await supabase.auth.getSession();
          const supaToken = session?.access_token || null;
          setAccessToken(supaToken);
          if (supaToken) {
            void fetchUserRole(supaToken);
          } else {
            setRole(null);
            setUser(null);
          }
        }
      } finally {
        setLoading(false);
      }
    };

    void init();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const local = localStorage.getItem('auth_access_token');
      if (local) return;
      const supaToken = session?.access_token || null;
      setAccessToken(supaToken);
      if (supaToken) {
        void fetchUserRole(supaToken);
      } else {
        setRole(null);
        setUser(null);
      }
    });

    return () => subscription.unsubscribe();
  }, [fetchUserRole, setAuthToken]);

  const signIn = async (email: string, password: string) => {
    const resp = await api.post('/auth/login', { email, password });
    const token = String(resp.data?.access_token || '');
    if (!token) {
      throw new Error('No access token');
    }
    await setAuthToken(token);
    const meRole = resp.data?.role ? String(resp.data.role) : null;
    if (meRole) {
      setRole(meRole);
      localStorage.setItem('last_role', meRole);
    }
    setUser({
      id: String(resp.data?.user_id || ''),
      email: resp.data?.email ? String(resp.data.email) : null,
    });
  };

  const signOut = async () => {
    localStorage.removeItem('auth_access_token');
    localStorage.removeItem('last_role');
    await supabase.auth.signOut();
    setAccessToken(null);
    setUser(null);
    setRole(null);
  };

  return (
    <AuthContext.Provider
      value={{ user, accessToken, role, loading, setAuthToken, signIn, signOut }}
    >
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
