import { useState, useCallback, useRef } from "react";
import { API_BASE_URL } from "@/src/lib/config";
import { safeFetch } from "@/src/lib/api/handler";
import { toast } from "sonner";

interface UsePostMentionsProps {
  auth: any;
  userToken?: string | null;
}

export function usePostMentions({ auth, userToken }: UsePostMentionsProps) {
  const [showMentions, setShowMentions] = useState(false);
  const [mentionsList, setMentionsList] = useState<any[]>([]);
  const [isLoadingMentions, setIsLoadingMentions] = useState(false);
  const [mentionsOffset, setMentionsOffset] = useState(0);
  const [hasMoreMentions, setHasMoreMentions] = useState(true);
  const [isFetchingMoreMentions, setIsFetchingMoreMentions] = useState(false);
  const [currentQuery, setCurrentQuery] = useState("");

  const LIMIT = 10;

  const fetchMentions = useCallback(async (query?: string, isLoadMore = false) => {
    if (!auth?.user?.user_id) {
      toast.error("Please login to mention users");
      return;
    }

    if (isLoadMore) {
      if (!hasMoreMentions || isFetchingMoreMentions) return;
      setIsFetchingMoreMentions(true);
    } else {
      setIsLoadingMentions(true);
      setMentionsOffset(0);
      setHasMoreMentions(true);
      setCurrentQuery(query || "");
    }

    const currentOffset = isLoadMore ? mentionsOffset : 0;
    const token = auth.token || userToken;

    try {
      if (query && query.length > 0) {
        const res = await safeFetch(`${API_BASE_URL}/api/search/unified?query=${encodeURIComponent(query)}&tab=users&limit=${LIMIT}&offset=${currentOffset}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const users = res?.data?.users || [];
        
        if (isLoadMore) {
          setMentionsList(prev => [...prev, ...users]);
          setMentionsOffset(prev => prev + users.length);
        } else {
          setMentionsList(users);
          setMentionsOffset(users.length);
        }
        setHasMoreMentions(users.length === LIMIT);
      } else {
        const [followingRes, followersRes] = await Promise.all([
          safeFetch(`${API_BASE_URL}/api/users/${auth.user.user_id}/following?limit=${LIMIT}&offset=${currentOffset}`, {
            headers: { 'Authorization': `Bearer ${token}` }
          }),
          safeFetch(`${API_BASE_URL}/api/users/${auth.user.user_id}/followers?limit=${LIMIT}&offset=${currentOffset}`, {
            headers: { 'Authorization': `Bearer ${token}` }
          })
        ]);

        const following = followingRes?.data?.items || [];
        const followers = followersRes?.data?.items || [];
        const combined = [...following, ...followers];
        const unique = Array.from(new Map(combined.map(u => [String(u.user_id || u.id), u])).values());

        if (isLoadMore) {
          setMentionsList(prev => {
            const existingIds = new Set(prev.map(u => String(u.user_id || u.id)));
            const filteredNew = unique.filter(u => !existingIds.has(String(u.user_id || u.id)));
            return [...prev, ...filteredNew];
          });
          setMentionsOffset(prev => prev + LIMIT);
        } else {
          setMentionsList(unique);
          setMentionsOffset(LIMIT);
        }
        setHasMoreMentions(following.length === LIMIT || followers.length === LIMIT);
      }
    } catch (err) {
      console.error("fetchMentions error", err);
    } finally {
      setIsLoadingMentions(false);
      setIsFetchingMoreMentions(false);
    }
  }, [auth, userToken, mentionsOffset, hasMoreMentions, isFetchingMoreMentions]);

  const mentionsMap = useRef<Record<string, string>>({});

  const registerMention = useCallback((mentionStr: string, slug: string) => {
    mentionsMap.current[mentionStr] = slug;
  }, []);

  const enrichTextWithSlugs = useCallback((text: string) => {
    if (!text) return text;
    // Match @ followed by anything that isn't a ZWSP, followed by ZWSP
    // Captured group 1 is the display name
    return text.replace(/@([^\u200B]+)\u200B/g, (match, displayName) => {
      // Find the slug from our map. We try the full match first, then just the display name
      // as a fallback for maximum reliability.
      const slug = mentionsMap.current[match] || mentionsMap.current[displayName];
      
      if (slug) {
        return `@[${displayName}](${slug})`;
      }
      // If no slug found, keep as is
      return match;
    });
  }, []);

  return {
    showMentions,
    setShowMentions,
    mentionsList,
    isLoadingMentions,
    isFetchingMoreMentions,
    hasMoreMentions,
    fetchMentions,
    mentionsMap,
    registerMention,
    enrichTextWithSlugs,
    currentQuery
  };
}
