// src/lib/api/post.ts
// Centralized Post-related API calls (comments, like, follow, etc.)
import { safeFetch } from "./handler";

export type APIComment = {
  comment_id: number;
  post_id: number;
  user_id: number;
  comment_content: string;
  comment_at: string;
  is_author: number;
  is_first_comment: number;
  author_name: string;
  author_pic?: string;
  author_handle?: string;
  likes_count: number;
  author_liked?: boolean;
  liked_by_user?: boolean;
};

function buildHeaders(token?: string | null) {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (token) h["Authorization"] = `Bearer ${token}`;
  return h;
}

export async function fetchComments(postId: number, token?: string | null, signal?: AbortSignal) {
  const json = await safeFetch<any>(`/api/social/${postId}/comments`, {
    method: "GET",
    headers: buildHeaders(token),
    signal,
  });
  
  const fetchedComments: any[] = json?.data?.comments && Array.isArray(json.data.comments) ? json.data.comments : [];
  const normalized = fetchedComments.map((c) => ({
    ...c,
    liked_by_user: Boolean(c.liked_by_user || c.author_liked || false),
    likes_count: Number(c.likes_count ?? 0),
  })) as APIComment[];
  return normalized;
}

export async function fetchFollowStatus(userId: number, token?: string | null, signal?: AbortSignal) {
  if (!token) return false;
  try {
    const json = await safeFetch<any>(`/api/follow/${userId}/status`, {
      method: "GET",
      headers: buildHeaders(token),
      signal,
    });
    return Boolean(json?.data?.isFollowing ?? json?.data?.is_following ?? false);
  } catch (e) {
    return false;
  }
}

export async function toggleFollow(userId: number, shouldFollow: boolean, token?: string | null) {
  if (!token) throw new Error("Unauthorized");
  return safeFetch(`/api/follow/${userId}/${shouldFollow ? "follow" : "unfollow"}`, {
    method: "POST",
    headers: buildHeaders(token),
  });
}

export async function postComment(postId: number | string, content: string, token?: string | null) {
  if (!token) throw new Error("Unauthorized");
  const json = await safeFetch<any>(`/api/social/${postId}/comment`, {
    method: "POST",
    headers: buildHeaders(token),
    body: JSON.stringify({ content }),
  });
  return json?.data?.comment ?? json;
}

export async function likeComment(commentId: number, token?: string | null) {
  return safeFetch(`/api/social/comments/${commentId}/like`, {
    method: "POST",
    headers: buildHeaders(token),
  });
}

export async function likePost(postId: number | string, token?: string | null) {
  return safeFetch(`/api/social/${postId}/like`, {
    method: "POST",
    headers: buildHeaders(token),
  });
}
