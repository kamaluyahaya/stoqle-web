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

  const getCachedProfile = (key: string) => state.profiles[key] || null;

  const setCachedProfile = (key: string, data: any) => {
    setState((prev) => ({
      ...prev,
      profiles: { 
        ...prev.profiles, 
        [key]: { ...(prev.profiles[key] || { mediaPosts: [], notePosts: [] }), data } 
      },
    }));
  };

  const setCachedProfilePosts = (key: string, mediaPosts: any[], notePosts: any[]) => {
    setState((prev) => ({
      ...prev,
      profiles: { 
        ...prev.profiles, 
        [key]: { ...(prev.profiles[key] || { data: null }), mediaPosts, notePosts } 
      },
    }));
  };

  const getCachedShop = (key: string) => state.shops[key] || null;

  const setCachedShop = (key: string, profile: any, products: any[]) => {
    setState((prev) => ({
      ...prev,
      shops: { ...prev.shops, [key]: { profile, products } },
    }));
  };

  const getScrollPosition = (key: string) => state.scrollPositions[key] || 0;

  const setScrollPosition = (key: string, position: number) => {
    setState((prev) => ({
      ...prev,
      scrollPositions: { ...prev.scrollPositions, [key]: position },
    }));
  };

  const getActiveTab = (key: string) => state.activeTabs[key] ?? null;

  const setActiveTab = (key: string, tab: string | number) => {
    setState((prev) => ({
      ...prev,
      activeTabs: { ...prev.activeTabs, [key]: tab },
    }));
  };

  const clearCache = () => {
    setState({
      profiles: {},
      shops: {},
      scrollPositions: {},
      activeTabs: {},
    });
  };

  return (
    <CacheContext.Provider
      value={{
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
      }}
    >
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
