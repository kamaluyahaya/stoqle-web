"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Star, ShoppingBag, Store, ChevronRight, X } from "lucide-react";

type QuickActionsProps = {
    onRate: (score: number, label: string) => void;
    onSendItem: (tab: 'view' | 'cart' | 'shop') => void;
    isBusiness: boolean;
};

export const MessagingQuickActions: React.FC<QuickActionsProps> = ({
    onRate,
    onSendItem,
    isBusiness
}) => {
    const [showRating, setShowRating] = useState(false);

    if (!isBusiness) return null;

    const ratings = [
        { label: "Worst", emoji: "😭", score: 1 },
        { label: "Poor", emoji: "😞", score: 2 },
        { label: "Average", emoji: "😐", score: 3 },
        { label: "Good", emoji: "😊", score: 4 },
        { label: "Perfect", emoji: "🤩", score: 5 },
    ];

    return (
        <div className=" px-4 flex flex-col gap-2 w-full animate-in fade-in slide-in-from-bottom-2">
            <AnimatePresence mode="wait">
                {!showRating ? (
                    <motion.div
                        key="actions"
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 10 }}
                        className="flex items-center gap-3 overflow-x-auto no-scrollbar pb-1"
                    >
                        <span className="text-[10px] font-black text-slate-400 shrink-0">I want to</span>

                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setShowRating(true)}
                                className="flex items-center gap-2 px-4 py-2 rounded-full bg-white border border-slate-100  hover:border-rose-200 hover:bg-rose-50 text-slate-600 transition-all active:scale-95 whitespace-nowrap"
                            >
                                <span className="text-[10px] font-bold">Rate service</span>
                            </button>

                            <button
                                onClick={() => onSendItem('view')}
                                className="flex items-center gap-2 px-4 py-2 rounded-full bg-white border border-slate-100  hover:border-rose-200 hover:bg-rose-50 text-slate-600 transition-all active:scale-95 whitespace-nowrap"
                            >
                                <span className="text-[10px] font-bold">Send item</span>
                            </button>

                            <button
                                onClick={() => onSendItem('shop')}
                                className="flex items-center gap-2 px-4 py-2 rounded-full bg-white border border-slate-100  hover:border-rose-200 hover:bg-rose-50 text-slate-600 transition-all active:scale-95 whitespace-nowrap"
                            >
                                <span className="text-[10px] font-bold">Shop items</span>
                            </button>
                        </div>
                    </motion.div>
                ) : (
                    <motion.div
                        key="rating"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="flex flex-col items-center gap-4 w-full bg-white border border-slate-100 p-4 rounded-[0.5rem] relative"
                    >
                        <button
                            onClick={() => setShowRating(false)}
                            className="absolute top-3 right-3 p-1.5 rounded-full hover:bg-slate-50 text-slate-400 transition-colors"
                        >
                            <X size={14} />
                        </button>

                        <div className="text-center space-y-1">
                            <p className="text-[12px] lg:text-sm text-slate-800">Are you satisfied with the customer service?</p>
                        </div>

                        <div className="w-full flex items-center justify-around px-2">
                            {ratings.map((r) => (
                                <button
                                    key={r.label}
                                    onClick={() => {
                                        onRate(r.score, r.label);
                                        setShowRating(false);
                                    }}
                                    className="flex flex-col items-center gap-1 group active:scale-90 transition-transform"
                                >
                                    <span className="text-xl">{r.emoji}</span>
                                    <span className="text-[8px] text-slate-400 group-hover:text-rose-500 transition-colors">{r.label}</span>
                                </button>
                            ))}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};
