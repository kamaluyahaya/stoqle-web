"use client";
import React, { createContext, useContext, useEffect, useRef, useState, Suspense } from "react";
import { useSearchParams, usePathname } from "next/navigation";
import { isOffline, safeFetch } from "@/src/lib/api/handler";
import { API_BASE_URL } from "@/src/lib/config";

type User = any; 

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
  logout: () => Promise<void>;
  isHydrated: boolean;
  refreshUser: () => Promise<void>;
  _onLoginSuccess: (user: User, token: string) => void;
  onVerificationSuccess: (user: User) => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loginOpen, setLoginOpen] = useState(false);
  const [verificationOpen, setVerificationOpen] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);

  const resolverRef = useRef<LoginResolver>(null);
  const verificationResolverRef = useRef<LoginResolver>(null);
  const mountedRef = useRef(false);
  // Guards: prevents a background refreshUser from overwriting auth state mid-switch
  const switchGuardRef = useRef(false);
  // Tracks heartbeat start time for active_duration calculation
  const heartbeatStartRef = useRef<number>(Date.now());

  const refreshUser = async () => {
    // Bail out during an active account switch to prevent stale data overwrite
    if (switchGuardRef.current) return;
    const t = typeof window !== "undefined" ? localStorage.getItem("token") : token;
    if (!t) return;
    
    // safeFetch handles offline state pre-emptively
    try {
      const json = await safeFetch<any>("/api/auth/profile/me", {
        headers: {
          "Authorization": `Bearer ${t}`,
        },
      });

      // If safeFetch returned the silent offline object, json.isOffline will be true
      if (!json || json.isOffline) return;

      const updatedUser = {
        ...(json.data?.user || json.data || json),
        isBusiness: Boolean(json.data?.is_business_owner || json.data?.business),
        is_business_owner: Boolean(json.data?.is_business_owner),
        business_id: json.data?.business?.business_id || json.data?.business?.id,
        business_status: json.data?.business?.business_status || (json.data as any)?.business_status
      };

      const currentToken = typeof window !== "undefined" ? localStorage.getItem("token") : null;
      if (currentToken && currentToken !== t) {
        return;
      }

      setUser(updatedUser);
      if (typeof window !== "undefined") {
        localStorage.setItem("user", JSON.stringify(updatedUser));
      }
      return updatedUser;
    } catch (e) {
      // safeFetch only throws for non-GET errors or non-offline errors by default now
      // but we still catch just in case
    }
  };

  useEffect(() => {
    mountedRef.current = true;
    let t: string | null = null;
    try {
      t = typeof window !== "undefined" ? localStorage.getItem("token") : null;
      const uRaw = typeof window !== "undefined" ? localStorage.getItem("user") : null;
      setToken(t);
      setUser(uRaw ? JSON.parse(uRaw) : null);
    } catch (e) {
      setToken(null);
      setUser(null);
    }

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

    if (t) {
      refreshUser();
    }

    return () => {
      mountedRef.current = false;
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  useEffect(() => {
    if (!token || !user) return;

    const interval = setInterval(() => {
      refreshUser();
    }, 60000);

    const handleFocus = () => refreshUser();
    window.addEventListener("focus", handleFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", handleFocus);
    };
  }, [token, !!user]);

  // ── Session heartbeat ────────────────────────────────────────────────────
  // Pings the backend every 60 seconds to update active_duration_seconds
  // and last_active_at in the user_sessions table.
  useEffect(() => {
    if (!token || !user) return;

    const INTERVAL_MS = 60_000; // 60 seconds
    heartbeatStartRef.current = Date.now();

    const sendHeartbeat = async () => {
      if (!token || switchGuardRef.current) return;
      try {
        const currentToken = typeof window !== "undefined" ? localStorage.getItem("token") : token;
        if (!currentToken) return;
        await fetch(`${API_BASE_URL}/api/activity/heartbeat`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${currentToken}`,
          },
          body: JSON.stringify({ delta_seconds: Math.round(INTERVAL_MS / 1000) }),
        });
      } catch (e) {
        // Heartbeat is best-effort — never throw
      }
    };

    const heartbeatTimer = setInterval(sendHeartbeat, INTERVAL_MS);

    return () => {
      clearInterval(heartbeatTimer);
    };
  }, [token, !!user]);

  const openLogin = (): Promise<boolean> => {
    setLoginOpen(true);
    return new Promise((resolve) => {
      resolverRef.current = { resolve };
    });
  };

  const openVerification = (): Promise<boolean> => {
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
      resolverRef.current.resolve(false);
      resolverRef.current = null;
    }
  };

  const ensureLoggedIn = async (): Promise<User | null> => {
    if (mountedRef.current && token && user) return user;
    return await openLogin();
  };

  const ensureAccountVerified = async (): Promise<User | null> => {
    const loggedIn = await ensureLoggedIn();
    if (!loggedIn) return null;

    const updatedUser = await refreshUser();
    const currentUser = updatedUser || user;

    if (currentUser?.phone_no && currentUser?.email) return currentUser;

    const result = await openVerification();
    return result as any;
  };

  const _onLoginSuccess = (u: User, t: string) => {
    // Engage the switch guard so in-flight refreshUser calls don't stomp the new session
    switchGuardRef.current = true;
    try {
      if (typeof window !== "undefined") {
        localStorage.setItem("token", t);
        localStorage.setItem("user", JSON.stringify(u));
        // Persistent cookie — no max-age means session cookie; user stays logged in
        // until they manually log out or clear browser data.
        document.cookie = `token=${t}; path=/; max-age=31536000; SameSite=Lax`;
      }
    } catch {}

    setUser(u);
    setToken(t);
    setLoginOpen(false);

    if (resolverRef.current) {
      resolverRef.current.resolve(u as any);
      resolverRef.current = null;
    }

    // Release the guard after a short delay — long enough for React to re-render
    // with the new token, preventing the next refreshUser tick from using the old token.
    setTimeout(() => {
      switchGuardRef.current = false;
    }, 1500);
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
    if (typeof window !== "undefined") {
      // Mark as offline on backend before wiping local state
      if (token) {
        fetch(`${API_BASE_URL}/api/activity/generic`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ action: "switch_away" }),
        }).catch(() => {});
      }

      localStorage.removeItem("token");
      localStorage.removeItem("user");
      document.cookie = "token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
    }

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
