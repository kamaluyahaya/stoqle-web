"use client";

import React, { useEffect, useState, useMemo } from "react";
import Lightbox from "yet-another-react-lightbox";
import "yet-another-react-lightbox/styles.css";
import { motion, AnimatePresence } from "framer-motion";
import { XMarkIcon } from "@heroicons/react/24/outline";
import { HeartIcon } from "@heroicons/react/24/outline";
import { HeartIcon as HeartSolidIcon, UserGroupIcon } from "@heroicons/react/24/solid";
import { useAuth } from "@/src/context/authContext";
import { safeFetch } from "@/src/lib/api/handler";
import Link from "next/link";
import { getNextZIndex } from "@/src/lib/utils/z-index";

interface ProfileImageViewerProps {
  open: boolean;
  onClose: () => void;
  images: string[];
  startIndex?: number;
  profileUserId: string | number;
  onUpdateProfile?: () => void;
  onSetAsCover?: (index: number) => void;
}

export default function ProfileImageViewer({
  open,
  onClose,
  images,
  startIndex = 0,
  profileUserId,
  onUpdateProfile,
  onSetAsCover,
}: ProfileImageViewerProps) {
  const { user } = useAuth();
  const [currentIndex, setCurrentIndex] = useState(startIndex);
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [showLikers, setShowLikers] = useState(false);
  const [likers, setLikers] = useState<any[]>([]);
  const [loadingLikers, setLoadingLikers] = useState(false);
  const [viewerZIndex, setViewerZIndex] = useState(900000);

  // Update z-index when opening
  useEffect(() => {
    if (open) {
      setViewerZIndex(getNextZIndex());
    }
  }, [open]);

  const LIGHTBOX_STYLES = useMemo(() => ({
    root: { zIndex: viewerZIndex },
    container: { backgroundColor: "rgba(0,0,0,0.98)" },
  }), [viewerZIndex]);

  const isOwnProfile = user && profileUserId && String(user.user_id || user.id) === String(profileUserId);

  // Sync internal index when external startIndex changes
  useEffect(() => {
    setCurrentIndex(startIndex);
  }, [startIndex]);

  useEffect(() => {
    if (open) document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  useEffect(() => {
    if (open && profileUserId) fetchLikeStats();
  }, [open, profileUserId]);

  const fetchLikeStats = async () => {
    try {
      const token = localStorage.getItem("token");
      const json = await safeFetch<any>(`/api/profile/${profileUserId}/like-stats`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (json?.status === "success") {
        setLiked(json.data.liked);
        setLikeCount(json.data.count);
      }
    } catch { }
  };

  const toggleLike = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user || isOwnProfile) return;
    try {
      const token = localStorage.getItem("token");
      const json = await safeFetch<any>(`/api/profile/${profileUserId}/like`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (json?.status === "success") { setLiked(json.data.liked); setLikeCount(json.data.count); }
    } catch { }
  };

  const fetchLikers = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowLikers(true);
    setLoadingLikers(true);
    try {
      const token = localStorage.getItem("token");
      const json = await safeFetch<any>(`/api/profile/${profileUserId}/likers`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (json?.status === "success") setLikers(json.data.items);
    } catch { } finally { setLoadingLikers(false); }
  };

  const handleUpdateProfile = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onUpdateProfile?.();
  };

  const handleSetAsCover = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onSetAsCover?.(currentIndex);
  };

  if (!open || images.length === 0) return null;

  return (
    <Lightbox
      open={open}
      close={onClose}
      index={currentIndex}
      on={{ view: ({ index }) => setCurrentIndex(index) }}
      slides={images.map(src => ({ src }))}
      portal={{ root: typeof document !== "undefined" ? document.body : undefined }}
      controller={{
        closeOnBackdropClick: false,
        closeOnPullDown: false,
      }}
      styles={LIGHTBOX_STYLES}
      render={{
        buttonPrev: images.length <= 1 ? () => null : undefined,
        buttonNext: images.length <= 1 ? () => null : undefined,
        buttonClose: () => null,
        slide: ({ slide }) => {
          if (slide.type !== "video" && 'src' in slide) {
            return (
              <div className="flex items-center justify-center w-full h-full select-none">
                <img
                  src={slide.src}
                  alt=""
                  className="aspect-square rounded-full object-cover w-full max-w-full md:max-w-[85vh] md:w-auto h-auto shadow-2xl ring-4 ring-white/20 cursor-default"
                  draggable={false}
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
            );
          }
          return undefined;
        },
        controls: () => (
          <>
            {/* Top Close Button */}
            <div 
              className="absolute top-5 right-6 pointer-events-auto"
              style={{ zIndex: viewerZIndex + 10 }}
            >
              <button
                onClick={(e) => { e.preventDefault(); onClose(); }}
                className="w-10 h-10 flex items-center justify-center rounded-full bg-black/60 backdrop-blur-md text-white shadow-xl active:scale-95 transition-transform cursor-pointer"
              >
                <XMarkIcon className="w-5 h-5 stroke-2" />
              </button>
            </div>

            {/* Set as Cover Button (If multiple images) */}
            {isOwnProfile && images.length > 1 && currentIndex !== 0 && (
              <div 
                className="absolute top-5 left-6 pointer-events-auto"
                style={{ zIndex: viewerZIndex + 10 }}
              >
                <button
                  onClick={handleSetAsCover}
                  className="bg-white/10 backdrop-blur-md text-white px-4 py-2 rounded-full font-bold text-xs hover:bg-white/20 active:scale-95 transition-all shadow-xl border border-white/20 cursor-pointer"
                >
                  Set as Cover
                </button>
              </div>
            )}

            {/* Profile Action Bar */}
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="pointer-events-auto absolute bottom-8 inset-x-0 flex flex-col items-center gap-3"
              style={{ zIndex: viewerZIndex + 10 }}
            >
              <div className="flex items-center gap-6 bg-white/10 backdrop-blur-xl px-6 py-3 rounded-full border border-white/20 shadow-xl pointer-events-auto">
                <button
                  onClick={toggleLike}
                  disabled={!!isOwnProfile}
                  className={`flex items-center gap-2 group transition-all cursor-pointer ${isOwnProfile ? "opacity-50 cursor-not-allowed" : "active:scale-90"}`}
                >
                  {liked
                    ? <HeartSolidIcon className="w-7 h-7 text-rose-500 drop-shadow-[0_0_8px_rgba(244,63,94,0.5)]" />
                    : <HeartIcon className="w-7 h-7 text-white group-hover:text-rose-400" />}
                  <span className="text-white font-bold text-lg">{likeCount}</span>
                </button>

                {isOwnProfile && (
                  <button
                    onClick={fetchLikers}
                    className="flex items-center gap-2 text-white/80 hover:text-white transition-colors"
                  >
                    <UserGroupIcon className="w-7 h-7" />
                    <span className="text-sm font-medium">Likers</span>
                  </button>
                )}
              </div>

              {isOwnProfile && (
                <div className="flex flex-col items-center gap-3 pointer-events-auto">
                  <button
                    onClick={handleUpdateProfile}
                    className="bg-white text-black px-8 py-2.5 rounded-full font-bold text-sm hover:bg-gray-100 active:scale-95 transition-all shadow-xl cursor-pointer"
                  >
                    Change Profile
                  </button>
                  <p className="text-white/20 text-[10px] tracking-widest font-bold">Your Profile Statistics</p>
                </div>
              )}
            </motion.div>

            {/* Likers Panel */}
            <AnimatePresence>
              {showLikers && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="pointer-events-auto absolute inset-0 flex items-center justify-center px-4"
                  style={{ zIndex: viewerZIndex + 20 }}
                >
                  <div className="w-full max-w-sm bg-[#1a1a1a] rounded-3xl border border-white/10 shadow-2xl overflow-hidden">
                    <div className="p-4 border-b border-white/10 flex items-center justify-between bg-white/5">
                      <h3 className="text-white font-bold">Profile Likers</h3>
                      <button onClick={(e) => { e.stopPropagation(); setShowLikers(false); }} className="text-white/60 hover:text-white">
                        <XMarkIcon className="w-5 h-5" />
                      </button>
                    </div>
                    <div className="max-h-80 overflow-y-auto p-2 space-y-1">
                      {loadingLikers ? (
                        <div className="p-10 flex flex-col items-center gap-3">
                          <div className="w-6 h-6 border-2 border-rose-500 border-t-transparent rounded-full animate-spin" />
                          <p className="text-white/40 text-xs">Loading likers...</p>
                        </div>
                      ) : likers.length === 0 ? (
                        <div className="p-10 text-center">
                          <p className="text-white/40 text-sm italic">No likes yet</p>
                        </div>
                      ) : likers.map((liker) => (
                        <Link
                          key={liker.user_id}
                          href={liker.username ? `/${liker.username}` : `/user/profile/${liker.user_id}`}
                          className="flex items-center gap-3 p-3 hover:bg-white/5 rounded-2xl transition-colors group"
                        >
                          <img src={liker.profile_pic || "/assets/images/favio.png"} className="w-10 h-10 rounded-full object-cover ring-1 ring-white/20" alt="" />
                          <div className="flex-1 min-w-0">
                            <p className="text-white font-medium text-sm truncate group-hover:text-rose-400 transition-colors">{liker.full_name}</p>
                            <p className="text-white/40 text-[10px]">Liked recently</p>
                          </div>
                        </Link>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )
      }}
    />
  );
}
