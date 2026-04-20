"use client";

import React, { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { getNextZIndex } from "@/src/lib/utils/z-index";
import { ChevronLeftIcon, ClockIcon, XMarkIcon, MagnifyingGlassIcon } from "@heroicons/react/24/outline";
import { useAuth } from "@/src/context/authContext";
import { fetchSearchSuggestions, fetchTrendingSearches, fetchRecentSearches, fetchUnifiedSearch } from "@/src/lib/api/searchApi";
import { useRouter } from "next/navigation";
import debounce from "lodash/debounce";
interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSearch?: (query: string, tab?: string) => void;
  initialQuery?: string;
}

// --- BLINK-EYE CACHE ENGINE ---
// Synchronous module-level cache to ensure zero-wait rendering
let BLINK_HISTORY: string[] = [];
let BLINK_TRENDS: any[] = [];

if (typeof window !== "undefined") {
  try {
    const savedHistory = localStorage.getItem("stoqle_search_history");
    const savedTrends = localStorage.getItem("stoqle_search_trends");
    if (savedHistory) BLINK_HISTORY = JSON.parse(savedHistory).slice(0, 5);
    if (savedTrends) BLINK_TRENDS = JSON.parse(savedTrends).slice(0, 10);
  } catch (e) {
    console.warn("Search blink-cache failed", e);
  }
}

