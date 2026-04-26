import { useState, useCallback } from "react";
import { toast } from "sonner";
import { copyToClipboard } from "@/src/lib/utils/utils";
import { Post } from "@/src/lib/types";

export function usePostActions() {
  const [showLongTapMenu, setShowLongTapMenu] = useState(false);
  const [menuPosition, setMenuPosition] = useState<{ x: number; y: number } | null>(null);
  const [longTappedPost, setLongTappedPost] = useState<any>(null);

  const handleCopyLink = useCallback((p: Post) => {
    const url = `${window.location.origin}/post/${p.social_post_id || p.id}`;
    copyToClipboard(url);
    toast.success("Link copied to clipboard");
  }, []);

  const handleDownload = useCallback(async (src?: string) => {
    if (!src) return;
    try {
      toast.promise(
        (async () => {
          const response = await fetch(src);
          const blob = await response.blob();
          const url = window.URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `stoqle-reel-${Date.now()}.mp4`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          window.URL.revokeObjectURL(url);
        })(),
        {
          loading: 'Preparing download...',
          success: 'Download started!',
          error: 'Failed to download video'
        }
      );
    } catch (err) {
      console.error("Download error", err);
    }
  }, []);

  return {
    showLongTapMenu,
    setShowLongTapMenu,
    menuPosition,
    setMenuPosition,
    longTappedPost,
    setLongTappedPost,
    handleCopyLink,
    handleDownload
  };
}
