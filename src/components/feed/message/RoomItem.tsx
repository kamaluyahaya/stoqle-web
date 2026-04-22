"use client";

import React from "react";
import { motion } from "framer-motion";

type RoomItemProps = {
    room: {
        chat_room_id: string | number;
        other_user_id?: string | number;
        other_stoqle_id?: string | number;
        full_name?: string;
        profile_pic?: string;
        business_name?: string | null;
        business_logo?: string | null;
        message_content?: string | null;
        sent_at?: string | null;
        last_message?: any;
        last_message_time?: string | null;
        updated_at?: string | null;
    };
    unread: number;
    active: boolean;
    onClick: () => void;
    onAvatarClick?: (userId: string | number, avatarUrl: string, name: string) => void;
    vendorBadge?: { verified_badge: boolean; badge_label?: string | null };
};

import { VerifiedBadge } from "@/src/components/common/VerifiedBadge";

export const RoomItem: React.FC<RoomItemProps> = ({
    room,
    unread,
    active,
    onClick,
    onAvatarClick,
    vendorBadge
}) => {
    const displayName = room.business_name || room.full_name || (room.other_stoqle_id ? `Stoqle ID: ${room.other_stoqle_id}` : `ID: ${room.other_user_id}`);
    const avatarSrc = room.business_logo || room.profile_pic;
    const timestamp = room.sent_at || room.last_message_time || room.updated_at;
    const preview = room.message_content || room.last_message?.message_content || "No messages yet";

    return (
        <motion.div
            onClick={onClick}
            whileHover={{ scale: 1.01, x: 2 }}
            whileTap={{ scale: 0.98 }}
            className={`flex items-center p-3.5 rounded-[1.25rem] cursor-pointer transition-all duration-300 gap-3 group relative ${active
                ? "bg-white shadow-xl shadow-slate-200/50 ring-1 ring-slate-100 z-10"
                : "hover:bg-white/50 border border-transparent hover:border-slate-100"
                }`}
        >
            <div className="relative flex-shrink-0">
                <div
                    className="relative cursor-pointer transition-transform duration-200 hover:scale-105 active:scale-95"
                    onClick={(e) => {
                        e.stopPropagation();
                        onAvatarClick?.(room.other_user_id || 0, avatarSrc || "", displayName);
                    }}
                >
                    {avatarSrc ? (
                        <img
                            src={avatarSrc}
                            alt={displayName}
                            className={`w-12 h-12 rounded-full object-cover shadow-sm transition-all duration-500 ${active ? "ring-2 ring-rose-500 ring-offset-2" : "border-2 border-white"
                                }`}
                        />
                    ) : (
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg text-white shadow-md transition-all duration-300 ${active ? "bg-rose-500 scale-105" : "bg-slate-200 group-hover:bg-slate-300"
                            }`}>
                            {displayName.charAt(0).toUpperCase()}
                        </div>
                    )}
                    {active && (
                        <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-green-500 rounded-full border-2 border-white shadow-sm" />
                    )}
                </div>
                {unread > 0 && (
                    <span className="absolute -top-1 -right-1 bg-rose-500 text-white text-[10px] font-black w-5 h-5 flex items-center justify-center rounded-full border-2 border-white ring-2 ring-rose-50">
                        {unread}
                    </span>
                )}
            </div>

            <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 mb-0.5">
                    <div className="flex items-center gap-1 min-w-0">
                        <p className={`font-black text-sm truncate tracking-tight transition-colors ${active ? "text-slate-900" : "text-slate-700"
                            }`}>
                            {displayName}
                        </p>
                        {!!vendorBadge?.verified_badge && (
                            <VerifiedBadge size="xs" label={vendorBadge.badge_label} className="shrink-0" />
                        )}
                    </div>
                    {timestamp && (
                        <span className={`text-[10px] font-bold flex-shrink-0 tabular-nums ${active ? "text-rose-500" : "text-slate-400"
                            }`}>
                            {new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                    )}
                </div>
                <div className="flex items-center justify-between gap-2">
                    <p className={`text-[11px] truncate font-medium leading-tight ${active ? "text-slate-600" : "text-slate-400"
                        }`}>
                        {preview}
                    </p>
                    {unread > 0 && !active && (
                        <div className="w-2 h-2 rounded-full bg-rose-500 shrink-0 shadow-sm shadow-rose-500/50" />
                    )}
                </div>
            </div>

            {active && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-rose-500 rounded-r-full shadow-sm" />
            )}
        </motion.div>
    );
};
