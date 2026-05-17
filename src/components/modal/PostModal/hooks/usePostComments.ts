import { useState, useRef, useCallback, useEffect } from "react";
import { io, Socket } from "socket.io-client";
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
  isModalFullyVisible: boolean;
}

// Per-comment reply pagination state
interface ReplyState {
  loadingIds: Set<number>;        // comment IDs currently loading more replies
  offsets: Record<number, number>; // next offset for each parent comment
  hasMore: Record<number, boolean>; // whether more replies exist for each parent
  totals: Record<number, number>;   // total reply count per parent
}

export function usePostComments({
  postId,
  userToken,
  auth,
  isPostOwner,
  isMobileReels,
  currentReelIndex,
  setReelsList,
  isPreview,
  isModalFullyVisible
}: UsePostCommentsProps) {
  const [comments, setComments] = useState<APIComment[]>([]);
  const [loadingComments, setLoadingComments] = useState(!!postId);
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
  const [externalPendingFiles, setExternalPendingFiles] = useState<File[]>([]);

  // Per-comment reply state
  const [replyState, setReplyState] = useState<ReplyState>({
    loadingIds: new Set(),
    offsets: {},
    hasMore: {},
    totals: {},
  });

  const beepAudio = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined" && !beepAudio.current) {
      beepAudio.current = new Audio("/assets/sound/beep.mp3");
      beepAudio.current.load();
    }
  }, []);

  const commentsScrollRef = useRef<HTMLDivElement>(null);
  const sheetTextareaRef = useRef<HTMLTextAreaElement>(null);
  const desktopTextareaRef = useRef<HTMLTextAreaElement>(null);
  const reelTextareaRef = useRef<HTMLTextAreaElement>(null);
  const lastFetchedPostIdRef = useRef<string | number | null>(null);

  const COMMENTS_LIMIT = 10;
  const REPLIES_LIMIT = 10;

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
        const fetchedComments = res.data.comments as any[];

        // Normalize top-level comments and flatten 2-preview replies
        const normalized: APIComment[] = [];
        const newOffsets: Record<number, number> = {};
        const newHasMore: Record<number, boolean> = {};
        const newTotals: Record<number, number> = {};

        fetchedComments.forEach(c => {
          const topLevel = {
            ...c,
            parent_id: c.parent_id ?? c.parent_comment_id ?? null,
            liked_by_user: Boolean(c.liked_by_user)
          };
          normalized.push(topLevel);

          // Flatten the 2 preview replies
          const previewReplies: any[] = c.replies ?? [];
          const totalReplies = Number(c.total_replies_count ?? 0);

          previewReplies.forEach((r: any) => {
            normalized.push({
              ...r,
              parent_id: r.parent_id ?? r.parent_comment_id ?? c.comment_id,
              liked_by_user: Boolean(r.liked_by_user)
            });
          });

          // Track reply pagination state for this parent
          newOffsets[c.comment_id] = previewReplies.length;
          newHasMore[c.comment_id] = previewReplies.length < totalReplies;
          newTotals[c.comment_id] = totalReplies;
        });

        if (isLoadMore) {
          setComments((prev) => [...prev, ...normalized]);
          setCommentsOffset((prev) => prev + fetchedComments.length);
        } else {
          setComments(normalized);
          setCommentsOffset(fetchedComments.length);
        }

        setReplyState(prev => ({
          ...prev,
          offsets: { ...prev.offsets, ...newOffsets },
          hasMore: { ...prev.hasMore, ...newHasMore },
          totals: { ...prev.totals, ...newTotals },
        }));

        setHasMoreComments(fetchedComments.length === COMMENTS_LIMIT);
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
    if (postId && postId !== lastFetchedPostIdRef.current && isModalFullyVisible) {
      lastFetchedPostIdRef.current = postId;
      setComments([]);
      setCommentsOffset(0);
      setHasMoreComments(true);
      setExpandedParents([]);
      setReplyState({ loadingIds: new Set(), offsets: {}, hasMore: {}, totals: {} });
      fetchComments();
    }
  }, [postId, fetchComments, isModalFullyVisible]);

  // --- Real-time Socket Synchronization ---
  useEffect(() => {
    if (!postId || isPreview || !isModalFullyVisible) return;

    const userId = auth?.user?.user_id || auth?.user?.id;
    const socket = io(API_BASE_URL, {
      query: userId ? { userId } : {},
      reconnection: true,
      reconnectionAttempts: 5,
    });

    const room = `user:post:${postId}`;
    socket.emit("join_room", room);
    console.log(`[Socket] Joined comment room: ${room}`);

    socket.on("comment_created", (newComment: APIComment) => {
      setComments(prev => {
        // Prevent duplication: if we already have this comment_id, skip
        if (prev.some(c => String(c.comment_id) === String(newComment.comment_id))) {
          return prev;
        }

        // Check if it's our own comment that might still be in "temp" state
        // If we find a temp comment with same content and user, we might want to replace it
        // but it's safer to just add if the ID is unique. The handleAddComment map will
        // handle replacing the temp one when the API returns.
        
        const normalized = {
          ...newComment,
          parent_id: newComment.parent_id ?? (newComment as any).parent_comment_id ?? null,
          liked_by_user: Boolean(newComment.liked_by_user)
        };

        // If it's a reply, ensure we expand parent if needed
        if (normalized.parent_id) {
          const pid = Number(normalized.parent_id);
          setReplyState(ps => ({
            ...ps,
            totals: { ...ps.totals, [pid]: (ps.totals[pid] ?? 0) + 1 }
          }));
        }

        return [normalized, ...prev];
      });
    });

    return () => {
      console.log(`[Socket] Leaving comment room: ${room}`);
      socket.disconnect();
    };
  }, [postId, isPreview, isModalFullyVisible, auth?.user?.user_id, auth?.user?.id]);

  // Fetch more replies for a specific parent comment
  const fetchMoreReplies = useCallback(async (parentCommentId: number) => {
    const currentOffset = replyState.offsets[parentCommentId] ?? 0;
    const hasMore = replyState.hasMore[parentCommentId] ?? false;
    if (!hasMore) return;

    // Mark as loading
    setReplyState(prev => ({
      ...prev,
      loadingIds: new Set([...prev.loadingIds, parentCommentId])
    }));

    try {
      const token = getToken();
      const res = await safeFetch<any>(
        `${API_BASE_URL}/api/social/comments/${parentCommentId}/replies?limit=${REPLIES_LIMIT}&offset=${currentOffset}`,
        {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        }
      );

      if (res?.status === "success" && res.data?.replies) {
        const newReplies: APIComment[] = (res.data.replies as any[]).map(r => ({
          ...r,
          parent_id: r.parent_id ?? r.parent_comment_id ?? parentCommentId,
          liked_by_user: Boolean(r.liked_by_user)
        }));

        setComments(prev => {
          // Avoid duplicates
          const existingIds = new Set(prev.map(c => c.comment_id));
          const deduplicated = newReplies.filter(r => !existingIds.has(r.comment_id));
          return [...prev, ...deduplicated];
        });

        const nextOffset = res.data.next_offset ?? currentOffset + newReplies.length;
        const hasMoreReplies = Boolean(res.data.has_more);

        setReplyState(prev => {
          const newLoadingIds = new Set(prev.loadingIds);
          newLoadingIds.delete(parentCommentId);
          const total = res.data.total ?? prev.totals[parentCommentId];
          return {
            ...prev,
            loadingIds: newLoadingIds,
            offsets: { ...prev.offsets, [parentCommentId]: nextOffset },
            hasMore: { ...prev.hasMore, [parentCommentId]: hasMoreReplies },
            totals: { ...prev.totals, [parentCommentId]: total },
          };
        });

        // Auto-expand parent if not already expanded
        setExpandedParents(prev => prev.includes(parentCommentId) ? prev : [...prev, parentCommentId]);
      }
    } catch (err) {
      console.error("fetchMoreReplies error", err);
      setReplyState(prev => {
        const newLoadingIds = new Set(prev.loadingIds);
        newLoadingIds.delete(parentCommentId);
        return { ...prev, loadingIds: newLoadingIds };
      });
    }
  }, [replyState, getToken]);

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

  const handleAddComment = async (manualText?: string, metadata?: any[], commentImageFiles?: File[], commentAudioFile?: File, voiceMeta?: any) => {
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
    const hasFiles = (commentImageFiles && commentImageFiles.length > 0) || !!commentAudioFile;
    if (!finalCommentText && !hasFiles) return;

    // Create optimistic media URLs
    const optimisticImages = commentImageFiles ? commentImageFiles.map(f => URL.createObjectURL(f)) : undefined;
    const optimisticAudio = commentAudioFile ? URL.createObjectURL(commentAudioFile) : undefined;

    const tokenUser = auth?.user;
    const tempId = `temp-${Date.now()}`;
    const optimisticComment: APIComment = {
      comment_id: tempId as any,
      post_id: Number(postId),
      user_id: Number(auth?.user?.user_id ?? auth?.user?.id ?? 0),
      comment_content: finalCommentText,
      comment_at: new Date().toISOString(),
      is_author: Number(auth?.user?.user_id ?? auth?.user?.id) === Number(auth?.user?.user_id) ? 1 : 0,
      is_first_comment: comments.length === 0 ? 1 : 0,
      author_name: tokenUser?.full_name ?? tokenUser?.name ?? "You",
      author_pic: tokenUser?.profile_pic ?? tokenUser?.avatar,
      author_is_trusted: false,
      location: getCachedLocationName(),
      likes_count: 0,
      liked_by_user: false,
      metadata: metadata,
      parent_id: replyingTo ? (replyingTo.parent_id ?? replyingTo.comment_id) : null,
      parent_comment_id: replyingTo?.comment_id ?? null,
      parent_author_name: replyingTo?.author_name,
      parent_author_handle: replyingTo?.author_handle,
      comment_images: optimisticImages,
      audio_url: optimisticAudio,
      audio_duration_ms: voiceMeta?.duration_ms,
      waveform_data: voiceMeta?.waveform,
    };

    setComments((p) => [optimisticComment, ...p]);

    if (isMobileReels) {
      setReelsList(prev => prev.map((item, idx) =>
        idx === currentReelIndex ? { ...item, comment_count: (item.comment_count ?? 0) + 1 } : item
      ));
    }

    setCommentText("");
    commentTextRef.current = "";
    if (sheetTextareaRef.current) sheetTextareaRef.current.style.height = '0px';
    if (desktopTextareaRef.current) desktopTextareaRef.current.style.height = '0px';
    if (reelTextareaRef.current) reelTextareaRef.current.style.height = '0px';

    if (optimisticComment.parent_id) {
      const pid = Number(optimisticComment.parent_id);
      setExpandedParents(prev => prev.includes(pid) ? prev : [...prev, pid]);
      // Increment offset and total for this parent since we're adding a reply
      setReplyState(prev => ({
        ...prev,
        offsets: { ...prev.offsets, [pid]: (prev.offsets[pid] ?? 0) + 1 },
        totals: { ...prev.totals, [pid]: (prev.totals[pid] ?? 0) + 1 },
      }));
    }

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

      const hasFiles2 = (commentImageFiles && commentImageFiles.length > 0) || commentAudioFile;

      let res: any;
      if (hasFiles2) {
        const form = new FormData();
        form.append("content", finalCommentText);
        if (location) form.append("location", location);
        if (userIp) form.append("user_ip", userIp);
        if (optimisticComment.parent_id) form.append("parent_id", String(optimisticComment.parent_id));
        if (optimisticComment.parent_comment_id) form.append("parent_comment_id", String(optimisticComment.parent_comment_id));
        if (metadata && metadata.length > 0) form.append("metadata", JSON.stringify(metadata));
        if (commentImageFiles) {
          commentImageFiles.forEach(f => form.append("comment_images", f));
        }
        if (commentAudioFile) {
          form.append("comment_audio", commentAudioFile);
          if (voiceMeta) form.append("voice_meta", JSON.stringify(voiceMeta));
        }
        res = await safeFetch<any>(`/api/social/${postId}/comment`, {
          method: "POST",
          headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
          body: form,
        });
      } else {
        res = await safeFetch<any>(`/api/social/${postId}/comment`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
          body: JSON.stringify({
            content: finalCommentText,
            location: location,
            user_ip: userIp,
            parent_id: optimisticComment.parent_id,
            parent_comment_id: optimisticComment.parent_comment_id,
            metadata: metadata
          }),
        });
      }

      const json = res;
      if (json?.status !== "success" && !json?.data?.comment) {
        throw new Error(json?.message || "Failed to post comment");
      }

      const created: APIComment | undefined = json?.data?.comment;

      if (created) {
        // 🔊 Play success sound for media-rich comments once synced
        if (hasFiles2) {
          beepAudio.current?.play().catch(e => console.warn("[Audio] Playback failed:", e));
        }

        setComments(prev => {
          const old = prev.find(c => c.comment_id === (tempId as any));
          // Revoke optimistic URLs
          if (old?.comment_images && Array.isArray(old.comment_images)) {
            (old.comment_images as string[]).forEach(url => {
              if (url.startsWith('blob:')) URL.revokeObjectURL(url);
            });
          }
          if (old?.audio_url?.startsWith('blob:')) {
            URL.revokeObjectURL(old.audio_url);
          }

          // If the socket already injected this real comment ID, just remove the temp one
          if (prev.some(c => String(c.comment_id) === String(created.comment_id))) {
            return prev.filter(c => c.comment_id !== (tempId as any));
          }

          return prev.map(c =>
            c.comment_id === (tempId as any)
              ? {
                ...created,
                parent_id: created.parent_id ?? (created as any).parent_comment_id ?? optimisticComment.parent_id,
                liked_by_user: Boolean(created.liked_by_user)
              }
              : c
          );
        });
      }
    } catch (err) {
      console.error("add comment failed", err);
      toast.error("Failed to post comment. Please try again.");

      setComments(prev => {
        const old = prev.find(c => c.comment_id === (tempId as any));
        // Revoke optimistic URLs on failure too
        if (old?.comment_images && Array.isArray(old.comment_images)) {
          (old.comment_images as string[]).forEach(url => {
            if (url.startsWith('blob:')) URL.revokeObjectURL(url);
          });
        }
        if (old?.audio_url?.startsWith('blob:')) {
          URL.revokeObjectURL(old.audio_url);
        }
        return prev.filter(c => c.comment_id !== (tempId as any));
      });
      if (isMobileReels) {
        setReelsList(prev => prev.map((item, idx) =>
          idx === currentReelIndex ? { ...item, comment_count: Math.max(0, (item.comment_count ?? 0) - 1) } : item
        ));
      }
    } finally {
      setCommentPosting(false);
    }
  };

  const deleteComment = async (commentId: number) => {
    // Snapshot for rollback
    const snapshot = [...comments];
    const deletedComment = comments.find(c => c.comment_id === commentId);
    const replyCount = replyState.totals[commentId] ?? 0;
    const totalToRemove = 1 + replyCount;

    // Optimistic removal (including all direct replies in the current state)
    setComments(prev => prev.filter(c => c.comment_id !== commentId && Number(c.parent_id) !== commentId));

    // If it was a reply, decrement the parent's total count in replyState
    if (deletedComment?.parent_id) {
      const pid = Number(deletedComment.parent_id);
      setReplyState(prev => ({
        ...prev,
        totals: { ...prev.totals, [pid]: Math.max(0, (prev.totals[pid] ?? 1) - 1) },
      }));
    }

    // Decrement overall comment count on the reel
    if (isMobileReels) {
      setReelsList(prev => prev.map((item, idx) =>
        idx === currentReelIndex ? { ...item, comment_count: Math.max(0, (item.comment_count ?? totalToRemove) - totalToRemove) } : item
      ));
    }

    try {
      const token = getToken();
      const res = await safeFetch<any>(`${API_BASE_URL}/api/social/comments/${commentId}`, {
        method: 'DELETE',
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });

      if (res?.status !== 'success') {
        throw new Error(res?.message || 'Failed to delete comment');
      }

      toast.success('Comment deleted');
    } catch (err) {
      console.error('deleteComment failed:', err);
      toast.error('Failed to delete comment');
      // Rollback
      setComments(snapshot);
      if (deletedComment?.parent_id) {
        const pid = Number(deletedComment.parent_id);
        setReplyState(prev => ({
          ...prev,
          totals: { ...prev.totals, [pid]: (prev.totals[pid] ?? 0) + 1 },
        }));
      }
      if (isMobileReels) {
        setReelsList(prev => prev.map((item, idx) =>
          idx === currentReelIndex ? { ...item, comment_count: (item.comment_count ?? 0) + totalToRemove } : item
        ));
      }
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
    deleteComment,
    fetchComments,
    // Reply pagination
    replyState,
    fetchMoreReplies,
    externalPendingFiles,
    setExternalPendingFiles,
  };
}

/** Resolve the correct parent_id from the replyingTo comment */
function relyingToParentId(replyingTo: APIComment | null): number | null {
  if (!replyingTo) return null;
  // Always thread under the root parent: if replyingTo is a reply, use its parent_id
  return replyingTo.parent_id ? Number(replyingTo.parent_id) : Number(replyingTo.comment_id);
}
