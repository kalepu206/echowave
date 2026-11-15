import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { api } from "./api";

/** Signed-in Google account (the session itself lives in a secure cookie the browser sends automatically). */
export interface SessionUser {
  uid: string;
  email: string | null;
  name: string | null;
}

interface Profile {
  username: string | null;
  isAdmin: boolean;
  banned: boolean;
}

interface AuthState {
  user: SessionUser | null;
  profile: Profile | null;
  loading: boolean;
  refresh: () => Promise<void>;
  signIn: (next?: string) => void;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthState>({
  user: null, profile: null, loading: true,
  refresh: async () => {}, signIn: () => {}, signOut: async () => {},
});

interface MeResponse {
  signedIn: boolean;
  uid?: string;
  email?: string | null;
  name?: string | null;
  username?: string | null;
  isAdmin?: boolean;
  banned?: boolean;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const me = await api<MeResponse>("/me");
      if (me.signedIn && me.uid) {
        setUser({ uid: me.uid, email: me.email ?? null, name: me.name ?? null });
        setProfile({ username: me.username ?? null, isAdmin: !!me.isAdmin, banned: !!me.banned });
      } else {
        setUser(null);
        setProfile(null);
      }
    } catch {
      setUser(null);
      setProfile(null);
    }
  }, []);

  useEffect(() => {
    refresh().finally(() => setLoading(false));
  }, [refresh]);

  const signIn = useCallback((next?: string) => {
    const target = next ?? window.location.pathname + window.location.search;
    window.location.href = `/api/auth/google/start?next=${encodeURIComponent(target.startsWith("/login") ? "/" : target)}`;
  }, []);

  const signOut = useCallback(async () => {
    await api("/auth/logout", { method: "POST" }).catch(() => {});
    setUser(null);
    setProfile(null);
  }, []);

  return <Ctx.Provider value={{ user, profile, loading, refresh, signIn, signOut }}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);
