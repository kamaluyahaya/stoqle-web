"use client";

import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import { createSocialPost } from "@/src/lib/api/social";
import { useAuth } from "@/src/context/authContext";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile, toBlobURL } from "@ffmpeg/util";
import CameraModal from "@/src/components/common/CameraModal";
import {
  XMarkIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  LockOpenIcon,
  LockClosedIcon,
  UsersIcon,
  CheckIcon,
  EyeIcon,
  TrashIcon,
  PlusIcon
} from "@heroicons/react/24/outline";
import Lightbox from "yet-another-react-lightbox";
import "yet-another-react-lightbox/styles.css";
import PostModal from "@/src/components/modal/postModal";
import {
  FilmIcon, PlayIcon, TrashIcon as TrashLucide, Heart as HeartLucide,
  Share2 as ShareLucide, Hexagon as HexagonLucide
} from "lucide-react";
import DefaultInput from "@/src/components/input/default-input-post";
import CreateNoteModal from "@/src/components/notes/createNoteModal";

// ----------------------
// VideoProcessingModal (Trimming & Merging)
// ----------------------
function VideoProcessingModal({ progress }: { progress: number }) {
  return (
    <div className="fixed inset-0 z-[100000] bg-slate-900/90 backdrop-blur-xl flex flex-col items-center justify-center p-8 text-center overscroll-none">
      <div className="relative w-32 h-32 mb-8">
        <div className="absolute inset-0 rounded-full border-4 border-slate-800" />
        <motion.div
          className="absolute inset-0 rounded-full border-4 border-t-red-500"
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
        />
        <div className="absolute inset-0 flex items-center justify-center font-bold text-2xl text-white">
          {Math.min(99, Math.round(progress))}%
        </div>
      </div>

      <h2 className="text-2xl font-bold text-white mb-3 tracking-tight">Post Studio</h2>
      <p className="text-slate-400 max-w-sm leading-relaxed text-sm">
        Optimizing and merging your media into a single high-quality reel...
        Please stay on this page.
      </p>

      <div className="mt-10 w-full max-w-xs h-1.5 bg-slate-800 rounded-full overflow-hidden">
        <motion.div
          className="h-full bg-red-500 shadow-[0_0_15px_rgba(239,68,68,0.5)]"
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ type: "spring", damping: 25, stiffness: 50 }}
        />
      </div>
    </div>
  );
}

