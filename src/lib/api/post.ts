// src/lib/api/post.ts
// Centralized Post-related API calls (comments, like, follow, etc.)

import { API_BASE_URL } from "@/src/lib/config";

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
  const res = await fetch(`${API_BASE_URL}/api/social/${postId}/comments`, {
    method: "GET",
    headers: buildHeaders(token),
    signal,
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Failed to fetch comments: ${res.status} ${res.statusText} ${txt}`);
  }
  const json = await res.json();
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
  const res = await fetch(`${API_BASE_URL}/api/follow/${userId}/status`, {
    method: "GET",
    headers: buildHeaders(token),
    signal,
  });
  if (!res.ok) return false;
  const json = await res.json();
  return Boolean(json?.data?.isFollowing ?? json?.data?.is_following ?? false);
}

export async function toggleFollow(userId: number, shouldFollow: boolean, token?: string | null) {
  if (!token) throw new Error("Unauthorized");
  const url = `${API_BASE_URL}/api/follow/${userId}/${shouldFollow ? "follow" : "unfollow"}`;
  const res = await fetch(url, {
    method: "POST",
    headers: buildHeaders(token),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Follow request failed: ${res.status} ${txt}`);
  }
  const json = await res.json().catch(() => ({} as any));
  return json;
}

export async function postComment(postId: number | string, content: string, token?: string | null) {
  if (!token) throw new Error("Unauthorized");
  const res = await fetch(`${API_BASE_URL}/api/social/${postId}/comment`, {
    method: "POST",
    headers: buildHeaders(token),
    body: JSON.stringify({ content }),
  });
  const json = await res.json().catch(() => ({} as any));
  if (!res.ok) throw new Error(json?.message || "Failed to post comment");
  return json?.data?.comment ?? json;
}

export async function likeComment(commentId: number, token?: string | null) {
  const res = await fetch(`${API_BASE_URL}/api/social/comments/${commentId}/like`, {
    method: "POST",
    headers: buildHeaders(token),
  });
  const json = await res.json().catch(() => ({} as any));
  if (!res.ok) throw new Error(json?.message || "Failed to like comment");
  return json;
}

export async function likePost(postId: number | string, token?: string | null) {
  const res = await fetch(`${API_BASE_URL}/api/social/${postId}/like`, {
    method: "POST",
    headers: buildHeaders(token),
  });
  const json = await res.json().catch(() => ({} as any));
  if (!res.ok) throw new Error(json?.message || "Failed to like post");
  return json;
}
