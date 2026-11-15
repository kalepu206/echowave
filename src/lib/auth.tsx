import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { onAuthStateChanged, signOut as fbSignOut, type User } from "firebase/auth";
import { auth } from "./firebase";
import { api } from "./api";

interface Profile {
  username: string | null;
  isAdmin: boolean;
  banned: boolean;
  emailVerified: boolean;
}

interface AuthState {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthState>({
  user: null, profile: null, loading: true, refresh: async () => {}, signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async (u: User | null) => {
    if (!u) {
      setProfile(null);
      return;
    }
    try {
      const me = await api<{ username: string | null; isAdmin: boolean; banned: boolean; emailVerified: boolean }>("/me");
      setProfile({ username: me.username, isAdmin: me.isAdmin, banned: me.banned, emailVerified: me.emailVerified });
    } catch {
      setProfile({ username: null, isAdmin: false, banned: false, emailVerified: u.emailVerified });
    }
  }, []);

  useEffect(
    () =>
      onAuthStateChanged(auth, async (u) => {
        setUser(u);
        await loadProfile(u);
        setLoading(false);
      }),
    [loadProfile],
  );

  const refresh = useCallback(async () => {
    const u = auth.currentUser;
    if (u) {
      await u.reload();
      await u.getIdToken(true); // pick up email verification
    }
    setUser(auth.currentUser);
    await loadProfile(auth.currentUser);
  }, [loadProfile]);

  const signOut = useCallback(async () => {
    await fbSignOut(auth);
  }, []);

  return <Ctx.Provider value={{ user, profile, loading, refresh, signOut }}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);
