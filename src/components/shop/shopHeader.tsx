"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/src/context/authContext";
import { API_BASE_URL } from "@/src/lib/config";
import LoginModal from "../../components/modal/auth/loginModal";
import { StarIcon } from "@heroicons/react/24/solid";

type ShopHeaderProps = {
    profileApi: any | null;
    displayName: string;
};

const DEFAULT_AVATAR = "/assets/images/favio.png";
const DEFAULT_BG = "/assets/images/background.png";

export default function ShopHeader({ profileApi, displayName }: ShopHeaderProps) {
    const router = useRouter();
    const auth = useAuth();
    const { user: currentUser, token } = auth;

    const [isFollowing, setIsFollowing] = useState<boolean>(false);
    const [followersCount, setFollowersCount] = useState<number>(0);
    const [actionLoading, setActionLoading] = useState(false);
    const [showLoginModal, setShowLoginModal] = useState(false);

    const business = profileApi?.business;
    const stats = profileApi?.business?.stats || profileApi?.stats;
    const policy = profileApi?.policy;

    const profileUserId = profileApi?.business?.user_id || profileApi?.user_id || profileApi?.user?.user_id || profileApi?.user?.id;

    useEffect(() => {
        if (stats && !followersCount) {
            const initialCount = Number(stats.followers ?? stats.followers_count ?? 0);
            if (initialCount > 0) setFollowersCount(initialCount);
        }
    }, [stats]);

    useEffect(() => {
        if (!profileUserId) return;

        async function fetchRealStats() {
            try {
                // Now public endpoint, no token needed for counts
                const res = await fetch(`${API_BASE_URL}/api/users/${profileUserId}/follow-stats`);
                const json = await res.json();
                if (json.ok && json.data) {
                    const count = Number(json.data.followersCount ?? json.data.followers ?? 0);
                    setFollowersCount(count);
                }
            } catch (e) {
                console.error("Follow stats fetch failed:", e);
            }
        }

        // Initial fetch
        fetchRealStats();

        // Polling for updates every 30 seconds if visible
        const interval = setInterval(fetchRealStats, 30000);
        return () => clearInterval(interval);
    }, [profileUserId]);

    useEffect(() => {
        if (!profileUserId || !token) return;
        async function checkFollow() {
            try {
                const res = await fetch(`${API_BASE_URL}/api/follow/${profileUserId}/status`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                const json = await res.json();
                if (json.ok) setIsFollowing(json.data.isFollowing);
            } catch (e) { }
        }
        checkFollow();
    }, [profileUserId, token]);

    const handleFollow = async () => {
        if (!token) {
            setShowLoginModal(true);
            return;
        }
        setActionLoading(true);
        const prevFollowing = isFollowing;
        const prevCount = followersCount;

        setIsFollowing(!isFollowing);
        setFollowersCount(isFollowing ? prevCount - 1 : prevCount + 1);

        try {
            const endpoint = isFollowing ? "unfollow" : "follow";
            const res = await fetch(`${API_BASE_URL}/api/follow/${profileUserId}/${endpoint}`, {
                method: "POST",
                headers: { Authorization: `Bearer ${token}` }
            });
            if (!res.ok) {
                setIsFollowing(prevFollowing);
                setFollowersCount(prevCount);
            }
        } catch (e) {
            setIsFollowing(prevFollowing);
            setFollowersCount(prevCount);
        } finally {
            setActionLoading(false);
        }
    };

    const formatUrl = (url: string) => {
        if (!url) return null;
        if (url.startsWith("http")) return url;
        return url.startsWith("/public") ? `${API_BASE_URL}${url}` : `${API_BASE_URL}/public/${url}`;
    };

    const bgPhoto = formatUrl(profileApi?.user?.bg_photo_url || business?.bg_photo_url) || DEFAULT_BG;
    const logo = formatUrl(business?.business_logo) || formatUrl(business?.logo) || formatUrl(profileApi?.user?.profile_pic) || formatUrl(business?.profile_pic) || DEFAULT_AVATAR;

    // rating calculation
    const rating = Number(stats?.rating ?? (policy?.customer_service?.good_reviews_threshold ? (policy.customer_service.good_reviews_threshold / 20) : 5.0));

    return (
        <div className="w-full bg-white">
            {/* Background with Content Overlay */}
            <div className="relative h-64 md:h-80 w-full overflow-hidden">
                <img src={bgPhoto} alt="Shop Background" className="h-full w-full object-cover" />

                {/* Dark shadow overlay from bottom to top */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/40 to-black/10" />

                {/* Content Container - Positioned ON TOP of the image */}
                <div className="absolute inset-x-0 top-0 z-10 pb-6 px-4">
                    <div className="max-w-6xl mx-auto mt-20 flex flex-col gap-4">
                        <div className="flex flex-row items-start gap-3 md:gap-5">
                            {/* Logo */}
                            <div className="flex-none">
                                <img
                                    src={logo}
                                    alt={displayName}
                                    className="h-20 w-20 sm:h-24 sm:w-24 md:h-36 md:w-36 rounded-full object-cover border-4 border-white shadow-2xl bg-white"
                                />
                            </div>

                            <div className="flex-1 pb-1 mt-3 sm:mt-5 min-w-0">
                                <h1 className="text-[clamp(9px,3.8vw,36px)] font-extrabold text-white drop-shadow-lg tracking-tight whitespace-nowrap leading-tight max-w-full block">
                                    {displayName}
                                </h1>
                                <div className="flex items-center gap-3 mt-2">
                                    <div className="flex items-start">
                                        <span className="text-[10px] font-bold text-white/80  tracking-widest drop-shadow-md uppercase">Followers {followersCount.toLocaleString()}+</span>
                                    </div>

                                    {/* Rating */}
                                    <div className="flex items-center gap-1.5 border-l border-white/20 pl-3">
                                        <div className="flex items-center">
                                            {[...Array(5)].map((_, i) => (
                                                <StarIcon
                                                    key={i}
                                                    className={`w-3 h-3 drop-shadow-sm ${i < Math.floor(rating) ? "text-yellow-400" : (i < rating ? "text-yellow-400/80" : "text-white/20")}`}
                                                />
                                            ))}
                                        </div>
                                        <span className="text-[10px] font-bold text-white tracking-widest drop-shadow-md">{rating.toFixed(1)}</span>
                                    </div>
                                </div>

                                {/* DESKTOP: Business Policies (Shown under followers) */}
                                <div className="hidden md:flex items-center flex-nowrap  mt-4 overflow-x-auto no-scrollbar pb-1 w-full translate-z-0">
                                    {renderPolicies()}
                                </div>
                            </div>
                        </div>

                        {/* MOBILE: Business Policies (Shown under the whole row) */}
                        <div className="md:hidden flex items-center flex-nowrap overflow-x-auto no-scrollbar pb-1 w-full translate-z-0">
                            {renderPolicies()}
                        </div>
                    </div>
                </div>
            </div>
            <LoginModal isOpen={showLoginModal} onClose={() => setShowLoginModal(false)} />
        </div>
    );

    // Helper to render policies to avoid duplication
    function renderPolicies() {
        return (
            <div className="flex items-center gap-x-2">
                {policy?.returns?.seven_day_no_reason === 1 && (
                    <div className="flex flex-none items-center gap-1 text-[10px] sm:text-[11px] font-bold text-white bg-black/40 backdrop-blur-md px-3 py-1 rounded border border-white/10 shadow-sm">
                        <svg className="w-3 h-3 text-green-400" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                        7 days no reason return
                    </div>
                )}
                {policy?.returns?.return_shipping_subsidy === 1 && (
                    <div className="flex flex-none items-center gap-1 text-[10px] sm:text-[11px] font-bold text-white bg-black/40 backdrop-blur-md px-3 py-1 rounded border border-white/10 shadow-sm">
                        <svg className="w-3 h-3 text-green-400" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                        Return shipping subsidy
                    </div>
                )}
                {(() => {
                    const avg = policy?.shipping?.find((s: any) => s.kind === 'avg');
                    if (!avg) return null;
                    return (
                        <div className="flex flex-none items-center gap-1 text-[10px] sm:text-[11px] font-bold text-white bg-black/40 backdrop-blur-md px-3 py-1 rounded border border-white/10 shadow-sm">
                            <svg className="w-3 h-3 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                            Avg. Shipping: {avg.value} {avg.unit}
                        </div>
                    );
                })()}
                {policy?.customer_service?.reply_time && (
                    <div className="flex flex-none items-center text-[10px] sm:text-[11px] font-bold text-white bg-black/40 backdrop-blur-md px-3 py-1 rounded border border-white/10 shadow-sm">
                        <svg className="w-3 h-3 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        Average Customer Reply {policy.customer_service.reply_time}
                    </div>
                )}
                {policy?.customer_service?.good_reviews_threshold && (
                    <div className="flex flex-none items-center text-[10px] sm:text-[11px] font-bold text-white bg-black/40 backdrop-blur-md px-3 py-1 rounded border border-white/10 shadow-sm">
                        <svg className="w-3 h-3 text-yellow-400" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
                        {policy.customer_service.good_reviews_threshold}% Reviews
                    </div>
                )}
                {/* Shipping Policies */}

                {(() => {
                    const promise = policy?.shipping?.find((s: any) => s.kind === 'promise');
                    if (!promise) return null;
                    return (
                        <div className="flex flex-none items-center gap-1 text-[10px] sm:text-[11px] font-bold text-white bg-black/40 backdrop-blur-md px-3 py-1 rounded border border-white/10 shadow-sm">
                            <svg className="w-3 h-3 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 12l2 2 4-4m5-2.308c0-5.694 3.466-4.615 5-4.615s5 1.079 5 4.615c0 4.019-5 6.77-5 6.77s-5-2.751-5-6.77z" /></svg>
                            Ship promise: {promise.value} {promise.unit}
                        </div>
                    );
                })()}
            </div>
        );
    }
}
