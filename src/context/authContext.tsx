// src/context/AuthContext.tsx
"use client";
import React, { createContext, useContext, useEffect, useRef, useState, Suspense } from "react";
import { useSearchParams, usePathname } from "next/navigation";
import { API_BASE_URL } from "../lib/config";
import { isOffline } from "../lib/api/handler";

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
    // Skip refresh if offline — keep existing cached user data
    if (isOffline()) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/profile/me`, {
        headers: {
          "Authorization": `Bearer ${t}`,
        },
      });
      if (res.ok) {
        const json = await res.json();
        const updatedUser = {
          ...(json.data?.user || json.data || json),
          isBusiness: Boolean(json.data?.is_business_owner || json.data?.business),
          is_business_owner: Boolean(json.data?.is_business_owner),
          business_id: json.data?.business?.business_id || json.data?.business?.id,
          business_status: json.data?.business?.business_status || (json.data as any)?.business_status
        };

        // ⚠️ SAFETY CHECK: If token has changed in storage while this fetch was in flight,
        // do NOT save this user object or we'll overwrite the new account's data with old data.
        const currentToken = typeof window !== "undefined" ? localStorage.getItem("token") : null;
        if (currentToken && currentToken !== t) {
          console.warn("AuthContext: Token mismatch after refreshUser fetch. Discarding stale profile data.");
          return;
        }

        setUser(updatedUser);
        if (typeof window !== "undefined") {
          localStorage.setItem("user", JSON.stringify(updatedUser));
        }
        return updatedUser;
      }
    } catch (e) {
      // Silently ignore network errors when offline
      if (!isOffline()) {
        console.warn("AuthContext refreshUser error", e);
      }
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
        // Force cookie for middleware (7 days) - Path and SameSite are critical for correctness
        document.cookie = `token=${t}; path=/; max-age=604800; SameSite=Lax`;
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
      // Clear cookie for middleware
      document.cookie = "token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
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
      <Suspense fallback={null}>
        <AuthTrigger
          setLoginOpen={setLoginOpen}
          isHydrated={isHydrated}
          token={token}
        />
      </Suspense>
      {children}
    </AuthContext.Provider>
  );
}

function AuthTrigger({ setLoginOpen, isHydrated, token }: {
  setLoginOpen: (val: boolean) => void,
  isHydrated: boolean,
  token: string | null
}) {
  const searchParams = useSearchParams();
  const pathname = usePathname();

  useEffect(() => {
    if (isHydrated && searchParams.get("auth") === "required" && !token) {
      setLoginOpen(true);
    }
  }, [searchParams, pathname, isHydrated, token]);

  return null;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
