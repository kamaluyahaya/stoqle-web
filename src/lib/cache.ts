// src/lib/cache.ts

export const DISCOVERY_CACHE = {
  posts: [] as any[],
  offset: 0,
  hasMore: true,
  category: "Recommend",
  scrollPos: 0,
  lastFetchedAt: 0,
  personalized: false
};

export const MARKET_CACHE = {
  categories: [] as string[],
  activeCategory: "For you",
  categoryData: {} as Record<string, {
    products: any[],
    page: number,
    hasMore: boolean,
    scrollPos: number,
    socialCursor: string | null,
    lastFetchedAt: number,
    personalized: boolean
  }>,
  likeData: {} as Record<number, { liked: boolean, count: number }>,
  globalScrollPos: 0,
};

export const PROFILE_CACHE = {
  profileApi: null as any,
  mediaPosts: [] as any[],
  notePosts: [] as any[],
  vendorProducts: [] as any[],
  likedItems: [] as any[],
  activeTabIndex: 0,
  activeVisibility: 'public' as 'public' | 'private' | 'friends',
  visibilityMap: {} as Record<string, { media: any[], notes: any[] }>,
  visibilityCounts: {
    public: { posts: 0, notes: 0 },
    private: { posts: 0, notes: 0 },
    friends: { posts: 0, notes: 0 }
  },
  productLikeData: {} as Record<number, { liked: boolean, count: number }>,
  scrollPos: 0,
  lastFetchedAt: 0,
  lastVisibilityFetchAt: {} as Record<string, number>,
  lastLikedFetchedAt: 0,
};

export const MESSAGES_CACHE = {
  chatSessions: [] as any[],
  scrollPos: 0,
  lastFetchedAt: 0,
  roomsFetchedAt: {} as Record<string, number>,
};

export const SHOP_CACHE: Record<string, {
  profileApi: any,
  products: any[],
  lastFetchedAt: number,
  activeNav: string,
  categories: string[],
}> = {};
