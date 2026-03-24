"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { XMarkIcon, StarIcon } from "@heroicons/react/24/outline";
import { StarIcon as StarIconSolid } from "@heroicons/react/24/solid";
import { Review } from "@/src/lib/api/reviewApi";
import ActionBar from "../preview/actionBar";
import { useRouter } from "next/navigation";
import { API_BASE_URL } from "@/src/lib/config";
import { useMemo, useState, useEffect } from "react";
import { FaHeart, FaRegHeart } from "react-icons/fa";
import { ChatBubbleLeftIcon } from "@heroicons/react/24/outline";
import { useAuth } from "@/src/context/authContext";
import { toast } from "sonner";

function LikeBurst() {
  const particles = Array.from({ length: 8 });
  const colors = ["#EF4444", "#F43F5E", "#FB7185", "#FDA4AF"];
  return (
    <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
      {particles.map((_, i) => (
        <motion.div
          key={i}
          initial={{ x: 0, y: 0, scale: 0, opacity: 1, rotate: 0 }}
          animate={{
            x: Math.cos((i * 45) * Math.PI / 180) * 45,
            y: Math.sin((i * 45) * Math.PI / 180) * 45,
            scale: [0.2, 1.2, 0],
            opacity: [1, 1, 0],
            rotate: [0, 45, 90]
          }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="absolute"
        >
          <FaHeart size={8} style={{ color: colors[i % colors.length] }} />
        </motion.div>
      ))}
    </div>
  );
}

interface ReviewListModalProps {
  open: boolean;
  onClose: () => void;
  reviews: Review[];
  businessData: any;
  payload: any;
  onAddToCart: (e: React.MouseEvent) => void;
  onBuyNow: (e: React.MouseEvent) => void;
  onOpenChat?: () => void;
  onCartClick?: () => void;
  onShopClick?: () => void;
  cartCount: number;
}

export default function ReviewListModal({
  open,
  onClose,
  reviews,
  businessData,
  payload,
  onAddToCart,
  onBuyNow,
  onOpenChat,
  onCartClick,
  onShopClick,
  cartCount,
}: ReviewListModalProps) {
  const router = useRouter();
  const { user, token, ensureLoggedIn } = useAuth();
  const [localReviews, setLocalReviews] = useState(reviews);
  const [replyingTo, setReplyingTo] = useState<number | null>(null);
  const [replyText, setReplyText] = useState("");
  const [burstingReviewId, setBurstingReviewId] = useState<number | null>(null);
  const [isSubmittingReply, setIsSubmittingReply] = useState(false);

  useEffect(() => {
    setLocalReviews(reviews);
  }, [reviews]);

  const handleToggleLike = async (reviewId: number) => {
    if (ensureLoggedIn) {
      const loggedIn = await ensureLoggedIn();
      if (!loggedIn) return;
    }

    const review = localReviews.find(r => r.review_id === reviewId);
    if (!review) return;

    if (!review.liked_by_user) {
      setBurstingReviewId(reviewId);
      setTimeout(() => setBurstingReviewId(null), 800);
    }

    setLocalReviews(prev => prev.map(r =>
      r.review_id === reviewId
        ? {
          ...r,
          liked_by_user: !r.liked_by_user,
          likes_count: (r.likes_count || 0) + (r.liked_by_user ? -1 : 1)
        }
        : r
    ));

    try {
      await fetch(`${API_BASE_URL}/api/reviews/${reviewId}/like`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        }
      });
    } catch (err) {
      console.error("Like toggle failed", err);
    }
  };

  const handleAddReply = async (reviewId: number) => {
    if (!replyText.trim()) return;
    if (ensureLoggedIn) {
      const loggedIn = await ensureLoggedIn();
      if (!loggedIn) return;
    }

    setIsSubmittingReply(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/reviews/${reviewId}/reply`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ content: replyText })
      });

      if (!response.ok) throw new Error("Failed to reply");

      const json = await response.json();
      const newReply = json.data;

      setLocalReviews(prev => prev.map(r =>
        r.review_id === reviewId
          ? { ...r, replies: [...(r.replies || []), newReply] }
          : r
      ));
      setReplyText("");
      setReplyingTo(null);
      toast.success("Reply posted!");
    } catch (err) {
      console.error("Reply failed", err);
      toast.error("Failed to post reply");
    } finally {
      setIsSubmittingReply(false);
    }
  };

  const getRatingStatus = (rating: number) => {
    const r = Math.round(rating);
    if (r >= 5) return "Excellent";
    if (r >= 4) return "Great";
    if (r >= 3) return "Average";
    if (r >= 2) return "Poor";
    return "Dissatisfied";
  };

  const renderStars = (rating: number, size = "w-3 h-3") => {
    return (
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((s) => (
          s <= rating ? (
            <StarIconSolid key={s} className={`${size} text-red-600`} />
          ) : (
            <StarIcon key={s} className={`${size} text-slate-200`} />
          )
        ))}
      </div>
    );
  };

  const formatUrl = (url: string) => {
    if (!url) return "/assets/images/favio.png";
    let formatted = url;
    if (!url.startsWith("http")) {
      formatted = url.startsWith("/public") ? `${API_BASE_URL}${url}` : `${API_BASE_URL}/public/${url}`;
    }
    return encodeURI(formatted);
  };

  const stats = useMemo(() => {
    const counts: Record<number, number> = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    reviews.forEach(r => {
      const star = Math.floor(r.rating);
      if (star >= 1 && star <= 5) counts[star]++;
    });

    const total = reviews.length || 1;
    const sum = reviews.reduce((acc, r) => acc + r.rating, 0);
    const average = reviews.length > 0 ? (sum / reviews.length).toFixed(1) : "0.0";

    return {
      average,
      counts,
      percentages: {
        5: (counts[5] / total) * 100,
        4: (counts[4] / total) * 100,
        3: (counts[3] / total) * 100,
        2: (counts[2] / total) * 100,
        1: (counts[1] / total) * 100,
      }
    };
  }, [reviews]);



  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center overflow-hidden">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />

          {/* Modal Container */}
          <motion.div
            initial={{ y: "100%", opacity: 0.5 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "100%", opacity: 0 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="relative w-full h-full lg:h-[85vh] lg:max-w-2xl lg:rounded-xl flex flex-col bg-white overflow-hidden shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-4 border-b border-slate-50 flex-shrink-0 bg-white/80 backdrop-blur-md sticky top-0 z-10">
              <div className="flex items-center gap-4">
                <button
                  onClick={onClose}
                  className="w-10 h-10 -ml-2 flex items-center justify-center rounded-full hover:bg-slate-50 transition-colors"
                >
                  <XMarkIcon className="w-6 h-6 text-slate-800" />
                </button>
                <div>
                  <h2 className="text-lg font-extrabold text-slate-900 leading-tight text-center">Customer Reviews</h2>
                </div>
              </div>
            </div>

            {/* Rating Analysis */}
            <div className="p-4 bg-white border-slate-50 flex-shrink-0">
              <div className="flex items-start gap-8">
                {/* Average Display */}
                <div className="flex flex-col items-center justify-center py-2 min-w-[100px]">
                  <div className="text-5xl font-black text-slate-900 leading-none">
                    {stats.average}
                  </div>
                  {renderStars(Number(stats.average), "w-4 h-4")}
                  <div className="mt-3 text-[10px] font-bold text-slate-400  tracking-widest">
                    {reviews.length} Reviews
                  </div>
                </div>

                {/* Progress Bars */}
                <div className="flex-1 space-y-2">
                  {[5, 4, 3, 2, 1].map((star) => (
                    <div key={star} className="flex items-center gap-3">
                      <div className="flex items-center gap-1 min-w-[32px]">
                        <span className="text-xs font-bold text-slate-600">{star}</span>
                        <StarIconSolid className="w-2.5 h-2.5 text-slate-300" />
                      </div>
                      <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${stats.percentages[star as keyof typeof stats.percentages]}%` }}
                          className="h-full bg-red-600 rounded-full"
                          transition={{ duration: 0.8, ease: "easeOut" }}
                        />
                      </div>
                      <span className="text-[10px] font-bold text-slate-400 min-w-[28px] text-right">
                        {Math.round(stats.percentages[star as keyof typeof stats.percentages])}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-auto p-4 lg:p-6 space-y-10 pb-20">
              {localReviews.map((review) => (
                <div key={review.review_id} className="group">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-11 h-11 rounded-full overflow-hidden bg-slate-100 border border-slate-200 cursor-pointer ring-offset-2 ring-red-500 hover:ring-2 transition-all"
                        onClick={() => router.push(`/user/profile/${review.user_id}`)}
                      >
                        <img
                          src={formatUrl(review.profile_pic || "")}
                          alt={review.full_name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="min-w-0">
                        <div
                          className="text-[13px] font-bold text-slate-500 truncate cursor-pointer hover:text-red-600 transition-colors"
                          onClick={() => router.push(`/user/profile/${review.user_id}`)}
                        >
                          {review.full_name}
                        </div>
                        <div className="flex items-center gap-2.5 mt-1">
                          <span className="text-[10px] font-black bg-red-100 text-red-400  tracking-widest px-1.5 py-0.5 rounded">
                            {getRatingStatus(review.rating)}
                          </span>
                          {renderStars(review.rating, "w-3.5 h-3.5")}
                        </div>
                      </div>
                    </div>
                    <div className="text-[11px] text-slate-400 font-semibold bg-slate-50 px-2 py-1 rounded-full">
                      {new Date(review.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                    </div>
                  </div>
                  <div className="pl-[56px]">
                    <p className="text-[15px] text-slate-600 leading-relaxed font-medium mb-4">
                      {review.comment}
                    </p>

                    <div className="flex items-center h-8">
                      <button
                        onClick={() => setReplyingTo(replyingTo === review.review_id ? null : review.review_id)}
                        className="flex items-center gap-1.5 text-xs font-bold text-slate-400 hover:text-slate-600 transition-colors"
                      >
                        <ChatBubbleLeftIcon className="w-4 h-4" />
                        <span>Reply</span>
                      </button>

                      <button
                        onClick={() => handleToggleLike(review.review_id)}
                        className={`ml-auto flex items-center gap-1.5 text-xs font-bold transition-colors relative ${review.liked_by_user ? "text-red-500" : "text-slate-400 hover:text-slate-600"}`}
                      >
                        <div className="relative flex items-center justify-center">
                          {burstingReviewId === review.review_id && <LikeBurst />}
                          <AnimatePresence mode="wait">
                            <motion.div
                              key={review.liked_by_user ? "liked" : "unliked"}
                              initial={{ scale: 0.7, opacity: 0 }}
                              animate={{ scale: 1, opacity: 1 }}
                              exit={{ scale: 0.7, opacity: 0 }}
                            >
                              {review.liked_by_user ? <FaHeart className="w-4 h-4" /> : <FaRegHeart className="w-4 h-4" />}
                            </motion.div>
                          </AnimatePresence>
                        </div>
                        <span>{review.likes_count || 0}</span>
                      </button>
                    </div>

                    {/* Reply Input */}
                    <AnimatePresence>
                      {replyingTo === review.review_id && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="mt-4 overflow-hidden"
                        >
                          <div className="flex gap-3">
                            <div className="h-8 w-8 rounded-full overflow-hidden flex-shrink-0 bg-slate-100 border border-slate-200">
                              <img src={user?.profile_pic || "/assets/images/favio.png"} alt="User" className="w-full h-full object-cover" />
                            </div>
                            <div className="flex-1 space-y-2">
                              <textarea
                                autoFocus
                                value={replyText}
                                onChange={(e) => setReplyText(e.target.value)}
                                placeholder="Write a reply..."
                                className="w-full bg-slate-50 border border-slate-100 rounded-xl p-3 text-sm focus:outline-none focus:ring-1 focus:ring-red-500 resize-none"
                                rows={2}
                              />
                              <div className="flex justify-end gap-2">
                                <button
                                  onClick={() => setReplyingTo(null)}
                                  className="px-4 py-1.5 text-xs font-bold text-slate-500 hover:bg-slate-50 rounded-full transition-colors"
                                >
                                  Cancel
                                </button>
                                <button
                                  onClick={() => handleAddReply(review.review_id)}
                                  disabled={!replyText.trim() || isSubmittingReply}
                                  className="px-4 py-1.5 text-xs font-bold bg-red-600 text-white rounded-full hover:bg-red-700 disabled:opacity-50 transition-colors"
                                >
                                  {isSubmittingReply ? "Posting..." : "Post Reply"}
                                </button>
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Replies List */}
                    {review.replies && review.replies.length > 0 && (
                      <div className="mt-6 space-y-4 border-l-2 border-slate-50 pl-4">
                        {review.replies.map((reply) => (
                          <div key={reply.reply_id} className="flex items-start gap-3 group/reply">
                            <div className="h-8 w-8 rounded-full overflow-hidden flex-shrink-0 bg-slate-100 border border-slate-200">
                              <img src={formatUrl(reply.author_pic || "")} alt={reply.author_name} className="w-full h-full object-cover" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-0.5">
                                <span className="text-xs font-bold text-slate-800">{reply.author_name}</span>
                                {Number(reply.user_id) === Number(businessData?.business?.user_id) && (
                                  <span className="text-[8px] font-black bg-red-50 text-red-600 px-1 py-0.5 rounded tracking-tighter">Vendor</span>
                                )}
                                <span className="text-[10px] text-slate-400 font-medium ml-auto">
                                  {new Date(reply.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                </span>
                              </div>
                              <p className="text-sm text-slate-600 leading-relaxed font-medium">
                                {reply.reply_content}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Sticky Action Bar */}
            <div className="mt-auto bg-white border-slate-100 p-1 lg:rounded-b-3xl overflow-hidden">
              <ActionBar
                onAddToCart={onAddToCart}
                onBuyNow={onBuyNow}
                onOpenChat={onOpenChat}
                onCartClick={onCartClick}
                onShopClick={onShopClick}
                cartCount={cartCount}
                shopLogo={businessData?.business?.logo}
                shopProfilePic={businessData?.business?.profile_pic}
                businessId={payload?.businessId}
              />
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
