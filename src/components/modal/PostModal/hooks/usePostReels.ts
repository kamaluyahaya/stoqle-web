import { useState, useRef, useCallback, useEffect } from "react";
import { API_BASE_URL } from "@/src/lib/config";
import { fetchSmartReels } from "@/src/lib/api/social";
import { safeFetch } from "@/src/lib/api/handler";

interface UsePostReelsProps {
  post: any;
  isMobileReels: boolean;
  userToken?: string | null;
  targetUserId?: string | number | null;
  onActivePostChange?: (post: any) => void;
}

export function usePostReels({
  post,
  isMobileReels,
  userToken,
  targetUserId,
  onActivePostChange
}: UsePostReelsProps) {
  const normalizedInitialPost = {
    ...post,
    social_post_id: post.social_post_id || post.id || post.apiId,
    liked_by_me: post.liked_by_me ?? post.liked_by_user ?? post.liked ?? false,
    likes_count: post.likes_count ?? post.likesCount ?? post.likeCount ?? 0,
    total_comments: post.total_comments ?? post.comments_count ?? post.commentCount ?? 0
  };

  const [reelsList, setReelsList] = useState<any[]>([normalizedInitialPost]);
  const [currentReelIndex, setCurrentReelIndex] = useState(0);
  const [showSwipeGuide, setShowSwipeGuide] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  
  const interactionTrackerRef = useRef<Record<string, { watch_time: number, max_progress: number, completed: boolean, skipped: boolean, start_time: number, replays: number }>>({});
  const heartbeatRef = useRef<NodeJS.Timeout | null>(null);
  const fastScrollVelocityRef = useRef<boolean>(false);
  const bgReservoirRef = useRef<any[]>([]);
  const isFetchingReservoirRef = useRef(false);
  const activeCursorRef = useRef<string | null>(null);
  const prevPostIdRef = useRef<string | number | null>(null);
  const userManualPauseRef = useRef<boolean>(false);

  const activePostId = reelsList[currentReelIndex]?.social_post_id ?? reelsList[currentReelIndex]?.id ?? post.social_post_id ?? post.id;
  const pendingTransitionRef = useRef<{ showing: boolean; timer: ReturnType<typeof setTimeout> | null }>({ showing: false, timer: null });

  // Swipe guide logic
  useEffect(() => {
    if (isMobileReels && currentReelIndex === 0) {
      const seen = localStorage.getItem("stoqle_post_swipe_guide_v1");
      if (!seen) {
        const timer = setTimeout(() => setShowSwipeGuide(true), 2000);
        return () => clearTimeout(timer);
      }
    } else if (currentReelIndex > 0 && showSwipeGuide) {
      setShowSwipeGuide(false);
      localStorage.setItem("stoqle_post_swipe_guide_v1", "true");
    }
  }, [isMobileReels, currentReelIndex, showSwipeGuide]);

  const dismissSwipeGuide = useCallback(() => {
    setShowSwipeGuide(false);
    localStorage.setItem("stoqle_post_swipe_guide_v1", "true");
  }, []);

  // Sync initial post
  useEffect(() => {
    setReelsList(prev => {
      if (prev.length === 0) return [normalizedInitialPost];
      const next = [...prev];
      next[0] = { ...next[0], ...normalizedInitialPost };
      return next;
    });
  }, [normalizedInitialPost.social_post_id]);

  // Watch time and activity logging
  useEffect(() => {
    if (!isMobileReels) return;

    const activeData = reelsList[currentReelIndex];
    if (!activeData) return;

    const trackedPostId = Number(activeData.id || activeData.social_post_id);
    let sessionWatchTime = 0;

    heartbeatRef.current = setInterval(() => {
      sessionWatchTime += 3;
      import("@/src/lib/api/social").then(({ logSocialActivity }) => {
        const data = interactionTrackerRef.current[String(trackedPostId)];
        logSocialActivity({
          social_post_id: trackedPostId,
          action_type: "view",
          watch_time: 3,
          watch_progress: data?.max_progress || 0,
          completed: !!data?.completed,
          skipped: false,
          scroll_velocity_flag: fastScrollVelocityRef.current
        }, userToken || undefined).catch(() => { });
      });
    }, 3000);

    return () => {
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
      const data = interactionTrackerRef.current[String(trackedPostId)];
      if (data) {
        import("@/src/lib/api/social").then(({ logSocialActivity }) => {
          logSocialActivity({
            social_post_id: trackedPostId,
            action_type: "view",
            watch_time: 1,
            watch_progress: data.max_progress,
            completed: data.completed,
            skipped: data.max_progress < 10,
            scroll_velocity_flag: fastScrollVelocityRef.current
          }, userToken || undefined).catch(() => { });
        });
      }
    };
  }, [activePostId, isMobileReels, currentReelIndex, userToken]);

  // Handle active post change
  useEffect(() => {
    if (!isMobileReels) return;
    
    // Auto-unpause when switching reels
    setIsPaused(false);
    
    const currentPost = reelsList[currentReelIndex];
    if (currentPost && onActivePostChange) {
      onActivePostChange(currentPost);
    }
  }, [currentReelIndex, isMobileReels, reelsList, onActivePostChange]);

  // Reservoir maintenance (Infinite Scroll)
  useEffect(() => {
    if (!isMobileReels) return;

    const maintainReservoir = async () => {
      if (isFetchingReservoirRef.current) return;
      
      const remainingTotal = bgReservoirRef.current.length + (reelsList.length - 1 - currentReelIndex);
      if (remainingTotal < 15) {
        isFetchingReservoirRef.current = true;
        try {
          const bufferIds = [...reelsList.map(r => r.id), ...bgReservoirRef.current.map(r => r.id)];
          const res = await fetchSmartReels({
            limit: 20,
            buffer_ids: bufferIds,
            targetUserId: targetUserId || undefined,
            cursor: activeCursorRef.current,
            token: userToken || undefined
          });

          if (res && res.posts) {
            bgReservoirRef.current = [...bgReservoirRef.current, ...res.posts];
            activeCursorRef.current = res.nextCursor || null;
          }
        } catch (e) {
          console.error("Reservoir fetch failed", e);
        } finally {
          isFetchingReservoirRef.current = false;
        }
      }

      // Pointer Swap: Move from reservoir to active list
      if (reelsList.length - 1 - currentReelIndex < 5 && bgReservoirRef.current.length > 0) {
        const toAdd = bgReservoirRef.current.slice(0, 10);
        bgReservoirRef.current = bgReservoirRef.current.slice(10);
        setReelsList(prev => [...prev, ...toAdd]);
      }
    };

    const interval = setInterval(maintainReservoir, 5000);
    const triggerHandler = () => maintainReservoir();
    window.addEventListener("trigger-reel-prefetch", triggerHandler);

    return () => {
      clearInterval(interval);
      window.removeEventListener("trigger-reel-prefetch", triggerHandler);
    };
  }, [isMobileReels, currentReelIndex, reelsList, targetUserId, userToken]);

  // Eagerly kick off the first reservoir fetch on mount — this makes the first swipe instant
  useEffect(() => {
    if (!isMobileReels) return;
    const timer = setTimeout(() => {
      window.dispatchEvent(new CustomEvent("trigger-reel-prefetch"));
    }, 300);
    return () => clearTimeout(timer);
  }, [isMobileReels]);

  const handleVideoEnded = useCallback((postId: string | number) => {
    const data = interactionTrackerRef.current[String(postId)];
    if (data) {
      data.completed = true;
      data.replays = (data.replays || 0) + 1;
    }
  }, []);

  const handleTimeUpdate = useCallback((postId: string | number, currentTime: number, duration: number) => {
    const data = interactionTrackerRef.current[String(postId)];
    if (data) {
      if (duration > 0) {
        const pct = (currentTime / duration) * 100;
        if (pct > data.max_progress) data.max_progress = pct;
        if (pct > 95) data.completed = true;

        if (pct > 70) {
          window.dispatchEvent(new CustomEvent("trigger-reel-prefetch"));
        }
      }
    }
  }, []);

  const lastScrollTimeRef = useRef(0);

  return {
    reelsList,
    setReelsList,
    currentReelIndex,
    setCurrentReelIndex,
    activePostId,
    showSwipeGuide,
    dismissSwipeGuide,
    isPaused,
    setIsPaused,
    handleVideoEnded,
    handleTimeUpdate,
    fastScrollVelocityRef,
    interactionTrackerRef,
    lastScrollTimeRef,
    userManualPauseRef,
    pendingTransitionRef
  };
}
