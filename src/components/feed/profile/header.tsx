// components/profile/Header.tsx
"use client";

// Tracking closed state across navigation for the current session ONLY.
// Resets on full page reload.
let isSuggestionsClosedGlobal = false;
let suggestionPoolGlobal: any[] = [];
let hasShownSuggestionsGlobal = false;

import React, { useEffect, useRef, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/src/context/authContext"; // adjust path
import { useCart } from "@/src/context/cartContext";
import LoginModal from "../../../components/modal/auth/loginModal"; // adjust path if needed
import { fetchMyWallet, requestWithdrawal, fetchMyPaymentAccount } from "@/src/lib/api/walletApi";
import { isOffline, safeFetch, ApiError } from "@/src/lib/api/handler";
import { toast } from "sonner";
import PinSetupModal from "../../business/pinSetupModal";
import TransferModal from "../../business/transferModal";
import WithdrawModal from "../../business/withdrawModal";
import { useWallet } from "@/src/context/walletContext";
import { copyToClipboard } from "@/src/lib/utils/utils";
import { EyeIcon, EyeSlashIcon, ArrowLeftIcon, UserPlusIcon, CheckIcon, EllipsisHorizontalIcon, ChevronLeftIcon, QrCodeIcon, PlusIcon, MapPinIcon, Cog6ToothIcon, XMarkIcon, UserGroupIcon, LinkIcon, FlagIcon, NoSymbolIcon, BuildingStorefrontIcon, Bars3Icon } from "@heroicons/react/24/outline";
import { CheckBadgeIcon } from "@heroicons/react/24/solid";
import { motion, AnimatePresence } from "framer-motion";
import { MessageCircleMore, Settings, ShoppingBag, Share, Star, QrCode, Download, Share2, Scan } from "lucide-react";
import { formatUrl } from "@/src/lib/utils/media";
import { toPng } from "html-to-image";


import ImageViewer from "../../../components/modal/imageViewer";
import MediaViewer from "../../product/addProduct/preview/modal/mediaViewer";
import { CameraIcon } from "@heroicons/react/24/solid";
import ProfileCropperModal from "../../../components/modal/profileCropperModal";
import ShareToFriendsModal from "../../../components/modal/shareToFriendsModal";
import { API_BASE_URL } from "@/src/lib/config";
import { createPortal } from "react-dom";
import BalanceModal from "../../business/balanceModal";

type HeaderProps = {
  profileApi: any | null;
  displayName: string;
  onLogout?: () => void;
  onSocialClick?: (tab: "friends" | "followers" | "following" | "recommend" | "liked") => void;
  onVisitShop?: () => void;
  onFollowToggle?: (following: boolean) => void;
  isFollowing?: boolean;
  followersCount?: number;
  isBlocked?: boolean;
  products?: any[];
};

const DEFAULT_AVATAR = "/assets/images/favio.png";
const DEFAULT_BANNER = "/assets/images/background.png";
const NO_IMAGE_PLACEHOLDER = "/assets/images/favio.png";

export default function Header({ profileApi, displayName, onLogout, onSocialClick, onVisitShop, onFollowToggle, isFollowing: isFollowingProp, followersCount: followersCountProp, isBlocked: isBlockedProp, products }: HeaderProps) {
  const router = useRouter();
  const [localBg, setLocalBg] = useState<string | null>(null);
  const hasBg = !!(localBg || profileApi?.bg_photo_url || profileApi?.user?.bg_photo_url || profileApi?.business?.bg_photo_url || (profileApi ? DEFAULT_BANNER : null));
  const auth = (useAuth?.() ?? null) as any;
  const { cartCount } = useCart();
  const currentUser = auth?.user ?? null;
  const token = auth?.token ?? (typeof window !== "undefined" ? localStorage.getItem("token") : null);

  const [open, setOpen] = useState(false);
  const [showShareFriendsModal, setShowShareFriendsModal] = useState(false);
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

  // Sync with prop if provided
  useEffect(() => {
    if (typeof isFollowingProp === 'boolean') {
      setIsFollowing(isFollowingProp);
    }
  }, [isFollowingProp]);

  const [followersCount, setFollowersCount] = useState<number>(
    Number(profileApi?.stats?.followers ?? profileApi?.stats?.followers_count ?? 0)
  );

  // Sync with followersCount prop if provided
  useEffect(() => {
    if (typeof followersCountProp === 'number') {
      setFollowersCount(followersCountProp);
    }
  }, [followersCountProp]);
  const [actionLoading, setActionLoading] = useState(false);
  const [statusFetched, setStatusFetched] = useState(false);
  const [isBlockedLocal, setIsBlockedLocal] = useState(false);

  useEffect(() => {
    if (typeof isBlockedProp === 'boolean') {
      setIsBlockedLocal(isBlockedProp);
    }
  }, [isBlockedProp]);

  // NEW: message init loading
  const [messageLoading, setMessageLoading] = useState(false);
  const { wallet, updateBalance, refreshWallet: fetchWallet } = useWallet();
  const [paymentAccountJson, setPaymentAccountJson] = useState<string>("");

  const [fullImageUrl, setFullImageUrl] = useState<string | null>(null);
  const [showBgMediaViewer, setShowBgMediaViewer] = useState(false);
  const [showMiniHeader, setShowMiniHeader] = useState(false);
  const [showMiniLogo, setShowMiniLogo] = useState(false);
  const [dominantColor, setDominantColor] = useState("rgba(255, 255, 255, 1)");

  const [uploadingProfile, setUploadingProfile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const fileInputBgRef = useRef<HTMLInputElement>(null);
  const [localProfilePic, setLocalProfilePic] = useState<string | null>(null);

  const [cropperImage, setCropperImage] = useState<string | null>(null);
  const [showCropper, setShowCropper] = useState(false);
  const [croppingType, setCroppingType] = useState<"profile" | "background">("profile");
  const [unfollowConfirmOpen, setUnfollowConfirmOpen] = useState(false);
  const [blockConfirmOpen, setBlockConfirmOpen] = useState(false);
  const [showFlyer, setShowFlyer] = useState(false);


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
    const handleScroll = () => {
      // MiniHeader logic (Mobile logic sync)
      setShowMiniHeader(window.scrollY > 0);
      setShowMiniLogo(window.scrollY > 150);
    };
    // Initial check on mount
    setShowMiniHeader(window.scrollY > 0);
    setShowMiniLogo(window.scrollY > 150);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [isOwner]);

  useEffect(() => {
    if (!profileUserId) return;
    setStatusFetched(false);
    const ac = new AbortController();
    let mounted = true;

    async function loadStatusAndStats() {
      if (isOffline()) return;
      try {
        const headers: Record<string, string> = { "Content-Type": "application/json" };
        if (token) headers["Authorization"] = `Bearer ${token}`;

        const statusPromise = safeFetch<any>(`/api/follow/${profileUserId}/status`, {
          method: "GET",
          headers,
          signal: ac.signal,
        });

        const statsPromise = safeFetch<any>(`/api/users/${profileUserId}/follow-stats`, {
          method: "GET",
          headers,
          signal: ac.signal,
        }).catch((err) => {
          return null;
        });

        const [statusJson, statsJson] = await Promise.all([
          statusPromise.catch(() => null),
          statsPromise
        ]);

        if (!mounted) return;

        if (statusJson && statusJson.data && typeof statusJson.data.isFollowing === "boolean") {
          setIsFollowing(Boolean(statusJson.data.isFollowing));
        } else {
          if (typeof isFollowingProp !== 'boolean') {
            setIsFollowing(Boolean(profileApi?.is_followed_by_me ?? profileApi?.is_followed ?? false));
          }
        }

        if (statsJson && statsJson.data) {
          const followers = Number(statsJson.data.followersCount ?? statsJson.data.followers ?? statsJson.data.followers_count ?? followersCount);
          setFollowersCount(Number.isFinite(followers) ? followers : followersCount);
        }
      } catch (err: any) {
        if (ac.signal.aborted) return;
        // Silent
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


  // --- Suggested Users (Mobile Only, Owner Only) ---
  const [suggestedUsers, setSuggestedUsers] = useState<any[]>([]);
  const [suggestionPool, setSuggestionPool] = useState<any[]>([]);
  const [showSuggestionsUI, setShowSuggestionsUI] = useState(false);
  // Persistent during session navigation, resets on refresh
  const [suggestionsClosed, setSuggestionsClosed] = useState(isSuggestionsClosedGlobal);
  const [showSuggestionInfo, setShowSuggestionInfo] = useState(false);

  /**
   * Priority sort:
   * 1. Frequently viewed  (view_count / profile_views)
   * 2. Trending           (is_trending flag or trending_score)
   * 3. Highest followers
   * 4. Highest posts/notes
   */
  const sortSuggestions = (list: any[]): any[] =>
    [...list].sort((a, b) => {
      const aViews = Number(a.view_count ?? a.profile_views ?? a.views ?? 0);
      const bViews = Number(b.view_count ?? b.profile_views ?? b.views ?? 0);
      if (aViews !== bViews) return bViews - aViews;

      const aTrend = Number(a.trending_score ?? (a.is_trending ? 1 : 0));
      const bTrend = Number(b.trending_score ?? (b.is_trending ? 1 : 0));
      if (aTrend !== bTrend) return bTrend - aTrend;

      const aFollowers = Number(a.total_followers ?? a.followers_count ?? a.followers ?? 0);
      const bFollowers = Number(b.total_followers ?? b.followers_count ?? b.followers ?? 0);
      if (aFollowers !== bFollowers) return bFollowers - aFollowers;

      const aPosts = Number(a.total_posts ?? a.posts_count ?? a.total_notes ?? a.notes_count ?? 0);
      const bPosts = Number(b.total_posts ?? b.posts_count ?? b.total_notes ?? b.notes_count ?? 0);
      return bPosts - aPosts;
    });

  /**
   * Return contextual label + stat for the card.
   * Returns NULL when there is no meaningful signal — those cards are hidden.
   */
  const getSuggestionMeta = (u: any): { label: string; value: string } | null => {
    const fmt = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
    const views = Number(u.view_count ?? u.profile_views ?? u.views ?? 0);
    const isTrend = u.is_trending || Number(u.trending_score ?? 0) > 0;
    const followers = Number(u.total_followers ?? u.followers_count ?? u.followers ?? 0);
    const posts = Number(u.total_posts ?? u.posts_count ?? u.total_notes ?? u.notes_count ?? 0);

    if (views > 0) return { label: "Frequently viewed", value: `👁 ${fmt(views)} views` };
    if (isTrend) return { label: "Trending", value: `🔥 Trending` };
    if (followers > 0) return { label: "Followers", value: `${fmt(followers)} followers` };
    if (posts > 0) return { label: "Posts", value: `${fmt(posts)} posts` };
    return null; // no meaningful signal — card will be hidden
  };

  useEffect(() => {
    if (!isOwner || isSuggestionsClosedGlobal) return;

    // Restore from global pool immediately if available for zero-wait UI
    if (suggestionPoolGlobal.length > 0) {
      setSuggestionPool(suggestionPoolGlobal);
      setSuggestedUsers(suggestionPoolGlobal.slice(0, 10));
    }

    const fetchSuggestions = async () => {
      if (isOffline()) return;
      try {
        const t = localStorage.getItem("token");
        if (!t) return;
        const json = await safeFetch<any>("/api/users/suggestions", {
          headers: { Authorization: `Bearer ${t}` }
        });

        const unified = Array.isArray(json?.data?.suggestions) ? json.data.suggestions : [];
        const recUsers = unified.length ? unified : (Array.isArray(json?.data?.users) ? json.data.users : []);
        const recVendors = unified.length ? [] : (Array.isArray(json?.data?.vendors) ? json.data.vendors : []);
        const allRecs = [...recUsers, ...recVendors];

        const filtered = allRecs.filter((u: any) => !u.is_following && !u.is_following_viewer);
        const withSignal = filtered.filter((u: any) => {
          const views = Number(u.view_count ?? u.profile_views ?? 0);
          const trend = u.is_trending || Number(u.trending_score ?? 0) > 0;
          const followers = Number(u.total_followers ?? u.followers_count ?? 0);
          const posts = Number(u.total_posts ?? u.posts_count ?? 0);
          return views > 0 || trend || followers > 0 || posts > 0;
        });

        const sorted = sortSuggestions(withSignal);
        suggestionPoolGlobal = sorted;
        setSuggestionPool(sorted);
        setSuggestedUsers(sorted.slice(0, 10));
      } catch (err) { }
    };
    fetchSuggestions(); // runs immediately in background

    // Only wait 4s on the first time it's shown in this session
    if (hasShownSuggestionsGlobal) {
      setShowSuggestionsUI(true);
    } else {
      const timer = setTimeout(() => {
        setShowSuggestionsUI(true);
        hasShownSuggestionsGlobal = true;
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [isOwner, API_BASE_URL]);

  const closeSuggestions = () => {
    setSuggestionsClosed(true);
    isSuggestionsClosedGlobal = true;
  };

  const handleFollowSuggestion = async (userId: string | number) => {
    try {
      const t = localStorage.getItem("token");
      await safeFetch(`/api/follow/${userId}/follow`, {
        method: "POST",
        headers: { Authorization: `Bearer ${t}` }
      });

      const performRefill = (prev: any[]) => {
        const filtered = prev.filter(u => String(u.user_id) !== String(userId) && String(u.id) !== String(userId));
        const currentIds = new Set(filtered.map(u => String(u.user_id || u.id)));
        const nextCandidate = suggestionPool.find(u =>
          !currentIds.has(String(u.user_id || u.id)) &&
          String(u.user_id || u.id) !== String(userId)
        );

        if (nextCandidate && filtered.length < 10) {
          return [...filtered, nextCandidate];
        }
        return filtered;
      };

      setSuggestedUsers(prev => performRefill(prev));

      suggestionPoolGlobal = suggestionPoolGlobal.filter(u => String(u.user_id || u.id) !== String(userId));
      setSuggestionPool([...suggestionPoolGlobal]);

      toast.success("Followed successfully");
    } catch (err) {
      toast.error("Failed to follow user");
    }
  };
  // ----------------------------------------------------


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

      const state = parsed.state || "";
      const country = parsed.country || "";

      const summary = [country, state].filter(Boolean).join(", ");
      return summary || profileApi?.user?.location || "";
    } catch {
      return (typeof addrJson === 'string' ? addrJson : "") || profileApi?.user?.location || "";
    }
  };

  const addressStr = useMemo(() => formatAddress(profileApi?.business?.business_address), [profileApi]);

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

  const isDMRestricted = React.useMemo(() => {
    if (isOwner) return false;
    const dmPref = profileApi?.dm_preference || "Default";
    // We allow "Nobody" to proceed to click so backend can check for existing chatroom
    if (dmPref === "FollowedByMe") {
      // is_follower means target follows current viewer
      return !profileApi?.is_follower;
    }
    return false;
  }, [isOwner, profileApi?.dm_preference, profileApi?.is_follower]);

  const profilePic = formatUrl(
    profileApi?.business?.business_logo ||
    profileApi?.user?.profile_pic ||
    profileApi?.business?.logo ||
    profileApi?.profile_pic
  );

  // Extract dominant color from background/profile picture
  useEffect(() => {
    const bgUrl = formatUrl(
      profileApi?.bg_photo_url ||
      profileApi?.user?.bg_photo_url ||
      profileApi?.business?.bg_photo_url
    );
    if (!bgUrl || bgUrl.includes('favio.png')) return;

    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.src = bgUrl;
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) return;
        canvas.width = 1;
        canvas.height = 1;
        ctx.drawImage(img, 0, 0, 1, 1);
        const pixelData = ctx.getImageData(0, 0, 1, 1).data;
        const [r, g, b] = pixelData;

        // Use a slightly opaque version of the dominant color
        setDominantColor(`rgba(${r}, ${g}, ${b}, 1)`);
      } catch (e) {
        console.warn("Color extraction failed:", e);
        setDominantColor("rgba(255, 255, 255, 1)");
      }
    };
    img.onerror = () => {
      setDominantColor("rgba(255, 255, 255, 1)");
    };
  }, [localBg, profileApi?.bg_photo_url, profileApi?.user?.bg_photo_url, profileApi?.business?.bg_photo_url, profilePic]);


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
      const json = await safeFetch<any>(`/api/follow/${profileUserId}/follow`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: token ? `Bearer ${token}` : "",
        },
      });
      if (json?.data?.followersCount || json?.data?.followers_count) {
        const c = Number(json.data.followersCount ?? json.data.followers_count);
        if (Number.isFinite(c)) setFollowersCount(c);
      }
      onFollowToggle?.(true);
    } catch (err) {
      setIsFollowing(false);
      setFollowersCount((s) => Math.max(0, s - 1));
      toast.error("Failed to follow");
    } finally {
      setActionLoading(false);
    }
  };

  const handleUnfollowClick = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setUnfollowConfirmOpen(true);
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
      const json = await safeFetch<any>(`/api/follow/${profileUserId}/unfollow`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: token ? `Bearer ${token}` : "",
        },
      });
      if (json?.data?.followersCount || json?.data?.followers_count) {
        const c = Number(json.data.followersCount ?? json.data.followers_count);
        if (Number.isFinite(c)) setFollowersCount(c);
      }
      onFollowToggle?.(false);
    } catch (err) {
      setIsFollowing(true);
      setFollowersCount((s) => s + 1);
      toast.error("Failed to unfollow");
    } finally {
      setActionLoading(false);
    }
  };

  // NEW: Initialize chat and navigate to messages
  const handleMessageClick = async () => {
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
        { url: `/api/chat/create`, body: { other_user_id: profileUserId } },
        { url: `/api/conversations/init`, body: { user_id: profileUserId } },
      ];

      for (const ep of tryEndpoints) {
        try {
          const json = await safeFetch<any>(ep.url, {
            method: "POST",
            headers,
            body: JSON.stringify(ep.body),
          });

          if (json) {
            convId = json?.chat_room_id ?? json?.data?.chat_room_id ?? json?.id ?? json?.data?.id ?? null;
            if (convId) break;
          }
        } catch (err: any) {
          if (err?.status === 403) {
            toast.error(err.body?.error || "This user has restricted direct messages");
            return;
          }
          if (err?.status === 401) {
            setShowLoginModal(true);
            return;
          }
        }
      }

      if (convId) {
        router.push(`/messages?room=${convId}`);
        return;
      }
      router.push(`/messages?user=${profileUserId}`);
    } catch (err) {
      router.push(`/messages?user=${profileUserId}`);
    } finally {
      setMessageLoading(false);
    }
  };

  const handleProfilePicChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setCroppingType("profile");
    const reader = new FileReader();
    reader.onload = () => {
      setCropperImage(reader.result as string);
      setShowCropper(true);
    };
    reader.readAsDataURL(file);
  };

  const handleCropComplete = async (croppedBlob: Blob) => {
    if (!token) {
      setShowLoginModal(true);
      return;
    }

    setUploadingProfile(true);
    const isProfile = croppingType === "profile";
    const endpoint = isProfile ? "profile-pic" : "bg-photo";
    const fieldName = isProfile ? "profile_pic" : "bg_photo";

    toast.info(`Updating ${isProfile ? "profile" : "background"}...`, { duration: 2000 });

    const formData = new FormData();
    formData.append(fieldName, croppedBlob, `${fieldName}.jpg`);

    try {
      const response = await fetch(`${API_BASE_URL}/api/profile/${endpoint}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      const json = await response.json();
      if (!response.ok) throw new Error(json.message || `Failed to update ${isProfile ? "profile" : "background"}`);

      const newUrl = isProfile
        ? (json.data?.user?.profile_pic || json.data?.profile_pic)
        : (json.data?.user?.bg_photo_url || json.data?.bg_photo_url);

      if (newUrl) {
        if (isProfile) {
          setLocalProfilePic(newUrl);
          if (auth?.onVerificationSuccess) auth.onVerificationSuccess({ ...currentUser, profile_pic: newUrl });
        } else {
          setLocalBg(newUrl);
          if (auth?.onVerificationSuccess) auth.onVerificationSuccess({ ...currentUser, bg_photo_url: newUrl });
        }
      }
      toast.success(`${isProfile ? "Profile" : "Background"} updated!`);
      if (isProfile) setFullImageUrl(null);
    } catch (err: any) {
      console.error(`${isProfile ? "Profile" : "Background"} upload error:`, err);
      toast.error(err.message || "Update failed");
    } finally {
      setUploadingProfile(false);
      setShowCropper(false);
      setCropperImage(null);
    }
  };

  const handleBgPhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !token) return;

    setCroppingType("background");
    const reader = new FileReader();
    reader.onload = () => {
      setCropperImage(reader.result as string);
      setShowCropper(true);
    };
    reader.readAsDataURL(file);
  };

  const [uploadingBg, setUploadingBg] = useState(false);

  // Report handler (for non-owner) kept for report functionality
  const reportUser = () => {
    if (!token) {
      setShowLoginModal(true);
      return;
    }
    setOpen(false);
    router.push(`/report/user/${profileUserId}`);
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: displayName,
          text: `Check out ${displayName} on Stoqle!`,
          url: window.location.href,
        });
      } catch (err) { }
    } else {
      handleCopyLink();
    }
  };

  const handleCopyLink = async () => {
    try {
      await copyToClipboard(window.location.href);
      toast.success("Profile link copied!");
    } catch (err) {
      toast.error("Failed to copy link");
    }
  };

  const handleBlockUser = async () => {
    if (!token || !profileUserId) return;
    try {
      const isCurrentlyBlocked = isBlockedLocal;
      const endpoint = isCurrentlyBlocked
        ? `${API_BASE_URL}/api/blocks/${profileUserId}/unblock`
        : `${API_BASE_URL}/api/blocks/${profileUserId}/block`;
      const method = 'POST';

      const res = await fetch(endpoint, {
        method,
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        toast.success(isCurrentlyBlocked ? "User unblocked" : "User blocked successfully");
        setIsBlockedLocal(!isCurrentlyBlocked);
        setBlockConfirmOpen(false);
      } else {
        const json = await res.json();
        toast.error(json.message || `Failed to ${isCurrentlyBlocked ? 'unblock' : 'block'} user`);
      }
    } catch (err) {
      toast.error("An error occurrose");
    }
  };

  const MoreMenu = ({ color }: { color?: string }) => {
    const [isLargeScreen, setIsLargeScreen] = useState(false);

    useEffect(() => {
      const check = () => setIsLargeScreen(window.innerWidth >= 1024);
      check();
      window.addEventListener("resize", check);
      return () => window.removeEventListener("resize", check);
    }, []);

    // Restrict background scrolling when modal is open on mobile
    useEffect(() => {
      if (open && !isLargeScreen) {
        document.body.style.overflow = "hidden";
      } else {
        document.body.style.overflow = "unset";
      }
      return () => {
        document.body.style.overflow = "unset";
      };
    }, [open, isLargeScreen]);

    const menuContent = (
      <div className="p-2 space-y-1">
        {isOwner ? (
          <>
            <button
              onClick={() => handleNavigate("/settings/")}
              className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-slate-50 transition-colors flex items-center gap-3 text-slate-700 font-medium"
            >
              <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-600">
                <Cog6ToothIcon className="w-4 h-4" />
              </div>
              Settings
            </button>
            <button
              onClick={() => handleNavigate("/profile/business/business-status")}
              className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-slate-50 transition-colors flex items-center gap-3 text-slate-700 font-medium"
            >
              <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-600">
                <BuildingStorefrontIcon className="w-4 h-4" />
              </div>
              {profileApi?.is_business_owner ? "My shop" : "Open store"}
            </button>
            <button
              onClick={() => handleNavigate("/profile/orders/")}
              className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-slate-50 transition-colors flex items-center gap-3 text-slate-700 font-medium"
            >
              <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-600">
                <ShoppingBag className="w-4 h-4" />
              </div>
              Order
            </button>
            <button
              onClick={handleBalance}
              className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-slate-50 transition-colors flex items-center gap-3 text-slate-700 font-medium"
            >
              <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 font-sans text-xs">
                ₦
              </div>
              Wallet Balance
            </button>
          </>
        ) : (
          <div className="p-4 flex flex-col items-center">
            <p className="text-sm text-slate-400 font-medium mb-4">Profile actions</p>
            <button
              onClick={reportUser}
              className="px-6 py-2 bg-slate-50 text-slate-600 rounded-full text-sm font-bold hover:bg-slate-100 transition-colors"
            >
              Report User
            </button>
          </div>
        )}
      </div>
    );

    return (
      <div className="relative inline-block text-left">
        <button
          ref={buttonRef}
          onClick={(e) => {
            e.stopPropagation();
            if (isOwner && !isLargeScreen) {
              router.push("/profile/edit");
              return;
            }
            setOpen(!open);
          }}
          className={`p-1.5 rounded-full transition-all group active:scale-90 hover:bg-black/5 ${open ? 'bg-slate-300' : ''} ${color || ""}`}
        >
          {isOwner ? (
            <Cog6ToothIcon className="w-6 h-6 stroke-[1.8] group-hover:rotate-45 transition-transform duration-500" />
          ) : (
            <EllipsisHorizontalIcon className="w-6 h-6 stroke-[1.8]" />
          )}
        </button>

        <AnimatePresence>
          {open && (
            <>
              {isLargeScreen ? (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 10 }}
                  className="absolute right-0 mt-2 w-56 bg-white rounded-2xl shadow-xl ring-1 ring-black/5 z-[150] overflow-hidden"
                >
                  <div className="p-2 space-y-1">
                    {isOwner ? (
                      menuContent
                    ) : (
                      <>
                        <button
                          onClick={() => {
                            setOpen(false);
                            setShowShareFriendsModal(true);
                          }}
                          className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-slate-50 transition-colors flex items-center gap-3 text-slate-700 font-medium"
                        >
                          <div className="w-8 h-8 rounded-full bg-rose-500 flex items-center justify-center text-white">
                            <Share className="w-4 h-4" />
                          </div>
                          Share to Friends
                        </button>

                        <div className="border-t border-slate-100 my-1" />

                        <button
                          onClick={handleCopyLink}
                          className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-slate-50 transition-colors flex items-center gap-3 text-slate-700 font-medium"
                        >
                          <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-600">
                            <LinkIcon className="w-4 h-4" />
                          </div>
                          Copy Link
                        </button>
                        <button
                          onClick={reportUser}
                          className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-slate-50 transition-colors flex items-center gap-3 text-slate-700 font-medium"
                        >
                          <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-600">
                            <FlagIcon className="w-4 h-4" />
                          </div>
                          Report
                        </button>
                        <button
                          onClick={() => {
                            if (!token) {
                              setShowLoginModal(true);
                              setOpen(false);
                              return;
                            }
                            if (isBlockedLocal) {
                              handleBlockUser();
                            } else {
                              setBlockConfirmOpen(true);
                            }
                            setOpen(false);
                          }}
                          className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-slate-50 transition-colors flex items-center gap-3 text-slate-700 font-medium"
                        >
                          <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-600">
                            <NoSymbolIcon className="w-4 h-4" />
                          </div>
                          {isBlockedLocal ? "Unblock" : "Block"}
                        </button>
                      </>
                    )}
                  </div>
                </motion.div>
              ) : (
                typeof document !== "undefined" && createPortal(
                  <div className="fixed inset-0 z-[200]">
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      onClick={() => setOpen(false)}
                      className="absolute inset-0 bg-black/40"
                    />
                    <motion.div
                      key="bottomsheet"
                      initial={{ y: "100%" }}
                      animate={{ y: 0 }}
                      exit={{ y: "100%" }}
                      transition={{ type: "spring", damping: 25, stiffness: 300 }}
                      className="absolute bottom-0 left-0 right-0 bg-white rounded-[0.5rem] pb-[env(safe-area-inset-bottom,20px)] shadow-[0_-8px_30px_rgba(0,0,0,0.1)] overflow-hidden"
                    >
                      <div className="flex items-center justify-center p-4 relative border-b border-slate-100">
                        <span className="font-bold text-slate-800 text-sm">More Options</span>
                        <button
                          onClick={() => setOpen(false)}
                          className="absolute right-4 p-1 hover:bg-slate-100 rounded-full transition-colors"
                        >
                          <XMarkIcon className="w-5 h-5 text-slate-500" />
                        </button>
                      </div>

                      <div className="p-4 space-y-1">
                        <button
                          onClick={() => {
                            setOpen(false);
                            setShowShareFriendsModal(true);
                          }}
                          className="w-full text-left px-4 py-3 rounded-xl hover:bg-slate-50 transition-colors flex items-center gap-3 text-slate-700 font-medium"
                        >
                          <div className="w-10 h-10 rounded-full bg-rose-500 flex items-center justify-center text-white">
                            <Share className="w-5 h-5" />
                          </div>
                          Share to Friends
                        </button>

                        <button
                          onClick={() => {
                            handleCopyLink();
                            setOpen(false);
                          }}
                          className="w-full text-left px-4 py-3 rounded-xl hover:bg-slate-50 transition-colors flex items-center gap-3 text-slate-700 font-medium"
                        >
                          <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-600">
                            <LinkIcon className="w-5 h-5" />
                          </div>
                          Copy Link
                        </button>

                        <button
                          onClick={() => {
                            reportUser();
                            setOpen(false);
                          }}
                          className="w-full text-left px-4 py-3 rounded-xl hover:bg-slate-50 transition-colors flex items-center gap-3 text-slate-700 font-medium"
                        >
                          <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-600">
                            <FlagIcon className="w-5 h-5" />
                          </div>
                          Report
                        </button>

                        <button
                          onClick={() => {
                            if (!token) {
                              setShowLoginModal(true);
                              setOpen(false);
                              return;
                            }
                            if (isBlockedLocal) {
                              handleBlockUser();
                            } else {
                              setBlockConfirmOpen(true);
                            }
                            setOpen(false);
                          }}
                          className="w-full text-left px-4 py-3 rounded-xl hover:bg-slate-50 transition-colors flex items-center gap-3 text-slate-700 font-medium"
                        >
                          <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-600">
                            <NoSymbolIcon className="w-5 h-5" />
                          </div>
                          {isBlockedLocal ? "Unblock" : "Block"}
                        </button>
                      </div>
                    </motion.div>
                  </div>,
                  document.body
                )
              )}
            </>
          )}
        </AnimatePresence>
      </div>
    );
  };

  return (
    <div className="relative">
      {(() => {
        const userBg = localBg || profileApi?.bg_photo_url || profileApi?.user?.bg_photo_url || profileApi?.business?.bg_photo_url;
        // If not loaded yet OR no background set, use bg-slate-200
        const bannerUrl = userBg || (profileApi ? DEFAULT_BANNER : null);
        const finalSrc = bannerUrl ? (bannerUrl.startsWith('http') || bannerUrl.startsWith('/') || bannerUrl.startsWith('blob:') ? bannerUrl : `${API_BASE_URL}/public/${bannerUrl}`) : null;

        return (
          <div
            onClick={() => finalSrc && setShowBgMediaViewer(true)}
            className={`absolute inset-x-0 top-0 bottom-[-32px] z-0 overflow-hidden cursor-pointer lg:hidden ${!finalSrc ? 'bg-slate-100' : ''}`}
          >
            {finalSrc && (
              <img
                src={finalSrc}
                className="w-full h-full object-cover"
                alt=""
              />
            )}
            {/* Overall dark overlay on the whole bg_photo for better contrast */}
            {finalSrc && <div className="absolute inset-0 bg-black/35" />}
            {/* Top navbar gradient */}
            {finalSrc && <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-black/50 via-black/20 to-transparent" />}
            {/* Heavy bottom blur-shadow for content legibility */}
            {finalSrc && <div className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />}
            <input
              type="file"
              ref={fileInputBgRef}
              className="hidden"
              accept="image/*"
              onChange={handleBgPhotoChange}
            />
          </div>
        );
      })()}

      {/* Immersive Navbar (Back & More always visible; Logo & Follow animate on scroll) */}
      <motion.header
        initial={false}
        animate={{
          backgroundColor: showMiniHeader ? dominantColor : "rgba(255,255,255,0)",
        }}
        transition={{ duration: 0.3 }}
        className="fixed top-0 left-0 lg:left-[300px] right-0 z-[100] h-14 flex lg:hidden items-center px-4 transition-[left] duration-300"
      >
        {/* Left part: Back button or Menu icon */}
        <div className="flex-1 flex justify-start">
          {isOwner ? (
            <button
              onClick={() => window.dispatchEvent(new CustomEvent("toggle-mobile-menu"))}
              className={`p-2 -ml-2 transition-colors duration-300 ${(showMiniHeader || hasBg) ? 'text-white drop-shadow-sm' : 'text-slate-800'}`}
            >
              <Bars3Icon className="w-6 h-6 stroke-[2]" />
            </button>
          ) : (
            <button
              onClick={() => router.back()}
              className={`p-2 -ml-2 transition-colors duration-300 ${(showMiniHeader || hasBg) ? 'text-white drop-shadow-sm' : 'text-slate-800'} hover:opacity-70`}
            >
              <ChevronLeftIcon className="w-6 h-6 stroke-[2.5]" />
            </button>
          )}
        </div>

        {/* Divider for Desktop centering (Hidden where Back button exists) */}
        <div className="hidden lg:flex flex-1" />

        {/* Middle part: Logo (Slides UP from bottom past 150px) */}
        <div className="flex-none flex justify-center h-full items-center overflow-hidden">
          <AnimatePresence>
            {showMiniLogo && (
              <motion.div
                key="logo"
                initial={{ y: 40, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 40, opacity: 0 }}
                transition={{ type: "spring", damping: 20, stiffness: 200 }}
                className="flex items-center justify-center"
              >
                <img
                  src={profilePic}
                  className="w-8 h-8 rounded-full object-cover border border-white/20"
                  alt=""
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Right part: Actions (Follow animates on scroll, More is always visible) */}
        <div className="flex-1 flex justify-end items-center gap-1 min-w-0">
          <AnimatePresence>
            {showMiniLogo && !isOwner && (
              <motion.div
                initial={{ x: 20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: 20, opacity: 0 }}
                className="flex items-center"
              >
                {!isFollowing ? (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      followUser();
                    }}
                    className="bg-rose-500 text-white px-5 py-1 rounded-full text-xs active:scale-95 transition-all shadow-md"
                  >
                    Follow
                  </button>
                ) : (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleUnfollowClick();
                    }}
                    className="bg-white/10 backdrop-blur-md text-white px-5 py-1.5 rounded-full text-xs  active:scale-95 transition-all"
                  >
                    Following
                  </button>
                )}
              </motion.div>
            )}
          </AnimatePresence>
          <div className={`transition-colors duration-300 ${(showMiniHeader || hasBg) ? 'text-white drop-shadow-sm' : 'text-slate-800'}`}>
            <div className="flex items-center gap-1">
              <AnimatePresence>
                {isOwner && !showMiniHeader && (
                  <motion.button
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10 }}
                    onClick={() => fileInputBgRef.current?.click()}
                    className="text-[9px] text-white bg-black/20 backdrop-blur-md px-3 py-1 rounded-full active:scale-95 transition-all whitespace-nowrap mr-2"
                  >
                    Edit background image
                  </motion.button>
                )}
              </AnimatePresence>
              {isOwner ? (
                <>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                    }}
                    className={`p-2 active:scale-95 transition-transform ${(showMiniHeader || hasBg) ? 'text-white drop-shadow-sm' : 'text-slate-800'}`}
                  >
                    <QrCodeIcon className="w-5 h-5" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowShareFriendsModal(true);
                    }}
                    className={`p-2 active:scale-95 transition-transform ${(showMiniHeader || hasBg) ? 'text-white drop-shadow-sm' : 'text-slate-800'}`}
                  >
                    <Share className="w-5 h-5" />
                  </button>
                </>
              ) : (
                <MoreMenu color={(showMiniHeader || hasBg) ? 'text-white drop-shadow-sm' : 'text-slate-800'} />
              )}
            </div>
          </div>
        </div>
      </motion.header>


      <div
        onClick={() => {
          if (typeof window !== 'undefined' && window.innerWidth < 1024 && hasBg) {
            setShowBgMediaViewer(true);
          }
        }}
        className={`relative z-[60] overflow-visible mb-6 transition-colors duration-300 cursor-default ${hasBg ? 'bg-transparent lg:bg-white' : 'bg-white'}`}>

        <div className="max-w-4xl mx-auto pt-15 px-3">
          {/* Mobile */}
          <div className="lg:hidden">
            <div className="flex items-center gap-3">
              <div
                className="group relative flex-none cursor-pointer active:scale-95 transition-transform"
                onClick={(e) => {
                  e.stopPropagation();
                  setFullImageUrl(
                    localProfilePic ??
                    profileApi?.business?.business_logo ??
                    profileApi?.business?.logo ??
                    profileApi?.user?.profile_pic ??
                    profileApi?.user?.avatar ??
                    DEFAULT_AVATAR
                  )
                }}
              >
                <img
                  src={
                    localProfilePic ??
                    profileApi?.business?.business_logo ??
                    profileApi?.business?.logo ??
                    profileApi?.user?.profile_pic ??
                    profileApi?.user?.avatar ??
                    DEFAULT_AVATAR
                  }
                  alt={displayName ?? "Profile"}
                  className={`h-20 w-20 rounded-full object-cover ring-1 border ring-white shadow bg-white border-slate-200 ${uploadingProfile ? "opacity-50" : ""}`}
                />

                {isOwner && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/30 rounded-full pointer-events-none">
                    <CameraIcon className="w-5 h-5 text-white/90" />
                  </div>
                )}

                {isOwner && (
                  <div className="absolute bottom-0 right-0 bg-rose-500 rounded-full p-0.5 border border-white shadow-sm transition-transform group-hover:scale-110">
                    <PlusIcon className="w-2.5 h-2.5 text-white stroke-[4px]" />
                  </div>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <h2 className={`lg:-mt-10 sm:-mt-5 font-semibold leading-tight truncate flex items-center gap-1.5 ${hasBg ? 'text-white lg:text-slate-900 drop-shadow-sm' : 'text-slate-900'}`} style={{ fontSize: "clamp(1rem, 2.2vw, 1.25rem)" }}>
                  {displayName}
                  {profileApi?.is_verified_partner && (
                    <CheckBadgeIcon className="w-4 h-4 text-blue-500 fill-current" />
                  )}
                </h2>
                <AnimatePresence mode="wait">
                  {profileApi && (
                    <motion.div
                      key="stoqle-id"
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mt-1 flex flex-col gap-0.5"
                    >
                      <div className="flex items-center gap-1.5 mt-1">
                        <p
                          onClick={(e) => {
                            e.stopPropagation();
                            const sid = profileApi?.user?.stoqle_id || profileApi?.user?.user_id || profileApi?.user?.id || "";
                            if (sid) {
                              copyToClipboard(sid);
                              toast.success("Stoqle ID copied!");
                            }
                          }}
                          className={`text-[10px] cursor-pointer hover:opacity-80 transition-opacity active:scale-95 ${hasBg ? 'text-white/80 lg:text-slate-400' : 'text-slate-400'}`}
                        >
                          Stoqle ID: {profileApi?.user?.stoqle_id || profileApi?.user?.user_id || profileApi?.user?.id || ""}
                        </p>
                        {isOwner && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setShowFlyer(true);
                            }}
                            className={`p-1 rounded-full hover:bg-black/5 transition-colors ${hasBg ? 'text-white/80 lg:text-slate-400' : 'text-slate-400'}`}
                          >
                            <QrCode className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                      {!isOwner && (profileApi?.latest_location || profileApi?.latest_ip) && (
                        <div className="flex items-center gap-1.5 mt-1">
                          <p className={`text-[10px] max-w-xl leading-snug ${hasBg ? 'text-white/80 lg:text-slate-400' : 'text-slate-400'}`}>IP location: {profileApi.latest_location || profileApi.latest_ip}</p>
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            <div className="flex items-start justify-between mt-3 gap-4">
              <div className="flex-1">
                <AnimatePresence mode="wait">
                  {profileApi && (
                    <motion.div
                      key="bio"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.1 }}
                      className="flex items-start gap-2 mt-2 max-w-xl"
                    >
                      <p className={`text-sm leading-snug whitespace-pre-wrap ${hasBg ? 'text-white/90 lg:text-slate-500 drop-shadow-sm' : 'text-slate-500'}`}>
                        {profileApi?.user?.bio || (isOwner ? (
                          <span className="flex items-center gap-2">
                            <svg className="w-4 h-4 mt-0.5 text-blue-400 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M12 20h9" />
                              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4L16.5 3.5z" />
                            </svg>
                            No bio yet
                          </span>
                        ) : null)}
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="flex items-center justify-between mt-4">
                  <AnimatePresence mode="wait">
                    {profileApi && (
                      <motion.div
                        key="stats"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.2 }}
                        className="flex items-center gap-4"
                      >
                        <div
                          className={`flex flex-col items-center ${(!isOwner && profileApi?.hide_followers) ? 'cursor-default opacity-90' : 'cursor-pointer active:scale-95 transition-transform'}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (!isOwner && profileApi?.hide_followers) return;
                            onSocialClick?.("followers");
                          }}
                        >
                          <div className={`text-sm font-bold ${hasBg ? 'text-white lg:text-slate-800' : 'text-slate-800'}`}>{followersCount}</div>
                          <div className={`text-xs ${hasBg ? 'text-white/80 lg:text-slate-500' : 'text-slate-500'}`}>Followers</div>
                        </div>

                        <div
                          className={`flex flex-col items-center ${(!isOwner && profileApi?.hide_following) ? 'cursor-default opacity-90' : 'cursor-pointer active:scale-95 transition-transform'}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (!isOwner && profileApi?.hide_following) return;
                            onSocialClick?.("following");
                          }}
                        >
                          <div className={`text-sm font-bold ${hasBg ? 'text-white lg:text-slate-800' : 'text-slate-800'}`}>
                            {profileApi?.stats?.following ?? profileApi?.stats?.following_count ?? 0}
                          </div>
                          <div className={`text-xs ${hasBg ? 'text-white/80 lg:text-slate-500' : 'text-slate-500'}`}>Following</div>
                        </div>

                        <div
                          className={`flex flex-col items-center ${isOwner ? 'cursor-pointer active:scale-95 transition-transform' : ''}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            isOwner && onSocialClick?.("liked");
                          }}
                        >
                          <div className={`text-sm font-bold ${hasBg ? 'text-white lg:text-slate-800' : 'text-slate-800'}`}>{profileApi?.stats?.total_likes ?? 0}</div>
                          <div className={`text-xs ${hasBg ? 'text-white/80 lg:text-slate-500' : 'text-slate-500'}`}>Likes</div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <div className="flex items-center gap-2">
                    {!statusFetched && !isOwner ? (
                      <div className="flex items-center gap-2 pr-6" />
                    ) : isOwner ? (
                      <div className="flex gap-1">
                        <button
                          className="bg-rose-500 text-white rounded-full px-2 py-1 text-sm whitespace-nowrap active:scale-95 transition-transform"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (!token) {
                              setShowLoginModal(true);
                              return;
                            }
                            router.push("/profile/edit");
                          }}
                          aria-label="Edit Profile"
                        >
                          Edit Profile
                        </button>
                        <div
                          className={`px-4 text-center flex item-center justify-center  rounded-full transition-all active:scale-95 ${hasBg ? 'border-white/50 text-white  shadow-sm' : 'border-slate-200 text-slate-800 bg-white'}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push("/settings");
                          }}
                        >
                          <Settings className="w-5 h-5" />
                        </div>
                      </div>
                    ) : (
                      <>
                        {isFollowing ? (
                          profileApi?.is_business_owner ? (
                            <>
                              {/* <button
                                className="rounded-full px-4 py-1.5 text-xs font-bold shadow bg-white border border-slate-200 text-slate-800 transition-all active:scale-95"
                                onClick={(e) => {
                            e.stopPropagation();
                            handleUnfollowClick();
                          }}
                              >
                                Following
                              </button> */}
                              <button
                                className="rounded-full px-3 py-1 text-sm shadow whitespace-nowrap transition-all bg-rose-500 text-white border border-transparent hover:bg-rose-500 active:scale-95"
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
                                  <MessageCircleMore className="w-5 h-5" />
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
                                <MessageCircleMore className="w-5 h-5" />
                              )}
                            </button>
                          )
                        ) : (
                          <>
                            {statusFetched && !actionLoading && (
                              <button
                                className="rounded-full px-5 py-1 text-sm shadow bg-rose-500 text-white transition-all active:scale-95 hover:bg-rose-500"
                                onClick={(e) => {
                                  e.stopPropagation();
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
                              className="rounded-full text-sm p-2 text-slate-800 bg-white/50 border border-slate-300  transition-transform active:scale-95 hover:bg-slate-50"
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
                                <MessageCircleMore className="w-4 h-4" />
                              )}
                            </button>
                          </>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>


          {/* ── Suggestion Info Overlay Modal ─────────────────────── */}
          <AnimatePresence>
            {showSuggestionInfo && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[9999] flex items-center justify-center"
                onClick={() => setShowSuggestionInfo(false)}
              >
                {/* Backdrop */}
                <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
                {/* Modal */}
                <motion.div
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.9, opacity: 0 }}
                  transition={{ type: "spring", stiffness: 350, damping: 25 }}
                  className="relative z-10 w-full max-w-[280px] bg-white rounded-[0.5rem] shadow-2xl overflow-hidden"
                  onClick={e => e.stopPropagation()}
                >
                  {/* Header */}
                  <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-slate-100">
                    <h2 className="text-sm font-bold text-slate-900">Explanation</h2>
                    <button onClick={() => setShowSuggestionInfo(false)} className="text-slate-400 hover:text-slate-700 transition">
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                  {/* Body */}
                  <div className="px-5 py-4 space-y-3 text-[13px] text-slate-700 leading-relaxed">
                    <p className="font-semibold text-slate-900">We recommend people you may know based on:</p>
                    <ol className="list-decimal list-inside space-y-1">
                      <li>Your authorized contact list</li>
                      <li>Your engagement with other users</li>
                      <li>Your followers and follows</li>
                    </ol>
                    <p className="text-slate-500 text-[12px]">
                      To keep your data safe, we use only the data you've authorized or made public, and solely to recommend friends.
                    </p>
                    <p className="text-slate-500 text-[12px]">
                      If you don't want to be recommended to people you may know, you can go to{" "}
                      <span className="font-semibold text-slate-700">&ldquo;Me&rdquo;</span>{" "}›{" "}
                      <span className="font-semibold text-slate-700">&ldquo;Settings&rdquo;</span>{" "}›{" "}
                      <span className="font-semibold text-slate-700">&ldquo;Privacy&rdquo;</span>{" "}to adjust this setting.
                    </p>
                  </div>
                  {/* Footer */}
                  <div className="px-5 pb-5">
                    <button
                      onClick={() => setShowSuggestionInfo(false)}
                      className="w-full py-2.5 rounded-full bg-rose-500 text-white text-sm font-bold transition active:scale-95"
                    >Got it</button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── Suggested Users - Mobile Only ────────────────────── */}
          {isOwner && !suggestionsClosed && suggestedUsers.length > 0 && (
            <AnimatePresence>
              {showSuggestionsUI && (
                <motion.div
                  key="suggestions-strip"
                  initial={{ opacity: 0, y: 16, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -8, scale: 0.97 }}
                  transition={{ type: "spring", stiffness: 280, damping: 26, delay: 0 }}
                  onClick={(e) => e.stopPropagation()}
                  className="lg:hidden mt-3 rounded py-2 px-1 overflow-hidden"
                  style={{ backgroundColor: dominantColor.replace('1)', '0.50)') }}
                >
                  {/* Strip header */}
                  <div className="flex items-center justify-between px-3 mb-2">
                    <div className="flex items-center gap-1.5">
                      <h3 className="text-[10px] font-bold text-white/70">Recommended for you</h3>
                      <button
                        onClick={() => setShowSuggestionInfo(true)}
                        className="text-white/40 hover:text-white/70 transition"
                        aria-label="How suggestions work"
                      >
                        <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
                          <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zm8.706-1.442c1.146-.573 2.437.463 2.126 1.706l-.709 2.836.042-.02a.75.75 0 01.67 1.34l-.04.022c-1.147.573-2.438-.463-2.127-1.706l.71-2.836-.042.02a.75.75 0 11-.671-1.34l.041-.022zM12 9a.75.75 0 100-1.5.75.75 0 000 1.5z" clipRule="evenodd" />
                        </svg>
                      </button>
                    </div>
                    <button
                      onClick={closeSuggestions}
                      className="text-white/40 hover:text-white/80 transition p-0.5"
                      aria-label="Dismiss suggestions"
                    >
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>

                  {/* Horizontal scroll list with vertical dividers */}
                  <div className="flex overflow-x-auto no-scrollbar pb-1 snap-x px-3">
                    {(() => {
                      const visible = suggestedUsers.filter(u => {
                        const meta = getSuggestionMeta(u);
                        const name = u.business_name || u.full_name || u.name || "";
                        return meta && name;
                      });
                      return (
                        <>
                          {visible.map((u, idx) => {
                            const meta = getSuggestionMeta(u)!;
                            const isTrusted = u.is_verified_partner || u.is_trusted_partner || u.trusted_partner;
                            const avatarSrc = formatUrl(u.business_logo || u.profile_pic || u.avatar);
                            const name = u.business_name || u.full_name || u.name || "";
                            // Priority: username then stoqle_id
                            const handle = u.username || u.stoqle_id;

                            return (
                              <div key={u.user_id || u.id} className="flex flex-shrink-0 snap-start">
                                {idx > 0 && <div className="w-px bg-slate-50/5 self-stretch h-20 text-center mt-5" />}
                                <div className="min-w-[96px] max-w-[96px] p-2 flex flex-col items-center">
                                  {/* Avatar + name clickable for redirect */}
                                  <div
                                    onClick={() => handle && router.push(`/${handle}`)}
                                    className="flex flex-col items-center cursor-pointer w-full"
                                  >
                                    <div className="relative mb-1.5">
                                      <img src={avatarSrc} alt={name} className="w-10 h-10 rounded-full object-cover" />
                                      {isTrusted && (
                                        <div title="Trusted Partner" className="absolute -bottom-1 -right-1 w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center border-[1.5px] border-white shadow-sm">
                                          <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 24 24">
                                            <path fillRule="evenodd" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" clipRule="evenodd" />
                                          </svg>
                                        </div>
                                      )}
                                    </div>
                                    <span className="text-[10px] font-medium text-slate-100 line-clamp-1 w-full text-center leading-tight hover:underline">{name}</span>
                                  </div>

                                  <span className="text-[8px] text-slate-300 line-clamp-1 w-full text-center mt-0.5">{meta.label}</span>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleFollowSuggestion(u.user_id || u.id);
                                    }}
                                    className="mt-1.5 px-2 py-0.5 bg-rose-500 text-white text-[9px] rounded-full transition active:scale-95"
                                  >Follow</button>
                                </div>
                              </div>
                            );
                          })}
                          {/* 'View more' — vertical rotated link at the very end */}
                          {visible.length >= 5 && (
                            <div className="flex flex-shrink-0 snap-start">
                              <div className="w-px bg-white/15 self-stretch mx-0.5" />
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onSocialClick?.("recommend");
                                }}
                                className="flex items-center justify-center w-10 self-stretch px-1"
                                aria-label="View more suggestions"
                              >
                                <span
                                  style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
                                  className="text-[9px] font-bold text-white/60 hover:text-white transition whitespace-nowrap leading-none"
                                >View more</span>
                              </button>
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          )}

          {/* Business Store Section */}
          {profileApi?.is_business_owner && (() => {
            const stats = profileApi?.business?.stats || profileApi?.stats;
            const policy = profileApi?.policy;
            const rating = Number(stats?.rating ?? stats?.avg_rating ?? (policy?.customer_service?.good_reviews_threshold ? (policy.customer_service.good_reviews_threshold / 20) : 5.0));
            const totalSold = Number(stats?.total_sold || 0);

            return (
              <div
                onClick={(e) => {
                  e.stopPropagation();
                  onVisitShop?.();
                }}
                style={{ backgroundColor: dominantColor.replace('1)', '0.40)') }}
                className={`lg:hidden mt-3 p-2 rounded-xl  transition-all active:scale-[0.98] flex items-center justify-between gap-4 cursor-pointer ${hasBg ? 'bg-black/40 border-white/10 shadow-lg' : 'bg-slate-50 border-slate-100 hover:bg-slate-100'}`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${hasBg ? 'bg-white/20' : 'bg-white shadow-sm'}`}>
                    <BuildingStorefrontIcon className={`w-5 h-5 ${hasBg ? 'text-white' : 'text-slate-600'}`} />
                  </div>
                  <div className="min-w-0 flex-1">

                    <div className="flex items-center gap-1.5 mt-0.5">
                      <div className="flex items-center gap-0.5 text-amber-400">
                        {[...Array(5)].map((_, i) => (
                          <Star key={i} className="w-3 h-3 fill-current" />
                        ))}
                      </div>
                      <span className={`text-[10px] font-black ${hasBg ? 'text-white' : 'text-slate-900'}`}>
                        {rating.toFixed(1)}
                      </span>
                    </div>

                    <div className="flex items-center gap-1 mt-0.5 opacity-80">
                      <ShoppingBag className={`w-2.5 h-2.5 ${hasBg ? 'text-white/80' : 'text-slate-500'}`} />
                      <span className={`text-[9px] font-bold ${hasBg ? 'text-white/80' : 'text-slate-500'}`}>
                        {totalSold.toLocaleString()}+ sold
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {(products || []).slice(0, 3).map((p: any, i: number) => (
                    <div key={p.product_id || i} className={`relative w-12 h-12 rounded overflow-hidden bg-white ${hasBg ? '' : 'border-slate-200'}`}>
                      <img
                        src={p.first_image?.startsWith('http') ? p.first_image : (p.first_image ? `${API_BASE_URL}/public/${p.first_image}` : NO_IMAGE_PLACEHOLDER)}
                        className="w-full h-full object-cover"
                        alt=""
                      />
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent flex items-center justify-center py-2">
                        <span className="text-[7px] font-black text-white px-1 leading-none drop-shadow-sm">
                          ₦{Number(p.price || 0).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  ))}
                  {(!products || products.length === 0) && (
                    <div className={`text-[10px] font-bold px-3 py-1.5 rounded-full ${hasBg ? 'bg-white/10 text-white/80' : 'bg-slate-100 text-slate-500'}`}>
                      Shop now
                    </div>
                  )}
                </div>
              </div>
            )
          })()}

          {/* Desktop Layout */}
          <div className="hidden lg:flex md:items-start md:gap-6">
            <div
              className="group relative flex-none cursor-pointer active:scale-95 transition-transform"
              onClick={(e) => {
                e.stopPropagation();
                setFullImageUrl(
                  localProfilePic ??
                  profileApi?.business?.business_logo ??
                  profileApi?.business?.logo ??
                  profileApi?.user?.profile_pic ??
                  profileApi?.user?.avatar ??
                  DEFAULT_AVATAR
                )
              }}
            >
              <img
                src={
                  localProfilePic ??
                  profileApi?.business?.business_logo ??
                  profileApi?.business?.logo ??
                  profileApi?.user?.profile_pic ??
                  profileApi?.user?.avatar ??
                  DEFAULT_AVATAR
                }
                alt={displayName ?? "Profile"}
                className={`h-44 w-44 rounded-full object-cover ring-4 border ring-white shadow bg-white border-slate-200 ${uploadingProfile ? "opacity-50" : ""}`}
              />

              {isOwner && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/30 rounded-full pointer-events-none">
                  <CameraIcon className="w-10 h-10 text-white/90" />
                </div>
              )}

              {isOwner && (
                <div className="absolute bottom-4 right-4 bg-rose-500 rounded-full p-1.5 border-2 border-white shadow-md transition-transform group-hover:scale-110">
                  <PlusIcon className="w-3.5 h-3.5 text-white stroke-[3px]" />
                </div>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <h2 className="font-semibold lg:mt-5 text-slate-900 truncate leading-tight flex items-center gap-1.5" style={{ fontSize: "clamp(1rem, 1.80vw, 1.10rem)" }}>
                {displayName}
                {profileApi?.is_verified_partner && (
                  <CheckBadgeIcon className="w-4 h-4 text-blue-500" />
                )}
              </h2>
              <AnimatePresence mode="wait">
                {profileApi && (
                  <motion.div
                    key="desktop-stoqle-id"
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-1 flex flex-col gap-0.5"
                  >
                    <div className="flex items-center gap-1.5 mt-1">
                      <p
                        onClick={(e) => {
                          e.stopPropagation();
                          const sid = profileApi?.user?.stoqle_id || profileApi?.user?.user_id || profileApi?.user?.id || "";
                          if (sid) {
                            copyToClipboard(sid);
                            toast.success("Stoqle ID copied!");
                          }
                        }}
                        className="text-[10px] text-slate-400 cursor-pointer hover:opacity-80 transition-opacity active:scale-95"
                      >
                        Stoqle ID: {profileApi?.user?.stoqle_id || profileApi?.user?.user_id || profileApi?.user?.id || ""}
                      </p>
                      {isOwner && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowFlyer(true);
                          }}
                          className="p-1 rounded-full text-slate-400 hover:bg-black/5 transition-colors"
                        >
                          <QrCode className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                    {!isOwner && (profileApi?.latest_location || profileApi?.latest_ip) && (
                      <div className="flex items-center gap-1.5 mt-1">
                        <p className="text-[10px] text-slate-400 max-w-xl leading-snug">IP location: {profileApi.latest_location || profileApi.latest_ip}</p>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
              <AnimatePresence mode="wait">
                {profileApi && (
                  <motion.div
                    key="desktop-bio"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.1 }}
                    className="flex items-start gap-2 mt-2 max-w-xl"
                  >
                    <p className="text-sm text-slate-500 leading-snug whitespace-pre-wrap">
                      {profileApi?.user?.bio || (isOwner ? (
                        <span className="flex items-center gap-2">
                          <svg className="w-4 h-4 mt-0.5 text-blue-400 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 20h9" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4L16.5 3.5z" />
                          </svg>
                          No bio yet
                        </span>
                      ) : null)}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>

              <AnimatePresence mode="wait">
                {profileApi && (
                  <motion.div
                    key="desktop-stats"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.2 }}
                    className="flex items-center gap-6 mt-4"
                  >
                    <div
                      className={`flex items-center gap-2 ${(!isOwner && profileApi?.hide_followers) ? 'cursor-default opacity-90' : 'cursor-pointer hover:bg-slate-50 p-1 rounded-lg transition-colors'}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!isOwner && profileApi?.hide_followers) return;
                        onSocialClick?.("followers");
                      }}
                    >
                      <div className="text-lg font-bold text-slate-800">{followersCount}</div>
                      <div className="text-sm text-slate-500">Followers</div>
                    </div>

                    <div
                      className={`flex items-center gap-2 ${(!isOwner && profileApi?.hide_following) ? 'cursor-default opacity-90' : 'cursor-pointer hover:bg-slate-50 p-1 rounded-lg transition-colors'}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!isOwner && profileApi?.hide_following) return;
                        onSocialClick?.("following");
                      }}
                    >
                      <div className="text-lg font-bold text-slate-800">
                        {profileApi?.stats?.following ?? profileApi?.stats?.following_count ?? 0}
                      </div>
                      <div className="text-sm text-slate-500">Following</div>
                    </div>

                    <div
                      className={`flex items-center gap-2 ${isOwner ? 'cursor-pointer hover:bg-slate-50 p-1 rounded-lg transition-colors' : ''}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        isOwner && onSocialClick?.("liked");
                      }}
                    >
                      <div className="text-lg font-bold text-slate-800">{profileApi?.stats?.total_likes ?? 0}</div>
                      <div className="text-sm text-slate-500">Likes</div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="flex-none self-center flex items-center gap-3">
              {!statusFetched && !isOwner ? (
                <div className="flex items-center gap-3 pr-6" />
              ) : isOwner ? (
                <>
                  <button
                    className="bg-rose-500 text-white rounded-full px-5 py-1 text-sm shadow active:scale-95 transition-transform"
                    onClick={(e) => {
                      e.stopPropagation();
                      router.push("/profile/edit");
                    }}
                  >
                    Edit profile
                  </button>
                  <MoreMenu color="text-slate-800" />
                </>
              ) : (
                <>
                  {isFollowing ? (
                    profileApi?.is_business_owner ? (
                      <>
                        <button
                          className="rounded-full px-5 py-1 text-sm font-bold shadow bg-white border border-slate-200 text-slate-800 transition-all active:scale-95"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleUnfollowClick();
                          }}
                        >
                          Following
                        </button>
                        <button
                          className="rounded-full px-5 py-1 text-sm shadow whitespace-nowrap transition-all bg-rose-500 text-white border border-transparent hover:bg-rose-500 active:scale-95"
                          onClick={(e) => {
                            e.stopPropagation();
                            onVisitShop?.();
                          }}
                        >
                          Visit Shop
                        </button>
                        {!isDMRestricted && (
                          <button
                            className="rounded-full p-2 text-slate-800 bg-white border border-slate-200 transition-transform active:scale-95 hover:bg-slate-50"
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
                              <MessageCircleMore className="w-5 h-5" />
                            )}
                          </button>
                        )}
                      </>
                    ) : (
                      <>
                        <button
                          className="rounded-full px-5 py-1 text-sm font-bold shadow bg-white border border-slate-200 text-slate-800 transition-all active:scale-95"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleUnfollowClick();
                          }}
                        >
                          Following
                        </button>
                        {!isDMRestricted && (
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
                              <MessageCircleMore className="w-5 h-5" />
                            )}
                          </button>
                        )}
                      </>
                    )
                  ) : (
                    <>
                      {statusFetched && !actionLoading && (
                        <button
                          className="rounded-full px-6 py-1 text-sm  shadow bg-rose-500 text-white transition-all active:scale-95 hover:bg-rose-500"
                          onClick={(e) => {
                            e.stopPropagation();
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
                      {!isDMRestricted && (
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
                            <MessageCircleMore className="w-5 h-5" />
                          )}
                        </button>
                      )}
                    </>
                  )}
                  <MoreMenu color="text-slate-800" />
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      <ShareToFriendsModal
        isOpen={showShareFriendsModal}
        onClose={() => setShowShareFriendsModal(false)}
        userId={currentUser?.user_id || currentUser?.id}
        shareUrl={typeof window !== "undefined" ? window.location.href : ""}
      />

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

      {isOwner && (
        <input
          type="file"
          ref={fileInputRef}
          className="hidden"
          accept="image/*"
          onChange={handleProfilePicChange}
        />
      )}

      <ProfileCropperModal
        isOpen={showCropper}
        image={cropperImage}
        onClose={() => setShowCropper(false)}
        onCropComplete={handleCropComplete}
        aspect={croppingType === "profile" ? 1 : 50 / 40}
        cropShape={croppingType === "profile" ? "round" : "rect"}
      />

      <ImageViewer
        src={fullImageUrl}
        onClose={() => setFullImageUrl(null)}
        profileUserId={profileApi?.user?.user_id ?? profileApi?.business?.user_id}
        onUpdateProfile={() => fileInputRef.current?.click()}
      />

      {showBgMediaViewer && (() => {
        const userBg = localBg || profileApi?.bg_photo_url || profileApi?.user?.bg_photo_url || profileApi?.business?.bg_photo_url;
        const bannerUrl = userBg || (profileApi ? DEFAULT_BANNER : null);
        const finalSrc = bannerUrl ? (bannerUrl.startsWith('http') || bannerUrl.startsWith('/') || bannerUrl.startsWith('blob:') ? bannerUrl : `${API_BASE_URL}/public/${bannerUrl}`) : null;

        return (
          <div className="fixed inset-0 z-[99999] bg-black/95 flex flex-col animate-in fade-in duration-300">
            {/* Header */}
            <div className="flex items-center justify-between p-4 z-50">
              <button
                onClick={() => setShowBgMediaViewer(false)}
                className="p-2 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
              >
                <ChevronLeftIcon className="w-6 h-6" />
              </button>
              <h2 className="text-white font-bold text-sm">Background Photo</h2>
              <div className="w-10" /> {/* spacer */}
            </div>

            <div className="flex-1 w-full flex items-center justify-center">
              <MediaViewer
                main={{ url: finalSrc || undefined, name: "Background" }}
                payload={{ title: profileApi?.business?.business_name || profileApi?.user?.full_name || "Profile Background" } as any}
                images={finalSrc ? [{ url: finalSrc }] : []}
                selectedIndex={0}
                onIndexChange={() => { }}
              />
            </div>
          </div>
        );
      })()}

      <BlockConfirmModal
        isOpen={blockConfirmOpen}
        onClose={() => setBlockConfirmOpen(false)}
        onConfirm={handleBlockUser}
        name={displayName}
      />

      <UnfollowConfirmModal
        isOpen={unfollowConfirmOpen}
        onClose={() => setUnfollowConfirmOpen(false)}
        onConfirm={unfollowUser}
        name={displayName}
      />
      {showFlyer && (
        <FlyerModal
          isOpen={showFlyer}
          onClose={() => setShowFlyer(false)}
          user={profileApi?.user}
          business={profileApi?.business}
        />
      )}
    </div>
  );
}

function UnfollowConfirmModal({ isOpen, onClose, onConfirm, name }: any) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[200000] flex items-center justify-center p-4 bg-black/60">
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl"
      >
        <h3 className="text-md font-bold text-slate-800 mb-2 text-center tracking-tight">Unfollow {name}?</h3>
        <p className="text-[13px] text-slate-500 mb-6 text-center leading-relaxed">
          Do you want to unfollow {name}? You will stop receiving updates from this profile in your feed.
        </p>
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-full border border-slate-200 text-slate-500 text-sm font-medium active:scale-[0.98] transition-all hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className="flex-1 py-2.5 rounded-full bg-rose-500 text-white text-sm active:scale-[0.98] transition-all"
          >
            Unfollow
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function BlockConfirmModal({ isOpen, onClose, onConfirm, name }: any) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[200000] flex items-center justify-center p-4 bg-black/60">
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-white rounded-[0.5rem] p-6 w-full max-w-sm shadow-2xl"
      >
        <h3 className="text-md font-bold text-slate-800 mb-2 text-center tracking-tight">Block {name}?</h3>
        <p className="text-[13px] text-slate-500 mb-6 text-center leading-relaxed">
          This user will no longer be able to view your notes or interact with you. They will not be notified of being blocked.
        </p>
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2 rounded-full border border-slate-100 text-slate-400 text-sm active:scale-[0.98] transition-all hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-2 rounded-full bg-rose-500 text-white text-sm active:scale-[0.98] transition-all shadow-lg shadow-rose-200"
          >
            Block
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function FlyerModal({ isOpen, onClose, user, business }: { isOpen: boolean, onClose: () => void, user: any, business: any }) {
  const [isFlipped, setIsFlipped] = useState(false);
  const flyerRef = useRef<HTMLDivElement>(null);
  const backFlyerRef = useRef<HTMLDivElement>(null);

  const bgImage = formatUrl(business?.bg_photo_url || user?.bg_photo_url) || "https://images.unsplash.com/photo-1557683316-973673baf926?q=80&w=1000&auto=format&fit=crop";
  const logo = formatUrl(business?.business_logo || user?.profile_pic || user?.avatar_url);
  // Remote QR services cannot fetch images from localhost. 
  // We also MUST ensure the URL is never 'undefined' to avoid 404s from the QR API.
  const isLocalLogo = logo?.includes("localhost") || logo?.includes("127.0.0.1");
  const fallbackLogo = "https://stoqle.com/logo.png";
  const safeLogo = (isLocalLogo || !logo) ? fallbackLogo : logo;
  const roundedLogo = safeLogo.includes("ui-avatars.com")
    ? safeLogo
    : `https://images.weserv.nl/?url=${encodeURIComponent(safeLogo)}&mask=circle&mtype=png`;

  const name = business?.business_name || user?.full_name || user?.name || user?.username || "NAME";
  const sid = user?.stoqle_id || user?.user_id || user?.id || "00000000001";
  const slug = business?.business_slug || user?.username || sid;
  const qrData = `${typeof window !== "undefined" ? window.location.origin : ""}/${slug}`;

  const handleDownload = async () => {
    const activeRef = isFlipped ? backFlyerRef : flyerRef;
    if (!activeRef.current) return;

    const toastId = toast.loading("Preparing your flyer...");
    try {
      // Small delay to ensure any animations are settled
      await new Promise(resolve => setTimeout(resolve, 100));

      const dataUrl = await toPng(activeRef.current, {
        cacheBust: true,
        backgroundColor: '#ffffff',
        skipFonts: true, // Speeds up capture and avoids CORS font errors
        pixelRatio: 2,   // High resolution for clear QR scanning
        style: {
          borderRadius: '2rem'
        }
      });

      const link = document.createElement('a');
      link.download = `Stoqle-Flyer-${name.replace(/\s+/g, '-')}.png`;
      link.href = dataUrl;
      link.click();

      toast.success("Flyer downloaded successfully!", { id: toastId });
    } catch (err) {
      console.error("Flyer capture failed:", err);
      toast.error("Failed to download flyer. Please try again.", { id: toastId });
    }
  };

  const handleShare = async () => {
    const url = qrData;
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Connect with ${name} on Stoqle`,
          text: `Check out my profile on Stoqle! My ID is ${sid}`,
          url,
        });
      } catch (err) { }
    } else {
      copyToClipboard(url);
      toast.success("Profile link copied!");
    }
  };

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        className="relative w-full max-w-sm bg-white rounded-[2rem] shadow-2xl overflow-hidden flex flex-col"
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-[100] p-2 bg-black/20 backdrop-blur-md rounded-full text-white hover:bg-black/30 transition-colors"
        >
          <XMarkIcon className="w-5 h-5" />
        </button>

        {/* Flyer Container with Switch Logic */}
        <div
          className="relative w-full aspect-[4/6] cursor-pointer group"
          onClick={() => setIsFlipped(!isFlipped)}
        >
          <AnimatePresence initial={false}>
            {!isFlipped ? (
              <motion.div
                key="front"
                initial={{ opacity: 0, rotateY: -110 }}
                animate={{ opacity: 1, rotateY: 0 }}
                exit={{ opacity: 0, rotateY: 110 }}
                transition={{
                  type: "spring",
                  stiffness: 450,
                  damping: 30,
                  mass: 0.5
                }}
                className="w-full h-full absolute inset-0"
              >
                <div ref={flyerRef} className="w-full h-full bg-white overflow-hidden border-[6px] border-white rounded-t-[2rem] relative shadow-xl">
                  {/* Banner Header */}
                  <div className="absolute top-0 left-0 right-0 h-[40%] z-0">
                    <img src={bgImage} crossOrigin="anonymous" className="w-full h-full object-cover" alt="Banner" />
                    <div className="absolute inset-0 bg-black/10"></div>
                  </div>

                  {/* rose Block - Elevated Content Area */}
                  <div className="absolute bottom-0 left-0 right-0 h-[72%] bg-rose-500 rounded-t-[2.5rem] z-10 shadow-[0_-15px_50px_rgba(0,0,0,0.3)]">
                    <div className="relative h-full flex flex-col p-8 justify-between text-white">
                      {/* Header */}
                      <div className="flex flex-col items-start mt-4">
                        <div className="w-16 h-16 rounded-full border-2 border-white/80 mb-4 overflow-hidden shadow-xl">
                          {logo ? (
                            <img src={logo} crossOrigin="anonymous" className="w-full h-full object-cover" alt="Logo" />
                          ) : (
                            <div className="w-full h-full bg-white flex items-center justify-center text-rose-500">
                              <UserGroupIcon className="w-8 h-8" />
                            </div>
                          )}
                        </div>
                        <h3 className="text-xl font-bold tracking-tight mb-1">{name}</h3>
                        <p className="text-[10px] text-white/80 font-medium">Stoqle ID: {sid}</p>
                      </div>

                      {/* Divider */}
                      <div className="w-full h-px bg-white/20 my-2"></div>

                      {/* Bottom */}
                      <div className="flex items-end justify-between w-full">
                        <div className="flex flex-col items-start gap-4">
                          <div className="bg-white px-3 py-1 rounded-full shadow-lg">
                            <span className="text-rose-500 font-black text-sm tracking-tight">stoqle</span>
                          </div>
                          <div className="space-y-0.5">
                            <p className="text-xs text-white/70 font-medium leading-tight">Scan QR code</p>
                            <p className="text-xs text-white font-bold tracking-wide">Find me on Stoqle</p>
                          </div>
                        </div>

                        <div className="relative w-24 h-24 bg-white rounded-2xl p-1 shadow-2xl flex items-center justify-center transform border-2 border-white overflow-hidden">
                          <img
                            src={`https://quickchart.io/qr?text=${encodeURIComponent(qrData)}&size=150&ecLevel=M`}
                            crossOrigin="anonymous"
                            alt="QR Code"
                            className="w-full h-full object-contain"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="back"
                initial={{ opacity: 0, rotateY: 110 }}
                animate={{ opacity: 1, rotateY: 0 }}
                exit={{ opacity: 0, rotateY: -110 }}
                transition={{
                  type: "spring",
                  stiffness: 450,
                  damping: 30,
                  mass: 0.5
                }}
                className="w-full h-full absolute inset-0"
              >
                <div ref={backFlyerRef} className="w-full h-full bg-white  border-white rounded-t-[2rem] flex flex-col items-center justify-center p-8 text-center relative ">
                  {/* Big QR Code with Integrated Center Logo */}
                  <div className="w-56 h-56 bg-white rounded-[2.5rem] p-6  mb-10 mt-6 relative flex items-center justify-center">
                    <img
                      src={`https://quickchart.io/qr?text=${encodeURIComponent(qrData)}&size=300&ecLevel=H&centerImageUrl=${encodeURIComponent(roundedLogo)}&centerImageWidth=40&centerImageHeight=40`}
                      crossOrigin="anonymous"
                      alt="Large QR Code"
                      className="w-full h-full object-contain"
                    />
                    <div className="absolute inset-0 -rose-500/10 rounded-[2.5rem] animate-pulse pointer-events-none"></div>
                  </div>

                  {/* User Info */}
                  <div className="space-y-4">
                    <h3 className="text-xl font-black text-slate-900 tracking-tight">{name}</h3>
                    <div className="inline-flex">
                      <span className="text-sm text-slate-400 font-semibold">stoqle ID:{sid}</span>
                    </div>
                  </div>

                  {/* Scan Instructions */}
                  <div className="mt-20 space-y-2">
                    <p className="text-slate-600 text-sm font-semibold">Scan QR code, Find me on Stoqle</p>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Action Buttons */}
        <div className="px-8 py-6 bg-white flex justify-around items-center border-t border-slate-50">
          <button onClick={() => toast.info("Hold your phone camera over the QR code")} className="flex flex-col items-center gap-1.5 group">
            <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center group-hover:bg-slate-100 transition-colors">
              <Scan className="w-5 h-5 text-slate-600" />
            </div>
            <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Scan</span>
          </button>

          <button onClick={handleDownload} className="flex flex-col items-center gap-1.5 group">
            <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center group-hover:bg-slate-100 transition-colors">
              <Download className="w-5 h-5 text-slate-600" />
            </div>
            <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Download</span>
          </button>

          <button onClick={handleShare} className="flex flex-col items-center gap-1.5 group">
            <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center group-hover:bg-slate-100 transition-colors">
              <Share2 className="w-5 h-5 text-slate-600" />
            </div>
            <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Share</span>
          </button>
        </div>
      </motion.div>
    </div>
  );
}
