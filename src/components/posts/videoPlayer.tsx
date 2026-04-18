"use client";

import React, { useEffect, useRef, useState, useMemo, useId, memo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Hls from "hls.js";
import { useAudio } from "@/src/context/audioContext";
import { videoPlaybackManager } from "@/src/lib/videoPlaybackManager";
import { Play } from "lucide-react";

type VideoPlayerProps = {
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
};

const VideoPlayer = memo(function VideoPlayer({
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
}: VideoPlayerProps) {
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
  const [internalisActive, setInternalIsActive] = useState(false);
  const [isFullyPainted, setIsFullyPainted] = useState(false);
  const [hasTriggeredPlay, setHasTriggeredPlay] = useState(false);
  const [isManagerActive, setIsManagerActive] = useState(false);

  // Unified Activation Logic: Trust the parent prop first for instant-render sync, fallback to manager
  const isActive = isActiveProp !== undefined ? isActiveProp : isManagerActive;

  const onTimeUpdateRef = useRef(onTimeUpdateHandler);
  const onEndedRef = useRef(onEndedHandler);
  const onPlayStartRef = useRef(onPlayStartHandler);

  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);

  const startLongPress = (e: React.MouseEvent | React.TouchEvent) => {
    longPressTimerRef.current = setTimeout(() => {
      onLongPress?.(e);
      if (typeof window !== "undefined" && window.navigator && window.navigator.vibrate) {
        window.navigator.vibrate(50);
      }
      longPressTimerRef.current = null;
    }, 600);
  };

  const endLongPress = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  useEffect(() => {
    onTimeUpdateRef.current = onTimeUpdateHandler;
  }, [onTimeUpdateHandler]);

  useEffect(() => {
    onEndedRef.current = onEndedHandler;
  }, [onEndedHandler]);

  useEffect(() => {
    onPlayStartRef.current = onPlayStartHandler;
  }, [onPlayStartHandler]);

  const finalMuted =
    (externalMute !== undefined ? externalMute : internalMuteFallback || globalMute) || isPaused;

  const finalVolume = isPaused
    ? 0
    : externalVolume !== undefined
      ? externalVolume
      : globalVolume;

  useEffect(() => {
    if (!videoRef.current) return;

    videoPlaybackManager.register(playerId, videoRef.current);

    return () => {
      videoPlaybackManager.unregister(playerId);
    };
  }, [playerId]);

  useEffect(() => {
    const isActuallyActive = videoPlaybackManager.getActiveVideoId() === playerId;
    if (isActuallyActive !== isManagerActive) setIsManagerActive(isActuallyActive);

    const unsubscribe = videoPlaybackManager.subscribe((activeId) => {
      const active = activeId === playerId;
      setIsManagerActive(active);

      if (!active) {
        setIsNativeReady(false);
        setIsFullyPainted(false);
        setHasTriggeredPlay(false);
      } else {
        // If it becomes active and already has data, pre-emptively set ready for instant display
        if (videoRef.current && videoRef.current.readyState >= 2) {
          setIsNativeReady(true);
        }
      }
    });

    return unsubscribe;
  }, [playerId]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    video.muted = finalMuted;
    video.volume = finalVolume;
  }, [finalMuted, finalVolume]);

  useEffect(() => {
    if (hasUserInteracted && internalMuteFallback && !globalMute) {
      setInternalMuteFallback(false);
      if (videoRef.current) {
        videoRef.current.muted = false;
      }
    }
  }, [hasUserInteracted, internalMuteFallback, globalMute]);

  useEffect(() => {
    if (isActive && videoRef.current) {
      onRegisterRef?.(videoRef.current);
    }
  }, [isActive, onRegisterRef]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !isActive) return;

    videoPlaybackManager.setManualPause(playerId, userManualPause || false);

    if (userManualPause) {
      if (hasTriggeredPlay) {
        setHasTriggeredPlay(false);
      }
      video.pause();
    } else {
      // 🚨 AUTOMATIC RECOVERY SYSTEM:
      // If we are active but not playing and not having a successful play session, trigger it.
      if (video.paused && !hasTriggeredPlay) {
        setHasTriggeredPlay(true);

        // Reels (autoFitPortrait) go immediately. No delay.
        if (autoFitPortrait) {
          videoPlaybackManager.authorizeAndPlay(playerId, finalMuted, finalVolume)
            .then((forcedMute) => {
              if (forcedMute) setInternalMuteFallback(true);
            })
            .catch(() => {
              setHasTriggeredPlay(false);
            });
        } else {
          // Post Modal details keep a small delay for layout stability
          const timer = setTimeout(() => {
            if (isActive && !userManualPause && video.paused) {
              videoPlaybackManager.authorizeAndPlay(playerId, finalMuted, finalVolume)
                .then((forcedMute) => {
                  if (forcedMute) setInternalMuteFallback(true);
                })
                .catch(() => setHasTriggeredPlay(false));
            }
          }, 200);
          return () => clearTimeout(timer);
        }
      }
    }
  }, [userManualPause, isActive, playerId, hasTriggeredPlay]);

  const appliedVideoClass = useMemo(() => {
    // ELITE DISCOVERY: Default to object-cover if it's an active reel to prevent sizing 'pop'
    if (autoFitPortrait) {
      if (aspectRatio === null) return `object-cover ${videoClassName}`;
      return aspectRatio < 0.8 ? `object-cover ${videoClassName}` : `object-contain ${videoClassName}`;
    }
    return videoClassName;
  }, [autoFitPortrait, aspectRatio, videoClassName]);

  const updateBuffer = () => {
    const v = videoRef.current;
    if (!v || !v.buffered.length) return;

    try {
      const bufferedEnd = v.buffered.end(v.buffered.length - 1);
      const d = v.duration || 1;
      setBufferProgress((bufferedEnd / d) * 100);
    } catch { }
  };

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src) return;

    setLoading(true);
    setError(null);
    setIsNativeReady(false);
    setIsFullyPainted(false);

    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    const isHls = src.toLowerCase().includes(".m3u8");

    if (isHls && Hls.isSupported()) {
      const hls = new Hls({
        capLevelToPlayerSize: true,
        autoStartLoad: true,
        maxBufferLength: 40, // More aggressive batch-downloading
        maxMaxBufferLength: 60,
        enableWorker: true,
      });

      hls.loadSource(src);
      hls.attachMedia(video);
      hlsRef.current = hls;

      hls.on(Hls.Events.ERROR, (_, data) => {
        if (!data.fatal) return;

        switch (data.type) {
          case Hls.ErrorTypes.NETWORK_ERROR:
            hls.startLoad();
            break;
          case Hls.ErrorTypes.MEDIA_ERROR:
            hls.recoverMediaError();
            break;
          default:
            setError("Video streaming unavailable");
            hls.destroy();
            break;
        }
      });
    } else {
      video.src = src;
      // 🚨 CRITICAL SAFARI FIX: Native HLS (.m3u8) on Safari often requires 
      // an explicit .load() call to trigger the hardware decoder.
      video.load();
    }

    const onLoadedData = () => {
      setLoading(false);
      setDuration(video.duration || 0);
    };

    const onLoadedMeta = () => {
      setDuration(Math.min(video.duration || 0, 180));
      if (video.videoWidth && video.videoHeight) {
        setAspectRatio(video.videoWidth / video.videoHeight);
      }
    };

    const onTime = () => {
      if (!seeking) {
        const d = video.duration || 0;

        if (video.currentTime >= 180 && d > 180) {
          video.currentTime = 0;
          setCurrent(0);
        } else {
          setCurrent(video.currentTime);
          if (onTimeUpdateRef.current && d > 0) {
            onTimeUpdateRef.current(video.currentTime, d);
          }
        }
      }

      updateBuffer();
    };

    const onProgress = () => updateBuffer();

    const onPlay = () => {
      setPlaying(true);
      onPlayStartRef.current?.();
    };

    const onPause = () => setPlaying(false);

    const onErr = () => {
      setLoading(false);
    };

    const onEnded = () => {
      onEndedRef.current?.();

      if (!loop) {
        setPlaying(false);
        return;
      }

      videoPlaybackManager.authorizeAndPlay(playerId, finalMuted, finalVolume).then((forcedMute) => {
        if (forcedMute) setInternalMuteFallback(true);
      });
    };

    const onPlayingEvent = () => {
      setIsNativeReady(true);
      setIsBuffering(false);
      requestAnimationFrame(() => {
        setTimeout(() => {
          setIsFullyPainted(true);
        }, 80);
      });
    };

    const onWaiting = () => setIsBuffering(true);
    const onCanPlay = () => setIsBuffering(false);
    const onSeekingNative = () => { };
    const onSeekedNative = () => setIsBuffering(false);

    video.addEventListener("loadeddata", onLoadedData);
    video.addEventListener("loadedmetadata", onLoadedMeta);
    video.addEventListener("timeupdate", onTime);
    video.addEventListener("progress", onProgress);
    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);
    video.addEventListener("error", onErr);
    video.addEventListener("ended", onEnded);
    video.addEventListener("playing", onPlayingEvent);
    video.addEventListener("waiting", onWaiting);
    video.addEventListener("canplay", onCanPlay);
    video.addEventListener("seeking", onSeekingNative);
    video.addEventListener("seeked", onSeekedNative);

    video.loop = loop;
    video.playsInline = playsInline;
    video.preload = "auto";

    return () => {
      video.pause();

      video.removeEventListener("loadeddata", onLoadedData);
      video.removeEventListener("loadedmetadata", onLoadedMeta);
      video.removeEventListener("timeupdate", onTime);
      video.removeEventListener("progress", onProgress);
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("error", onErr);
      video.removeEventListener("ended", onEnded);
      video.removeEventListener("playing", onPlayingEvent);
      video.removeEventListener("waiting", onWaiting);
      video.removeEventListener("canplay", onCanPlay);
      video.removeEventListener("seeking", onSeekingNative);
      video.removeEventListener("seeked", onSeekedNative);

      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }

    };
  }, [src, loop, playsInline, playerId]); // STRICT CORE DEPENDENCIES: Removing finalMuted/finalVolume/seeking to prevent blink-reloads

  useEffect(() => {
    const wrap = videoRef.current?.parentElement;
    if (!wrap || !src) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry) return;

        // Relax threshold for Safari (0.1 instead of 0.4) 
        if (entry.isIntersecting && entry.intersectionRatio >= 0.1) {
          const video = videoRef.current;
          if (!video) return;

          // ONLY trigger if not already active - the primary effect handles isActive=true
          if (!isActive && video.readyState >= 1) {
            videoPlaybackManager.authorizeAndPlay(playerId, finalMuted, finalVolume).then((forcedMute) => {
              if (forcedMute) setInternalMuteFallback(true);
            });
          }
        }
      },
      { threshold: [0, 0.1, 0.5, 1.0] }
    );

    observer.observe(wrap);
    return () => observer.disconnect();
  }, [playerId, src]); // Only re-run if video/src changes

  useEffect(() => {
    if (!isActive && src) {
      videoPlaybackManager.prepare(playerId);
    }
  }, [isActive, playerId, src]);


  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const unlock = () => {
      setIsNativeReady(true);
    };

    video.addEventListener("canplay", unlock);
    video.addEventListener("playing", unlock);

    return () => {
      video.removeEventListener("canplay", unlock);
      video.removeEventListener("playing", unlock);
    };
  }, []);

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
    } catch (err) {
      setError("Playback blocked");
      onError?.(err);
    }
  };

  const toggleMuteLocal = (e?: React.MouseEvent) => {
    e?.stopPropagation();

    if (externalMute !== undefined) {
      onMuteChange?.(!externalMute);
    } else {
      globalToggleMute();
      setInternalMuteFallback(false);
    }

    markInteracted();
  };

  const onSeekChange = (val: number) => {
    setCurrent(val);
    const v = videoRef.current;
    if (v && Number.isFinite(val)) {
      v.currentTime = val;
    }
  };

  const onSeekStart = () => {
    setSeeking(true);
  };

  const onSeekEnd = (val: number) => {
    const v = videoRef.current;
    if (v && Number.isFinite(val)) {
      v.currentTime = val;
      setCurrent(val);
    }
    setSeeking(false);
  };

  const stopPropagation = (e: React.MouseEvent | React.TouchEvent) => e.stopPropagation();

  return (
    <div
      className={`relative overflow-hidden group ${className}`}
      style={(!autoFitPortrait && (fixedRatio || aspectRatio)) ? { aspectRatio: String(fixedRatio || aspectRatio) } : {}}
      onContextMenu={(e) => { e.preventDefault(); onLongPress?.(e as any); }}
      onMouseDown={(e) => startLongPress(e)}
      onMouseUp={endLongPress}
      onMouseLeave={endLongPress}
      onTouchStart={(e) => startLongPress(e)}
      onTouchEnd={endLongPress}
      onTouchMove={endLongPress}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === " " || e.key === "k") {
          e.preventDefault();
          togglePlay();
        }
      }}
    >
      {/* 1. INITIAL LOADER: Only show on cold boot / first src load */}
      {(loading && isActive && !error) && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center gap-6"
          >
            <div className="relative group/logo">
              <h1 className="text-6xl md:text-7xl font-black tracking-tighter text-white/10 relative select-none">
                stoqle
                {/* High-Fidelity Branding Shimmer */}
                <motion.div
                  initial={{ x: "-100%", opacity: 0 }}
                  animate={{ x: "100%", opacity: 1 }}
                  transition={{
                    repeat: Infinity,
                    duration: 1.8,
                    ease: "linear",
                    repeatDelay: 0.5
                  }}
                  className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.08] to-transparent skew-x-12"
                />
              </h1>
              {/* Atomic Pulse Indicator */}
              <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 w-10 h-[1.5px] bg-white/5 overflow-hidden rounded-full">
                <motion.div
                  initial={{ x: "-100%" }}
                  animate={{ x: "100%" }}
                  transition={{ repeat: Infinity, duration: 1.2, ease: "easeInOut" }}
                  className="w-full h-full bg-rose-500/30 shadow-[0_0_8px_rgba(239,68,68,0.3)]"
                />
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* 2. BUFFERING LOADER: Only show if NOT actively seeking for seamless continuity */}
      {isBuffering && isNativeReady && isFullyPainted && !seeking && (
        <div className="absolute inset-0 z-[60] flex items-center justify-center pointer-events-none">
          <div className="relative w-1 h-32 bg-white/5 rounded-full overflow-hidden">
            <motion.div
              animate={{
                y: ["-100%", "100%"],
              }}
              transition={{
                duration: 1.5,
                repeat: Infinity,
                ease: "easeInOut",
                repeatType: "reverse"
              }}
              className="absolute inset-x-0 h-1/2 bg-gradient-to-b from-transparent via-rose-500/40 to-transparent"
            />
          </div>
        </div>
      )}

      {/* Poster Layer (Only show if NOT active - prevent any glitch between poster/shimmer) */}
      {!isActive && poster && (
        // <img
        //   src={poster}
        //   className={`absolute inset-0 w-full h-full object-cover z-10 transition-opacity duration-700 ${appliedVideoClass} opacity-100`}
        //   alt="Video poster"
        // />
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center gap-6"
          >
            <div className="relative group/logo">
              <h1 className="text-6xl md:text-7xl font-black tracking-tighter text-white/10 relative select-none">
                stoqle
                {/* High-Fidelity Branding Shimmer */}
                <motion.div
                  initial={{ x: "-100%", opacity: 0 }}
                  animate={{ x: "100%", opacity: 1 }}
                  transition={{
                    repeat: Infinity,
                    duration: 1.8,
                    ease: "linear",
                    repeatDelay: 0.5
                  }}
                  className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.08] to-transparent skew-x-12"
                />
              </h1>
              {/* Atomic Pulse Indicator */}
              <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 w-10 h-[1.5px] bg-white/5 overflow-hidden rounded-full">
                <motion.div
                  initial={{ x: "-100%" }}
                  animate={{ x: "100%" }}
                  transition={{ repeat: Infinity, duration: 1.2, ease: "easeInOut" }}
                  className="w-full h-full bg-rose-500/30 shadow-[0_0_8px_rgba(239,68,68,0.3)]"
                />
              </div>
            </div>
          </motion.div>
        </div>
      )}

      <video
        ref={videoRef}
        src={src || undefined}
        poster={poster || undefined} // Keep poster on video element always
        playsInline={playsInline}
        autoPlay={autoplay && isActive}
        muted={true}
        disableRemotePlayback={true}
        preload="auto"
        className={`w-full h-full bg-black transition-opacity duration-300 ${!isActive ? "opacity-0" : "opacity-100"
          } ${appliedVideoClass || (aspectRatio && aspectRatio < 0.8 ? "object-cover" : "object-contain")}`}
      />

      {/* 3. CENTRAL PLAY TRIGGER (Visual Only, Tap passes to parent) */}
      {userManualPause && !loading && !error && !hideOverlay && (
        <div
          className="absolute left-1/2 top-1/2 z-[100] -translate-x-1/2 -translate-y-1/2 pointer-events-none scale-100 group-hover:scale-110 transition-transform shadow-2xl animate-in zoom-in duration-200"
        >
          <Play className="h-12 w-12 text-white/90 stroke-[1.5]" />
        </div>
      )}

      <AnimatePresence>
        {finalMuted && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="hidden md:block absolute left-4 bottom-4 z-[100]"
          >
            <button
              onClick={toggleMuteLocal}
              className="rounded-full p-2 bg-black/40 border border-white/20 text-white shadow-xl hover:bg-black/60 transition-all active:scale-95"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path
                  d="M11 5L6 9H2v6h4l5 4V5z"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path d="M23 9l-6 6m0-6l6 6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {!hideControls && (
        <div className={`${progressBarClassName} h-[2px] z-[100] group/progress pointer-events-none`}>
          <div
            className="absolute inset-y-0 left-0 bg-slate-600 transition-all duration-300"
            style={{ width: `${bufferProgress}%` }}
          />
          <div
            className="absolute inset-y-0 left-0 bg-white transition-all duration-100 ease-linear z-20"
            style={{ width: `${(current / Math.max(duration, 0.001)) * 100}%` }}
          />
        </div>
      )}

      {!hideControls && (
        <div
          className={`${progressBarClassName} h-8 z-50 flex items-end px-0 pointer-events-auto`}
          onMouseDown={stopPropagation}
          onTouchStart={stopPropagation}
          onClick={stopPropagation}
        >
          <input
            type="range"
            min={0}
            max={Math.max(duration || 0, 0.0001)}
            step="0.01"
            value={current}
            onChange={(e) => onSeekChange(Number(e.target.value))}
            onMouseDown={onSeekStart}
            onMouseUp={(e) => onSeekEnd(Number((e.target as HTMLInputElement).value))}
            onTouchStart={onSeekStart}
            onTouchEnd={(e) => onSeekEnd(Number((e.target as HTMLInputElement).value))}
            className="w-full h-2 cursor-pointer opacity-0 hover:opacity-20 transition-opacity bg-transparent accent-slate-100 appearance-none"
            aria-label="Seek"
          />
        </div>
      )}
    </div>
  );
});

export default VideoPlayer;