import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { API_BASE_URL } from "@/src/lib/config";
import { useAudio } from "@/src/context/audioContext";

interface UsePostMediaProps {
  post: any;
  allMedia: any[];
  isMobileReels: boolean;
  reelsList: any[];
  currentReelIndex: number;
  open: boolean;
  isPaused: boolean;
}

export function usePostMedia({
  post,
  allMedia,
  isMobileReels,
  reelsList,
  currentReelIndex,
  open,
  isPaused
}: UsePostMediaProps) {
  const [currentMediaIndex, setCurrentMediaIndex] = useState(() => {
    if (allMedia && allMedia.length > 0 && post.src) {
      const idx = allMedia.findIndex(m => m.url === post.src);
      return idx >= 0 ? idx : 0;
    }
    return 0;
  });
  
  const [firstImageAspectRatio, setFirstImageAspectRatio] = useState<number | null>(null);
  const [swipeDirection, setSwipeDirection] = useState(1);
  const [fullImageUrl, setFullImageUrl] = useState<string | null>(null);
  
  const backgroundAudioRef = useRef<HTMLAudioElement | null>(null);
  const { isMuted: globalMute, volume: globalVolume } = useAudio();

  const backgroundAudioUrl = useMemo(() => {
    const activeItem = (isMobileReels && reelsList[currentReelIndex]) ? reelsList[currentReelIndex] : post;
    const url = activeItem.original_audio_url;
    if (!url) return null;
    if (url.startsWith('http')) return url;
    return url.startsWith('/public') ? `${API_BASE_URL}${url}` : `${API_BASE_URL}/public/${url}`;
  }, [currentReelIndex, reelsList, post, isMobileReels]);

  useEffect(() => {
    if (open && backgroundAudioUrl && backgroundAudioRef.current) {
      const audio = backgroundAudioRef.current;
      audio.volume = globalVolume;
      audio.muted = globalMute;

      if (!isPaused) {
        audio.load();
        audio.play().catch(e => console.warn("[PostModal] Playback blocked:", e));
      } else {
        audio.pause();
      }
    } else if (backgroundAudioRef.current) {
      backgroundAudioRef.current.pause();
    }
  }, [open, backgroundAudioUrl, globalVolume, globalMute, isPaused]);

  // Automatic slideshow for multi-image posts
  useEffect(() => {
    if (open && !isPaused && !post.isVideo && allMedia.length > 1 && !isMobileReels) {
      const interval = setInterval(() => {
        setSwipeDirection(1);
        setCurrentMediaIndex((prev) => (prev + 1) % allMedia.length);
      }, 5000); // 5 seconds
      return () => clearInterval(interval);
    }
  }, [open, isPaused, post.isVideo, allMedia.length, isMobileReels]);

  const isDraggingRef = useRef(false);

  return {
    currentMediaIndex,
    setCurrentMediaIndex,
    firstImageAspectRatio,
    setFirstImageAspectRatio,
    swipeDirection,
    setSwipeDirection,
    fullImageUrl,
    setFullImageUrl,
    backgroundAudioRef,
    backgroundAudioUrl,
    isDraggingRef
  };
}
