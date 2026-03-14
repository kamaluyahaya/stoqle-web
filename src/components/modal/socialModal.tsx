"use client";

import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { API_BASE_URL } from "@/src/lib/config";
import { useAuth } from "@/src/context/authContext";
import { ChevronLeftIcon, XMarkIcon, MagnifyingGlassIcon, UserPlusIcon, UserMinusIcon, ChatBubbleLeftRightIcon } from "@heroicons/react/24/outline";
import { useRouter } from "next/navigation";

type SocialUser = {
  user_id: string | number;
  full_name: string;
  name?: string;
  username?: string;
  profile_pic?: string;
  avatar?: string;
  is_followed_by_viewer?: boolean;
  is_following_viewer?: boolean;
  total_followers?: number;
  total_posts?: number;
  bio?: string;
};

type SocialTab = "friends" | "followers" | "following" | "recommend";

interface SocialModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string | number;
  initialTab?: SocialTab;
}

const SocialModal: React.FC<SocialModalProps> = ({ isOpen, onClose, userId, initialTab = "followers" }) => {
  const [activeTab, setActiveTab] = useState<SocialTab>(initialTab);
  const [users, setUsers] = useState<SocialUser[]>([]);
  const [recommendedUsers, setRecommendedUsers] = useState<SocialUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [unfollowConfirm, setUnfollowConfirm] = useState<SocialUser | null>(null);
  const cacheRef = useRef<Record<string, { users: SocialUser[]; timestamp: number }>>({});
  const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  const auth = useAuth() as any;
  const token = auth?.token ?? (typeof window !== "undefined" ? localStorage.getItem("token") : null);
  const router = useRouter();

  const tabs: { id: SocialTab; label: string }[] = [
    { id: "friends", label: "Friends" },
    { id: "followers", label: "Followers" },
    { id: "following", label: "Following" },
    { id: "recommend", label: "Recommend" }
  ];

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
      setSearchQuery("");
      setRecommendedUsers([]);
    }
  }, [isOpen, initialTab]);

  useEffect(() => {
    if (isOpen) {
      fetchData();
    }
  }, [isOpen, activeTab, userId]);

  const fetchData = async () => {
    // Check cache first
    const cacheKey = `${activeTab}-${userId}`;
    const cachedData = cacheRef.current[cacheKey];
    if (cachedData && Date.now() - cachedData.timestamp < CACHE_TTL) {
      setUsers(cachedData.users);
      // Also grab cached recommendations if not on recommend tab
      if (activeTab !== "recommend") {
        const recCache = cacheRef.current["recommendations"];
        if (recCache && Date.now() - recCache.timestamp < CACHE_TTL) {
          const existingIds = new Set(cachedData.users.map(u => String(u.user_id)));
          setRecommendedUsers(recCache.users.filter(u => !existingIds.has(String(u.user_id))).slice(0, 5));
        } else {
          fetchRecommendations(cachedData.users);
        }
      } else {
        setRecommendedUsers([]);
      }
      return;
    }

    setLoading(true);
    try {
      let url = "";
      if (activeTab === "followers") {
        url = `${API_BASE_URL}/api/users/${userId}/followers`;
      } else if (activeTab === "following") {
        url = `${API_BASE_URL}/api/users/${userId}/following`;
      } else if (activeTab === "recommend") {
        url = `${API_BASE_URL}/api/users/suggestions`;
      } else if (activeTab === "friends") {
        url = `${API_BASE_URL}/api/users/${userId}/following`;
      }

      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch(url, { headers });
      const data = await res.json();

      let rawList = [];
      if (activeTab === "recommend") {
        const usersList = data?.data?.users || [];
        const vendorsList = data?.data?.vendors || [];
        rawList = [...usersList, ...vendorsList];
      } else {
        rawList = data?.data?.items ?? data?.items ?? [];
      }

      const list: SocialUser[] = (Array.isArray(rawList) ? rawList : []).map((u: any) => ({
        ...u,
        user_id: u.user_id || u.id,
        full_name: u.business_name || u.full_name || u.name || "Stoqle User",
        profile_pic: u.business_logo || u.profile_pic || u.avatar || `https://i.pravatar.cc/150?u=${u.user_id || u.id}`
      }));

      let filteredList = list;
      if (activeTab === "friends") {
        filteredList = list.filter((u: SocialUser) => u.is_following_viewer);
      }

      setUsers(filteredList);

      // Update Tab Cache
      cacheRef.current[cacheKey] = { users: filteredList, timestamp: Date.now() };

      // Fetch recommendations if not on recommend tab
      if (activeTab !== "recommend") {
        fetchRecommendations(filteredList);
      } else {
        setRecommendedUsers([]);
      }

    } catch (err) {
      console.error("Failed to fetch users:", err);
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchRecommendations = async (currentList: SocialUser[]) => {
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const recRes = await fetch(`${API_BASE_URL}/api/users/suggestions`, { headers });
      const recData = await recRes.json();
      const recUsersList = recData?.data?.users || [];
      const recVendorsList = recData?.data?.vendors || [];
      const recRawList = [...recUsersList, ...recVendorsList];

      const recList: SocialUser[] = (Array.isArray(recRawList) ? recRawList : []).map((u: any) => ({
        ...u,
        user_id: u.user_id || u.id,
        full_name: u.business_name || u.full_name || u.name || "Stoqle User",
        profile_pic: u.business_logo || u.profile_pic || u.avatar || `https://i.pravatar.cc/150?u=${u.user_id || u.id}`
      }));

      // Cache the raw recommendations list
      cacheRef.current["recommendations"] = { users: recList, timestamp: Date.now() };

      // Filter out users that are already in the main list
      const existingIds = new Set(currentList.map(u => String(u.user_id)));
      setRecommendedUsers(recList.filter(u => !existingIds.has(String(u.user_id))).slice(0, 5));
    } catch (recErr) {
      console.error("Failed to fetch recommendations:", recErr);
    }
  };

  const handleFollowToggle = async (targetUserId: string | number, currentStatus: boolean) => {
    if (!token) {
      onClose();
      router.push("/login");
      return;
    }

    // Save user for rollback if needed (minimal implementation)
    const targetUser = users.find(u => String(u.user_id) === String(targetUserId));

    // Optimistic update
    const updateStateAndCache = (updater: (prev: SocialUser[]) => SocialUser[]) => {
      setUsers(prev => {
        const next = updater(prev);
        // Sync cache
        const cacheKey = `${activeTab}-${userId}`;
        if (cacheRef.current[cacheKey]) {
          cacheRef.current[cacheKey].users = next;
        }
        return next;
      });
    };

    updateStateAndCache(prev => {
      // If following from recommendations, or unfollowing from following/friends, we remove immediately
      if ((activeTab === "recommend" && !currentStatus) ||
        ((activeTab === "following" || activeTab === "friends") && currentStatus)) {
        return prev.filter(u => String(u.user_id) !== String(targetUserId));
      }

      // Otherwise regular toggle
      return prev.map(u =>
        String(u.user_id) === String(targetUserId)
          ? { ...u, is_followed_by_viewer: !currentStatus }
          : u
      );
    });

    setRecommendedUsers(prev => {
      const next = prev.map(u =>
        String(u.user_id) === String(targetUserId)
          ? { ...u, is_followed_by_viewer: !currentStatus }
          : u
      );
      // Update recommendations cache
      if (cacheRef.current["recommendations"]) {
        cacheRef.current["recommendations"].users = cacheRef.current["recommendations"].users.map(u =>
          String(u.user_id) === String(targetUserId)
            ? { ...u, is_followed_by_viewer: !currentStatus }
            : u
        );
      }
      return next;
    });

    try {
      const endpoint = currentStatus ? "unfollow" : "follow";
      const res = await fetch(`${API_BASE_URL}/api/follow/${targetUserId}/${endpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        }
      });
      if (!res.ok) throw new Error("Failed to update follow status");
    } catch (err) {
      console.error(err);
      // Rollback
      if (targetUser) {
        updateStateAndCache(prev => {
          if (prev.find(u => String(u.user_id) === String(targetUserId))) {
            return prev.map(u => String(u.user_id) === String(targetUserId) ? targetUser : u);
          }
          return [...prev, targetUser]; // Put it back if it was filtered
        });
      }
    }
  };

  const filteredUsers = users.filter(u =>
    (u.full_name || u.name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
    (u.username || "").toLowerCase().includes(searchQuery.toLowerCase())
  );

  useEffect(() => {
    if (isOpen) {
      const originalStyle = window.getComputedStyle(document.body).overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = originalStyle;
      };
    }
  }, [isOpen]);

  const handleUserClick = (targetId: string | number) => {
    onClose();
    router.push(`/user/profile/${targetId}`);
  };

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <div
            key="social-modal-overlay"
            className="fixed inset-0 z-[1000] flex items-center justify-center sm:p-6"
          >
            <motion.div
              key="social-modal-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onClose}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />

            <motion.div
              key="social-modal-content"
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full bg-white shadow-2xl overflow-hidden flex flex-col h-[100dvh] sm:h-[80vh] sm:max-w-md sm:rounded-3xl"
            >
              {/* Header */}
              <div className="px-6 py-4 flex items-center justify-between border-b border-slate-50 shrink-0">
                <h3 className="text-lg font-bold text-slate-900">Community</h3>
                <button
                  onClick={onClose}
                  className="p-2 -mr-2 rounded-full hover:bg-slate-50 text-slate-400 transition-colors"
                >
                  <XMarkIcon className="w-6 h-6" />
                </button>
              </div>

              {/* Tabs */}
              <div className="px-6 flex items-center gap-6 overflow-x-auto no-scrollbar border-b border-slate-100 shrink-0">
                {tabs.map((tab) => {
                  const isActive = activeTab === tab.id;

                  return (
                    <button
                      key={tab.id}
                      onClick={() => {
                        setActiveTab(tab.id);
                        setSearchQuery("");
                      }}
                      className={`relative py-3 text-sm font-bold whitespace-nowrap transition-all ${isActive
                          ? "text-red-500"
                          : "text-slate-400 hover:text-slate-600"
                        }`}
                    >
                      {tab.label}
                      {isActive && (
                        <motion.div
                          layoutId="activeTabSocial"
                          className="absolute bottom-0 left-0 right-0 h-0.5 bg-red-500 rounded-t-full"
                          transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                        />
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Search */}
              {users.length > 0 && (
                <div className="px-6 py-3 shrink-0 flex flex-col gap-3">
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                      <MagnifyingGlassIcon className="w-4 h-4 text-slate-400 group-focus-within:text-red-500 transition-colors" />
                    </div>
                    <input
                      type="text"
                      placeholder={
                        activeTab === "following" ? "Search people you follow..." :
                          activeTab === "followers" ? "Search your followers..." :
                            activeTab === "friends" ? "Search your mutual friends..." :
                              "Search recommendations..."
                      }
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-11 pr-4 py-2.5 bg-slate-50 border-none rounded-2xl text-sm focus:ring-2 focus:ring-red-100 placeholder:text-slate-400 focus:bg-white transition-all outline-none"
                    />
                  </div>
                  <div className="text-xs font-bold text-slate-900 pl-1 capitalize">
                    {activeTab === "recommend" ? "Recommendations" : activeTab} ({users.length})
                  </div>
                </div>
              )}

              {/* List */}
              <div className="flex-1 overflow-y-auto px-4 pb-6 custom-scrollbar">
                {loading ? (
                  <div className="flex flex-col items-center justify-center py-20 gap-4">
                    <div className="w-8 h-8 border-3 border-red-500 border-t-transparent rounded-full animate-spin" />
                    <p className="text-xs font-medium text-slate-400 animate-pulse">Gathering community...</p>
                  </div>
                ) : filteredUsers.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-center px-10">
                    <img src="/assets/images/message-icons.png" alt="No users found" className="w-24 opacity-50 mb-4" />
                    <p className="text-sm font-bold text-slate-900">
                      {searchQuery
                        ? "No users match your search"
                        : activeTab === "followers"
                          ? "You don't have any followers yet"
                          : activeTab === "following"
                            ? "You aren't following anyone yet"
                            : activeTab === "friends"
                              ? "You don't have any mutual friends yet"
                              : "No recommendations available"}
                    </p>
                    <p className="text-xs text-slate-400 mt-1">
                      {searchQuery
                        ? "Try a different spelling or name"
                        : activeTab === "followers"
                          ? "Keep posting to grow your community!"
                          : activeTab === "following"
                            ? "Explore to find people and businesses to follow!"
                            : activeTab === "friends"
                              ? "When you follow someone who follows you, they appear here."
                              : "Check back later for more suggestions."}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {filteredUsers.map((user, idx) => (
                      <motion.div
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.03 }}
                        key={`social-user-${user.user_id}-${idx}`}
                        className="flex items-center gap-3 p-3 rounded-2xl hover:bg-slate-50 active:bg-slate-100 transition-all cursor-pointer group"
                        onClick={() => handleUserClick(user.user_id)}
                      >
                        <div className="relative flex-shrink-0">
                          <img
                            src={user.profile_pic || user.avatar || `https://i.pravatar.cc/150?u=${user.user_id}`}
                            alt={user.full_name || user.name}
                            className="w-12 h-12 rounded-full object-cover ring-2 ring-white shadow-sm"
                          />
                          {user.is_following_viewer && (
                            <div className="absolute -bottom-1 -right-1 bg-green-500 border-2 border-white w-4 h-4 rounded-full flex items-center justify-center" title="Mutual Friend">
                              <div className="w-1.5 h-1.5 bg-white rounded-full" />
                            </div>
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <h4 className="text-sm font-bold text-slate-900 truncate">
                            {user.full_name || user.name}
                          </h4>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[10px] text-slate-400 font-medium truncate">
                              @{user.username || 'stoqleID' + user.user_id}
                            </span>
                            {user.total_followers !== undefined && (
                              <>
                                <span className="w-1 h-1 bg-slate-200 rounded-full" />
                                <span className="text-[10px] text-slate-500 font-bold">
                                  {user.total_followers} followers
                                </span>
                              </>
                            )}
                          </div>
                        </div>

                        <div className="shrink-0">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (user.is_followed_by_viewer) {
                                setUnfollowConfirm(user);
                              } else {
                                handleFollowToggle(user.user_id, !!user.is_followed_by_viewer);
                              }
                            }}
                            className={`px-2.5 py-0.5 rounded-full border-[0.5px] text-[9px] font-bold transition-all active:scale-95 ${user.is_followed_by_viewer
                                ? "border-slate-200 text-slate-400 hover:bg-slate-50"
                                : "border-red-500 text-red-500 hover:bg-red-50"
                              }`}
                          >
                            {user.is_followed_by_viewer
                              ? (activeTab === 'friends' ? 'Friends' : 'Following')
                              : (activeTab === 'followers' ? 'Follow Back' : 'Follow')}
                          </button>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}

                {/* Recommendations Section */}
                {!loading && activeTab !== "recommend" && recommendedUsers.length > 0 && !searchQuery && (
                  <div className="mt-8 border-t border-slate-100 pt-6">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="text-xs font-bold text-slate-900 tracking-wide px-2">Recommended for you</h4>
                      <button
                        onClick={() => {
                          setActiveTab("recommend");
                          setSearchQuery("");
                        }}
                        className="text-xs font-bold text-red-500 hover:text-red-600 px-2"
                      >
                        See all
                      </button>
                    </div>
                    <div className="space-y-1">
                      {recommendedUsers.map((user, idx) => (
                        <motion.div
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: idx * 0.03 }}
                          key={`rec-user-${user.user_id}-${idx}`}
                          className="flex items-center gap-3 p-3 rounded-2xl hover:bg-slate-50 active:bg-slate-100 transition-all cursor-pointer group"
                          onClick={() => handleUserClick(user.user_id)}
                        >
                          <div className="relative flex-shrink-0">
                            <img
                              src={user.profile_pic || user.avatar || `https://i.pravatar.cc/150?u=${user.user_id}`}
                              alt={user.full_name || user.name}
                              className="w-12 h-12 rounded-full object-cover ring-2 ring-slate-100 shadow-sm"
                            />
                            {user.is_following_viewer && (
                              <div className="absolute -bottom-1 -right-1 bg-green-500 border-2 border-white w-4 h-4 rounded-full flex items-center justify-center" title="Mutual Friend">
                                <div className="w-1.5 h-1.5 bg-white rounded-full" />
                              </div>
                            )}
                          </div>

                          <div className="flex-1 min-w-0">
                            <h4 className="text-sm font-bold text-slate-900 truncate">
                              {user.full_name || user.name}
                            </h4>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-[10px] text-slate-400 font-medium truncate">
                                @{user.username || 'stoqleID' + user.user_id}
                              </span>
                              {user.total_followers !== undefined && (
                                <>
                                  <span className="w-1 h-1 bg-slate-200 rounded-full" />
                                  <span className="text-[10px] text-slate-500 font-bold">
                                    {user.total_followers} followers
                                  </span>
                                </>
                              )}
                            </div>
                          </div>

                          <div className="shrink-0">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (user.is_followed_by_viewer) {
                                  setUnfollowConfirm(user);
                                } else {
                                  handleFollowToggle(user.user_id, !!user.is_followed_by_viewer);
                                }
                              }}
                              className={`px-3 py-1 rounded-full border-[0.5px] text-[10px] font-bold transition-all active:scale-95 ${user.is_followed_by_viewer
                                  ? "border-slate-200 text-slate-400 hover:bg-slate-50"
                                  : "border-red-500 text-red-500 hover:bg-red-50"
                                }`}
                            >
                              {user.is_followed_by_viewer ? 'Following' : 'Follow'}
                            </button>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Footer Stats / PWA Hint */}
              <div className="px-6 py-3 bg-slate-50/50 flex items-center justify-between shrink-0">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  {filteredUsers.length} Users Listed
                </span>
                <div className="flex items-center gap-1.5 opacity-40">
                  <span className="w-1.5 h-1.5 bg-red-500 rounded-full" />
                  <span className="text-[10px] font-bold text-slate-900 uppercase">Live Updates</span>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {unfollowConfirm && (
          <div className="fixed inset-0 z-[1100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setUnfollowConfirm(null)}
              className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 10 }}
              className="relative w-full max-w-[280px] bg-white rounded-3xl p-6 shadow-2xl text-center"
            >
              <div className="mb-4">
                <div className="w-16 h-16 mx-auto mb-3 rounded-full overflow-hidden ring-4 ring-slate-50">
                  <img
                    src={unfollowConfirm.profile_pic || unfollowConfirm.avatar || `https://i.pravatar.cc/150?u=${unfollowConfirm.user_id}`}
                    className="w-full h-full object-cover"
                    alt=""
                  />
                </div>
                <h4 className="text-sm font-bold text-slate-900">
                  Unfollow @{unfollowConfirm.username || unfollowConfirm.full_name}?
                </h4>
                <p className="text-[11px] text-slate-400 mt-1">
                  You will stop seeing their posts in your feed.
                </p>
              </div>
              <div className="flex flex-col gap-2">
                <button
                  onClick={() => {
                    handleFollowToggle(unfollowConfirm.user_id, true);
                    setUnfollowConfirm(null);
                  }}
                  className="w-full py-2.5 rounded-xl bg-red-500 text-white text-xs font-bold hover:bg-red-600 transition-colors shadow-lg shadow-red-100"
                >
                  Unfollow
                </button>
                <button
                  onClick={() => setUnfollowConfirm(null)}
                  className="w-full py-2.5 rounded-xl bg-slate-50 text-slate-500 text-xs font-bold hover:bg-slate-100 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <style jsx global>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #f1f5f9; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #e2e8f0; }
      `}</style>
    </>
  );
};

export default SocialModal;

