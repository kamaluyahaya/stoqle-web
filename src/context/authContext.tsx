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



  // Read localStorage only on client after mount
  useEffect(() => {
    mountedRef.current = true;
    try {
      const t = typeof window !== "undefined" ? localStorage.getItem("token") : null;
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

    return () => {
      mountedRef.current = false;
      window.removeEventListener("storage", onStorage);
    };
  }, []);

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
  const ensureLoggedIn = async (): Promise<boolean> => {
    if (mountedRef.current && token && user) return true;
    return await openLogin();
  };

  const ensureAccountVerified = async (): Promise<boolean> => {
    // first ensure logged in
    const loggedIn = await ensureLoggedIn();
    if (!loggedIn) return false;
 
    // then ensure phone and email
    if (user?.phone_no && user?.email) return true;
    return await openVerification();
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
      resolverRef.current.resolve(true);
      resolverRef.current = null;
    }
 
    // Check for verification after successful login
    if (!u.phone_no || !u.email) {
      setTimeout(() => {
        openVerification().then((verified) => {
           if (verified) {
              console.log("Account verified after login triggered");
           }
        });
      }, 500); // Small delay to let login modal exit smoothly
    }
  };

  const onVerificationSuccess = (verifiedUser: User) => {
      setUser(verifiedUser);
      if (typeof window !== "undefined") {
        localStorage.setItem("user", JSON.stringify(verifiedUser));
      }
      setVerificationOpen(false);
      if (verificationResolverRef.current) {
        verificationResolverRef.current.resolve(true);
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
