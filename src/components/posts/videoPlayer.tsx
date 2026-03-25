"use client";

import React, { useEffect, useRef, useState } from "react";

type VideoPlayerProps = {
  src?: string | null;
  poster?: string | null;
  className?: string; // container classes (tailwind)
  playsInline?: boolean;
  mutedByDefault?: boolean; // what the UI shows as initial mute preference (but we may start muted to allow autoplay)
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
  onError,
  autoplay = true,
  loop = true,
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // UI state
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(mutedByDefault);
  const [duration, setDuration] = useState(0);
  const [current, setCurrent] = useState(0);
  const [isUserInteracted, setIsUserInteracted] = useState(false);
  const [seeking, setSeeking] = useState(false);

  // Attach core video event listeners
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onLoaded = () => {
      setLoading(false);
      setDuration(video.duration || 0);
    };
    const onMetadata = () => setDuration(Math.min(video.duration || 0, 180));
    const onTime = () => {
      if (!seeking) {
        const maxD = 180;
        if (video.currentTime >= maxD) {
          video.currentTime = 0;
          setCurrent(0);
        } else {
          setCurrent(video.currentTime);
        }
      }
    };
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onErr = () => {
  console.warn("Video temporary error, retrying...");
  setLoading(false);

  const video = videoRef.current;
  if (!video) return;

  // soft retry after a short delay
  setTimeout(() => {
    try {
      video.load();
      video.play().catch(() => {});
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
    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);
    video.addEventListener("error", onErr);
    video.addEventListener("ended", onEnded);

    video.loop = loop;

    return () => {
      video.removeEventListener("loadeddata", onLoaded);
      video.removeEventListener("loadedmetadata", onMetadata);
      video.removeEventListener("timeupdate", onTime);
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("error", onErr);
      video.removeEventListener("ended", onEnded);
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
        video.muted = true;
        setMuted(true);
        if (autoplay) {
          await video.play();
          setPlaying(true);
        }
      } catch (err) {
        // autoplay blocked — OK, wait for user interaction
        setPlaying(false);
      }
    };

    tryAutoplay();
  }, [src, autoplay]);

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
        video.muted = false;
        setMuted(false);
        await video.play();
        setPlaying(true);
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
      className={`relative overflow-hidden ${className}`}
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
        preload="metadata"
        className="w-full h-full object-contain bg-black"
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

      <div
        className="absolute left-3 right-3 bottom-1 z-40 flex items-center gap-3 bg-black/20 rounded-xl p-2 "
        onClick={stopPropagation}
      >
        {/* Progress bar */}
        <div className="flex-1 px-2">
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
            className="w-full h-2 "
            aria-label="Seek"
          />
          <div className="text-xs text-white/80 mt-1 flex justify-between">
            <span>{formatTime(current)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        {/* Mute/unmute */}
        <button
          onClick={toggleMute}
          className="rounded-full p-2 bg-white/90 shadow-sm"
          title={muted ? "Unmute" : "Mute"}
        >
          {muted ? (
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M5 9v6h4l5 5V4L9 9H5z" />
            </svg>
            
          ) : (
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M5 9v6h4l5 5V4L9 9H5z" />
              <path d="M16.5 12a4.5 4.5 0 00-1-2.9l1.4-1.4A6.5 6.5 0 0118.5 12c0 1.8-.8 3.4-2 4.5l-1.4-1.4c.7-.7 1.4-1.7 1.4-2.9z" />
            </svg>
          )}
        </button>

        {/* Fullscreen */}
        <button onClick={requestFullScreen} className="rounded-full p-2 bg-white/90 shadow-sm" title="Fullscreen">
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
            <path d="M7 14H5v5h5v-2H7v-3zM19 10h-2V7h-3V5h5v5zM7 10h3V7h2V5H5v5h2zM19 14v3h-3v2h5v-5h-2z" stroke="currentColor" />
          </svg>
        </button>
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
