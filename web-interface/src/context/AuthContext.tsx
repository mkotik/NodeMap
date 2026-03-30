"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import { trpc } from "@/lib/trpc";
import { setAccessToken as syncAccessToken } from "@/lib/auth-token";

export interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  avatarUrl: string | null;
}

interface AuthContextValue {
  user: User | null;
  accessToken: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (
    firstName: string,
    lastName: string,
    email: string,
    password: string,
  ) => Promise<void>;
  loginWithGoogle: (idToken: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, _setAccessToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Keep the module-level token store in sync so the tRPC client can send it
  const setAccessToken = useCallback((token: string | null) => {
    _setAccessToken(token);
    syncAccessToken(token);
  }, []);

  useEffect(() => {
    trpc.auth.refresh
      .mutate()
      .then((res) => {
        setUser(res.user);
        setAccessToken(res.accessToken);
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, [setAccessToken]);

  const login = useCallback(
    async (email: string, password: string) => {
      const res = await trpc.auth.login.mutate({ email, password });
      setUser(res.user);
      setAccessToken(res.accessToken);
    },
    [setAccessToken],
  );

  const register = useCallback(
    async (
      firstName: string,
      lastName: string,
      email: string,
      password: string,
    ) => {
      const res = await trpc.auth.register.mutate({
        firstName,
        lastName,
        email,
        password,
      });
      setUser(res.user);
      setAccessToken(res.accessToken);
    },
    [setAccessToken],
  );

  const loginWithGoogle = useCallback(
    async (idToken: string) => {
      const res = await trpc.auth.google.mutate({ idToken });
      setUser(res.user);
      setAccessToken(res.accessToken);
    },
    [setAccessToken],
  );

  const logout = useCallback(async () => {
    await trpc.auth.logout.mutate().catch(() => {});
    setUser(null);
    setAccessToken(null);
  }, [setAccessToken]);

  return (
    <AuthContext.Provider
      value={{
        user,
        accessToken,
        isLoading,
        login,
        register,
        loginWithGoogle,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
