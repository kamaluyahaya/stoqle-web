// components/profile/Header.tsx
"use client";

import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/src/context/authContext"; // adjust path
import { useCart } from "@/src/context/cartContext";
import LoginModal from "../../../components/modal/auth/loginModal"; // adjust path if needed
import { API_BASE_URL } from "@/src/lib/config";
import BalanceModal from "../../business/balanceModal";
import { fetchMyWallet, requestWithdrawal, fetchMyPaymentAccount } from "@/src/lib/api/walletApi";
import { toast } from "sonner";
import PinSetupModal from "../../business/pinSetupModal";
import TransferModal from "../../business/transferModal";
import WithdrawModal from "../../business/withdrawModal";
import { useWallet } from "@/src/context/walletContext";
import { EyeIcon, EyeSlashIcon } from "@heroicons/react/24/outline";


import ImageViewer from "../../../components/modal/imageViewer";

type HeaderProps = {
  profileApi: any | null;
  displayName: string;
  onLogout?: () => void;
  onSocialClick?: (tab: "friends" | "followers" | "following" | "recommend" | "liked") => void;
  onVisitShop?: () => void;
};

const DEFAULT_AVATAR = "/assets/images/favio.png";

export default function Header({ profileApi, displayName, onLogout, onSocialClick, onVisitShop }: HeaderProps) {
  const router = useRouter();
  const auth = (useAuth?.() ?? null) as any;
  const { cartCount } = useCart();
  const currentUser = auth?.user ?? null;
  const token = auth?.token ?? (typeof window !== "undefined" ? localStorage.getItem("token") : null);

  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const [showBalanceModal, setShowBalanceModal] = useState(false);
  const [showPinSetupModal, setShowPinSetupModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);

  // login modal control (for actions requiring auth)
  const [showLoginModal, setShowLoginModal] = useState(false);

  // Dynamic follow state & follower count
  const [isFollowing, setIsFollowing] = useState<boolean>(false);
  const [followersCount, setFollowersCount] = useState<number>(
    Number(profileApi?.stats?.followers ?? profileApi?.stats?.followers_count ?? 0)
  );
  const [actionLoading, setActionLoading] = useState(false);
  const [statusFetched, setStatusFetched] = useState(false);

  // NEW: message init loading
  const [messageLoading, setMessageLoading] = useState(false);
  const { wallet, updateBalance, refreshWallet: fetchWallet } = useWallet();
  const [paymentAccountJson, setPaymentAccountJson] = useState<string>("");

  const [fullImageUrl, setFullImageUrl] = useState<string | null>(null);

  const [hideBalance, setHideBalance] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("hideBalance") === "true";
    }
    return false;
  });

  useEffect(() => {
    localStorage.setItem("hideBalance", String(hideBalance));
  }, [hideBalance]);

  useEffect(() => {
    setFollowersCount(Number(profileApi?.stats?.followers ?? profileApi?.stats?.followers_count ?? 0));
  }, [profileApi]);

  const profileUserId = Number(profileApi?.user?.user_id ?? profileApi?.user?.id ?? profileApi?.user_id ?? 0);
  const isOwner = Boolean(currentUser && Number(currentUser.user_id ?? currentUser.id) === profileUserId);

  useEffect(() => {
    if (!profileUserId) return;
    setStatusFetched(false);
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
      } finally {
        if (mounted) setStatusFetched(true);
      }
    }

    loadStatusAndStats();

    return () => {
      mounted = false;
      ac.abort();
    };
  }, [profileUserId, token, API_BASE_URL]); // eslint-disable-line



  const fetchPaymentAccount = async () => {
    try {
      const res = await fetchMyPaymentAccount();
      if (res?.data?.account) {
        setPaymentAccountJson(JSON.stringify(res.data.account));
      }
    } catch (err) {
      console.error("Failed to fetch payment account:", err);
    }
  };

  const handleWithdrawAction = async () => {
    setShowBalanceModal(false);
    if (!wallet?.has_pin) {
      setShowPinSetupModal(true);
    } else {
      if (profileApi?.is_business_owner) {
        setShowWithdrawModal(true);
      } else {
        setShowTransferModal(true);
      }
    }
  };

  // Fetch real payment account if owner
  useEffect(() => {
    if (isOwner && token) {
      fetchPaymentAccount();
    }
  }, [isOwner, token, currentUser]);

  const formatAddress = (addrJson: any) => {
    if (!addrJson) return profileApi?.user?.location || "";
    try {
      const parsed = typeof addrJson === 'string' && (addrJson.startsWith('{') || addrJson.startsWith('['))
        ? JSON.parse(addrJson)
        : addrJson;

      if (typeof parsed === 'string') return parsed;

      const line1 = parsed.address_line_1 || parsed.line1 || "";
      const city = parsed.city || "";
      const state = parsed.state || "";
      const country = parsed.country || "";

      const summary = [line1, city, state, country].filter(Boolean).join(", ");
      return summary || profileApi?.user?.location || "";
    } catch {
      return (typeof addrJson === 'string' ? addrJson : "") || profileApi?.user?.location || "";
    }
  };

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
          className="absolute right-0 mt-2 w-70 rounded-xl border border-slate-200 bg-white shadow-[0_8px_30px_rgba(0,0,0,0.08)] z-[70]"
        >
          <div className="p-2">
            {isOwner ? (
              <>
                {/* owner menu... (unchanged) */}
                {profileApi?.is_business_owner ? (
                  <div
                    role="button"
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      handleBalance()
                    }}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-md hover:bg-gray-50 font-medium text-gray-800 cursor-pointer"
                  >
                    <span>Total Balance</span>
                    <div className="flex items-center gap-2 text-sm text-gray-500 font-bold">
                      <span>
                        {hideBalance ? "****" : `₦${(Number(wallet?.available_balance) || 0).toLocaleString()}`}
                      </span>
                      <button
                        onPointerDown={(e) => {
                          e.stopPropagation();
                          setHideBalance(!hideBalance);
                        }}
                        className="p-1 hover:bg-gray-100 rounded-full transition-colors"
                      >
                        {hideBalance ? (
                          <EyeIcon className="w-3.5 h-3.5" />
                        ) : (
                          <EyeSlashIcon className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div
                    role="button"
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      handleBalance()
                    }}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-md hover:bg-gray-50 font-medium text-gray-800 cursor-pointer"
                  >

                    <span>Balance</span>
                    <div className="flex items-center gap-2 text-sm text-gray-500 font-bold">
                      <span>
                        {hideBalance ? "****" : `₦${(Number(wallet?.available_balance) || 0).toLocaleString()}`}
                      </span>
                      <button
                        onPointerDown={(e) => {
                          e.stopPropagation();
                          setHideBalance(!hideBalance);
                        }}
                        className="p-1 hover:bg-gray-100 rounded-full transition-colors"
                      >
                        {hideBalance ? (
                          <EyeIcon className="w-3.5 h-3.5" />
                        ) : (
                          <EyeSlashIcon className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>
                )}
                <button
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    handleNavigate("/cart");
                  }}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-md hover:bg-gray-50 font-medium text-gray-800 mt-1"
                >
                  <span>Cart</span>
                  <span className="text-xs bg-gray-200 text-gray-700 px-2 py-0.5 rounded-full">{cartCount}</span>
                </button>

                <div className="my-2 border-t border-gray-100" />

                <button
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    handleNavigate("/profile/edit");
                  }}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-md hover:bg-gray-50 font-medium text-gray-800"
                >
                  <span>Edit Profile</span>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </button>

                <button
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    handleNavigate("/profile/orders");
                  }}
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
              <div
                className="flex-none cursor-pointer active:scale-95 transition-transform"
                onClick={() => setFullImageUrl(
                  profileApi?.business?.business_logo ??
                  profileApi?.business?.logo ??
                  profileApi?.user?.profile_pic ??
                  profileApi?.user?.avatar ??
                  DEFAULT_AVATAR
                )}
              >
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
              </div>

              <div className="flex-1">
                <h2 className="lg:-mt-10 sm:-mt-5 font-semibold text-slate-900 leading-tight" style={{ fontSize: "clamp(1rem, 2.2vw, 1.25rem)" }}>
                  {displayName}
                </h2>
                {profileApi?.business?.previous_business_name && (
                  <p className="text-[10px] text-slate-400 leading-none mt-0.5 italic">
                    Previously known as {profileApi.business.previous_business_name}
                  </p>
                )}
                <p className="text-sm text-slate-500">{formatAddress(profileApi?.business?.business_address)}</p>
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
                    <div
                      className={`flex flex-col items-center cursor-pointer active:scale-95 transition-transform`}
                      onClick={() => onSocialClick?.("followers")}
                    >
                      <div className="text-sm font-bold text-slate-800">{followersCount}</div>
                      <div className="text-xs text-slate-500">Followers</div>
                    </div>

                    <div
                      className={`flex flex-col items-center cursor-pointer active:scale-95 transition-transform`}
                      onClick={() => onSocialClick?.("following")}
                    >
                      <div className="text-sm font-bold text-slate-800">
                        {profileApi?.stats?.following ?? profileApi?.stats?.following_count ?? 0}
                      </div>
                      <div className="text-xs text-slate-500">Following</div>
                    </div>

                    <div
                      className={`flex flex-col items-center ${isOwner ? 'cursor-pointer active:scale-95 transition-transform' : ''}`}
                      onClick={() => isOwner && onSocialClick?.("liked")}
                    >
                      <div className="text-sm font-bold text-slate-800">{profileApi?.stats?.total_likes ?? 0}</div>
                      <div className="text-xs text-slate-500">Likes</div>
                    </div>


                  </div>

                  <div className="flex items-center gap-2">
                    {!statusFetched && !isOwner ? (
                      <div className="flex items-center gap-2">
                        <div className="h-8 w-24 rounded-full shimmer-bg opacity-60" />
                        <div className="h-8 w-8 rounded-full shimmer-bg opacity-60" />
                      </div>
                    ) : isOwner ? (
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
                        {isFollowing ? (
                          profileApi?.is_business_owner ? (
                            <>
                              <button
                                className="rounded-full px-3 py-1 text-sm shadow whitespace-nowrap transition-all bg-red-500 text-white border border-transparent hover:bg-red-600 active:scale-95"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onVisitShop?.();
                                }}
                              >
                                Visit Shop
                              </button>
                              <button
                                className="rounded-full p-2 text-slate-800 bg-white border border-slate-200 shadow-sm transition-transform active:scale-95 hover:bg-slate-50"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleMessageClick();
                                }}
                                disabled={messageLoading}
                                aria-label="Message"
                              >
                                {messageLoading ? (
                                  <div className="w-5 h-5 border-2 border-slate-600 border-t-transparent rounded-full animate-spin" />
                                ) : (
                                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.76c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.076-4.076a1.526 1.526 0 011.037-.443 48.282 48.282 0 005.68-.494c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
                                  </svg>
                                )}
                              </button>
                            </>
                          ) : (
                            <button
                              className="rounded-full p-2 text-slate-800 bg-white border border-slate-200  transition-transform active:scale-95 hover:bg-slate-50"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleMessageClick();
                              }}
                              disabled={messageLoading}
                              aria-label="Message"
                            >
                              {messageLoading ? (
                                <div className="w-5 h-5 border-2 border-slate-600 border-t-transparent rounded-full animate-spin" />
                              ) : (
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.76c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.076-4.076a1.526 1.526 0 011.037-.443 48.282 48.282 0 005.68-.494c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
                                </svg>
                              )}
                            </button>
                          )
                        ) : (
                          <>
                            {statusFetched && !actionLoading && (
                              <button
                                className="rounded-full px-5 py-2 text-sm font-bold shadow bg-rose-500 text-white transition-all active:scale-95 hover:bg-rose-600"
                                onClick={(e) => {
                                  if (!currentUser) {
                                    setShowLoginModal(true);
                                    return;
                                  }
                                  followUser();
                                }}
                                disabled={actionLoading}
                              >
                                Follow
                              </button>
                            )}
                            <button
                              className="rounded-full p-2 text-slate-800 bg-white border border-slate-200 shadow-sm transition-transform active:scale-95 hover:bg-slate-50"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleMessageClick();
                              }}
                              disabled={messageLoading}
                              aria-label="Message"
                            >
                              {messageLoading ? (
                                <div className="w-5 h-5 border-2 border-slate-600 border-t-transparent rounded-full animate-spin" />
                              ) : (
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.76c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.076-4.076a1.526 1.526 0 011.037-.443 48.282 48.282 0 005.68-.494c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
                                </svg>
                              )}
                            </button>
                          </>
                        )}
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
            <div
              className="flex-none cursor-pointer active:scale-95 transition-transform"
              onClick={() => setFullImageUrl(
                profileApi?.business?.business_logo ??
                profileApi?.business?.logo ??
                profileApi?.user?.profile_pic ??
                profileApi?.user?.avatar ??
                DEFAULT_AVATAR
              )}
            >
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
              {profileApi?.business?.previous_business_name && (
                <p className="text-[10px] text-slate-400 italic mt-0.5">
                  Previously known as {profileApi.business.previous_business_name}
                </p>
              )}
              <p className="text-sm text-slate-500 mt-2 max-w-xl leading-snug">{formatAddress(profileApi?.business?.business_address)}</p>
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
                <div
                  className={`flex items-center gap-2 cursor-pointer hover:bg-slate-50 p-1 rounded-lg transition-colors`}
                  onClick={() => onSocialClick?.("followers")}
                >
                  <div className="text-lg font-bold text-slate-800">{followersCount}</div>
                  <div className="text-sm text-slate-500">Followers</div>
                </div>
                <div
                  className={`flex items-center gap-2 cursor-pointer hover:bg-slate-50 p-1 rounded-lg transition-colors`}
                  onClick={() => onSocialClick?.("following")}
                >
                  <div className="text-lg font-bold text-slate-800">
                    {profileApi?.stats?.following ?? profileApi?.stats?.following_count ?? 0}
                  </div>
                  <div className="text-sm text-slate-500">Following</div>
                </div>

                <div
                  className={`flex items-center gap-2 ${isOwner ? 'cursor-pointer hover:bg-slate-50 p-1 rounded-lg transition-colors' : ''}`}
                  onClick={() => isOwner && onSocialClick?.("liked")}
                >
                  <div className="text-lg font-bold text-slate-800">{profileApi?.stats?.total_likes ?? 0}</div>
                  <div className="text-sm text-slate-500">Likes</div>
                </div>


              </div>
            </div>

            <div className="flex-none self-center flex items-center gap-3">
              {!statusFetched && !isOwner ? (
                <div className="flex items-center gap-3">
                  <div className="h-10 w-32 rounded-full shimmer-bg opacity-60" />
                  <div className="h-10 w-10 rounded-full shimmer-bg opacity-60" />
                </div>
              ) : isOwner ? (
                <button
                  className="bg-red-500 text-white rounded-full px-4 py-2 text-sm font-medium shadow active:scale-95 transition-transform"
                  onClick={() => router.push("/profile/business/business-status")}
                >
                  {profileApi?.is_business_owner ? "My Shop" : "Open Store"}
                </button>
              ) : (
                <>
                  {isFollowing ? (
                    profileApi?.is_business_owner ? (
                      <>
                        <button
                          className="rounded-full px-5 py-2 text-sm font-bold shadow whitespace-nowrap transition-all bg-red-500 text-white border border-transparent hover:bg-red-600 active:scale-95"
                          onClick={(e) => {
                            e.stopPropagation();
                            onVisitShop?.();
                          }}
                        >
                          Visit Shop
                        </button>
                        <button
                          className="rounded-full p-2 text-slate-800 bg-white border border-slate-200 shadow-sm transition-transform active:scale-95 hover:bg-slate-50"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleMessageClick();
                          }}
                          disabled={messageLoading}
                          aria-label="Message"
                        >
                          {messageLoading ? (
                            <div className="w-5 h-5 border-2 border-slate-600 border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.76c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.076-4.076a1.526 1.526 0 011.037-.443 48.282 48.282 0 005.68-.494c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
                            </svg>
                          )}
                        </button>
                      </>
                    ) : (
                      <button
                        className="rounded-full p-2 text-slate-800 bg-white border border-slate-200 shadow-sm transition-transform active:scale-95 hover:bg-slate-50"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleMessageClick();
                        }}
                        disabled={messageLoading}
                        aria-label="Message"
                      >
                        {messageLoading ? (
                          <div className="w-5 h-5 border-2 border-slate-600 border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.76c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.076-4.076a1.526 1.526 0 011.037-.443 48.282 48.282 0 005.68-.494c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
                          </svg>
                        )}
                      </button>
                    )
                  ) : (
                    <>
                      {statusFetched && !actionLoading && (
                        <button
                          className="rounded-full px-6 py-2 text-sm font-bold shadow bg-rose-500 text-white transition-all active:scale-95 hover:bg-rose-600"
                          onClick={(e) => {
                            if (!currentUser) {
                              setShowLoginModal(true);
                              return;
                            }
                            followUser();
                          }}
                          disabled={actionLoading}
                        >
                          Follow
                        </button>
                      )}
                      <button
                        className="rounded-full p-2 text-slate-800 bg-white border border-slate-200 shadow-sm transition-transform active:scale-95 hover:bg-slate-50"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleMessageClick();
                        }}
                        disabled={messageLoading}
                        aria-label="Message"
                      >
                        {messageLoading ? (
                          <div className="w-5 h-5 border-2 border-slate-600 border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.76c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.076-4.076a1.526 1.526 0 011.037-.443 48.282 48.282 0 005.68-.494c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
                          </svg>
                        )}
                      </button>
                    </>
                  )}
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
          available: Number(wallet?.available_balance || 0),
          pending: Number(wallet?.pending_balance || 0),
          virtualAccount: String(wallet?.owner_id || "Stoqle Wallet"),
          currency: wallet?.currency || "₦",
        }}
        role={profileApi?.is_business_owner ? "vendor" : "user"}
        businessId={profileApi?.business?.business_id}
        onWithdraw={handleWithdrawAction}
        onBalanceUpdate={(newBal) => updateBalance(newBal)}
      />

      <PinSetupModal
        isOpen={showPinSetupModal}
        onClose={() => setShowPinSetupModal(false)}
        onSuccess={() => {
          fetchWallet();
          // Optionally re-trigger the action they wanted
          if (profileApi?.is_business_owner) setShowWithdrawModal(true);
          else setShowTransferModal(true);
        }}
      />

      <TransferModal
        isOpen={showTransferModal}
        onClose={() => setShowTransferModal(false)}
        availableBalance={Number(wallet?.available_balance || 0)}
        onBalanceUpdate={(newBal) => updateBalance(newBal)}
      />

      <WithdrawModal
        isOpen={showWithdrawModal}
        onClose={() => setShowWithdrawModal(false)}
        availableBalance={Number(wallet?.available_balance || 0)}
        onEditAccount={() => {
          setShowWithdrawModal(false);
          router.push("/profile/business/business-status?edit=true");
        }}
        activePaymentJson={paymentAccountJson}
        onBalanceUpdate={(newBal) => updateBalance(newBal)}
        role={profileApi?.is_business_owner ? "vendor" : "user"}
      />

      <ImageViewer
        src={fullImageUrl}
        onClose={() => setFullImageUrl(null)}
        profileUserId={profileApi?.user?.user_id ?? profileApi?.business?.user_id}
      />
    </>
  );
}