// ----------------------
// VideoPreviewModal (Phone Interface)
// ----------------------
function VideoPreviewModal({
  images,
  imagePreviews,
  video,
  videoPreview,
  interleavedMedia = [],
  onClose,
  onPosted,
  onSubmitPayload,
  setInterleavedMedia,
  isLoading = false,
  uploadProgress = 0,
}: {
  images: File[];
  imagePreviews: string[];
  video: File;
  videoPreview: string;
  interleavedMedia?: { type: 'image' | 'video', file: File, preview: string }[];
  onClose: () => void;
  onPosted: () => void;
  isLoading?: boolean;
  uploadProgress?: number;
  setInterleavedMedia: React.Dispatch<React.SetStateAction<{ type: 'image' | 'video', file: File, preview: string }[]>>;
  onSubmitPayload: (payload: {
    type: "video" | "mixed";
    video: File;
    images?: File[];
    text?: string;
    subtitle?: string;
    privacy?: "public" | "private" | "friends";
    media_order?: { name: string, type: 'image' | 'video' }[];
  }) => void;
}) {
  const [text, setText] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [privacy, setPrivacy] = useState<"public" | "private" | "friends">("public");
  const [isPrivacyModalOpen, setIsPrivacyModalOpen] = useState(false);
  const [previewPost, setPreviewPost] = useState<any>(null);
  const { user } = useAuth();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(true); // auto-start preview
  const [isMuted, setIsMuted] = useState(true); // start muted for autoPlay compatibility; user can unmute
  const [progress, setProgress] = useState(0);
  const [videoAspectRatio, setVideoAspectRatio] = useState<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  // Flag to suppress onPause from stopping the simulation during internal slide transitions
  const internalTransitionRef = useRef(false);
  // Flag: video needs to play as soon as the element mounts after a loop reset
  const pendingPlayRef = useRef(false);

  const reorderMedia = (idx: number, direction: 'left' | 'right') => {
    const newMedia = [...interleavedMedia];
    const targetIdx = direction === 'left' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= newMedia.length) return;

    [newMedia[idx], newMedia[targetIdx]] = [newMedia[targetIdx], newMedia[idx]];
    setInterleavedMedia(newMedia);
    // Reset simulation
    setSimElapsed(0);
    setCurrentIndex(0);
  };

  const [videoDuration, setVideoDuration] = useState(0);
  const effectiveVideoDuration = videoDuration || 5;

  // Simulation State logic for interleaved
  const [currentIndex, setCurrentIndex] = useState(0);
  const currentItem = interleavedMedia[currentIndex];
  const isVideoSlide = currentItem?.type === 'video';

  // Calculate per-segment start offsets and total duration
  const segmentOffsets = useMemo(() => {
    const offsets: number[] = [];
    let acc = 0;
    for (const item of interleavedMedia) {
      offsets.push(acc);
      acc += item.type === 'video' ? effectiveVideoDuration : 3;
    }
    return offsets;
  }, [interleavedMedia, effectiveVideoDuration]);

  // Calculate total duration from interleaved list
  const totalSimDuration = interleavedMedia.reduce((acc, item) => {
    return acc + (item.type === 'video' ? effectiveVideoDuration : 3);
  }, 0);

  // Unified Progressive State
  const [simElapsed, setSimElapsed] = useState(0);

  // Advance simElapsed past the video slot so image slides can play
  const handleVideoEnded = useCallback(() => {
    // Find the video item's index and compute where its slot ends
    const videoIdx = interleavedMedia.findIndex(m => m.type === 'video');
    if (videoIdx !== -1 && videoIdx < interleavedMedia.length - 1) {
      // Move simElapsed to just after the video slot → next slide plays
      const videoSlotEnd = segmentOffsets[videoIdx] + effectiveVideoDuration;
      setSimElapsed(videoSlotEnd + 0.01);
      setCurrentIndex(videoIdx + 1);
      // Pause the video element silently (don't stop the simulation)
      if (videoRef.current) {
        internalTransitionRef.current = true;
        videoRef.current.pause();
        videoRef.current.currentTime = 0;
      }
    } else {
      // Video is last (or only) item — loop from the start
      setSimElapsed(0);
      setCurrentIndex(0);
      if (videoRef.current) {
        videoRef.current.currentTime = 0;
        if (isPlaying) videoRef.current.play().catch(() => {});
      }
    }
  }, [interleavedMedia, segmentOffsets, effectiveVideoDuration, isPlaying]);

  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      setSimElapsed(prev => {
        let next = prev + 0.05;

        // Full loop completed — seamless restart
        if (next >= totalSimDuration) {
          setCurrentIndex(0);
          if (videoRef.current) {
            // Video element is mounted — restart it directly
            internalTransitionRef.current = true;
            videoRef.current.currentTime = 0;
            videoRef.current.play().catch(() => {});
          } else {
            // Video element is currently unmounted (we were on an image slide).
            // Set a flag so it plays as soon as it mounts.
            pendingPlayRef.current = true;
          }
          return 0;
        }

        // Determine CURRENT item based on elapsed time segments
        let runTotal = 0;
        let foundIndex = interleavedMedia.length - 1; // default to last
        for (let i = 0; i < interleavedMedia.length; i++) {
          const item = interleavedMedia[i];
          const dur = item.type === 'video' ? effectiveVideoDuration : 3;
          if (next < runTotal + dur) {
            foundIndex = i;

            // For video items, sync next with the real video currentTime
            if (item.type === 'video' && videoRef.current) {
              const videoCurrentTime = videoRef.current.currentTime;
              const synced = runTotal + videoCurrentTime;
              // Clamp just under the slot boundary to avoid overshooting into the next segment here
              next = Math.min(synced, runTotal + dur - 0.01);
            }
            break;
          }
          runTotal += dur;
        }

        if (foundIndex !== currentIndex) {
          setCurrentIndex(foundIndex);
          // If we transitioned TO a video slide, ensure it plays
          if (interleavedMedia[foundIndex]?.type === 'video' && videoRef.current) {
            videoRef.current.play().catch(() => {});
          }
          // If we transitioned AWAY from a video slide, pause it silently
          if (interleavedMedia[currentIndex]?.type === 'video' && interleavedMedia[foundIndex]?.type !== 'video' && videoRef.current) {
            internalTransitionRef.current = true;
            videoRef.current.pause();
          }
        }

        return next;
      });
    }, 50);
    return () => clearInterval(interval);
  }, [isPlaying, totalSimDuration, currentIndex, interleavedMedia, effectiveVideoDuration]);

  // Lock body scroll when modal is open
  useEffect(() => {
    document.body.classList.add("overflow-hidden");
    return () => {
      document.body.classList.remove("overflow-hidden");
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    };
  }, []);

  const togglePlay = () => {
    setIsPlaying(!isPlaying);
    if (videoRef.current && isVideoSlide) {
      if (isPlaying) videoRef.current.pause();
      else videoRef.current.play();
    }
  };

  const handleTimeUpdate = () => {
    // This function is now largely handled by the simElapsed useEffect for global progress
    // but can be used for specific video-only progress if needed.
    // For now, we'll let simElapsed drive the global progress bar.
  };

  const submit = async () => {
    onSubmitPayload({
      type: images.length > 0 ? "mixed" : "video",
      video,
      images: images.length > 0 ? images : undefined,
      text: text || undefined,
      subtitle: subtitle || undefined,
      privacy,
      media_order: interleavedMedia.map(m => ({
        name: m.file.name,
        type: m.type
      }))
    });
  };

  return (
    <div className="fixed inset-0 z-[100000] flex items-end sm:items-center justify-center p-0" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        className="relative w-full max-w-lg bg-white h-[100dvh] sm:h-auto sm:max-h-[95vh] rounded-none sm:rounded-2xl shadow-2xl z-10 flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="px-4 py-3 flex items-center justify-between relative border-b border-slate-100">
          <div className="w-10"></div>
          <h2 className="text-sm font-bold text-slate-900 absolute left-1/2 -translate-x-1/2  ">Video Post</h2>
          <div className="w-10 flex justify-end">
            <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-100 transition-colors">
              <XMarkIcon className="w-5 h-5 text-slate-500" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto no-scrollbar space-y-6 p-4">
          {/* Video Preview with Phone Decoration */}
          <div className="flex justify-center py-4 bg-slate-50 rounded-2xl">
            <div className="relative w-[240px] h-[480px] bg-slate-900 rounded-[3rem] border-[8px] border-slate-900 shadow-2xl overflow-hidden group">
              {/* Notch */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-24 h-6 bg-slate-900 rounded-b-2xl z-20" />

              {/* Video Content */}
              <div
                className="w-full h-full cursor-pointer relative"
                onClick={togglePlay}
              >
                <AnimatePresence mode="wait">
                  {!isVideoSlide ? (
                    <motion.img
                      key={`slide-${currentIndex}`}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      src={currentItem?.preview}
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <motion.video
                      key="preview-video"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      ref={videoRef}
                      src={videoPreview}
                      className={`w-full h-full ${videoAspectRatio && videoAspectRatio < 0.8 ? "object-cover" : "object-contain"}`}
                      autoPlay={isPlaying}
                      muted={isMuted}
                      playsInline
                      onPlay={() => setIsPlaying(true)}
                      onPause={(e) => {
                        // Skip if this was an internal programmatic pause (slide transition or loop reset)
                        if (internalTransitionRef.current) {
                          internalTransitionRef.current = false;
                          return;
                        }
                        // Skip if the video just reached its natural end — onEnded will handle advancing.
                        // (Browsers fire onPause before onEnded when video reaches the end.)
                        if (e.currentTarget.ended) {
                          return;
                        }
                        // Genuine user-initiated pause — stop the simulation
                        setIsPlaying(false);
                      }}
                      onCanPlay={(e) => {
                        // If a pending play was requested while the element was unmounted, start now
                        if (pendingPlayRef.current) {
                          pendingPlayRef.current = false;
                          e.currentTarget.play().catch(() => {});
                        }
                      }}
                      onTimeUpdate={handleTimeUpdate}
                      onEnded={handleVideoEnded}
                      onLoadedMetadata={(e) => {
                        const v = e.currentTarget;
                        setVideoAspectRatio(v.videoWidth / v.videoHeight);
                        setVideoDuration(v.duration);
                      }}
                    />
                  )}
                </AnimatePresence>

                {/* Progress Bar (Global) */}
                <div className="absolute bottom-[2px] left-0 w-full h-[1.5px] bg-white/20 z-30">
                  <div
                    className="h-full bg-white transition-all duration-100 ease-linear shadow-[0_0_4px_rgba(255,255,255,0.8)]"
                    style={{
                      width: `${(simElapsed / (totalSimDuration || 1)) * 100}%`
                    }}
                  />
                </div>

                {/* Play Overlay */}
                <AnimatePresence>
                  {!isPlaying && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.5 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.5 }}
                      className="absolute inset-0 flex items-center justify-center bg-black/10"
                    >
                      <div className="w-12 h-12 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center text-white/90">
                        <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                          <path d="M8 5v14l11-7z" />
                        </svg>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Mute / Unmute button — top right of phone screen */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsMuted(prev => {
                      const next = !prev;
                      if (videoRef.current) videoRef.current.muted = next;
                      return next;
                    });
                  }}
                  className="absolute top-8 right-3 z-30 w-7 h-7 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center text-white transition-all active:scale-90"
                  title={isMuted ? "Unmute" : "Mute"}
                >
                  {isMuted ? (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
                      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                      <line x1="23" y1="9" x2="17" y2="15" />
                      <line x1="17" y1="9" x2="23" y2="15" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
                      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                      <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                      <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
                    </svg>
                  )}
                </button>

                {/* Social Overlays */}
                <div className="absolute inset-0 pointer-events-none flex flex-col justify-end p-4 pb-8 bg-gradient-to-t from-black/60 via-transparent to-transparent">
                  {/* Right side icons */}
                  <div className="absolute right-2 bottom-12 flex flex-col items-center gap-4 text-white">
                    <div className="flex flex-col items-center gap-1">
                      <div className="w-8 h-8 rounded-full bg-black/20 backdrop-blur-sm flex items-center justify-center">
                        <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" /></svg>
                      </div>
                      <span className="text-[8px] font-bold">0</span>
                    </div>
                    <div className="flex flex-col items-center gap-1">
                      <div className="w-8 h-8 rounded-full bg-black/20 backdrop-blur-sm flex items-center justify-center">
                        <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10z" /></svg>
                      </div>
                      <span className="text-[8px] font-bold">0</span>
                    </div>
                    <div className="flex flex-col items-center gap-1">
                      <div className="w-8 h-8 rounded-full bg-black/20 backdrop-blur-sm flex items-center justify-center">
                        <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24"><path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92 1.61 0 2.92-1.31 2.92-2.92s-1.31-2.92-2.92-2.92z" /></svg>
                      </div>
                      <span className="text-[8px] font-bold">0</span>
                    </div>
                  </div>

                  {/* Bottom info */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full border border-white overflow-hidden bg-slate-200">
                        {user?.profile_pic ? (
                          <img src={user.profile_pic} className="w-full h-full object-cover" alt="user" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-red-500 text-white font-bold text-[8px]">
                            {user?.full_name?.[0] || 'S'}
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="text-white text-[9px] font-black shadow-sm truncate max-w-[80px]">{user?.business_name || user?.full_name || user?.username || 'user'}</span>
                      </div>
                      <button className="px-2 py-0.5 bg-red-500 rounded-full text-[7px] font-black text-white ml-1">Follow</button>
                    </div>
                    <p className="text-white text-[8px] font-medium line-clamp-2 max-w-[80%] drop-shadow-md">
                      {text || 'Thinking of a catchy title...'}
                    </p>
                  </div>
                </div>

                {/* iOS Style Bottom Bar */}
                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-20 h-1 bg-white/50 rounded-full" />
              </div>
            </div>
          </div>

          {/* Media Sequence Reorder Strip */}
          <div className="space-y-2">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Reel Sequence</h3>
            <div className="flex gap-3 overflow-x-auto pb-2 no-scrollbar px-1">
              {interleavedMedia.map((m, i) => (
                <div key={i} className={`relative flex-shrink-0 group ${currentIndex === i ? 'scale-105' : 'opacity-70'}`}>
                  <div className={`w-14 h-14 rounded-xl overflow-hidden shadow-lg border-2 transition-all ${currentIndex === i ? 'border-red-500' : 'border-slate-100'}`}>
                    {m.type === 'video' ? (
                      <video src={m.preview} className="w-full h-full object-cover" muted playsInline />
                    ) : (
                      <img src={m.preview} className="w-full h-full object-cover" alt={`part-${i}`} />
                    )}
                    {m.type === 'video' && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/20 text-white">
                        <PlayIcon className="w-4 h-4 fill-current" />
                      </div>
                    )}
                    <div className="absolute top-0.5 right-1 px-1 rounded-md bg-black/60 text-[8px] text-white font-bold">{i + 1}</div>
                  </div>

                  {/* Reorder Controls */}
                  <div className="absolute -bottom-1 inset-x-0 flex justify-center gap-1 opacity-100 group-hover:opacity-100 transition-opacity">
                    {i > 0 && (
                      <button
                        onClick={(e) => { e.stopPropagation(); reorderMedia(i, 'left'); }}
                        className="w-4 h-4 rounded-full bg-white shadow-md text-slate-900 flex items-center justify-center border border-slate-100 hover:bg-slate-50 transition-colors"
                      >
                        <ChevronLeftIcon className="w-3 h-3" strokeWidth={3} />
                      </button>
                    )}
                    {i < interleavedMedia.length - 1 && (
                      <button
                        onClick={(e) => { e.stopPropagation(); reorderMedia(i, 'right'); }}
                        className="w-4 h-4 rounded-full bg-white shadow-md text-slate-900 flex items-center justify-center border border-slate-100 hover:bg-slate-50 transition-colors"
                      >
                        <ChevronRightIcon className="w-3 h-3" strokeWidth={3} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-5">
            <DefaultInput
              type="textarea"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Add title"
            />

            <DefaultInput
              value={subtitle}
              onChange={(e) => setSubtitle(e.target.value)}
              placeholder="Add captions (optional)"
            />
          </div>

          <div className="pt-2">
            <button
              onClick={() => setIsPrivacyModalOpen(true)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-50 border border-slate-100 hover:bg-slate-100 transition-colors group"
            >
              {privacy === "public" && <LockOpenIcon className="w-3.5 h-3.5 text-slate-400 group-hover:text-red-500" />}
              {privacy === "private" && <LockClosedIcon className="w-3.5 h-3.5 text-slate-400 group-hover:text-red-500" />}
              {privacy === "friends" && <UsersIcon className="w-3.5 h-3.5 text-slate-400 group-hover:text-red-500" />}
              <span className="text-[10px] font-bold   text-slate-500 group-hover:text-red-600">
                {privacy === "public" ? "Public" : privacy === "private" ? "Private" : "Friends Only"}
              </span>
            </button>
          </div>
        </div>

        {/* Privacy Select Modal (Nested) */}
        <AnimatePresence>
          {isPrivacyModalOpen && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsPrivacyModalOpen(false)}
                className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px] z-[50] rounded-[inherit]"
              />
              <motion.div
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                exit={{ y: "100%" }}
                className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl shadow-2xl z-[60] p-6 space-y-4"
              >
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs font-bold   text-slate-400">Visibility</h3>
                  <button onClick={() => setIsPrivacyModalOpen(false)}>
                    <XMarkIcon className="w-4 h-4 text-slate-400" />
                  </button>
                </div>

                {[
                  { id: "public", label: "Public", icon: LockOpenIcon },
                  { id: "private", label: "Private", icon: LockClosedIcon },
                  { id: "friends", label: "Visible to Friends only", icon: UsersIcon },
                ].map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => {
                      setPrivacy(opt.id as any);
                      setIsPrivacyModalOpen(false);
                    }}
                    className={`w-full flex items-center justify-between p-4 rounded-2xl transition-all ${privacy === opt.id ? "bg-red-50 text-red-600" : "bg-slate-50 text-slate-600 hover:bg-slate-100"
                      }`}
                  >
                    <div className="flex items-center gap-3">
                      <opt.icon className="w-5 h-5" />
                      <span className="text-sm font-bold">{opt.label}</span>
                    </div>
                    {privacy === opt.id && <CheckIcon className="w-4 h-4" />}
                  </button>
                ))}
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* Upload Progress Overlay */}
        <AnimatePresence>
          {isLoading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-[100] bg-white/80 backdrop-blur-md flex flex-col items-center justify-center space-y-4"
            >
              <div className="relative w-24 h-24">
                <svg className="w-full h-full transform -rotate-90">
                  <circle
                    cx="48"
                    cy="48"
                    r="40"
                    stroke="currentColor"
                    strokeWidth="8"
                    fill="transparent"
                    className="text-slate-100"
                  />
                  <circle
                    cx="48"
                    cy="48"
                    r="40"
                    stroke="currentColor"
                    strokeWidth="8"
                    fill="transparent"
                    strokeDasharray={2 * Math.PI * 40}
                    strokeDashoffset={2 * Math.PI * 40 * (1 - uploadProgress / 100)}
                    strokeLinecap="round"
                    className="text-red-500 transition-all duration-300"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center font-bold text-2xl text-slate-900">
                  {uploadProgress}%
                </div>
              </div>
              <p className="text-sm font-bold text-slate-400   animate-pulse">Uploading Video</p>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="p-6 flex gap-3 pb-10 sm:pb-6 mt-auto border-t border-slate-100">
          <button
            onClick={submit}
            disabled={isLoading}
            className="flex-1 py-3 rounded-full bg-red-500 text-white text-sm hover:bg-red-600 active:scale-95 transition-all disabled:opacity-50 disabled:grayscale disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isLoading ? "Publishing..." : "Publish Post"}
          </button>
        </div>

      </motion.div>
    </div>
  );
}

// ----------------------
// ImagePreviewModal
// ----------------------
function ImagePreviewModal({
  imageFiles,
  imagePreviews,
  onClose,
  onSubmitPayload,
  removeImageAt,
  setImages,
  coverIndex,
  setCoverIndex,
  isLoading = false,
  uploadProgress = 0,
  initialStep = 0,
}: {
  imageFiles: File[];
  imagePreviews: string[];
  onClose: () => void;
  onSubmitPayload: (payload: {
    type: "image" | "video" | "mixed";
    images?: File[];
    video?: File;
    text?: string;
    subtitle?: string;
    privacy?: "public" | "private" | "friends";
  }) => void;
  removeImageAt: (index: number) => void;
  setImages: (f: File[]) => void;
  coverIndex: number;
  setCoverIndex: (idx: number) => void;
  isLoading?: boolean;
  uploadProgress?: number;
  initialStep?: number;
}) {
  const [step, setStep] = useState(initialStep);
  const [index, setIndex] = useState(0);
  const [text, setText] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [privacy, setPrivacy] = useState<"public" | "private" | "friends">("public");
  const [isPrivacyModalOpen, setIsPrivacyModalOpen] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [previewPost, setPreviewPost] = useState<any>(null);
  const { user } = useAuth();

  useEffect(() => {
    document.body.classList.add("overflow-hidden");
    return () => {
      document.body.classList.remove("overflow-hidden");
    };
  }, []);

  const isInitialized = useRef(false);

  useEffect(() => {
    if (imageFiles.length > 0) {
      isInitialized.current = true;
    }

    // Only auto-close if we were previously initialized and now have no files
    if (isInitialized.current && imageFiles.length === 0) {
      onClose();
    }

    if (index >= imageFiles.length) setIndex(Math.max(0, imageFiles.length - 1));
  }, [imageFiles.length, index, onClose]);

  const handleAddMore = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const maxAllowed = 5 - imageFiles.length;
    if (maxAllowed <= 0) {
      toast.error("Maximum 5 images allowed");
      return;
    }
    if (files.length > 0) {
      const newlyAdded = files.slice(0, maxAllowed);
      if (files.length > maxAllowed) {
        toast.info(`Only ${maxAllowed} more images were added (max 5)`);
      }
      setImages([...imageFiles, ...newlyAdded]);
    }
    e.target.value = "";
  };

  const submit = () => {
    onSubmitPayload({
      type: "image",
      images: imageFiles,
      text,
      subtitle,
      privacy
    });
  };

  return (
    <div className="fixed inset-0 z-[100000] flex items-end sm:items-center justify-center p-0" role="dialog" aria-modal="true">
      <motion.div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        onClick={onClose}
      />

      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", stiffness: 380, damping: 38, mass: 0.8 }}
        className="relative w-full max-w-lg bg-white h-[100dvh] sm:h-auto sm:max-h-[95vh] rounded-none sm:rounded-2xl shadow-2xl z-10 flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="px-4 py-3 flex items-center justify-between relative border-b border-slate-50">
          <div className="w-10">
            {step === 1 && (
              <button onClick={() => setStep(0)} className="p-2 rounded-full hover:bg-slate-100 transition-colors">
                <ChevronLeftIcon className="w-6 h-6 text-slate-900" />
              </button>
            )}
          </div>

          <h2 className="text-sm font-bold text-slate-900 absolute left-1/2 -translate-x-1/2">
            {step === 0 ? "Post Preview" : "Create Post"}
          </h2>

          <div className="w-10 flex justify-end">
            <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-100 transition-colors">
              <XMarkIcon className="w-5 h-5 text-slate-500" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto space-y-6 scrollbar-hide">
          {step === 0 ? (
            <div className="flex flex-col h-full">
              <div className="flex-1 flex flex-col justify-center min-h-0 bg-slate-50">
                <div className="relative group aspect-square max-w-full mx-auto overflow-hidden">
                  <AnimatePresence mode="wait">
                    <motion.img
                      key={index}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 1.05 }}
                      drag="x"
                      dragConstraints={{ left: 0, right: 0 }}
                      dragElastic={0.2}
                      onDragEnd={(e, info) => {
                        const swipeThreshold = 30;
                        const velocityThreshold = 400;
                        if (info.offset.x < -swipeThreshold || info.velocity.x < -velocityThreshold) {
                          setIndex((i) => Math.min(i + 1, imagePreviews.length - 1));
                        } else if (info.offset.x > swipeThreshold || info.velocity.x > velocityThreshold) {
                          setIndex((i) => Math.max(i - 1, 0));
                        }
                      }}
                      src={imagePreviews[index]}
                      className="w-full h-full object-cover cursor-grab active:cursor-grabbing"
                      alt={`slide-${index}`}
                    />
                  </AnimatePresence>

                  {/* Cover Indicator */}
                  <div className="absolute top-4 left-4 z-40">
                    {coverIndex === index ? (
                      <div className="px-3 py-1.5 bg-slate-900/80 backdrop-blur-md rounded-full text-white text-[10px] font-black shadow-2xl flex items-center gap-2 border border-white/20">
                        <CheckIcon className="w-3.5 h-3.5" strokeWidth={3} />
                        COVER PHOTO
                      </div>
                    ) : (
                      <button
                        onClick={() => {
                          setCoverIndex(index);
                          // Also reorder imageFiles so the selected image becomes first
                          const newFiles = [...imageFiles];
                          const [picked] = newFiles.splice(index, 1);
                          newFiles.unshift(picked);
                          setImages(newFiles);
                          setIndex(0);
                        }}
                        className="px-3 py-1.5 bg-white/90 backdrop-blur-lg rounded-full text-slate-900 text-[10px] font-black shadow-xl flex items-center gap-2 hover:bg-white transition-all active:scale-95 border border-slate-200"
                      >
                        SET AS COVER
                      </button>
                    )}
                  </div>

                  {/* Navigation */}
                  {imagePreviews.length > 1 && (
                    <>
                      <div className="absolute p-4 inset-y-0 left-0 right-0 flex items-center justify-between px-4 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                        <button
                          onClick={() => setIndex((i) => Math.max(0, i - 1))}
                          disabled={index === 0}
                          className="w-8 h-8 rounded-full bg-white/90 shadow-xl backdrop-blur-md flex items-center justify-center disabled:opacity-30 disabled:scale-95 transition-all text-slate-900 pointer-events-auto"
                        >
                          <ChevronLeftIcon className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => setIndex((i) => Math.min(imagePreviews.length - 1, i + 1))}
                          disabled={index === imagePreviews.length - 1}
                          className="w-8 h-8 rounded-full bg-white/90 shadow-xl backdrop-blur-md flex items-center justify-center disabled:opacity-30 disabled:scale-95 transition-all text-slate-900 pointer-events-auto"
                        >
                          <ChevronRightIcon className="w-5 h-5" />
                        </button>
                      </div>
                      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-black/40 backdrop-blur-md text-[10px] font-bold text-white">
                        {index + 1} / {imagePreviews.length}
                      </div>
                    </>
                  )}
                </div>
              </div>

              <div className="space-y-6 mt-auto p-6">
                {/* Thumbnail Strip */}
                <div className="flex gap-2 overflow-x-auto py-2 no-scrollbar">
                  {imagePreviews.map((src, i) => (
                    <div key={i} className="relative flex-shrink-0">
                      <button
                        onClick={() => setIndex(i)}
                        className={`relative w-16 h-16 rounded-xl overflow-hidden transition-all duration-300 ${index === i
                          ? "ring-2 ring-red-500 ring-offset-2 scale-105"
                          : "opacity-40 hover:opacity-70"
                          }`}
                      >
                        <img src={src} className="w-full h-full object-cover" alt={`thumb-${i}`} />
                        {i === 0 && (
                          <div className="absolute top-1 left-1 px-1 rounded-md bg-red-500 text-[6px] text-white font-bold">Cover</div>
                        )}
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removeImageAt(i);
                        }}
                        className="absolute -top-1 -right-1 h-5 w-5 bg-black/40 backdrop-blur-md rounded-full shadow-lg flex items-center justify-center text-white hover:bg-red-500 transition-all ring-1 ring-white/20 z-10"
                      >
                        <XMarkIcon className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                  {imagePreviews.length < 5 && (
                    <button
                      onClick={() => document.getElementById("global-add-more")?.click()}
                      className="relative w-16 h-16 rounded-xl border-2 border-dashed border-slate-200 flex items-center justify-center text-slate-400 hover:text-red-500 hover:border-red-500 transition-all flex-shrink-0"
                    >
                      <PlusIcon className="w-6 h-6" />
                    </button>
                  )}
                </div>

                <button
                  onClick={() => setStep(1)}
                  className="w-full py-3.5 rounded-full bg-red-500 text-white text-sm font-bold hover:bg-red-600 shadow-xl shadow-red-200 active:scale-95 transition-all"
                >
                  Continue
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col h-full p-6 pt-0 space-y-6">
              {/* Images Summary */}
              <div className="flex gap-2 overflow-x-auto py-4 no-scrollbar border-b border-slate-50">
                {imagePreviews.map((src, i) => (
                  <div key={i} className="relative flex-shrink-0">
                    <div
                      onClick={() => {
                        setLightboxIndex(i);
                        setLightboxOpen(true);
                      }}
                      className={`w-14 h-14 rounded-xl overflow-hidden cursor-pointer transition-all ${i === 0 ? "ring-2 ring-red-500 scale-105" : "opacity-80 hover:opacity-100"}`}
                    >
                      <img src={src} className="w-full h-full object-cover" alt={`f-thumb-${i}`} />
                      {i === 0 && (
                        <div className="absolute inset-0 bg-red-500/20 flex items-center justify-center pointer-events-none">
                          <CheckIcon className="w-6 h-6 text-white drop-shadow-lg" />
                        </div>
                      )}
                    </div>
                    {i === 0 && (
                      <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 bg-red-500 text-[6px] text-white font-black px-1 rounded uppercase tracking-tighter">Cover</div>
                    )}
                  </div>
                ))}
                {imagePreviews.length < 5 && (
                  <button
                    onClick={() => document.getElementById("global-add-more")?.click()}
                    className="relative w-14 h-14 rounded-xl border-2 border-dashed border-slate-200 flex items-center justify-center text-slate-400 hover:text-red-500 hover:border-red-500 transition-all flex-shrink-0"
                  >
                    <PlusIcon className="w-5 h-5" />
                  </button>
                )}
              </div>

              <div className="space-y-4">
                <DefaultInput
                  type="textarea"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Add some title..."
                />
                <DefaultInput
                  value={subtitle}
                  onChange={(e) => setSubtitle(e.target.value)}
                  placeholder="Add sub-title (optional)"
                />
              </div>

              <div className="flex items-center justify-between">
                <button
                  onClick={() => setIsPrivacyModalOpen(true)}
                  className="flex items-center gap-2 px-4 py-2 rounded-full bg-slate-50 text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  {privacy === 'public' ? <LockOpenIcon className="w-4 h-4" /> : privacy === 'private' ? <LockClosedIcon className="w-4 h-4" /> : <UsersIcon className="w-4 h-4" />}
                  <span className="text-xs font-bold capitalize">{privacy}</span>
                </button>

                <button
                  onClick={() => setPreviewPost({
                    id: `preview-image-${Date.now()}`,
                    src: imagePreviews[coverIndex],
                    isImage: true,
                    isVideo: false,
                    allMedia: imagePreviews.map((url, i) => ({ url, id: i })),
                    user: {
                      name: user?.full_name || user?.name || "You",
                      avatar: user?.profile_pic || user?.avatar || "",
                      id: user?.user_id || user?.id || 0
                    },
                    caption: text || "",
                    liked: false,
                    likeCount: 0,
                    rawCreatedAt: new Date().toISOString()
                  })}
                  className="p-3 rounded-full bg-slate-50 text-slate-400 hover:bg-slate-100 transition-all"
                >
                  <EyeIcon className="w-5 h-5" />
                </button>
              </div>

              <button
                onClick={submit}
                disabled={isLoading}
                className="w-full py-4 rounded-full bg-red-500 text-white font-bold text-sm shadow-xl shadow-red-200 hover:bg-red-600 disabled:opacity-50 transition-all active:scale-95"
              >
                {isLoading ? "Publishing..." : "Publish Post"}
              </button>
            </div>
          )}
        </div>
      </motion.div>

      <input
        id="global-add-more"
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={handleAddMore}
      />

      <AnimatePresence>
        {isPrivacyModalOpen && (
          <div className="absolute inset-0 z-[100] flex items-end justify-center overflow-hidden rounded-none sm:rounded-2xl">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsPrivacyModalOpen(false)} className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" />
            <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', stiffness: 380, damping: 38 }} className="relative w-full max-w-lg bg-white rounded-t-3xl p-6 space-y-3 shadow-2xl">
              <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Audience</p>
              {['public', 'private', 'friends'].map((p) => (
                <button key={p} onClick={() => { setPrivacy(p as any); setIsPrivacyModalOpen(false); }} className={`w-full p-4 rounded-2xl flex items-center justify-between transition-all ${privacy === p ? 'bg-red-50 text-red-500' : 'bg-slate-50 text-slate-600'}`}>
                  <span className="font-bold capitalize">{p === 'friends' ? 'Friends only' : p}</span>
                  {privacy === p && <CheckIcon className="w-5 h-5" />}
                </button>
              ))}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Overlays / Progress */}
      {isLoading && (
        <div className="absolute inset-0 z-[200] bg-white/60 backdrop-blur-md flex flex-col items-center justify-center">
          <div className="w-20 h-20 bg-red-500 rounded-full flex items-center justify-center text-white font-bold text-xl animate-pulse">
            {uploadProgress}%
          </div>
          <p className="mt-4 text-xs font-bold text-slate-400">Uploading Post</p>
        </div>
      )}

      {previewPost && (
        <PostModal post={previewPost} isPreview onClose={() => setPreviewPost(null)} onToggleLike={() => { }} />
      )}

      <Lightbox
        open={lightboxOpen}
        close={() => setLightboxOpen(false)}
        index={lightboxIndex}
        on={{ view: ({ index }) => setLightboxIndex(index) }}
        slides={imagePreviews.map(src => ({ src }))}
        portal={{ root: typeof document !== "undefined" ? document.body : undefined }}
        styles={{ root: { zIndex: 110000 } }}
        render={{
          controls: () => (
            /* Set as Cover Button (Top Right-ish like ProductMedia) */
            <div className="absolute top-4 right-16 z-[30001] flex items-center gap-2 pointer-events-auto">
              <button
                onClick={() => {
                  if (lightboxIndex === 0) {
                    toast.info("This is already the cover image");
                    return;
                  }
                  const newImages = [...imageFiles];
                  const [img] = newImages.splice(lightboxIndex, 1);
                  newImages.unshift(img);
                  setImages(newImages);
                  setLightboxIndex(0);
                  toast.success("Set ✅");
                }}
                className="px-4 py-2 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-full text-white text-[10px] font-bold transition-all flex items-center gap-2 border border-white/20"
              >
                <CheckIcon className="w-3.5 h-3.5" />
                Set as cover
              </button>
            </div>
          ),
          slideFooter: () => (
            /* Delete Button (Bottom Centered like ProductMedia) */
            <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-[30001] pointer-events-auto">
              <button
                onClick={() => {
                  const nextIndex = lightboxIndex >= imageFiles.length - 1 ? Math.max(0, imageFiles.length - 2) : lightboxIndex;
                  removeImageAt(lightboxIndex);
                  if (imageFiles.length <= 1) {
                    setLightboxOpen(false);
                  } else {
                    setLightboxIndex(nextIndex);
                  }
                }}
                className="px-6 py-3 bg-red-500/10 hover:bg-red-500 transition-all backdrop-blur-md rounded-full text-red-500 hover:text-white text-[10px] font-bold flex items-center gap-3 border border-red-500/30"
              >
                <TrashIcon className="w-4 h-4" />
                Delete Image
              </button>
            </div>
          )
        }}
      />
    </div>
  );
}

