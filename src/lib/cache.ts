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
  products: [] as any[],
  categories: [] as string[],
  page: 0,
  hasMore: true,
  category: "For you",
  likeData: {} as Record<number, { liked: boolean, count: number }>,
  scrollPos: 0,
  lastFetchedAt: 0,
  personalized: false
};

export const PROFILE_CACHE = {
  profileApi: null as any,
  mediaPosts: [] as any[],
  notePosts: [] as any[],
  vendorProducts: [] as any[],
  likedItems: [] as any[],
  activeTabIndex: 0,
  productLikeData: {} as Record<number, { liked: boolean, count: number }>,
  scrollPos: 0,
  lastFetchedAt: 0,
  lastLikedFetchedAt: 0,
};

export const MESSAGES_CACHE = {
  chatSessions: [] as any[],
  scrollPos: 0,
  lastFetchedAt: 0,
  roomsFetchedAt: {} as Record<string, number>,
};