export default function SearchModal({ isOpen, onClose, onSearch, initialQuery = "" }: SearchModalProps) {
  const { token, user } = useAuth();
  const router = useRouter();
  const [modalZIndex, setModalZIndex] = useState(() => getNextZIndex());
  useEffect(() => {
    if (isOpen) {
      setModalZIndex(getNextZIndex());
    }
  }, [isOpen]);
  const [searchQuery, setSearchQuery] = useState("");

  // Initialize with blink-cache for instant UI
  const [searchHistory, setSearchHistory] = useState<string[]>(BLINK_HISTORY);
  const [trendingSearches, setTrendingSearches] = useState<any[]>(BLINK_TRENDS);

  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [results, setResults] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [view, setView] = useState<"initial" | "results">("initial");

  // Sync scroll lock
  useEffect(() => {
    if (!isOpen) return;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "auto";
    };
  }, [isOpen]);

  // Background Revalidation logic (Silent updates)
  useEffect(() => {
    if (!isOpen) return;

    if (initialQuery) setSearchQuery(initialQuery);

    // 1. Silent History Fetch
    const loadHistory = async () => {
      try {
        if (token) {
          const res = await fetchRecentSearches(token);
          const history = res.data.slice(0, 5);
          setSearchHistory(history);
          BLINK_HISTORY = history; // Update global cache
          localStorage.setItem("stoqle_search_history", JSON.stringify(history));
        }
      } catch (err) {
        // Fallback to local is already in state
      }
    };

    // 2. Silent Trends Fetch
    const loadTrends = async () => {
      try {
        const res = await fetchTrendingSearches();
        const trends = res.data.slice(0, 10);
        setTrendingSearches(trends);
        BLINK_TRENDS = trends; // Update global cache
        localStorage.setItem("stoqle_search_trends", JSON.stringify(trends));
      } catch (err) {
        if (trendingSearches.length === 0) {
          setTrendingSearches(["Trending Shoes", "Office wear", "Home Decor", "Electronics"]);
        }
      }
    };

    loadHistory();
    loadTrends();

  }, [isOpen, token, initialQuery]);

  // Debounced Suggestion Fetching
  const debouncedSuggest = useCallback(
    debounce((query: string) => {
      if (query.trim().length < 1) {
        setSuggestions([]);
        return;
      }
      setIsSuggesting(true);
      fetchSearchSuggestions(query)
        .then(res => {
          if (res?.data) setSuggestions(res.data);
        })
        .catch(console.error)
        .finally(() => setIsSuggesting(false));
    }, 250),
    []
  );

  useEffect(() => {
    if (searchQuery.trim().length >= 1 && view === "initial") {
      debouncedSuggest(searchQuery);
    } else {
      setSuggestions([]);
      setIsSuggesting(false);
    }
  }, [searchQuery, view, debouncedSuggest]);

  const handleSearch = async (queryToSearch?: string, type?: string) => {
    const finalQuery = queryToSearch || searchQuery;
    if (!finalQuery.trim()) return;

    // Map suggestion type to TabType
    let targetTab = "all";
    if (type === "user") targetTab = "users";
    else if (type === "product" || type === "shop") targetTab = "products";
    else if (type === "post") targetTab = "posts";
    else if (type === "location") targetTab = "location";

    // Also track in history
    const newHistory = [finalQuery, ...searchHistory.filter(s => s !== finalQuery)].slice(0, 5);
    setSearchHistory(newHistory);
    localStorage.setItem("stoqle_search_history", JSON.stringify(newHistory));

    if (onSearch) onSearch(finalQuery, targetTab);
  };

  const handleRecentClick = (query: string, type?: string) => {
    setSearchQuery(query);
    handleSearch(query, type);
  };

  const handleRemoveHistory = (query: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newHistory = searchHistory.filter(s => s !== query);
    setSearchHistory(newHistory);
    localStorage.setItem("stoqle_search_history", JSON.stringify(newHistory));
  };

  const renderInitialView = () => (
    <div className="flex-1 overflow-auto p-5 space-y-10">
      {searchQuery.trim().length > 0 ? (
        /* Autocomplete Suggestions Section (Only show when typing) */
        suggestions.length > 0 ? (
          <div>
            <h5 className="text-[10px] font-bold text-slate-400  tracking-widest mb-4">Suggestions</h5>
            <div className="space-y-4">
              {suggestions.map((s, i) => {
                const highlightText = (text: string, query: string) => {
                  if (!query.trim()) return text;
                  const parts = text.split(new RegExp(`(${query})`, "gi"));
                  return parts.map((part, index) =>
                    part.toLowerCase() === query.toLowerCase() ? (
                      <span key={index} className="text-rose-500 font-bold">{part}</span>
                    ) : (
                      part
                    )
                  );
                };

                return (
                  <div
                    key={i}
                    className="flex items-center gap-3 cursor-pointer group min-w-0"
                    onClick={() => {
                      if (s.type === 'user' && s.username) router.push(`/${s.username}`);
                      else if (s.type === 'shop' && s.business_slug) router.push(`/${s.business_slug}`);
                      else handleRecentClick(s.text, s.type);
                    }}
                  >
                    <MagnifyingGlassIcon className="w-4 h-4 text-slate-300 group-hover:text-rose-500 shrink-0" />
                    <span className="text-sm font-medium text-slate-600 group-hover:text-slate-900 truncate flex-1">
                      {highlightText(s.text, searchQuery)}
                    </span>
                    <span className="text-[9px] bg-slate-50 text-slate-400 px-1.5 py-0.5 rounded  shrink-0">{s.type}</span>
                  </div>
                );
              })}
            </div>
          </div>
        ) : isSuggesting ? (
          <div className="flex flex-col items-center justify-center p-10 text-center opacity-50">
            <ClockIcon className="w-10 h-10 text-slate-200 mb-2 animate-pulse" />
            <p className="text-xs text-slate-400 font-medium">Looking for matches...</p>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center p-12 text-center">
            <div className="w-20 h-20 mb-4 flex items-center justify-center">
              <img
                src="/assets/images/search-icon.png"
                alt="No results"
                className="w-full h-full object-contain opacity-40 grayscale-[0.5]"
              />
            </div>
            <p className="text-sm font-bold text-slate-900">No suggestions for "{searchQuery}"</p>
            <p className="text-[11px] text-slate-400 mt-1">Try a different keyword or check spelling</p>
          </div>
        )
      ) : (
        <>
          {/* Recent Search Section (Only show when input is empty) */}
          {searchHistory.length > 0 && (
            <div>
              <h5 className="flex items-center gap-2 italic text-xs font-bold text-rose-500 font-mono tracking-widest mb-4">
                Recent Search
              </h5>
              <div className="space-y-3">
                {searchHistory.map(s => (
                  <div
                    key={s}
                    className="flex items-center justify-between py-1.5 border-b border-slate-50 cursor-pointer"
                    onClick={() => handleRecentClick(s)}
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1 mr-2">
                      <ClockIcon className="w-4 h-4 text-slate-300 shrink-0" />
                      <span className="text-sm text-slate-600 font-medium truncate">{s}</span>
                    </div>
                    <button
                      onClick={(e) => handleRemoveHistory(s, e)}
                      className="p-1 hover:bg-slate-50 rounded-full transition-colors"
                    >
                      <XMarkIcon className="w-4 h-4 text-slate-300" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Trending Search Section */}
          <div>
            <h5 className="flex items-center gap-2 italic text-md font-black italic tracking-[0.15em] mb-6 bg-gradient-to-r from-orange-500 via-rose-500 to-rose-700 bg-clip-text text-transparent">
              🔥 Trending Search
            </h5>
            <div className="space-y-4">
              {trendingSearches.length > 0 ? (
                trendingSearches.slice(0, 10).map((s, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between group cursor-pointer"
                    onClick={() => {
                      const handle = s.username || s.business_slug;
                      if (handle) router.push(`/${handle}`);
                      else handleRecentClick(s.query, s.type);
                    }}
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <span className={`w-5 text-[15px] font-black italic transition-colors flex-shrink-0 ${idx === 0 ? 'text-orange-600' :
                        idx === 1 ? 'text-orange-500' :
                          idx === 2 ? 'text-amber-500' :
                            'text-slate-300'
                        }`}>
                        {idx + 1}
                      </span>
                      <div className="w-10 h-10 rounded bg-slate-50 overflow-hidden border border-slate-100 flex-shrink-0 flex items-center justify-center">
                        {s.image ? (
                          <img
                            src={s.image.startsWith('http') ? s.image : `https://stoqle.com/${s.image}`}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <span className="text-xs font-bold text-slate-300 ">
                            {s.display_name?.[0] || 'S'}
                          </span>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] font-bold text-slate-900 truncate group-hover:text-rose-500 transition-colors">
                          {s.display_name}
                        </p>
                        <p className="text-[10px] text-slate-400 font-medium  tracking-tighter truncate">
                          {s.type}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 bg-slate-50 px-2 py-0.5 rounded-full border border-slate-100">
                      <MagnifyingGlassIcon className="w-2.5 h-2.5 text-slate-400" />
                      <span className="text-[10px] font-black text-slate-600">{s.total || 0}</span>
                    </div>
                  </div>
                ))
              ) : (
                // Silent Loading Skeletons for the blink-eye experience
                Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3 animate-pulse">
                    <div className="w-5 h-5 bg-slate-100 rounded" />
                    <div className="w-10 h-10 bg-slate-100 rounded" />
                    <div className="flex-1 space-y-2">
                      <div className="w-24 h-3 bg-slate-100 rounded" />
                      <div className="w-16 h-2 bg-slate-50 rounded" />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );

  const renderResultsView = () => (
    <div className="flex-1 overflow-auto p-5 space-y-8">
      {isLoading ? (
        <div className="flex flex-col items-center justify-center h-64 space-y-4">
          <div className="w-8 h-8 border-4 border-rose-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-slate-400 font-medium">Searching for "{searchQuery}"...</p>
        </div>
      ) : results ? (
        <>
          {/* Grouped Results */}
          {results.products?.length > 0 && (
            <section>
              <h6 className="text-[10px] font-black  tracking-[0.2em] text-slate-400 mb-3 ml-1">Products</h6>
              <div className="space-y-4">
                {results.products.map((p: any) => (
                  <div key={p.id} className="flex items-center gap-3 p-1.5 bg-slate-50/50 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer group" onClick={() => handleRecentClick(p.name, 'product')}>
                    <div className="w-12 h-12 bg-slate-100 rounded-lg flex-shrink-0 overflow-hidden border border-slate-100 flex items-center justify-center">
                      {p.image ? (
                        <img
                          src={p.image.startsWith('http') ? p.image : `https://stoqle.com/${p.image}`}
                          alt=""
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                        />
                      ) : (
                        <span className="text-[10px] font-bold text-slate-300 ">{p.name?.[0] || 'P'}</span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-bold text-slate-900 truncate">{p.name}</p>
                      <p className="text-[11px] text-slate-500 truncate">₦{(p.price ?? 0).toLocaleString()}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {results.shops?.length > 0 && (
            <section>
              <h6 className="text-[10px] font-black  tracking-[0.2em] text-slate-400 mb-3 ml-1">Shops</h6>
              <div className="grid grid-cols-2 gap-3">
                {results.shops.map((s: any) => (
                  <div key={s.id} className="flex items-center gap-3 p-2 border border-slate-100 rounded-xl hover:shadow-sm transition-all cursor-pointer bg-white" onClick={() => handleRecentClick(s.name, 'shop')}>
                    <div className="w-10 h-10 rounded-full bg-rose-50 flex items-center justify-center text-rose-500 font-bold text-xs overflow-hidden border border-slate-50 flex-shrink-0 ">
                      {s.image ? (
                        <img
                          src={s.image.startsWith('http') ? s.image : `https://stoqle.com/${s.image}`}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        s.name?.[0] || 'S'
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-bold text-slate-900 truncate">{s.name}</p>
                      {s.is_verified && <span className="text-[9px] text-emerald-600 font-bold">Verified</span>}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {results.users?.length > 0 && (
            <section>
              <h6 className="text-[10px] font-black  tracking-[0.2em] text-slate-400 mb-3 ml-1">People</h6>
              <div className="space-y-3">
                {results.users.map((u: any) => (
                  <div
                    key={u.id}
                    className="flex items-center gap-3 p-1 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer"
                    onClick={() => {
                      const handle = u.username;
                      const profilePath = (user?.id === u.id || user?.user_id === u.id)
                        ? "/profile"
                        : handle ? `/${handle}` : `/user/profile/${u.id}`;
                      router.push(profilePath);
                      onClose();
                    }}
                  >
                    <div className="w-10 h-10 rounded-full bg-slate-100 overflow-hidden border border-slate-50 flex items-center justify-center flex-shrink-0">
                      {u.image ? (
                        <img
                          src={u.image.startsWith('http') ? u.image : `https://stoqle.com/${u.image}`}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="text-xs font-bold text-slate-300">{u.name?.[0] || '@'}</span>
                      )}
                    </div>
                    <div>
                      <p className="text-[13px] font-bold text-slate-900 group-hover:text-rose-500 transition-colors">{u.name}</p>
                      <p className="text-[11px] text-slate-400">User Profile</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {(!results.products?.length && !results.shops?.length && !results.users?.length) && (
            <div className="flex flex-col items-center justify-center h-64 text-center px-10">
              <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                <XMarkIcon className="w-8 h-8 text-slate-200" />
              </div>
              <p className="text-[14px] font-bold text-slate-900">No results found</p>
              <p className="text-[12px] text-slate-500 mt-1">We couldn't find anything matching "{searchQuery}"</p>
              <button
                onClick={() => setView("initial")}
                className="mt-6 text-xs font-bold text-rose-500  tracking-widest"
              >
                Clear Search
              </button>
            </div>
          )}
        </>
      ) : null}
    </div>
  );

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          transition={{
            type: "spring",
            damping: 25,
            stiffness: 300,
            opacity: { duration: 0.2 }
          }}
          style={{ willChange: "transform, opacity", zIndex: modalZIndex }}
          className="fixed inset-0 bg-white flex flex-col"
          onMouseDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
        >
          <div className="h-14 flex items-center px-2 gap-2 border-b border-slate-50 bg-white sticky top-0 z-20">
            <button
              onClick={() => {
                if (view === "results") {
                  setView("initial");
                  setResults(null);
                } else {
                  onClose();
                }
              }}
              className="p-2 flex items-center justify-center rounded-full active:bg-slate-50 transition-colors"
            >
              <ChevronLeftIcon className="w-6 h-6 text-slate-900 stroke-[2.5]" />
            </button>

            <div className="flex-1 bg-slate-100 h-10 rounded-full flex items-center pl-4 pr-1 gap-2 border border-slate-200/50">
              <input
                autoFocus
                type="text"
                placeholder="Search products, brands, people..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                className="bg-transparent border-none outline-none text-[13px] w-full text-slate-900 font-medium placeholder:text-slate-400"
              />
              {searchQuery && (
                <button
                  onClick={() => {
                    setSearchQuery("");
                    setView("initial");
                    setResults(null);
                  }}
                  className="p-1.5 hover:bg-slate-200 rounded-full transition-colors mr-1"
                >
                  <XMarkIcon className="w-3 h-3 text-slate-400" />
                </button>
              )}
              <button
                onClick={() => handleSearch()}
                disabled={isLoading}
                className="bg-rose-500 text-white text-[11px] font-black px-5 h-10 rounded-full flex items-center justify-center transition-all active:scale-95 tracking-tighter disabled:opacity-50"
              >
                {isLoading ? "..." : "Search"}
              </button>
            </div>
          </div>

          <div className="flex-1 flex flex-col min-h-0">
            {view === "initial" ? renderInitialView() : renderResultsView()}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
