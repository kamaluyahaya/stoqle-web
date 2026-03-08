// components/profile/Header.tsx
"use client";

import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/src/context/authContext"; // adjust path
import LoginModal from "../../../components/modal/auth/loginModal"; // adjust path if needed
import { API_BASE_URL } from "@/src/lib/config";
import BalanceModal from "../../business/balanceModal";


type HeaderProps = {
  profileApi: any | null;
  displayName: string;
  onLogout?: () => void;
};

const DEFAULT_AVATAR = "/assets/images/favio.png";

export default function Header({ profileApi, displayName, onLogout }: HeaderProps) {
  const router = useRouter();
  const auth = (useAuth?.() ?? null) as any;
  const currentUser = auth?.user ?? null;
  const token = auth?.token ?? (typeof window !== "undefined" ? localStorage.getItem("token") : null);

  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const [showBalanceModal, setShowBalanceModal] = useState(false);

  // login modal control (for actions requiring auth)
  const [showLoginModal, setShowLoginModal] = useState(false);

  // Dynamic follow state & follower count
  const [isFollowing, setIsFollowing] = useState<boolean>(false);
  const [followersCount, setFollowersCount] = useState<number>(
    Number(profileApi?.stats?.followers ?? profileApi?.stats?.followers_count ?? 0)
  );
  const [actionLoading, setActionLoading] = useState(false);

  // NEW: message init loading
  const [messageLoading, setMessageLoading] = useState(false);

  useEffect(() => {
    setFollowersCount(Number(profileApi?.stats?.followers ?? profileApi?.stats?.followers_count ?? 0));
  }, [profileApi]);

  const profileUserId = Number(profileApi?.user?.user_id ?? profileApi?.user?.id ?? profileApi?.user_id ?? 0);
  const isOwner = Boolean(currentUser && Number(currentUser.user_id ?? currentUser.id) === profileUserId);

  useEffect(() => {
    if (!profileUserId) return;
    const ac = new AbortController();
    let mounted = true;

    async function loadStatusAndStats() {
      try {
        const headers: Record<string, string> = { "Content-Type": "application/json" };
        if (token) headers["Authorization"] = `Bearer ${token}`;

        const statusPromise = fetch(`${API_BASE_URL}/api/follow/${profileUserId}/status`, {
          method: "GET",
          headers,
          signal: ac.signal,
        }).then(async (r) => {
          if (!r.ok) {
            const txt = await r.text().catch(() => "");
            throw new Error(`Status fetch failed: ${r.status} ${txt}`);
          }
          return r.json();
        });

        const statsPromise = fetch(`${API_BASE_URL}/api/users/${profileUserId}/follow-stats`, {
          method: "GET",
          headers,
          signal: ac.signal,
        })
          .then(async (r) => {
            if (!r.ok) {
              const txt = await r.text().catch(() => "");
              throw new Error(`Stats fetch failed: ${r.status} ${txt}`);
            }
            return r.json();
          })
          .catch((err) => {
            console.warn("Follow stats fetch error:", err.message || err);
            return null;
          });

        const [statusJson, statsJson] = await Promise.all([statusPromise.catch((e) => { console.warn(e); return null; }), statsPromise]);

        if (!mounted) return;

        if (statusJson && statusJson.data && typeof statusJson.data.isFollowing === "boolean") {
          setIsFollowing(Boolean(statusJson.data.isFollowing));
        } else {
          setIsFollowing(Boolean(profileApi?.is_followed_by_me ?? profileApi?.is_followed ?? false));
        }

        if (statsJson && statsJson.data) {
          const followers = Number(statsJson.data.followersCount ?? statsJson.data.followers ?? statsJson.data.followers_count ?? followersCount);
          setFollowersCount(Number.isFinite(followers) ? followers : followersCount);
        }
      } catch (err: any) {
        if (ac.signal.aborted) return;
        console.warn("Failed to fetch follow status/stats:", err?.message ?? err);
      }
    }

    loadStatusAndStats();

    return () => {
      mounted = false;
      ac.abort();
    };
  }, [profileUserId, token, API_BASE_URL]); // eslint-disable-line

  useEffect(() => {
    if (!open) return;

    const handleOutside = (e: Event) => {
      const target = e.target as Node;

      if (
        menuRef.current &&
        !menuRef.current.contains(target) &&
        buttonRef.current &&
        !buttonRef.current.contains(target)
      ) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleOutside);
    document.addEventListener("touchstart", handleOutside);

    return () => {
      document.removeEventListener("mousedown", handleOutside);
      document.removeEventListener("touchstart", handleOutside);
    };
  }, [open]);


  const handleNavigate = (href: string) => {
    setOpen(false);
    router.push(href);
  };
  // e.stopPropagation();

  const handleLogout = async () => {
    setOpen(false);

    try {
      if (auth?.logout) {
        await auth.logout();
        localStorage.clear();
      }
    } catch (err) {

      console.error("Logout error:", err);
    } finally {
      localStorage.clear();
      window.location.replace("/discover");
    }
  };

  const handleBalance = async () => {
    setOpen(false);
    setShowBalanceModal(true);

  };

  // FOLLOW / UNFOLLOW handlers (optimistic)
  const followUser = async () => {
    if (!token) {
      setShowLoginModal(true);
      return;
    }
    if (actionLoading) return;
    setActionLoading(true);

    setIsFollowing(true);
    setFollowersCount((s) => s + 1);

    try {
      const resp = await fetch(`${API_BASE_URL}/api/follow/${profileUserId}/follow`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: token ? `Bearer ${token}` : "",
        },
      });
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        setIsFollowing(false);
        setFollowersCount((s) => Math.max(0, s - 1));
        console.error("Follow failed", json);
      } else {
        if (json?.data?.followersCount || json?.data?.followers_count) {
          const c = Number(json.data.followersCount ?? json.data.followers_count);
          if (Number.isFinite(c)) setFollowersCount(c);
        }
      }
    } catch (err) {
      setIsFollowing(false);
      setFollowersCount((s) => Math.max(0, s - 1));
      console.error("Follow error", err);
    } finally {
      setActionLoading(false);
    }
  };

  const unfollowUser = async () => {
    if (!token) {
      setShowLoginModal(true);
      return;
    }
    if (actionLoading) return;
    setActionLoading(true);

    setIsFollowing(false);
    setFollowersCount((s) => Math.max(0, s - 1));

    try {
      const resp = await fetch(`${API_BASE_URL}/api/follow/${profileUserId}/unfollow`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: token ? `Bearer ${token}` : "",
        },
      });
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        setIsFollowing(true);
        setFollowersCount((s) => s + 1);
        console.error("Unfollow failed", json);
      } else {
        if (json?.data?.followersCount || json?.data?.followers_count) {
          const c = Number(json.data.followersCount ?? json.data.followers_count);
          if (Number.isFinite(c)) setFollowersCount(c);
        }
      }
    } catch (err) {
      setIsFollowing(true);
      setFollowersCount((s) => s + 1);
      console.error("Unfollow error", err);
    } finally {
      setActionLoading(false);
    }
  };

  // NEW: Initialize chat and navigate to messages
  const handleMessageClick = async () => {
    // require login
    if (!token) {
      setShowLoginModal(true);
      return;
    }
    if (!profileUserId) return;

    setOpen(false);
    setMessageLoading(true);

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    };

    try {
      let convId: string | number | null = null;
      const tryEndpoints = [
        { url: `${API_BASE_URL}/api/chat/create`, body: { other_user_id: profileUserId } },
        { url: `${API_BASE_URL}/api/conversations/init`, body: { user_id: profileUserId } },
      ];

      for (const ep of tryEndpoints) {
        try {
          const resp = await fetch(ep.url, {
            method: "POST",
            headers,
            body: JSON.stringify(ep.body),
          });

          if (resp.status === 401 || resp.status === 403) {
            setShowLoginModal(true);
            throw new Error("Unauthorized");
          }

          const json = await resp.json().catch(() => null);
          if (resp.ok && json) {
            // Mapping for the new and old API response formats
            convId = json?.chat_room_id ?? json?.data?.chat_room_id ?? json?.id ?? json?.data?.id ?? null;
            if (convId) break;
          }
        } catch (err) {
          console.warn("conversation init attempt failed:", ep.url, err);
        }
      }

      if (convId) {
        router.push(`/messages?room=${convId}`);
        return;
      }

      // fallback: if no convId, navigate to messages page with user query
      router.push(`/messages?user=${profileUserId}`);
    } catch (err) {
      console.error("Failed to init conversation:", err);
      // fallback navigation anyway
      router.push(`/messages?user=${profileUserId}`);
    } finally {
      setMessageLoading(false);
    }
  };

  // Report handler (for non-owner) kept for report functionality
  const reportUser = () => {
    if (!token) {
      setShowLoginModal(true);
      return;
    }
    setOpen(false);
    router.push(`/report/user/${profileUserId}`);
  };

  const MoreMenu = () => (
    <div className="relative inline-block text-left">
      <button
        ref={buttonRef}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((s) => !s);
        }}
        aria-haspopup="true"
        aria-expanded={open}
        className="p-2 rounded-full hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-indigo-400"
        title="More"
      >
        <svg className="w-4 h-4 text-slate-500" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <circle cx="5" cy="12" r="2" />
          <circle cx="12" cy="12" r="2" />
          <circle cx="19" cy="12" r="2" />
        </svg>
      </button>

      {open && (
        <div
          ref={menuRef}
          className="absolute right-0 mt-2 w-70 rounded-xl border border-slate-200 bg-white shadow-[0_8px_30px_rgba(0,0,0,0.08)] z-50"
        >
          <div className="p-2">
            {isOwner ? (
              <>
                {/* owner menu... (unchanged) */}
                {profileApi?.is_business_owner ? (
                  <button
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      handleBalance()
                    }}

                    className="w-full flex items-center justify-between px-3 py-2 rounded-md hover:bg-gray-50 font-medium text-gray-800"
                  >
                    <span>Total Balance</span>
                    <span className="text-sm text-gray-500">₦11,120,500</span>
                  </button>
                ) : (
                  <button
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      handleBalance()
                    }}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-md hover:bg-gray-50 font-medium text-gray-800"
                  >

                    <span>Balance</span>
                    <span className="text-sm text-gray-500">₦10,500</span>
                  </button>
                )}
                <button
                  onClick={() => handleNavigate("/cart")}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-md hover:bg-gray-50 font-medium text-gray-800 mt-1"
                >
                  <span>Cart</span>
                  <span className="text-xs bg-gray-200 text-gray-700 px-2 py-0.5 rounded-full">3</span>
                </button>

                <div className="my-2 border-t border-gray-100" />

                <button
                  onClick={() => handleNavigate("/profile/edit")}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-md hover:bg-gray-50 font-medium text-gray-800"
                >
                  <span>Edit Profile</span>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </button>

                <button
                  onClick={() => handleNavigate("/orders")}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-md hover:bg-gray-50 font-medium text-gray-800 mt-1"
                >
                  <span>Orders</span>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </button>

                <div className="my-2 border-t border-gray-100" />

                <button
                  onPointerDown={(e) => {
                    e.stopPropagation(); // prevents menu auto-close
                    handleLogout();
                  }}
                  className="w-full text-left px-3 py-2 rounded-md hover:bg-gray-50 font-medium text-rose-600"
                >
                  Logout
                </button>

              </>
            ) : (
              <>
                <button
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    handleMessageClick();
                  }}
                  className="w-full text-left px-3 py-2 rounded-md hover:bg-gray-50 font-medium text-gray-800"
                >
                  {messageLoading ? "Opening chat..." : "Message"}
                </button>

                <button
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    reportUser();
                  }}
                  className="w-full text-left px-3 py-2 rounded-md hover:bg-gray-50 font-medium text-gray-800"
                >
                  Report user
                </button>
              </>
            )}
          </div>
        </div>
      )}

    </div>
  );

  return (
    <>


      <div className="rounded-2xl overflow-visible bg-white mb-6">
        <div className="max-w-4xl mx-auto mt-12 px-4">
          {/* Mobile */}
          <div className="md:hidden">
            <div className="flex items-center gap-3">
              <img
                src={
                  profileApi?.business?.business_logo ??
                  profileApi?.business?.logo ??
                  profileApi?.user?.profile_pic ??
                  profileApi?.user?.avatar ??
                  DEFAULT_AVATAR
                }
                alt={displayName ?? "Profile"}
                className="h-20 w-20 rounded-full object-cover ring-4 border ring-white shadow bg-white border-slate-200"
              />

              <div className="flex-1">
                <h2 className="lg:-mt-10 sm:-mt-5 font-semibold text-slate-900 leading-tight" style={{ fontSize: "clamp(1rem, 2.2vw, 1.25rem)" }}>
                  {displayName}
                </h2>
                <p className="text-sm text-slate-500">Nigeria Kaduna</p>
              </div>
            </div>

            <div className="flex items-start justify-between mt-3 gap-4">
              <div className="flex-1">
                <div className="flex items-start gap-2 mt-2 max-w-xl">
                  <svg className="w-4 h-4 mt-0.5 text-blue-400 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 20h9" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4L16.5 3.5z" />
                  </svg>

                  <p className="text-sm text-slate-500 leading-snug">
                    {profileApi?.user?.bio ?? profileApi?.business?.business_category ?? "No bio yet"}
                  </p>
                </div>

                <div className="flex items-center justify-between mt-4">
                  <div className="flex items-center gap-4">
                    <div className="flex flex-col items-center">
                      <div className="text-sm font-bold text-slate-800">{followersCount}</div>
                      <div className="text-xs text-slate-500">Followers</div>
                    </div>

                    <div className="flex flex-col items-center">
                      <div className="text-sm font-bold text-slate-800">
                        {profileApi?.stats?.following ?? profileApi?.stats?.following_count ?? 0}
                      </div>
                      <div className="text-xs text-slate-500">Following</div>
                    </div>

                    <div className="flex flex-col items-center">
                      <div className="text-sm font-bold text-slate-800">{profileApi?.stats?.posts ?? 0}</div>
                      <div className="text-xs text-slate-500">Posts</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {isOwner ? (
                      <button
                        className="bg-red-500 text-white rounded-full px-4 py-2 text-sm font-medium shadow whitespace-nowrap"
                        onClick={() => {
                          if (!token) {
                            setShowLoginModal(true);
                            return;
                          }
                          router.push("/profile/business/business-status");
                        }}
                        aria-label="Open my store"
                      >
                        {profileApi?.is_business_owner ? "My Shop" : "Open Store"}
                      </button>
                    ) : (
                      <>
                        <button
                          className={`rounded-full px-4 py-2 text-sm font-medium shadow whitespace-nowrap ${isFollowing ? "bg-white text-slate-800 border border-slate-200" : "bg-rose-500 text-white"}`}
                          onClick={(e) => {
                            if (!currentUser) {
                              setShowLoginModal(true);
                              return;
                            }
                            isFollowing ? unfollowUser() : followUser();
                          }}
                          disabled={actionLoading}
                        >
                          {actionLoading ? "..." : isFollowing ? "Unfollow" : "Follow"}
                        </button>

                      </>
                    )}
                    <MoreMenu />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Desktop Layout */}
          <div className="hidden md:flex md:items-start md:gap-6">
            <div className="flex-none">
              <img
                src={
                  profileApi?.business?.business_logo ??
                  profileApi?.business?.logo ??
                  profileApi?.user?.profile_pic ??
                  profileApi?.user?.avatar ??
                  DEFAULT_AVATAR
                }
                alt={displayName ?? "Profile"}
                className="h-44 w-44 rounded-full object-cover ring-4 border ring-white shadow bg-white border-slate-200"
              />
            </div>

            <div className="flex-1 min-w-0">
              <h2 className="font-semibold text-slate-900 truncate leading-tight" style={{ fontSize: "clamp(1rem, 1.80vw, 1.10rem)" }}>
                {displayName}
              </h2>
              <p className="text-sm text-slate-500 mt-2 max-w-xl leading-snug">Nigeria Kaduna</p>
              <div className="flex items-start gap-2 mt-2 max-w-xl">
                <svg className="w-4 h-4 mt-0.5 text-blue-400 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 20h9" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4L16.5 3.5z" />
                </svg>
                <p className="text-sm text-slate-500 leading-snug">
                  {profileApi?.user?.bio ?? profileApi?.business?.business_category ?? "No bio yet"}
                </p>
              </div>

              <div className="flex items-center gap-6 mt-4">
                <div className="flex items-center gap-2">
                  <div className="text-lg font-bold text-slate-800">{followersCount}</div>
                  <div className="text-sm text-slate-500">Followers</div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="text-lg font-bold text-slate-800">
                    {profileApi?.stats?.following ?? profileApi?.stats?.following_count ?? 0}
                  </div>
                  <div className="text-sm text-slate-500">Following</div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="text-lg font-bold text-slate-800">{profileApi?.stats?.posts ?? 0}</div>
                  <div className="text-sm text-slate-500">Posts</div>
                </div>
              </div>
            </div>

            <div className="flex-none self-center flex items-center gap-3">
              {isOwner ? (
                <button
                  className="bg-red-500 text-white rounded-full px-4 py-2 text-sm font-medium shadow active:scale-95 transition-transform"
                  onClick={() => router.push("/profile/business/business-status")}
                >
                  {profileApi?.is_business_owner ? "My Shop" : "Open Store"}
                </button>
              ) : (
                <>
                  <button
                    className={`rounded-full px-5 py-2 text-sm font-medium shadow transition-all ${isFollowing ? "bg-white text-slate-800 border border-slate-200" : "bg-rose-500 text-white"}`}
                    onClick={isFollowing ? unfollowUser : followUser}
                    disabled={actionLoading}
                  >
                    {actionLoading ? "..." : isFollowing ? "Unfollow" : "Follow"}
                  </button>
                  <button
                    className="rounded-full px-6 py-2 text-sm font-medium bg-white text-slate-800 border border-slate-200 shadow-sm active:scale-95 transition-transform"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleMessageClick();
                    }}
                    disabled={messageLoading}
                  >
                    {messageLoading ? "Opening..." : "Message"}
                  </button>
                </>
              )}
              <MoreMenu />
            </div>
          </div>
        </div>
      </div>

      <LoginModal isOpen={showLoginModal} onClose={() => setShowLoginModal(false)} />
      <BalanceModal
        open={showBalanceModal}
        onClose={() => setShowBalanceModal(false)}
        balances={{
          available: 11205000,
          pending: 50000,
          virtualAccount: "1234567890",
          currency: "NGN",
        }}
        role="vendor"
      />
    </>
  );
}
