"use client";

import React, { useEffect, useRef, useState, useMemo, useId, memo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Hls from "hls.js";
import { useAudio } from "@/src/context/audioContext";
import { videoPlaybackManager } from "@/src/lib/videoPlaybackManager";
import { Play } from "lucide-react";

type LargeScreenVideoPlayerProps = {
  src?: string | null;
  poster?: string | null;
  className?: string;
  playsInline?: boolean;
  mutedByDefault?: boolean;
  isMuted?: boolean;
  videoClassName?: string;
  onError?: (err?: any) => void;
  autoplay?: boolean;
  loop?: boolean;
  progressBarClassName?: string;
  onTimeUpdateHandler?: (currentTime: number, duration: number) => void;
  onEndedHandler?: () => void;
  onPlayStartHandler?: () => void;
  hideControls?: boolean;
  autoFitPortrait?: boolean;
  isPaused?: boolean;
  volume?: number;
  videoId?: string;
  onMuteChange?: (muted: boolean) => void;
  onRegisterRef?: (el: HTMLVideoElement | null) => void;
  userManualPause?: boolean;
  hideOverlay?: boolean;
  onLongPress?: (e: React.MouseEvent | React.TouchEvent) => void;
  isActive?: boolean;
  fixedRatio?: number | null;
  onLoadedMetadata?: (w: number, h: number) => void;
};

const LargeScreenVideoPlayer = memo(function LargeScreenVideoPlayer({
  src,
  poster,
  className = "w-full h-full",
  playsInline = true,
  mutedByDefault = true,
  isMuted: externalMute,
  videoClassName = "",
  onError,
  autoplay = true,
  loop = true,
  progressBarClassName = "absolute bottom-0 left-0 right-0",
  onTimeUpdateHandler,
  onEndedHandler,
  onPlayStartHandler,
  hideControls = false,
  autoFitPortrait = false,
  isPaused = false,
  volume: externalVolume,
  videoId,
  onMuteChange,
  onRegisterRef,
  userManualPause,
  hideOverlay = false,
  onLongPress,
  isActive: isActiveProp,
  fixedRatio = null,
  onLoadedMetadata,
}: LargeScreenVideoPlayerProps) {
  const {
    isMuted: globalMute,
    volume: globalVolume,
    toggleMute: globalToggleMute,
    hasUserInteracted,
    markInteracted,
  } = useAudio();

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);
  const reactGeneratedId = useId();
  const playerId = videoId || reactGeneratedId;

  const [loading, setLoading] = useState(true);
  const [isBuffering, setIsBuffering] = useState(false);
  const [isNativeReady, setIsNativeReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [current, setCurrent] = useState(0);
  const [bufferProgress, setBufferProgress] = useState(0);
  const [seeking, setSeeking] = useState(false);
  const [aspectRatio, setAspectRatio] = useState<number | null>(null);
  const [internalMuteFallback, setInternalMuteFallback] = useState(false);
  const [isFullyPainted, setIsFullyPainted] = useState(false);
  const [hasTriggeredPlay, setHasTriggeredPlay] = useState(false);
  const [isManagerActive, setIsManagerActive] = useState(false);

  // Unified Activation Logic: Trust the parent prop first for instant-render sync, fallback to manager
  const isActive = isActiveProp !== undefined ? isActiveProp : isManagerActive;

  const onTimeUpdateRef = useRef(onTimeUpdateHandler);
  const onEndedRef = useRef(onEndedHandler);
  const onPlayStartRef = useRef(onPlayStartHandler);

  useEffect(() => { onTimeUpdateRef.current = onTimeUpdateHandler; }, [onTimeUpdateHandler]);
  useEffect(() => { onEndedRef.current = onEndedHandler; }, [onEndedHandler]);
  useEffect(() => { onPlayStartRef.current = onPlayStartHandler; }, [onPlayStartHandler]);

  const finalMuted = (externalMute !== undefined ? externalMute : internalMuteFallback || globalMute) || isPaused;
  const finalVolume = isPaused ? 0 : (externalVolume !== undefined ? externalVolume : globalVolume);

  // 1. Core Registration
  useEffect(() => {
    if (!videoRef.current) return;
    videoPlaybackManager.register(playerId, videoRef.current);
    return () => { videoPlaybackManager.unregister(playerId); };
  }, [playerId]);

  // 2. Manager Subscription & Active State Sync
  useEffect(() => {
    const checkActive = () => {
      const active = videoPlaybackManager.getActiveVideoId() === playerId;
      setIsManagerActive(active);
    };
    checkActive();

    return videoPlaybackManager.subscribe((activeId) => {
      const active = activeId === playerId;
      setIsManagerActive(active);
      if (!active) {
        setIsNativeReady(false);
        setIsFullyPainted(false);
        setHasTriggeredPlay(false);
      }
    });
  }, [playerId]);

  // 3. Audio & Volume Sync
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = finalMuted;
    video.volume = finalVolume;
  }, [finalMuted, finalVolume]);

  // 4. Auto-Unmute after interaction
  useEffect(() => {
    if (hasUserInteracted && internalMuteFallback && !globalMute) {
      setInternalMuteFallback(false);
      if (videoRef.current) videoRef.current.muted = false;
    }
  }, [hasUserInteracted, internalMuteFallback, globalMute]);

  // 5. Playback Control Hub
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !isActive) return;

    videoPlaybackManager.setManualPause(playerId, userManualPause || false);

    if (userManualPause) {
      setHasTriggeredPlay(false);
      video.pause();
    } else {
      // 🚨 Aggressive Desktop Playback Recovery
      // If we are active but paused and not currently waiting for a play session, go for it.
      if (video.paused && !hasTriggeredPlay) {
        setHasTriggeredPlay(true);
        videoPlaybackManager.authorizeAndPlay(playerId, finalMuted, finalVolume)
          .then((forcedMute) => { if (forcedMute) setInternalMuteFallback(true); })
          .catch(() => setHasTriggeredPlay(false));
      }

      // Secondary check: if it's been active for a while but stuck in paused state without manual pause
      const heartbeat = setInterval(() => {
        if (isActive && !userManualPause && video.paused && !loading && !isBuffering) {
          videoPlaybackManager.authorizeAndPlay(playerId, finalMuted, finalVolume)
            .catch(() => { });
        }
      }, 3000);
      return () => clearInterval(heartbeat);
    }
  }, [userManualPause, isActive, playerId, hasTriggeredPlay, loading, isBuffering]);

  // 6. Media Source Setup
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src) return;

    setLoading(true);
    setError(null);
    setIsNativeReady(false);
    setIsFullyPainted(false);

    if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; }

    const isHls = src.toLowerCase().includes(".m3u8");

    if (isHls && Hls.isSupported()) {
      const hls = new Hls({
        capLevelToPlayerSize: true,
        autoStartLoad: true,
        maxBufferLength: 30,
        enableWorker: true,
      });
      hls.loadSource(src);
      hls.attachMedia(video);
      hlsRef.current = hls;
      hls.on(Hls.Events.ERROR, (_, data) => {
        if (data.fatal) {
          if (data.type === Hls.ErrorTypes.NETWORK_ERROR) hls.startLoad();
          else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) hls.recoverMediaError();
          else { setError("Video failed"); hls.destroy(); }
        }
      });
    } else {
      video.src = src;
      video.load();
    }

    const onLoadedMeta = () => {
      setDuration(Math.min(video.duration || 0, 180));
      if (video.videoWidth && video.videoHeight) {
        setAspectRatio(video.videoWidth / video.videoHeight);
        onLoadedMetadata?.(video.videoWidth, video.videoHeight);
      }
    };

    const onTime = () => {
      if (!seeking) {
        setCurrent(video.currentTime);
        onTimeUpdateRef.current?.(video.currentTime, video.duration || 0);
      }
      if (video.buffered.length) {
        setBufferProgress((video.buffered.end(video.buffered.length - 1) / (video.duration || 1)) * 100);
      }
    };

    const onEnded = () => {
      onEndedRef.current?.();
      if (loop) videoPlaybackManager.authorizeAndPlay(playerId, finalMuted, finalVolume);
    };

    const onPlaying = () => {
      setIsNativeReady(true);
      setIsBuffering(false);
      requestAnimationFrame(() => setTimeout(() => setIsFullyPainted(true), 100));
    };

    video.addEventListener("loadedmetadata", onLoadedMeta);
    video.addEventListener("timeupdate", onTime);
    video.addEventListener("ended", onEnded);
    video.addEventListener("playing", onPlaying);
    video.addEventListener("waiting", () => setIsBuffering(true));
    video.addEventListener("canplay", () => { setLoading(false); setIsBuffering(false); });

    return () => {
      video.pause();
      video.removeEventListener("loadedmetadata", onLoadedMeta);
      video.removeEventListener("timeupdate", onTime);
      video.removeEventListener("ended", onEnded);
      video.removeEventListener("playing", onPlaying);
      if (hlsRef.current) hlsRef.current.destroy();
    };
  }, [src, loop, playerId]);

  const appliedVideoClass = videoClassName || (aspectRatio && aspectRatio < 0.8 ? "object-cover" : "object-contain");

  const togglePlay = async () => {
    const v = videoRef.current;
    if (!v) return;
    try {
      if (v.paused || v.ended) {
        await videoPlaybackManager.authorizeAndPlay(playerId, finalMuted, finalVolume);
        markInteracted();
      } else {
        v.pause();
      }
    } catch (err) { onError?.(err); }
  };

  const toggleMuteLocal = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (externalMute !== undefined) onMuteChange?.(!externalMute);
    else { globalToggleMute(); setInternalMuteFallback(false); }
    markInteracted();
  };

  return (
    <div
      className={`relative overflow-hidden group ${className}`}
      style={(fixedRatio || aspectRatio) ? { aspectRatio: String(fixedRatio || aspectRatio) } : {}}
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === " " || e.key === "k") { e.preventDefault(); togglePlay(); } }}
      onClick={togglePlay}
    >
      {/* 1. INITIAL LOADER */}
      {(loading && isActive && !error) && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black">
          <div className="relative">
            <h1 className="text-6xl md:text-7xl font-black tracking-tighter text-white/10 select-none">stoqle</h1>
            <motion.div
              animate={{ x: ["-100%", "100%"] }}
              transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
              className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent skew-x-12"
            />
          </div>
        </div>
      )}

      {/* 2. BUFFERING LOADER */}
      {isBuffering && isNativeReady && isFullyPainted && !seeking && (
        <div className="absolute inset-0 z-[60] flex items-center justify-center pointer-events-none">
          <div className="w-1 h-32 bg-white/5 rounded-full overflow-hidden relative">
            <motion.div animate={{ y: ["-100%", "100%"] }} transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut", repeatType: "reverse" }} className="absolute inset-x-0 h-1/2 bg-rose-500/30" />
          </div>
        </div>
      )}

      <video
        ref={videoRef}
        src={src || undefined}
        poster={poster || undefined}
        playsInline={playsInline}
        muted={true}
        disableRemotePlayback={true}
        preload="auto"
        className={`w-full h-full bg-black transition-opacity duration-300 ${!isActive ? "opacity-0" : "opacity-100"} ${appliedVideoClass}`}
      />

      {userManualPause && !loading && !error && !hideOverlay && (
        <div className="absolute left-1/2 top-1/2 z-[100] -translate-x-1/2 -translate-y-1/2 pointer-events-none transition-transform group-hover:scale-110">
          <Play className="h-12 w-12 text-white/90 stroke-[1.5]" />
        </div>
      )}

      {!hideControls && (
        <div className={`${progressBarClassName} h-[2px] z-[100] pointer-events-none`}>
          <div className="absolute inset-y-0 left-0 bg-white/20 transition-all" style={{ width: `${bufferProgress}%` }} />
          <div className="absolute inset-y-0 left-0 bg-white transition-all" style={{ width: `${(current / Math.max(duration, 0.001)) * 100}%` }} />
        </div>
      )}

      <AnimatePresence>
        {finalMuted && !userManualPause && (
          <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }} className="absolute left-4 bottom-4 z-[100]">
            <button onClick={toggleMuteLocal} className="rounded-full p-2 bg-black/40 border border-white/20 text-white hover:bg-black/60 transition-all active:scale-95">
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M11 5L6 9H2v6h4l5 4V5z" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M23 9l-6 6m0-6l6 6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

export default LargeScreenVideoPlayer;