// ----------------------
// Main Global Composer
// ----------------------
export default function GlobalPostComposer() {
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const [isVideoModalOpen, setIsVideoModalOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [isNoteOpen, setIsNoteOpen] = useState(false);

  const [imageModalStep, setImageModalStep] = useState(0);
  const [images, setImages] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [coverIndex, setCoverIndex] = useState(0);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoPreview, setVideoPreview] = useState<string | null>(null);
  const [interleavedMedia, setInterleavedMedia] = useState<{ type: 'image' | 'video', file: File, preview: string }[]>([]);

  const ffmpegRef = useRef<any>(null);

  const loadFFmpeg = async () => {
    if (ffmpegRef.current) return ffmpegRef.current;
    const ffmpeg = new FFmpeg();
    const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd';
    await ffmpeg.load({
      coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
      wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
    });
    ffmpegRef.current = ffmpeg;
    return ffmpeg;
  };
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  // image previews logic
  useEffect(() => {
    const urls = images.map((f) => URL.createObjectURL(f));
    setImagePreviews(urls);
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, [images]);

  // Listen for global events
  useEffect(() => {
    const triggerCamera = () => {
      setIsCameraOpen(true);
    };
    const triggerAlbum = () => {
      fileInputRef.current?.click();
    };

    const triggerNote = () => {
      setIsNoteOpen(true);
    };

    window.addEventListener("triggerCamera", triggerCamera);
    window.addEventListener("triggerAlbum", triggerAlbum);
    window.addEventListener("triggerNote", triggerNote);
    return () => {
      window.removeEventListener("triggerCamera", triggerCamera);
      window.removeEventListener("triggerAlbum", triggerAlbum);
      window.removeEventListener("triggerNote", triggerNote);
    };
  }, []);

  // Sync state with URL indicators
  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    let changed = false;

    if (isCameraOpen) {
      if (params.get("camera") !== "true") {
        params.set("camera", "true");
        changed = true;
      }
    } else {
      if (params.has("camera")) {
        params.delete("camera");
        changed = true;
      }
    }

    if (changed) {
      const query = params.toString();
      router.replace(`${pathname}${query ? `?${query}` : ""}`, { scroll: false });
    }
  }, [isCameraOpen, pathname, router, searchParams]);

  const handleCapture = (file: File) => {
    setImages([file]); // Single snap starting point
    setVideoFile(null); // Clear video mode
    setIsCameraOpen(false);
    setImageModalStep(0);
    setIsImageModalOpen(true);
  };

  const processMixedMedia = async (incomingFiles: File[]) => {
    // Determine order
    const videoOnly = incomingFiles.filter(f => f.type.startsWith("video/"));
    const imagesOnly = incomingFiles.filter(f => f.type.startsWith("image/"));

    // If more than one video was picked, only use the first; gently inform the user
    if (videoOnly.length > 1) {
      toast.info("Only 1 video allowed per post — using the first video selected.");
    }

    // Preserve order while respecting limits
    let hasVideo = false;
    let imagesCount = 0;
    const orderedMedia: { type: 'image' | 'video', file: File, preview: string }[] = [];

    incomingFiles.forEach(file => {
      if (file.type.startsWith('video/')) {
        if (!hasVideo) {
          hasVideo = true;
          orderedMedia.push({ type: 'video', file, preview: URL.createObjectURL(file) });
        }
      } else if (file.type.startsWith('image/')) {
        if (hasVideo && imagesCount < 4) {
          imagesCount++;
          orderedMedia.push({ type: 'image', file, preview: URL.createObjectURL(file) });
        } else if (!hasVideo && imagesCount < 5) {
          imagesCount++;
          orderedMedia.push({ type: 'image', file, preview: URL.createObjectURL(file) });
        }
      }
    });

    const finalVideo = orderedMedia.find(m => m.type === 'video');
    const finalImages = orderedMedia.filter(m => m.type === 'image');

    if (!finalVideo) {
      setImages(finalImages.map(m => m.file));
      setVideoFile(null);
      setVideoPreview(null);
      setInterleavedMedia(orderedMedia);
      setIsImageModalOpen(true);
      return;
    }

    // Set states for VideoPreviewModal
    setIsImageModalOpen(false); // Ensure image modal is closed
    setImages(finalImages.map(m => m.file));
    setVideoFile(finalVideo.file);
    setVideoPreview(finalVideo.preview);
    setInterleavedMedia(orderedMedia);
    setIsVideoModalOpen(true);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    processMixedMedia(files);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const auth = useAuth();
  const getToken = () => auth.token || localStorage.getItem("token") || "";

  const handleSubmit = async (payload: {
    type: "image" | "video" | "mixed";
    images?: File[];
    video?: File;
    text?: string;
    subtitle?: string;
    privacy?: "public" | "private" | "friends";
    media_order?: { name: string, type: 'image' | 'video' }[];
  }) => {
    setIsLoading(true);
    setProgress(0);
    try {
      const activeToken = getToken();
      if (!activeToken) {
        toast.error("You must be logged in to post");
        auth.openLogin();
        return;
      }

      const formData = new FormData();
      formData.append("text", payload.text || "");
      formData.append("subtitle", payload.subtitle || "");
      formData.append("privacy", payload.privacy || "public");

      if (payload.media_order) {
        formData.append("media_order", JSON.stringify(payload.media_order));
      }

      // Handle Content
      console.log(`[Submit] Type: ${payload.type}, Images: ${payload.images?.length || 0}, Video: ${!!payload.video}`);
      if (payload.type === "image" && payload.images) {
        payload.images.forEach((img: File) => formData.append("images", img));
      } else if (payload.type === "video" && payload.video) {
        formData.append("video", payload.video);
      } else if (payload.type === "mixed") {
        if (payload.video) formData.append("video", payload.video);
        if (payload.images) {
          payload.images.forEach((img: File) => formData.append("images", img));
        }
      }

      // Generate Thumbnail for Pure Video posts locally
      const targetVideo = payload.video;
      if (targetVideo && payload.type === "video") {
        const video = document.createElement("video");
        const vUrl = URL.createObjectURL(targetVideo);
        video.src = vUrl;
        video.crossOrigin = "anonymous";
        await new Promise((resolve) => {
          video.onloadeddata = resolve;
          video.currentTime = 1; // Seek to 1s
        });
        const canvas = document.createElement("canvas");
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(video, 0, 0);
          const thumbBlob = await new Promise<Blob | null>(r => canvas.toBlob(r, 'image/jpeg', 0.8));
          if (thumbBlob) formData.append("images", thumbBlob, "thumbnail.jpg");
        }
        URL.revokeObjectURL(vUrl);
      }

      // Show processing modal during upload for video content
      if (payload.type === "video" || payload.type === "mixed") {
        setIsProcessing(true);
        setIsVideoModalOpen(false); // Close preview, show processing
      }

      await createSocialPost(formData, activeToken, (p: number) => {
        setProcessingProgress(p);
      });

      // Cleanup & Close
      setIsProcessing(false);
      setIsVideoModalOpen(false);
      setIsImageModalOpen(false);
      setIsNoteOpen(false);
      setImages([]);
      setVideoFile(null);
      if (videoPreview) URL.revokeObjectURL(videoPreview);
      setVideoPreview(null);

      toast.success("Post created successfully!");
      window.dispatchEvent(new CustomEvent("post-created"));
    } catch (err: any) {
      toast.error(err.message || "Failed to publish post");
      setIsProcessing(false);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={(isCameraOpen || isImageModalOpen || isNoteOpen || isProcessing || isVideoModalOpen) ? "pointer-events-auto" : "pointer-events-none"}>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/*"
        multiple
        className="hidden"
        onChange={handleFileSelect}
      />

      {isCameraOpen && (
        <CameraModal
          onCapture={handleCapture}
          onClose={() => setIsCameraOpen(false)}
        />
      )}

      {isProcessing && <VideoProcessingModal progress={processingProgress} />}

      <AnimatePresence>
        {isVideoModalOpen && videoFile && videoPreview && (
          <VideoPreviewModal
            images={images}
            imagePreviews={imagePreviews}
            video={videoFile}
            videoPreview={videoPreview}
            interleavedMedia={interleavedMedia}
            setInterleavedMedia={setInterleavedMedia}
            onClose={() => {
              setIsVideoModalOpen(false);
              setImages([]);
              setVideoFile(null);
              if (videoPreview) URL.revokeObjectURL(videoPreview);
              setVideoPreview(null);
            }}
            onPosted={() => setIsVideoModalOpen(false)}
            onSubmitPayload={handleSubmit}
            isLoading={isLoading}
            uploadProgress={progress}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isImageModalOpen && (
          <ImagePreviewModal
            imageFiles={images}
            imagePreviews={imagePreviews}
            initialStep={imageModalStep}
            onClose={() => setIsImageModalOpen(false)}
            onSubmitPayload={handleSubmit}
            setImages={setImages}
            coverIndex={coverIndex}
            setCoverIndex={setCoverIndex}
            removeImageAt={(idx) => setImages(prev => prev.filter((_, i) => i !== idx))}
            isLoading={isLoading}
            uploadProgress={progress}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isNoteOpen && (
          <CreateNoteModal
            open={isNoteOpen}
            onClose={() => setIsNoteOpen(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
