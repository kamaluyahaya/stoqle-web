"use client";

import React, { createContext, useContext, useState, ReactNode } from "react";

interface CacheState {
  profiles: Record<string, { data: any, mediaPosts: any[], notePosts: any[] }>;
  shops: Record<string, { profile: any, products: any[] }>;
  scrollPositions: Record<string, number>;
  activeTabs: Record<string, string | number>;
}

interface CacheContextType {
  getCachedProfile: (key: string) => { data: any, mediaPosts: any[], notePosts: any[] } | null;
  setCachedProfile: (key: string, data: any) => void;
  setCachedProfilePosts: (key: string, mediaPosts: any[], notePosts: any[]) => void;
  getCachedShop: (key: string) => { profile: any, products: any[] } | null;
  setCachedShop: (key: string, profile: any, products: any[]) => void;
  getScrollPosition: (key: string) => number;
  setScrollPosition: (key: string, position: number) => void;
  getActiveTab: (key: string) => string | number | null;
  setActiveTab: (key: string, tab: string | number) => void;
  clearCache: () => void;
}

const CacheContext = createContext<CacheContextType | undefined>(undefined);

export function CacheProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<CacheState>({
    profiles: {},
    shops: {},
    scrollPositions: {},
    activeTabs: {},
  });

  const getCachedProfile = React.useCallback((key: string) => state.profiles[key] || null, [state.profiles]);
  const setCachedProfile = React.useCallback((key: string, data: any) => {
    setState((prev) => ({
      ...prev,
      profiles: { 
        ...prev.profiles, 
        [key]: { ...(prev.profiles[key] || { mediaPosts: [], notePosts: [] }), data } 
      },
    }));
  }, []);
  const setCachedProfilePosts = React.useCallback((key: string, mediaPosts: any[], notePosts: any[]) => {
    setState((prev) => ({
      ...prev,
      profiles: { 
        ...prev.profiles, 
        [key]: { ...(prev.profiles[key] || { data: null }), mediaPosts, notePosts } 
      },
    }));
  }, []);
  const getCachedShop = React.useCallback((key: string) => state.shops[key] || null, [state.shops]);
  const setCachedShop = React.useCallback((key: string, profile: any, products: any[]) => {
    setState((prev) => ({
      ...prev,
      shops: { ...prev.shops, [key]: { profile, products } },
    }));
  }, []);
  const getScrollPosition = React.useCallback((key: string) => state.scrollPositions[key] || 0, [state.scrollPositions]);
  const setScrollPosition = React.useCallback((key: string, position: number) => {
    setState((prev) => ({
      ...prev,
      scrollPositions: { ...prev.scrollPositions, [key]: position },
    }));
  }, []);
  const getActiveTab = React.useCallback((key: string) => state.activeTabs[key] ?? null, [state.activeTabs]);
  const setActiveTab = React.useCallback((key: string, tab: string | number) => {
    setState((prev) => ({
      ...prev,
      activeTabs: { ...prev.activeTabs, [key]: tab },
    }));
  }, []);
  const clearCache = React.useCallback(() => {
    setState({
      profiles: {},
      shops: {},
      scrollPositions: {},
      activeTabs: {},
    });
  }, []);

  const value = React.useMemo(() => ({
    getCachedProfile,
    setCachedProfile,
    setCachedProfilePosts,
    getCachedShop,
    setCachedShop,
    getScrollPosition,
    setScrollPosition,
    getActiveTab,
    setActiveTab,
    clearCache,
  }), [
    getCachedProfile, setCachedProfile, setCachedProfilePosts,
    getCachedShop, setCachedShop, getScrollPosition,
    setScrollPosition, getActiveTab, setActiveTab, clearCache
  ]);

  return (
    <CacheContext.Provider value={value}>
      {children}
    </CacheContext.Provider>
  );
}

export function useCache() {
  const context = useContext(CacheContext);
  if (context === undefined) {
    throw new Error("useCache must be used within a CacheProvider");
  }
  return context;
}
