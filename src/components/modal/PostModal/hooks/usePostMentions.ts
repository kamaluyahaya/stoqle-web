import { useState, useCallback } from "react";
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

  const fetchMentions = useCallback(async () => {
    if (!auth?.user?.user_id) {
      toast.error("Please login to mention users");
      return;
    }
    setIsLoadingMentions(true);
    try {
      const token = auth.token || userToken;
      const [followingRes, followersRes] = await Promise.all([
        safeFetch(`${API_BASE_URL}/api/users/${auth.user.user_id}/following?limit=50`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        safeFetch(`${API_BASE_URL}/api/users/${auth.user.user_id}/followers?limit=50`, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
      ]);

      const following = followingRes?.data?.items || [];
      const followers = followersRes?.data?.items || [];
      const combined = [...following, ...followers];
      const unique = Array.from(new Map(combined.map(u => [String(u.user_id || u.id), u])).values());
      setMentionsList(unique);
    } catch (err) {
      console.error("fetchMentions error", err);
    } finally {
      setIsLoadingMentions(false);
    }
  }, [auth, userToken]);

  return {
    showMentions,
    setShowMentions,
    mentionsList,
    isLoadingMentions,
    fetchMentions
  };
}
