import { useState, useRef, useCallback, useEffect } from "react";
import { API_BASE_URL } from "@/src/lib/config";
import { safeFetch } from "@/src/lib/api/handler";
import { toast } from "sonner";
import { getCachedLocationName, getCurrentLocationName } from "@/src/lib/location";
import { APIComment } from "@/src/lib/types";

interface UsePostCommentsProps {
  postId: string | number;
  userToken?: string | null;
  auth: any;
  isPostOwner: boolean;
  isMobileReels: boolean;
  currentReelIndex: number;
  setReelsList: React.Dispatch<React.SetStateAction<any[]>>;
  isPreview?: boolean;
}

export function usePostComments({
  postId,
  userToken,
  auth,
  isPostOwner,
  isMobileReels,
  currentReelIndex,
  setReelsList,
  isPreview
}: UsePostCommentsProps) {
  const [comments, setComments] = useState<APIComment[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [commentsError, setCommentsError] = useState<string | null>(null);
  const [commentText, setCommentText] = useState("");
  const commentTextRef = useRef("");
  const [commentPosting, setCommentPosting] = useState(false);
  const [replyingTo, setReplyingTo] = useState<APIComment | null>(null);
  const [commentsOffset, setCommentsOffset] = useState(0);
  const [hasMoreComments, setHasMoreComments] = useState(true);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const [burstingCommentId, setBurstingCommentId] = useState<number | null>(null);
  const [expandedParents, setExpandedParents] = useState<number[]>([]);
  
  const commentsScrollRef = useRef<HTMLDivElement>(null);
  const sheetTextareaRef = useRef<HTMLTextAreaElement>(null);
  const desktopTextareaRef = useRef<HTMLTextAreaElement>(null);
  const reelTextareaRef = useRef<HTMLTextAreaElement>(null);
  const lastFetchedPostIdRef = useRef<string | number | null>(null);

  const COMMENTS_LIMIT = 10;

  const getToken = useCallback(() => auth?.token || userToken, [auth?.token, userToken]);

  const fetchComments = useCallback(async (isLoadMore = false) => {
    if (!postId || isPreview) return;
    
    if (isLoadMore) setIsFetchingMore(true);
    else setLoadingComments(true);

    try {
      const offset = isLoadMore ? commentsOffset : 0;
      const token = getToken();
      const res = await safeFetch<any>(
        `${API_BASE_URL}/api/social/${postId}/comments?limit=${COMMENTS_LIMIT}&offset=${offset}`,
        {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        }
      );

      if (res && res.status === "success" && res.data?.comments) {
        const newComments = res.data.comments;
        if (isLoadMore) {
          setComments((prev) => [...prev, ...newComments]);
          setCommentsOffset((prev) => prev + newComments.length);
        } else {
          setComments(newComments);
          setCommentsOffset(newComments.length);
        }
        setHasMoreComments(newComments.length === COMMENTS_LIMIT);
        setCommentsError(null);
      } else {
        if (!isLoadMore) setCommentsError("Failed to load comments");
      }
    } catch (err) {
      console.error("fetchComments error", err);
      if (!isLoadMore) setCommentsError("Failed to load comments");
    } finally {
      setLoadingComments(false);
      setIsFetchingMore(false);
    }
  }, [postId, commentsOffset, getToken, isPreview]);

  useEffect(() => {
    if (postId && postId !== lastFetchedPostIdRef.current) {
      lastFetchedPostIdRef.current = postId;
      setComments([]);
      setCommentsOffset(0);
      setHasMoreComments(true);
      fetchComments();
    }
  }, [postId, fetchComments]);

  const handleCommentsScroll = useCallback((e: any) => {
    const el = e.target;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 100 && hasMoreComments && !isFetchingMore && !loadingComments) {
      fetchComments(true);
    }
  }, [hasMoreComments, isFetchingMore, loadingComments, fetchComments]);

  const toggleLikeComment = async (commentId: number) => {
    const ok = await auth.ensureAccountVerified();
    if (!ok) return;

    const comment = comments.find(c => c.comment_id === commentId);
    if (comment && !comment.liked_by_user) {
      setBurstingCommentId(commentId);
      setTimeout(() => setBurstingCommentId(null), 800);
    }

    setComments((prev) =>
      prev.map((c) =>
        c.comment_id === commentId
          ? {
            ...c,
            liked_by_user: !c.liked_by_user,
            likes_count: c.liked_by_user ? Math.max(0, c.likes_count - 1) : (c.likes_count || 0) + 1,
            author_liked: isPostOwner ? !c.liked_by_user : c.author_liked
          }
          : c
      )
    );

    try {
      const token = getToken();
      const res = await safeFetch<any>(`${API_BASE_URL}/api/social/comments/${commentId}/like`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });

      if (res?.status !== "success") {
        // Reverse optimistic update on error
        setComments((prev) =>
          prev.map((c) =>
            c.comment_id === commentId
              ? {
                ...c,
                liked_by_user: !c.liked_by_user,
                likes_count: c.liked_by_user ? Math.max(0, c.likes_count - 1) : (c.likes_count || 0) + 1
              }
              : c
          )
        );
        return;
      }

      // Sync with real data from server
      const serverLikesCount = Number(res?.data?.likes_count ?? res?.data?.likesCount);
      const serverMessage = res?.message || "";
      const isLikedAction = /liked/i.test(serverMessage);

      setComments((prev) =>
        prev.map((c) =>
          c.comment_id === commentId
            ? {
              ...c,
              liked_by_user: isLikedAction,
              likes_count: isNaN(serverLikesCount) ? c.likes_count : serverLikesCount
            }
            : c
        )
      );
    } catch (e) {
      console.error("Like toggle failed:", e);
      // Reverse optimistic update on network error
      setComments((prev) =>
        prev.map((c) =>
          c.comment_id === commentId
            ? {
              ...c,
              liked_by_user: !c.liked_by_user,
              likes_count: c.liked_by_user ? Math.max(0, c.likes_count - 1) : (c.likes_count || 0) + 1
            }
            : c
        )
      );
    }
  };

  const handleAddComment = async (manualText?: string, metadata?: any[]) => {
    if (isPreview) {
      toast.info("Interactions are not allowed in preview mode");
      return;
    }

    const cachedUser = auth?.user;
    if (!cachedUser || !cachedUser.phone_no || !cachedUser.email) {
      const ok = await auth.ensureAccountVerified();
      if (!ok) return;
    }

    const finalCommentText = (manualText ?? commentTextRef.current ?? commentText)?.trim();
    if (!finalCommentText) return;

    const tokenUser = auth?.user;
    const tempId = `temp-${Date.now()}`;
    const optimisticComment: APIComment = {
      comment_id: tempId as any,
      post_id: Number(postId),
      user_id: Number(auth?.user?.user_id ?? auth?.user?.id ?? 0),
      comment_content: finalCommentText,
      comment_at: new Date().toISOString(),
      is_author: Number(auth?.user?.user_id ?? auth?.user?.id) === Number(auth?.user?.user_id) ? 1 : 0, // Simplified
      is_first_comment: comments.length === 0 ? 1 : 0,
      author_name: tokenUser?.full_name ?? tokenUser?.name ?? "You",
      author_pic: tokenUser?.profile_pic ?? tokenUser?.avatar,
      author_is_trusted: false, // Will be updated by server
      location: getCachedLocationName(),
      likes_count: 0,
      liked_by_user: false,
      metadata: metadata,
      parent_id: replyingTo?.parent_id ? replyingTo.parent_id : replyingTo?.comment_id ?? null,
    };

    setComments((p) => [optimisticComment, ...p]);

    if (isMobileReels) {
      setReelsList(prev => prev.map((item, idx) =>
        idx === currentReelIndex ? { ...item, comment_count: (item.comment_count ?? 0) + 1 } : item
      ));
    }

    setCommentText("");
    commentTextRef.current = "";
    if (sheetTextareaRef.current) sheetTextareaRef.current.style.height = 'auto';
    if (desktopTextareaRef.current) desktopTextareaRef.current.style.height = 'auto';
    if (reelTextareaRef.current) reelTextareaRef.current.style.height = 'auto';
    setReplyingTo(null);

    setCommentPosting(true);
    try {
      const token = getToken();

      let userIp = null;
      let ipBasedLocation = null;
      try {
        const ipRes = await fetch("https://ipapi.co/json/");
        if (ipRes.ok) {
          const ipData = await ipRes.json();
          userIp = ipData.ip;
          if (ipData.city) {
            ipBasedLocation = `${ipData.city}, ${ipData.country_name || ipData.country}`;
          }
        }
      } catch (err) {
        try {
          const ipRes = await fetch("https://api.ipify.org?format=json");
          const ipData = await ipRes.json();
          userIp = ipData.ip;
        } catch (e) { }
      }

      const freshLocation = await getCurrentLocationName();
      const location = freshLocation || ipBasedLocation || getCachedLocationName();

      const res = await fetch(`${API_BASE_URL}/api/social/${postId}/comment`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({
          content: finalCommentText,
          location: location,
          user_ip: userIp,
          parent_comment_id: optimisticComment.parent_id,
          metadata: metadata
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json?.message || "Failed to post comment");

      const created: APIComment | undefined = json?.data?.comment;

      if (created) {
        setComments(prev => prev.map(c =>
          c.comment_id === (tempId as any)
            ? { ...created, liked_by_user: Boolean(created.liked_by_user) }
            : c
        ));
      }
    } catch (err) {
      console.error("add comment failed", err);
      toast.error("Failed to post comment. Please try again.");

      setComments(prev => prev.filter(c => c.comment_id !== (tempId as any)));
      if (isMobileReels) {
        setReelsList(prev => prev.map((item, idx) =>
          idx === currentReelIndex ? { ...item, comment_count: Math.max(0, (item.comment_count ?? 0) - 1) } : item
        ));
      }
    } finally {
      setCommentPosting(false);
    }
  };

  return {
    comments,
    setComments,
    loadingComments,
    commentsError,
    commentText,
    setCommentText,
    commentTextRef,
    commentPosting,
    replyingTo,
    setReplyingTo,
    commentsOffset,
    hasMoreComments,
    isFetchingMore,
    burstingCommentId,
    expandedParents,
    setExpandedParents,
    commentsScrollRef,
    sheetTextareaRef,
    desktopTextareaRef,
    reelTextareaRef,
    handleCommentsScroll,
    toggleLikeComment,
    handleAddComment,
    fetchComments
  };
}
