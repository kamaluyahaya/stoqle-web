import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { XMarkIcon, HeartIcon, UserGroupIcon, ChevronLeftIcon, ChevronRightIcon } from "@heroicons/react/24/outline";
import { HeartIcon as HeartSolidIcon } from "@heroicons/react/24/solid";
import { useAuth } from "@/src/context/authContext";
import { API_BASE_URL } from "@/src/lib/config";
import Link from "next/link";

type Props = {
    src: string | null;
    onClose: () => void;
    profileUserId?: string | number;
    mediaList?: string[];
    currentIndex?: number;
    onIndexChange?: (index: number) => void;
    direction?: number;
    onUpdateProfile?: () => void;
};

export default function ImageViewer({ src, onClose, profileUserId, mediaList = [], currentIndex = 0, onIndexChange, direction = 0, onUpdateProfile }: Props) {
    const { user } = useAuth();
    const [liked, setLiked] = useState(false);
    const [likeCount, setLikeCount] = useState(0);
    const [showLikers, setShowLikers] = useState(false);
    const [likers, setLikers] = useState<any[]>([]);
    const [loadingLikers, setLoadingLikers] = useState(false);

    const isOwnProfile = user && profileUserId && String(user.user_id || user.id) === String(profileUserId);

    useEffect(() => {
        if (profileUserId) {
            fetchLikeStats();
        }
    }, [profileUserId]);

    const fetchLikeStats = async () => {
        try {
            const token = localStorage.getItem("token");
            const res = await fetch(`${API_BASE_URL}/api/profile/${profileUserId}/like-stats`, {
                headers: token ? { "Authorization": `Bearer ${token}` } : {}
            });
            const json = await res.json();
            if (json.status === "success") {
                setLiked(json.data.liked);
                setLikeCount(json.data.count);
            }
        } catch (err) {
            console.error("Fetch like stats failed", err);
        }
    };

    const toggleLike = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!user) return; // Should probably open login modal

        try {
            const token = localStorage.getItem("token");
            const res = await fetch(`${API_BASE_URL}/api/profile/${profileUserId}/like`, {
                method: "POST",
                headers: { "Authorization": `Bearer ${token}` }
            });
            const json = await res.json();
            if (json.status === "success") {
                setLiked(json.data.liked);
                setLikeCount(json.data.count);
            }
        } catch (err) {
            console.error("Toggle like failed", err);
        }
    };

    const fetchLikers = async (e: React.MouseEvent) => {
        e.stopPropagation();
        setShowLikers(true);
        setLoadingLikers(true);
        try {
            const token = localStorage.getItem("token");
            const res = await fetch(`${API_BASE_URL}/api/profile/${profileUserId}/likers`, {
                headers: { "Authorization": `Bearer ${token}` }
            });
            const json = await res.json();
            if (json.status === "success") {
                setLikers(json.data.items);
            }
        } catch (err) {
            console.error("Fetch likers failed", err);
        } finally {
            setLoadingLikers(false);
        }
    };

    if (!src) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[10000] flex flex-col items-center justify-center bg-black/98 p-4 backdrop-blur-xl cursor-zoom-out"
                onClick={onClose}
                onMouseDown={(e) => e.stopPropagation()}
            >
                {/* Backdrop Overlay for closing */}
                <div className="absolute inset-0 z-0" onClick={onClose} />
                {/* Close Button */}
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onClose();
                    }}
                    className="absolute top-6 right-6 p-2 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors z-[10001] backdrop-blur-sm"
                >
                    <XMarkIcon className="w-8 h-8" />
                </button>

                {/* Main Media Container */}
                <div className="relative flex flex-col items-center gap-6 w-full h-full justify-center">
                    <div className="relative w-full max-h-[85vh] flex items-center justify-center overflow-hidden">
                        <AnimatePresence initial={false} custom={direction} mode="popLayout">
                            <motion.img
                                key={src}
                                custom={direction}
                                variants={{
                                    enter: (dir: number) => ({ x: dir > 0 ? "100%" : "-100%", opacity: 0 }),
                                    center: { x: 0, opacity: 1 },
                                    exit: (dir: number) => ({ x: dir > 0 ? "-100%" : "100%", opacity: 0 })
                                }}
                                initial="enter"
                                animate="center"
                                exit="exit"
                                transition={{ x: { type: "spring", stiffness: 400, damping: 40 }, opacity: { duration: 0.2 } }}
                                src={src || undefined}
                                alt="Full screen"
                                drag={mediaList.length > 1 ? "x" : false}
                                dragConstraints={{ left: 0, right: 0 }}
                                dragElastic={0.6}
                                onDragEnd={(e, info) => {
                                    if (!onIndexChange || mediaList.length <= 1) return;
                                    const swipeThreshold = 50;
                                    if (info.offset.x < -swipeThreshold) {
                                        onIndexChange((currentIndex + 1) % mediaList.length);
                                    } else if (info.offset.x > swipeThreshold) {
                                        onIndexChange((currentIndex - 1 + mediaList.length) % mediaList.length);
                                    }
                                }}
                                className={`max-w-[95vw] max-h-[85vh] object-contain shadow-2xl pointer-events-auto cursor-grab active:cursor-grabbing ${
                                    profileUserId 
                                        ? "aspect-square rounded-full ring-4 ring-white/20" 
                                        : "rounded-xl border border-white/10"
                                }`}
                                onClick={(e) => e.stopPropagation()}
                            />
                        </AnimatePresence>

                        {/* Navigation Arrows */}
                        {mediaList.length > 1 && (
                            <>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onIndexChange?.((currentIndex - 1 + mediaList.length) % mediaList.length);
                                    }}
                                    className="absolute left-4 lg:left-8 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition-all backdrop-blur-md z-20 active:scale-95"
                                >
                                    <ChevronLeftIcon className="w-8 h-8" />
                                </button>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onIndexChange?.((currentIndex + 1) % mediaList.length);
                                    }}
                                    className="absolute right-4 lg:right-8 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition-all backdrop-blur-md z-20 active:scale-95"
                                >
                                    <ChevronRightIcon className="w-8 h-8" />
                                </button>
                            </>
                        )}
                    </div>

                    {/* Action Bar */}
                    {profileUserId && (
                        <motion.div
                            initial={{ y: 20, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            className="flex flex-col items-center gap-3 w-full"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="flex items-center gap-6 bg-white/10 backdrop-blur-xl px-6 py-3 rounded-full border border-white/20 shadow-xl">
                                {/* Like Toggle */}
                                <button
                                    onClick={toggleLike}
                                    className="flex items-center gap-2 group transition-all active:scale-90"
                                >
                                    {liked ? (
                                        <HeartSolidIcon className="w-7 h-7 text-rose-500 drop-shadow-[0_0_8px_rgba(244,63,94,0.5)]" />
                                    ) : (
                                        <HeartIcon className="w-7 h-7 text-white group-hover:text-rose-400" />
                                    )}
                                    <span className="text-white font-bold text-lg">{likeCount}</span>
                                </button>

                                {/* Likers List Trigger (Only for owner or if stats visible) */}
                                {isOwnProfile && (
                                    <button
                                        onClick={fetchLikers}
                                        className="flex items-center gap-2 text-white/80 hover:text-white transition-colors"
                                        title="See who liked"
                                    >
                                        <UserGroupIcon className="w-7 h-7" />
                                        <span className="text-sm font-medium">Likers</span>
                                    </button>
                                )}
                            </div>

                            {isOwnProfile && (
                                <div className="flex flex-col items-center gap-3">
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onUpdateProfile?.();
                                        }}
                                        className="bg-white text-black px-8 py-2.5 rounded-full font-bold text-sm hover:bg-gray-100 active:scale-95 transition-all shadow-xl"
                                    >
                                        Change Profile
                                    </button>
                                    <p className="text-white/20 text-[10px] uppercase tracking-widest font-bold">Your Profile Statistics</p>
                                </div>
                            )}
                        </motion.div>
                    )}
                </div>

                {/* Likers Overlay (Optional: slide up from bottom or center modal) */}
                <AnimatePresence>
                    {showLikers && (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="absolute z-[10002] w-full max-w-sm bg-[#1a1a1a] rounded-3xl border border-white/10 shadow-2xl overflow-hidden"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="p-4 border-b border-white/10 flex items-center justify-between bg-white/5">
                                <h3 className="text-white font-bold">Profile Likers</h3>
                                <button onClick={() => setShowLikers(false)} className="text-white/60 hover:text-white">
                                    <XMarkIcon className="w-5 h-5" />
                                </button>
                            </div>

                            <div className="max-h-80 overflow-y-auto p-2 space-y-1 custom-scrollbar">
                                {loadingLikers ? (
                                    <div className="p-10 flex flex-col items-center gap-3">
                                        <div className="w-6 h-6 border-2 border-rose-500 border-t-transparent rounded-full animate-spin" />
                                        <p className="text-white/40 text-xs">Loading likers...</p>
                                    </div>
                                ) : likers.length === 0 ? (
                                    <div className="p-10 text-center">
                                        <p className="text-white/40 text-sm italic">No likes yet</p>
                                    </div>
                                ) : (
                                    likers.map((liker) => (
                                        <Link
                                            key={liker.user_id}
                                            href={`/user/profile/${liker.user_id}`}
                                            className="flex items-center gap-3 p-3 hover:bg-white/5 rounded-2xl transition-colors group"
                                            onClick={onClose}
                                        >
                                            <img src={liker.profile_pic || "https://via.placeholder.com/40"} className="w-10 h-10 rounded-full object-cover ring-1 ring-white/20" alt="" />
                                            <div className="lex-1 min-w-0">
                                                <p className="text-white font-medium text-sm truncate group-hover:text-rose-400 transition-colors uppercase tracking-tight">{liker.full_name}</p>
                                                <p className="text-white/40 text-[10px]">Liked recently</p>
                                            </div>
                                        </Link>
                                    ))
                                )}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.div>
        </AnimatePresence>
    );
}
