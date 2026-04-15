// src/context/AuthContext.tsx
"use client";
import React, { createContext, useContext, useEffect, useRef, useState } from "react";

type User = any; // tighten up later if you want

type LoginResolver = {
  resolve: (val: boolean) => void;
} | null;

type AuthContextValue = {
  user: User | null;
  token: string | null;
  loginOpen: boolean;
  verificationOpen: boolean;
  openLogin: () => Promise<boolean>;
  openVerification: () => Promise<boolean>;
  ensureLoggedIn: () => Promise<boolean>;
  ensureAccountVerified: () => Promise<boolean>;
  closeLogin: () => void;
  closeVerification: () => void;
  // internal: called by LoginModal when login succeeds
  logout: () => Promise<void>;
  isHydrated: boolean;
  refreshUser: () => Promise<void>;
  _onLoginSuccess: (user: User, token: string) => void;
  onVerificationSuccess: (user: User) => void;
};


const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  // start as null (safe for SSR)
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loginOpen, setLoginOpen] = useState(false);
  const [verificationOpen, setVerificationOpen] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);

  const resolverRef = useRef<LoginResolver>(null);
  const verificationResolverRef = useRef<LoginResolver>(null);
  const mountedRef = useRef(false);



  const refreshUser = async () => {
    const t = typeof window !== "undefined" ? localStorage.getItem("token") : token;
    if (!t) return;
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://10.123.11.181:4000"}/api/auth/profile/me`, {
        headers: {
          "Authorization": `Bearer ${t}`,
        },
      });
      if (res.ok) {
        const json = await res.json();
        const u = json.data?.user || json.data || json;
        // The /api/auth/profile/me might return { user, business, stats ... }
        // We want to merge or keep the most relevant user info for auth
        // Usually, the 'user' object in state is what other components consume
        const updatedUser = {
          ...(json.data?.user || json.data || json),
          isBusiness: Boolean(json.data?.is_business_owner || json.data?.business),
          is_business_owner: Boolean(json.data?.is_business_owner),
          business_id: json.data?.business?.business_id || json.data?.business?.id,
          business_status: json.data?.business?.business_status || (json.data as any)?.business_status
        };
        setUser(updatedUser);
        if (typeof window !== "undefined") {
          localStorage.setItem("user", JSON.stringify(updatedUser));
        }
        return updatedUser;
      }
    } catch (e) {
      console.error("AuthContext refreshUser error", e);
    }
  };

  // Read localStorage only on client after mount
  useEffect(() => {
    mountedRef.current = true;
    let t: string | null = null;
    try {
      t = typeof window !== "undefined" ? localStorage.getItem("token") : null;
      const uRaw = typeof window !== "undefined" ? localStorage.getItem("user") : null;
      setToken(t);
      setUser(uRaw ? JSON.parse(uRaw) : null);
    } catch (e) {
      // ignore parse errors
      setToken(null);
      setUser(null);
    }

    // optional: listen to storage events so auth syncs across tabs
    const onStorage = (ev: StorageEvent) => {
      if (ev.key === "token" || ev.key === "user") {
        try {
          const newToken = localStorage.getItem("token");
          const newUserRaw = localStorage.getItem("user");
          setToken(newToken);
          setUser(newUserRaw ? JSON.parse(newUserRaw) : null);
        } catch {
          setToken(null);
          setUser(null);
        }
      }
    };
    window.addEventListener("storage", onStorage);
    setIsHydrated(true);

    // Initial sync with backend to catch any status updates (e.g. business approval)
    if (t) {
      refreshUser();
    }

    return () => {
      mountedRef.current = false;
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  // background refresh logic
  useEffect(() => {
    if (!token || !user) return;

    // Periodic refresh every 60 seconds to catch status updates in the background
    const interval = setInterval(() => {
      refreshUser();
    }, 60000);

    // Refresh when user returns to the tab
    const handleFocus = () => refreshUser();
    window.addEventListener("focus", handleFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", handleFocus);
    };
  }, [token, !!user]);

  // open login and return promise that resolves true if user logged in, false otherwise
  const openLogin = (): Promise<boolean> => {
    // if mounted and token+user exist, short-circuit
    if (mountedRef.current && token && user) {
      return Promise.resolve(true);
    }

    setLoginOpen(true);
    return new Promise((resolve) => {
      resolverRef.current = { resolve };
    });
  };

  // open verification and return promise
  const openVerification = (): Promise<boolean> => {
    // Both phone and email must exist to skip
    if (mountedRef.current && user?.phone_no && user?.email) {
      return Promise.resolve(true);
    }
    setVerificationOpen(true);
    return new Promise((resolve) => {
      verificationResolverRef.current = { resolve };
    });
  };

  const closeVerification = () => {
    setVerificationOpen(false);
    if (verificationResolverRef.current) {
      verificationResolverRef.current.resolve(false);
      verificationResolverRef.current = null;
    }
  };

  const closeLogin = () => {
    setLoginOpen(false);
    if (resolverRef.current) {
      // user closed without logging in -> resolve false
      resolverRef.current.resolve(false);
      resolverRef.current = null;
    }
  };

  // handy wrapper
  const ensureLoggedIn = async (): Promise<User | null> => {
    if (mountedRef.current && token && user) return user;
    return await openLogin();
  };

  const ensureAccountVerified = async (): Promise<User | null> => {
    // first ensure logged in
    const loggedIn = await ensureLoggedIn();
    if (!loggedIn) return null;

    // Refresh user from server to ensure we have the absolute latest status from DB
    // before deciding to trigger the modal
    const updatedUser = await refreshUser();
    const currentUser = updatedUser || user;

    // then ensure phone and email
    if (currentUser?.phone_no && currentUser?.email) return currentUser;

    const result = await openVerification();
    // If openVerification returns true, we should get the latest user from state
    // But since setUser is async, we'll return the user passed to onVerificationSuccess if possible.
    // Actually, openVerification now resolves with the USER object.
    return result as any;
  };

  // called by LoginModal after successful verification & token set in localStorage
  const _onLoginSuccess = (u: User, t: string) => {
    // persist
    try {
      if (typeof window !== "undefined") {
        localStorage.setItem("token", t);
        localStorage.setItem("user", JSON.stringify(u));
      }
    } catch {
      // ignore localStorage errors
    }

    // update state
    setUser(u);
    setToken(t);
    setLoginOpen(false);

    if (resolverRef.current) {
      resolverRef.current.resolve(u as any);
      resolverRef.current = null;
    }
  };

  const onVerificationSuccess = (verifiedUser: User) => {
    setUser(verifiedUser);
    if (typeof window !== "undefined") {
      localStorage.setItem("user", JSON.stringify(verifiedUser));
    }
    setVerificationOpen(false);
    if (verificationResolverRef.current) {
      verificationResolverRef.current.resolve(verifiedUser as any);
      verificationResolverRef.current = null;
    }
  };
  const logout = async () => {
    // clear storage FIRST (most important)
    if (typeof window !== "undefined") {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
    }

    // then update state
    setUser(null);
    setToken(null);
    setLoginOpen(false);
  };


  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoggedIn: !!user,
        isBusiness: Boolean(user?.is_business_owner || user?.isBusiness),
        loginOpen,
        verificationOpen,
        openLogin,
        openVerification,
        ensureLoggedIn,
        ensureAccountVerified,
        closeLogin,
        closeVerification,
        _onLoginSuccess,
        logout,
        isHydrated,
        refreshUser,
        onVerificationSuccess,
      } as any}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
