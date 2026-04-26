import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { API_BASE_URL } from "@/src/lib/config";
import { safeFetch } from "@/src/lib/api/handler";
import { toast } from "sonner";
import { io } from "socket.io-client";
import { useSocialShare } from "@/src/hooks/useSocialShare";

interface UsePostInteractionsProps {
  post: any;
  activePostId: string | number;
  userToken?: string | null;
  auth: any;
  isMobileReels: boolean;
  currentReelIndex: number;
  reelsList: any[];
  setReelsList: React.Dispatch<React.SetStateAction<any[]>>;
  isPreview?: boolean;
  onToggleLikeProp: (postId: string | number) => void;
  setIsPaused?: React.Dispatch<React.SetStateAction<boolean>>;
}

export function usePostInteractions({
  post,
  activePostId,
  userToken,
  auth,
  isMobileReels,
  currentReelIndex,
  reelsList,
  setReelsList,
  isPreview,
  onToggleLikeProp,
  setIsPaused
}: UsePostInteractionsProps) {
  const [postLiked, setPostLiked] = useState<boolean>(false);
  const [postLikeCount, setPostLikeCount] = useState<number>(0);
  const [isFollowing, setIsFollowing] = useState<boolean>(false);
  const [followLoading, setFollowLoading] = useState<boolean>(false);
  const [showBurst, setShowBurst] = useState(false);
  const [activeHeartPops, setActiveHeartPops] = useState<{ id: string, x: number, y: number, rotate: number, offsetX: number, offsetY: number }[]>([]);
  const [isPostShareModalOpen, setIsPostShareModalOpen] = useState(false);

  const likingLock = useRef(false);
  const lastTapRef = useRef<number>(0);

  const { share: generateShareLink, shareUrl, isSharing: isGeneratingShareLink } = useSocialShare(userToken);

  const getToken = useCallback(() => auth?.token || userToken, [auth?.token, userToken]);

  const isPostOwner = useMemo(() => {
    const activeItem = isMobileReels ? (reelsList[currentReelIndex] || post) : post;
    const authorId = activeItem?.user_id || activeItem?.author_id || activeItem?.user?.id || activeItem?.user_id;
    const myId = auth?.user?.user_id || auth?.user?.id;
    if (!authorId || !myId) return false;
    return String(authorId) === String(myId);
  }, [isMobileReels, reelsList, currentReelIndex, post, auth?.user]);

  // Sync with prop changes or reel changes
  useEffect(() => {
    const activeItem = isMobileReels ? reelsList[currentReelIndex] : post;
    if (!activeItem) return;

    setPostLiked(Boolean(activeItem.liked_by_user ?? activeItem.liked_by_me ?? activeItem.liked ?? false));
    setPostLikeCount(Number(activeItem.likes_count ?? activeItem.total_likes ?? activeItem.likeCount ?? activeItem.likesCount ?? 0));
    setIsFollowing(Boolean(activeItem.is_following ?? false));
  }, [post.id, currentReelIndex, reelsList.length, isMobileReels]);

  const toggleFollowAuthor = useCallback(async () => {
    const activeItem = isMobileReels ? reelsList[currentReelIndex] : post;
    const authorId = activeItem?.user_id || activeItem?.author_id || activeItem?.user?.id;
    if (!authorId || isPostOwner) return;

    const ok = await auth.ensureAccountVerified();
    if (!ok) return;

    setFollowLoading(true);
    try {
      const token = getToken();
      const action = isFollowing ? 'unfollow' : 'follow';
      const res = await safeFetch<any>(`${API_BASE_URL}/api/follow/${authorId}/${action}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res && res.status === "success") {
        const nextFollowing = !isFollowing;
        setIsFollowing(nextFollowing);
        if (isMobileReels) {
          setReelsList(prev => prev.map(item => {
            const itemId = item.user_id || item.author_id || item.user?.id;
            if (itemId && String(itemId) === String(authorId)) {
              return { ...item, is_following: nextFollowing };
            }
            return item;
          }));
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setFollowLoading(false);
    }
  }, [isMobileReels, reelsList, currentReelIndex, post, isPostOwner, auth, getToken, isFollowing, setReelsList]);

  // Socket.io for real-time like updates
  useEffect(() => {
    const socket = io(API_BASE_URL, {
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
    });

    socket.on("post:like", (data) => {
      const socketPostId = String(data.postId);
      const isActivePost = socketPostId === String(activePostId);
      const newCount = Number(data.likes_count ?? data.likesCount ?? data.likeCount ?? 0);
      const currentUserId = auth?.user?.user_id || auth?.user?.id;
      const wasLikedBySocketUser = data.liked_by && String(data.liked_by) === String(currentUserId);
      const wasUnlikedBySocketUser = data.unliked_by && String(data.unliked_by) === String(currentUserId);

      if (isActivePost) {
        setPostLikeCount(newCount);
        if (wasLikedBySocketUser) setPostLiked(true);
        else if (wasUnlikedBySocketUser) setPostLiked(false);
      }

      if (isMobileReels) {
        setReelsList(prev => prev.map(item => {
          const itemId = String(item.social_post_id ?? item.id);
          if (itemId === socketPostId) {
            return {
              ...item,
              likes_count: newCount,
              liked_by_user: wasLikedBySocketUser ? true : (wasUnlikedBySocketUser ? false : item.liked_by_user)
            };
          }
          return item;
        }));
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [activePostId, auth?.user, isMobileReels, setReelsList]);

  const handleToggleLike = useCallback(async (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (isPreview) {
      toast.info("Interactions are not allowed in preview mode");
      return;
    }

    if (likingLock.current) return;

    const ok = await auth.ensureAccountVerified();
    if (!ok) return;

    const activeItem = isMobileReels ? reelsList[currentReelIndex] : post;
    const activeId = activeItem.social_post_id ?? activeItem.id;
    const token = getToken();
    const oldLiked = postLiked;
    const oldLikeCount = postLikeCount;

    if (!oldLiked) {
      setShowBurst(true);
      setTimeout(() => setShowBurst(false), 800);
    }

    likingLock.current = true;
    setPostLiked(!oldLiked);
    setPostLikeCount(prev => oldLiked ? Math.max(0, prev - 1) : prev + 1);

    if (isMobileReels) {
      setReelsList(prev => prev.map((item, idx) =>
        idx === currentReelIndex
          ? { ...item, liked_by_user: !oldLiked, likes_count: oldLiked ? Math.max(0, (item.likes_count ?? 0) - 1) : (item.likes_count ?? 0) + 1 }
          : item
      ));
    }

    try {
      const res = await fetch(`${API_BASE_URL}/api/social/${activeId}/like`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok || json.status !== "success") throw new Error(json.message || "Like failed");

      const { liked, likes_count } = json.data;
      if (activeId === activePostId) {
        setPostLiked(liked);
        setPostLikeCount(Number(likes_count));
      }

      onToggleLikeProp(String(activeId));
    } catch (err: any) {
      setPostLiked(oldLiked);
      setPostLikeCount(oldLikeCount);
      toast.error(err.message || "Failed to sync like");
    } finally {
      setTimeout(() => { likingLock.current = false; }, 300);
    }
  }, [isPreview, isMobileReels, reelsList, currentReelIndex, post, activePostId, auth, getToken, postLiked, postLikeCount, onToggleLikeProp, setReelsList]);

  const handleDoubleTap = useCallback((e: React.MouseEvent | React.TouchEvent, options?: { disableSingleTapPause?: boolean }) => {
    e.stopPropagation();
    const now = Date.now();
    const delay = now - lastTapRef.current;

    if (delay < 300 && delay > 0) {
      // Clear any pending single tap pause/play
      if (lastTapRef.current !== 0) {
        lastTapRef.current = 0;
      }
      
      const clientX = "touches" in (e as any) && (e as any).touches.length > 0 ? (e as any).touches[0].clientX : (e as React.MouseEvent).clientX;
      const clientY = "touches" in (e as any) && (e as any).touches.length > 0 ? (e as any).touches[0].clientY : (e as React.MouseEvent).clientY;

      const newHearts = [0, 1, 2].map(i => ({
        id: `${Date.now()}-${i}`,
        x: clientX,
        y: clientY,
        rotate: (Math.random() - 0.5) * 60,
        offsetX: (Math.random() - 0.5) * 100,
        offsetY: (Math.random() - 0.5) * 100 - 50
      }));

      setActiveHeartPops(prev => [...prev, ...newHearts]);
      setTimeout(() => {
        setActiveHeartPops(prev => prev.filter(h => !newHearts.find(nh => nh.id === h.id)));
      }, 1000);

      if (!postLiked) handleToggleLike();
    } else {
      lastTapRef.current = now;
      // If no second tap within 300ms, toggle pause
      setTimeout(() => {
        if (lastTapRef.current === now) {
          lastTapRef.current = 0;
          if (setIsPaused && !options?.disableSingleTapPause) {
            setIsPaused(prev => !prev);
          }
        }
      }, 300);
    }
  }, [postLiked, handleToggleLike, setIsPaused]);

  const handleShareClick = useCallback(async (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setIsPostShareModalOpen(true);
    const activeItem = isMobileReels ? reelsList[currentReelIndex] : post;
    const postId = activeItem?.id || activePostId;
    if (postId) {
      generateShareLink(postId);
    }
  }, [activePostId, isMobileReels, reelsList, currentReelIndex, post, generateShareLink]);

  return {
    postLiked,
    postLikeCount,
    isPostOwner,
    isFollowing,
    followLoading,
    toggleFollowAuthor,
    showBurst,

    activeHeartPops,
    isPostShareModalOpen,
    setIsPostShareModalOpen,
    handleToggleLike,
    handleDoubleTap,
    handleShareClick,
    generateShareLink,
    shareUrl,
    isGeneratingShareLink
  };
}
