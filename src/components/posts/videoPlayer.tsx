"use client";

import React, { useEffect, useRef, useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Hls from "hls.js";

type VideoPlayerProps = {
  src?: string | null;
  poster?: string | null;
  className?: string; // container classes (tailwind)
  playsInline?: boolean;
  mutedByDefault?: boolean; // what the UI shows as initial mute preference (but we may start muted to allow autoplay)
  isMuted?: boolean; // external control for mute state
  videoClassName?: string; // class for the video element itself
  onError?: (err?: any) => void;
  autoplay?: boolean;
  loop?: boolean;
};

export default function VideoPlayer({
  src,
  poster,
  className = "w-full h-full",
  playsInline = true,
  mutedByDefault = true,
  isMuted,
  videoClassName = "",
  onError,
  autoplay = true,
  loop = true,
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);

  // UI state
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(isMuted ?? mutedByDefault);
  const [duration, setDuration] = useState(0);
  const [current, setCurrent] = useState(0);
  const [bufferProgress, setBufferProgress] = useState(0);
  const [isUserInteracted, setIsUserInteracted] = useState(false);
  const [seeking, setSeeking] = useState(false);
  const [aspectRatio, setAspectRatio] = useState<number | null>(null);

  // External mute control
  useEffect(() => {
    if (isMuted !== undefined) {
        setMuted(isMuted);
        if (videoRef.current) videoRef.current.muted = isMuted;
    }
  }, [isMuted]);

  // Buffer management
  const updateBuffer = () => {
    const v = videoRef.current;
    if (!v || !v.buffered.length) return;
    try {
        const bufferedEnd = v.buffered.end(v.buffered.length - 1);
        const d = v.duration || 1;
        setBufferProgress((bufferedEnd / d) * 100);
    } catch {}
  };

  // Attach core video event listeners and HLS initialization
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src) return;

    // Cleanup Hls if exists
    if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
    }

    const isHls = src.toLowerCase().includes(".m3u8");

    if (isHls && Hls.isSupported()) {
        const hls = new Hls({
            capLevelToPlayerSize: true,
            autoStartLoad: true,
            maxBufferLength: 20, // Buffer 20s ahead for progressive playback
            enableWorker: true
        });
        hls.loadSource(src);
        hls.attachMedia(video);
        hlsRef.current = hls;

        hls.on(Hls.Events.MANIFEST_PARSED, () => {
            if (autoplay) video.play().catch(() => {});
        });

        hls.on(Hls.Events.ERROR, (event, data) => {
            if (data.fatal) {
                switch(data.type) {
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
            }
        });
    } else {
        // Fallback for native browsers (iOS Safari supports HLS naturally, or simple MP4)
        video.src = src;
    }

    const onLoaded = () => {
      setLoading(false);
      setDuration(video.duration || 0);
    };
    const onMetadata = () => {
        setDuration(Math.min(video.duration || 0, 180));
        if (video.videoWidth && video.videoHeight) {
            setAspectRatio(video.videoWidth / video.videoHeight);
        }
    };
    const onTime = () => {
      if (!seeking) {
        const d = video.duration || 0;
        const maxD = 180;
        if (video.currentTime >= maxD && d > maxD) {
          video.currentTime = 0;
          setCurrent(0);
        } else {
          setCurrent(video.currentTime);
        }
      }
      updateBuffer();
    };
    const onProgress = () => updateBuffer();
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onErr = () => {
        console.warn("Video temporary error, retrying...");
        setLoading(false);
        const v = videoRef.current;
        if (!v) return;
        setTimeout(() => {
            try {
                v.load();
                v.play().catch(() => {});
            } catch {}
        }, 1500);
    };

    const onEnded = async () => {
      if (loop) {
        try {
          await video.play();
        } catch {
          setPlaying(false);
        }
      } else {
        setPlaying(false);
      }
    };

    video.addEventListener("loadeddata", onLoaded);
    video.addEventListener("loadedmetadata", onMetadata);
    video.addEventListener("timeupdate", onTime);
    video.addEventListener("progress", onProgress);
    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);
    video.addEventListener("error", onErr);
    video.addEventListener("ended", onEnded);

    video.loop = loop;

    return () => {
      video.removeEventListener("loadeddata", onLoaded);
      video.removeEventListener("loadedmetadata", onMetadata);
      video.removeEventListener("timeupdate", onTime);
      video.removeEventListener("progress", onProgress);
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("error", onErr);
      video.removeEventListener("ended", onEnded);
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src, loop, seeking]);

  // Autoplay attempt: start muted to satisfy autoplay policies, then try to unmute on user interaction
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // If autoplay is requested, try to play; start muted if necessary
    const tryAutoplay = async () => {
      // To maximize chance of autoplay success, start muted (even if user prefers sound)
      // We'll unmute later on first user interaction.
      try {
        const shouldBeMuted = isMuted !== undefined ? isMuted : true;
        video.muted = shouldBeMuted;
        if (isMuted === undefined) setMuted(true);

        if (autoplay) {
          await video.play();
          setPlaying(true);
        } else {
          video.pause();
          setPlaying(false);
        }
      } catch (err) {
        // autoplay blocked — OK, wait for user interaction
        setPlaying(false);
      }
    };

    tryAutoplay();
  }, [src, autoplay, isMuted]);

  // First user interaction handler: unmute and play with sound
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onUserInteract = async () => {
      if (isUserInteracted) return;
      setIsUserInteracted(true);

      // If user prefers unmuted (mutedByDefault === false), unmute; otherwise keep current preference
      try {
        // Unmute only if the user has not chosen muted via the UI
        if (isMuted === undefined) {
            video.muted = false;
            setMuted(false);
        }
        if (autoplay) {
            await video.play();
            setPlaying(true);
        }
      } catch {
        // maybe still blocked, ignore
      }
      // This listener is once only
      window.removeEventListener("click", onUserInteract);
      window.removeEventListener("keydown", onUserInteract);
      window.removeEventListener("touchstart", onUserInteract);
    };

    window.addEventListener("click", onUserInteract, { passive: true });
    window.addEventListener("keydown", onUserInteract, { passive: true });
    window.addEventListener("touchstart", onUserInteract, { passive: true });

    return () => {
      window.removeEventListener("click", onUserInteract);
      window.removeEventListener("keydown", onUserInteract);
      window.removeEventListener("touchstart", onUserInteract);
    };
  }, [isUserInteracted]);

  // Toggle play/pause (used when user taps the video area)
  const togglePlay = async () => {
    const v = videoRef.current;
    if (!v) return;

    try {
      if (v.paused || v.ended) {
        await v.play();
      } else {
        v.pause();
      }
    } catch (err) {
      setError("Playback blocked");
      onError?.(err);
    }
  };

  // Mute toggle (custom speaker)
  const toggleMute = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    const v = videoRef.current;
    if (!v) return;
    const next = !muted;
    v.muted = next;
    setMuted(next);
    // record that user explicitly interacted with mute
    setIsUserInteracted(true);
  };

  // Fullscreen helper
  const requestFullScreen = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    const v = videoRef.current;
    if (!v) return;
    if (v.requestFullscreen) v.requestFullscreen().catch(() => {});
  };

  // Seek handlers for progress bar
  const onSeekChange = (val: number) => {
    setCurrent(val);
  };
  const onSeekStart = () => setSeeking(true);
  const onSeekEnd = (val: number) => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = val;
    setCurrent(val);
    setSeeking(false);
  };

  // prevent click on controls from toggling video playback
  const stopPropagation = (e: React.MouseEvent) => e.stopPropagation();

  return (
    <div
      className={`relative overflow-hidden group ${className}`}
      style={aspectRatio ? { aspectRatio: String(aspectRatio) } : {}}
      onClick={() => {
        // clicking the container toggles play/pause
        togglePlay();
      }}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        // space toggles play
        if (e.key === " " || e.key === "k") {
          e.preventDefault();
          togglePlay();
        }
      }}
    >
      {/* Loading spinner */}
      {loading && !error && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/5">
          <svg className="h-8 w-8 animate-spin" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" className="opacity-30 fill-none" />
            <path d="M21 12a9 9 0 10-9 9v-3a6 6 0 11.001-12.001L21 6v6z" fill="currentColor" />
          </svg>
        </div>
      )}

      {/* Error overlay */}
      {error && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/60 text-white p-4 text-center">
          <div>
            <div className="mb-2 font-semibold">Couldn't load video</div>
            <div className="text-xs opacity-80">{error}</div>
          </div>
        </div>
      )}

      {/* Video element */}
      <video
        ref={videoRef}
        src={src ?? undefined}
        poster={poster ?? undefined}
        playsInline={playsInline}
        muted={muted}
        preload="auto"
        className={`w-full h-full bg-black ${videoClassName || (aspectRatio && aspectRatio < 0.8 ? "object-cover" : "object-contain")}`}
      />

      {/* Big play overlay when paused */}
      {!playing && !loading && !error && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            togglePlay();
          }}
          aria-label="Play video"
          className="absolute left-1/2 top-1/2 z-25 -translate-x-1/2 -translate-y-1/2 rounded-full bg-black/40 p-4 hover:bg-black/50"
        >
          <svg className="h-10 w-10 text-white" viewBox="0 0 24 24" fill="currentColor">
            <path d="M5 3v18l15-9L5 3z" />
          </svg>
        </button>
      )}

      {/* Visual Progress Line (TikTok Style) */}
      <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-white/10 z-[45] group/progress pointer-events-none">
          {/* Buffer Bar */}
          <div 
            className="absolute inset-y-0 left-0 bg-white/30 transition-all duration-300"
            style={{ width: `${bufferProgress}%` }}
          />
          {/* Current Progress bar */}
          <div 
            className="absolute inset-y-0 left-0 bg-red-500 transition-all duration-100 ease-linear shadow-[0_0_8px_rgba(239,68,68,0.6)] z-10" 
            style={{ width: `${(current / Math.max(duration, 0.001)) * 100}%` }} 
          />
      </div>

      <div
        className="absolute left-3 right-3 bottom-4 z-40 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity duration-300"
        onClick={stopPropagation}
      >
        <div className="flex items-center gap-3">
            {/* Mute/unmute Toggle (Visible only when muted or on hover) */}
            <AnimatePresence>
                {muted && (
                    <motion.button
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        onClick={toggleMute}
                        className="rounded-full p-2.5 bg-black/40 backdrop-blur-md border border-white/20 text-white shadow-xl hover:bg-black/60 transition-all active:scale-95"
                        title="Unmute"
                    >
                        <svg className="h-4.5 w-4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <path d="M11 5L6 9H2v6h4l5 4V5z" strokeLinecap="round" strokeLinejoin="round" />
                            <path d="M23 9l-6 6m0-6l6 6" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                    </motion.button>
                )}
            </AnimatePresence>

            {/* Time labels (Miniaturized) */}
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/20 backdrop-blur-md border border-white/10 text-[10px] font-black text-white/90 tabular-nums">
                <span>{formatTime(current)}</span>
                <span className="opacity-40">/</span>
                <span>{formatTime(duration)}</span>
            </div>
        </div>

        {/* Fullscreen icon - only show on hover */}
        <button onClick={requestFullScreen} className="rounded-full p-2 bg-black/20 backdrop-blur-md border border-white/10 text-white shadow-sm hover:bg-black/40 transition-all active:scale-90" title="Fullscreen">
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M7 14H5v5h5v-2H7v-3zM19 10h-2V7h-3V5h5v5zM7 10h3V7h2V5H5v5h2zM19 14v3h-3v2h5v-5h-2z" />
          </svg>
        </button>
      </div>

      {/* Invisible Seek Bar (full width at bottom) */}
      <div className="absolute bottom-0 left-0 right-0 h-6 z-50 flex items-end px-0" onClick={stopPropagation}>
          <input
            type="range"
            min={0}
            max={Math.max(duration || 0, 0.0001)}
            step="0.01"
            value={current}
            onChange={(e) => onSeekChange(Number(e.target.value))}
            onMouseDown={onSeekStart}
            onTouchStart={onSeekStart}
            onMouseUp={(e) => onSeekEnd(Number((e.target as HTMLInputElement).value))}
            onTouchEnd={(e) => onSeekEnd(Number((e.target as HTMLInputElement).value))}
            className="w-full h-1.5 cursor-pointer opacity-0 hover:opacity-10 transition-opacity bg-transparent accent-red-500 appearance-none"
            aria-label="Seek"
          />
      </div>
    </div>
  );
}

// small helper to format seconds
function formatTime(sec: number) {
  if (!sec || !isFinite(sec)) return "0:00";
  const s = Math.floor(sec % 60)
    .toString()
    .padStart(2, "0");
  const m = Math.floor(sec / 60).toString();
  return `${m}:${s}`;
}
