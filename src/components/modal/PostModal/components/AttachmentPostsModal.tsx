import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { XMarkIcon } from "@heroicons/react/24/outline";
import { FileText } from "lucide-react";
import StoqleLoader from "@/src/components/common/StoqleLoader";
import CachedImage from "@/src/components/common/CachedImage";
import { PostModalContext } from "../types";
import { safeFetch } from "@/src/lib/api/handler";
import { API_BASE_URL } from "@/src/lib/config";
import PostCard, { getNoteStyles } from "@/src/components/common/PostCard";
import { mapApiPost } from "@/src/lib/utils/social/mapping";

interface AttachmentPostsModalProps {
  ctx: PostModalContext;
  onClose: () => void;
  onInsertToken: (token: string, metadata: any) => void;
}

const MasonryGrid = ({ items, openPostWithUrl, toggleLike, getNoteStyles }: any) => {
  const columns = 2; // Forced to 2 per row for attachment modal

  const columnData = React.useMemo(() => {
    const data = Array.from({ length: columns }, () => [] as any[]);
    items.forEach((item: any, index: number) => {
      data[index % columns].push(item);
    });
    return data;
  }, [items, columns]);

  return (
    <div className="flex gap-3 items-start w-full">
      {columnData.map((colItems, colIdx) => (
        <div key={colIdx} className="flex-1 flex flex-col gap-3 min-w-0">
          {colItems.map((p: any, idx: number) => (
            <PostCard
              key={p.id || idx}
              post={p}
              openPostWithUrl={openPostWithUrl}
              toggleLike={toggleLike}
              getNoteStyles={getNoteStyles}
            />
          ))}
        </div>
      ))}
    </div>
  );
};

type SubTabType = "liked_posts" | "my_notes" | "my_posts";

export default function AttachmentPostsModal({ ctx, onClose, onInsertToken }: AttachmentPostsModalProps) {
  const { auth, formatUrl } = ctx;
  const [subTab, setSubTab] = useState<SubTabType>("liked_posts");

  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(1);
  const LIMIT = 10;

  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any[]>([]);
  const [cache, setCache] = useState<Record<string, any[]>>({});

  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setData([]);
    setPage(1);
    setHasMore(true);
    fetchPostsData(subTab, 1);
  }, [subTab]);

  const fetchPostsData = async (type: SubTabType, currentPage: number) => {
    const cacheKey = `${type}_${currentPage}`;
    if (cache[cacheKey]) {
      setData(cache[cacheKey]);
      return;
    }

    setLoading(true);
    try {
      let endpoint = "";
      if (type === "liked_posts") endpoint = `/api/social/liked/me?limit=${LIMIT}&offset=${(currentPage - 1) * LIMIT}`;
      else if (type === "my_posts") endpoint = `/api/social/user/${auth?.user?.user_id}?type=post&limit=${LIMIT}&offset=${(currentPage - 1) * LIMIT}`;
      else if (type === "my_notes") endpoint = `/api/social/user/${auth?.user?.user_id}?type=note&limit=${LIMIT}&offset=${(currentPage - 1) * LIMIT}`;

      if (!endpoint) return;

      const json: any = await safeFetch(`${API_BASE_URL}${endpoint}`, {
        headers: { Authorization: `Bearer ${auth?.token}` }
      });
      const items = json?.data?.posts || [];

      const validItems = items.filter(Boolean);
      setData(prev => currentPage === 1 ? validItems : [...prev, ...validItems]);
      setCache(prev => ({ ...prev, [cacheKey]: validItems }));

      if (validItems.length < LIMIT) {
        setHasMore(false);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const bottom = e.currentTarget.scrollHeight - e.currentTarget.scrollTop <= e.currentTarget.clientHeight + 100;
    if (bottom && !loading && hasMore) {
      setPage(p => p + 1);
      fetchPostsData(subTab, page + 1);
    }
  };

  const handlePostSelect = (post: any) => {
    // If post has a title/text/subtitle use it, otherwise use author name
    const rawText = post.title || post.text || post.subtitle || post.note_caption;
    const authorName = post.full_name || post.business_name || post.author_name || "Author";
    const displayLabel = rawText ? rawText : `Post by ${authorName}`;
    const title = displayLabel.length > 22 ? displayLabel.substring(0, 22) + "..." : displayLabel;

    onInsertToken(`[Post: ${title}]`, {
      type: "post",
      id: post.post_public_id || post.social_post_id || post.id,
      handle: post.author_handle || post.user?.username || post.username,
      display: `[Post: ${title}]`
    });
    onClose();
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: "100%" }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: "100%" }}
        transition={{ type: "spring", damping: 25, stiffness: 200 }}
        className="fixed bottom-0 left-0 right-0 z-[200] bg-white rounded-t-[0.5rem] flex flex-col h-[80vh] sm:max-h-[80vh] sm:absolute sm:w-full sm:max-w-md sm:left-1/2 sm:-translate-x-1/2"
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
        ref={containerRef}
      >
        <div className="flex items-center justify-between px-5 py-4 ">
          <h3 className="text-md font-bold text-slate-800 tracking-tight text-center">Attach Post</h3>
          <button
            onClick={onClose}
            className="p-2 -mr-2 bg-slate-100/50 hover:bg-slate-200 rounded-full text-slate-500 transition-colors"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto relative flex flex-col">
          <div className="flex px-4 py-3 gap-6 overflow-x-auto no-scrollbar border-b border-slate-100 shrink-0 relative">
            {(["liked_posts", "my_notes", "my_posts"] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setSubTab(tab as SubTabType)}
                className={`pb-2 text-sm font-bold whitespace-nowrap transition-colors relative ${subTab === tab ? "text-slate-800" : "text-slate-400 hover:text-slate-600"
                  }`}
              >
                {tab === "liked_posts" ? "Liked" : tab === "my_notes" ? "Notes" : "My Posts"}
                {subTab === tab && (
                  <motion.div
                    layoutId="activePostTabIndicator"
                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-rose-500 rounded-full"
                  />
                )}
              </button>
            ))}
          </div>
          <div className="flex-1 p-4 overflow-y-auto min-h-[250px]" onScroll={handleScroll}>
            {loading && page === 1 ? (
              <div className="h-full flex items-center justify-center">
                <StoqleLoader size={32} />
              </div>
            ) : data.length === 0 ? (
              <div className="text-center py-10 text-slate-400 text-sm font-medium">No posts found</div>
            ) : (
              <div className="flex flex-col gap-3 pb-6">
                <MasonryGrid
                  items={data.map(mapApiPost)}
                  openPostWithUrl={(post: any) => handlePostSelect(data.find((d: any) => (d.social_post_id || d.id) === post.id))}
                  getNoteStyles={getNoteStyles}
                />
                {loading && page > 1 && (
                  <div className="py-4 flex justify-center w-full">
                    <StoqleLoader size={24} />
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
