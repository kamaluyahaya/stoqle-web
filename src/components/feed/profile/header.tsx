// components/profile/Header.tsx
"use client";

import React, { useEffect, useRef, useState, useMemo } from "react";
import { useRouter, usePathname } from "next/navigation";
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
import { EyeIcon, EyeSlashIcon, ArrowLeftIcon, UserPlusIcon, CheckIcon, EllipsisHorizontalIcon, ChevronLeftIcon, PlusIcon, MapPinIcon, Cog6ToothIcon, XMarkIcon, UserGroupIcon, LinkIcon, FlagIcon, NoSymbolIcon } from "@heroicons/react/24/outline";
import { CheckBadgeIcon } from "@heroicons/react/24/solid";
import { motion, AnimatePresence } from "framer-motion";
import { MessageCircleMore, Settings, ShoppingBag } from "lucide-react";


import ImageViewer from "../../../components/modal/imageViewer";
import { CameraIcon } from "@heroicons/react/24/solid";
import ProfileCropperModal from "../../../components/modal/profileCropperModal";
import ShareToFriendsModal from "../../../components/modal/shareToFriendsModal";

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
};

const DEFAULT_AVATAR = "/assets/images/favio.png";

export default function Header({ profileApi, displayName, onLogout, onSocialClick, onVisitShop, onFollowToggle, isFollowing: isFollowingProp, followersCount: followersCountProp, isBlocked: isBlockedProp }: HeaderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const isOtherUserProfileRoute = pathname?.startsWith('/user/profile/');
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
  const [showMiniHeader, setShowMiniHeader] = useState(false);
  const [showMiniLogo, setShowMiniLogo] = useState(false);
  const [dominantColor, setDominantColor] = useState("rgba(255, 255, 255, 1)");

  const [uploadingProfile, setUploadingProfile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [localProfilePic, setLocalProfilePic] = useState<string | null>(null);

  const [cropperImage, setCropperImage] = useState<string | null>(null);
  const [showCropper, setShowCropper] = useState(false);
  const [blockConfirmOpen, setBlockConfirmOpen] = useState(false);


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
      if (!isOwner || isOtherUserProfileRoute) {
        setShowMiniHeader(window.scrollY > 0);
        setShowMiniLogo(window.scrollY > 150);
      }
    };
    // Initial check on mount
    if (!isOwner || isOtherUserProfileRoute) {
      setShowMiniHeader(window.scrollY > 0);
      setShowMiniLogo(window.scrollY > 150);
    }
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [isOwner, isOtherUserProfileRoute]);

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
          // Only fallback if Prop is not provided
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

  const profilePic = profileApi?.business?.business_logo ?? profileApi?.user?.profile_pic ?? DEFAULT_AVATAR;

  // Extract dominant color from profile picture
  useEffect(() => {
    if (!profilePic) return;

    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.src = profilePic;
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
  }, [profilePic]);


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
        onFollowToggle?.(true);
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
        onFollowToggle?.(false);
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

          if (resp.status === 403) {
            const error = await resp.json().catch(() => ({}));
            toast.error(error.error || "This user has restricted direct messages");
            return;
          }

          if (resp.status === 401) {
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

  const handleProfilePicChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

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
    toast.info("Updating profile...", { duration: 2000 });

    const formData = new FormData();
    formData.append("profile_pic", croppedBlob, "profile.jpg");

    try {
      const response = await fetch(`${API_BASE_URL}/api/profile/profile-pic`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      const json = await response.json();
      if (!response.ok) throw new Error(json.message || "Failed to update profile pic");

      const newPicUrl = json.data?.user?.profile_pic || json.data?.profile_pic;

      // Update global context
      if (auth?.onVerificationSuccess) {
        const updatedUser = { ...currentUser, profile_pic: newPicUrl };
        auth.onVerificationSuccess(updatedUser);
      }

      toast.success("Profile updated!");
      setLocalProfilePic(newPicUrl);

      // Auto-close the full screen as requested
      setFullImageUrl(null);
    } catch (err: any) {
      console.error("Profile upload error:", err);
      toast.error(err.message || "Failed to upload image");
      setLocalProfilePic(null);
    } finally {
      setUploadingProfile(false);
      setShowCropper(false);
      setCropperImage(null);
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
      await navigator.clipboard.writeText(window.location.href);
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
      toast.error("An error occurred");
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
          className={`p-1.5 rounded-full transition-all group active:scale-90 hover:bg-black/5 ${color || ""}`}
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
                          <div className="w-8 h-8 rounded-full bg-red-500 flex items-center justify-center text-white">
                            <UserGroupIcon className="w-4 h-4" />
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
                <>
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={() => setOpen(false)}
                    className="fixed inset-0 bg-black/40 z-[140] lg:hidden"
                  />
                  <motion.div
                    key="bottomsheet"
                    initial={{ y: "100%" }}
                    animate={{ y: 0 }}
                    exit={{ y: "100%" }}
                    transition={{ type: "spring", damping: 25, stiffness: 300 }}
                    className="fixed bottom-0 left-0 right-0 bg-white rounded-t-[0.5rem] z-[150] lg:hidden pb-[env(safe-area-inset-bottom,20px)] shadow-[0_-8px_30px_rgba(0,0,0,0.1)] overflow-hidden"
                  >
                    <div className="flex items-center justify-center p-4 relative  border-slate-100">
                      <span className="font-bold text-slate-800 text-sm">Share to</span>
                      <button
                        onClick={() => setOpen(false)}
                        className="absolute right-4 p-1 hover:bg-slate-100 rounded-full transition-colors"
                      >
                        <XMarkIcon className="w-5 h-5 text-slate-500" />
                      </button>
                    </div>

                    <div className="p-6">
                      <div
                        className="flex flex-col items-start cursor-pointer group"
                        onClick={() => {
                          setOpen(false);
                          setShowShareFriendsModal(true);
                        }}
                      >
                        <div className="w-12 h-12 bg-red-500 rounded-full flex items-center justify-center shadow-lg shadow-red-500/20 group-active:scale-95 transition-transform">
                          <UserGroupIcon className="w-6 h-6 text-white" />
                        </div>
                        <span className="text-[11px] font-medium text-slate-600">Friends</span>
                      </div>
                    </div>

                    <div className="mx-6 border-t border-slate-100" />

                    <div className="p-6 py-4 flex gap-6 items-start">
                      <button
                        onClick={() => {
                          handleCopyLink();
                          setOpen(false);
                        }}
                        className="flex flex-col items-center gap-2 group"
                      >
                        <div className="w-12 h-12 bg-slate-200 rounded-full flex items-center justify-center group-active:scale-95 transition-transform text-slate-600">
                          <LinkIcon className="w-5 h-5" />
                        </div>
                        <span className="text-[11px] font-medium text-slate-500">Copy link</span>
                      </button>

                      <button
                        onClick={() => {
                          reportUser();
                          setOpen(false);
                        }}
                        className="flex flex-col items-center gap-2 group"
                      >
                        <div className="w-12 h-12 bg-slate-200 rounded-full flex items-center justify-center group-active:scale-95 transition-transform text-slate-600">
                          <FlagIcon className="w-5 h-5" />
                        </div>
                        <span className="text-[11px] font-medium text-slate-500">Report</span>
                      </button>

                      <button
                        onClick={() => {
                          if (isBlockedLocal) {
                            handleBlockUser();
                          } else {
                            setBlockConfirmOpen(true);
                          }
                          setOpen(false);
                        }}
                        className="flex flex-col items-center gap-2 group"
                      >
                        <div className="w-12 h-12 bg-slate-200 rounded-full flex items-center justify-center group-active:scale-95 transition-transform text-slate-600">
                          <NoSymbolIcon className="w-5 h-5" />
                        </div>
                        <span className="text-[11px] font-medium text-slate-500">{isBlockedLocal ? "Unblock" : "Block"}</span>
                      </button>
                    </div>
                  </motion.div>
                </>
              )}
            </>
          )}
        </AnimatePresence>
      </div>
    );
  };

  return (
    <div className="relative">
      {/* Immersive Navbar (Back & More always visible; Logo & Follow animate on scroll) */}
      <motion.div
        initial={false}
        animate={{
          backgroundColor: showMiniHeader ? dominantColor : "rgba(255,255,255,0)",
        }}
        transition={{ duration: 0.3 }}
        className="fixed top-0 left-0 lg:left-[300px] right-0 z-[100] h-14 flex lg:hidden items-center px-4 transition-[left] duration-300"
      >
        {/* Left part: Back button (Always visible on mobile/tablet) */}
        <div className="flex-1 flex justify-start min-w-0 lg:hidden focus:outline-none">
          <button
            onClick={() => router.back()}
            className={`p-2 -ml-2 transition-colors duration-300 ${showMiniHeader ? 'text-white' : 'text-slate-800'} hover:opacity-70`}
          >
            <ChevronLeftIcon className="w-6 h-6 stroke-[2.5]" />
          </button>
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
                    onClick={followUser}
                    className="bg-red-500 text-white px-5 py-1.5 rounded-full text-xs font-bold active:scale-95 transition-all shadow-md"
                  >
                    Follow
                  </button>
                ) : (
                  <button
                    onClick={unfollowUser}
                    className="bg-white/10 backdrop-blur-md text-white px-5 py-1.5 rounded-full text-xs font-bold active:scale-95 transition-all"
                  >
                    Following
                  </button>
                )}
              </motion.div>
            )}
          </AnimatePresence>
          <div className={`transition-colors duration-300 ${showMiniHeader ? 'text-white' : 'text-slate-800'}`}>
            <MoreMenu />
          </div>
        </div>
      </motion.div>


      <div className="rounded-2xl overflow-visible bg-white mb-6">
        <div className="max-w-4xl mx-auto mt-20 px-4">
          {/* Mobile */}
          <div className="md:hidden">
            <div className="flex items-center gap-3">
              <div
                className="group relative flex-none cursor-pointer active:scale-95 transition-transform"
                onClick={() => setFullImageUrl(
                  localProfilePic ??
                  profileApi?.business?.business_logo ??
                  profileApi?.business?.logo ??
                  profileApi?.user?.profile_pic ??
                  profileApi?.user?.avatar ??
                  DEFAULT_AVATAR
                )}
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
                  className={`h-20 w-20 rounded-full object-cover ring-4 border ring-white shadow bg-white border-slate-200 ${uploadingProfile ? "opacity-50" : ""}`}
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
                <h2 className="lg:-mt-10 sm:-mt-5 font-semibold text-slate-900 leading-tight truncate flex items-center gap-1.5" style={{ fontSize: "clamp(1rem, 2.2vw, 1.25rem)" }}>
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
                      <p className="text-[10px] text-slate-400 mt-1">
                        Stoqle ID: {profileApi?.user?.user_id || profileApi?.user?.id || ""}
                      </p>
                      {!isOwner && (profileApi?.latest_location || profileApi?.latest_ip) && (
                        <div className="flex items-center gap-1.5 mt-1">
                          <p className="text-[10px] text-slate-400 max-w-xl leading-snug">IP location: {profileApi.latest_location || profileApi.latest_ip}</p>
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
                      <p className="text-sm text-slate-500 leading-snug">
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
                          onClick={() => {
                            if (!isOwner && profileApi?.hide_followers) return;
                            onSocialClick?.("followers");
                          }}
                        >
                          <div className="text-sm font-bold text-slate-800">{followersCount}</div>
                          <div className="text-xs text-slate-500">Followers</div>
                        </div>

                        <div
                          className={`flex flex-col items-center ${(!isOwner && profileApi?.hide_following) ? 'cursor-default opacity-90' : 'cursor-pointer active:scale-95 transition-transform'}`}
                          onClick={() => {
                            if (!isOwner && profileApi?.hide_following) return;
                            onSocialClick?.("following");
                          }}
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
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <div className="flex items-center gap-2">
                    {!statusFetched && !isOwner ? (
                      <div className="flex items-center gap-2">
                        <div className="h-8 w-24 rounded-full shimmer-bg opacity-60" />
                        <div className="h-8 w-8 rounded-full shimmer-bg opacity-60" />
                      </div>
                    ) : isOwner ? (
                      <div className="flex gap-1">
                        <button
                          className="bg-red-500 text-white rounded-full px-5 py-2 text-sm whitespace-nowrap active:scale-95 transition-transform"
                          onClick={() => {
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
                        <div className="p-2 border border-slate-200 rounded-full" onClick={() => { router.push("/settings"); }}>
                          <Settings className="w-5 h-5" />
                        </div>
                      </div>
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
                                <MessageCircleMore className="w-5 h-5" />
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

          {/* Desktop Layout */}
          <div className="hidden lg:flex md:items-start md:gap-6">
            <div
              className="group relative flex-none cursor-pointer active:scale-95 transition-transform"
              onClick={() => setFullImageUrl(
                localProfilePic ??
                profileApi?.business?.business_logo ??
                profileApi?.business?.logo ??
                profileApi?.user?.profile_pic ??
                profileApi?.user?.avatar ??
                DEFAULT_AVATAR
              )}
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
                      <p className="text-[10px] text-slate-400 mt-1">
                        Stoqle ID: {profileApi?.user?.user_id || profileApi?.user?.id || ""}
                      </p>
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
                    <p className="text-sm text-slate-500 leading-snug">
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
                      onClick={() => {
                        if (!isOwner && profileApi?.hide_followers) return;
                        onSocialClick?.("followers");
                      }}
                    >
                      <div className="text-lg font-bold text-slate-800">{followersCount}</div>
                      <div className="text-sm text-slate-500">Followers</div>
                    </div>

                    <div
                      className={`flex items-center gap-2 ${(!isOwner && profileApi?.hide_following) ? 'cursor-default opacity-90' : 'cursor-pointer hover:bg-slate-50 p-1 rounded-lg transition-colors'}`}
                      onClick={() => {
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
                      onClick={() => isOwner && onSocialClick?.("liked")}
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
                <div className="flex items-center gap-3">
                  <div className="h-10 w-32 rounded-full shimmer-bg opacity-60" />
                  <div className="h-10 w-10 rounded-full shimmer-bg opacity-60" />
                </div>
              ) : isOwner ? (
                <>
                  <button
                    className="bg-red-500 text-white rounded-full px-5 py-2 text-sm shadow active:scale-95 transition-transform"
                    onClick={() => router.push("/profile/edit")}
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
                          className="rounded-full px-5 py-2 text-sm shadow whitespace-nowrap transition-all bg-red-500 text-white border border-transparent hover:bg-red-600 active:scale-95"
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
                      !isDMRestricted && (
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
      />

      <ImageViewer
        src={fullImageUrl}
        onClose={() => setFullImageUrl(null)}
        profileUserId={profileApi?.user?.user_id ?? profileApi?.business?.user_id}
        onUpdateProfile={() => fileInputRef.current?.click()}
      />

      <BlockConfirmModal
        isOpen={blockConfirmOpen}
        onClose={() => setBlockConfirmOpen(false)}
        onConfirm={handleBlockUser}
        name={displayName}
      />
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
            className="flex-1 py-2 rounded-full bg-red-500 text-white text-sm active:scale-[0.98] transition-all shadow-lg shadow-red-200"
          >
            Block
          </button>
        </div>
      </motion.div>
    </div>
  );
}
