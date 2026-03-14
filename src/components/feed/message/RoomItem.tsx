"use client";

import React from "react";

type RoomItemProps = {
    room: {
        chat_room_id: string | number;
        other_user_id?: string | number;
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
};

export const RoomItem: React.FC<RoomItemProps> = ({
    room,
    unread,
    active,
    onClick,
}) => {
    const displayName = room.business_name || room.full_name || `stoqleID ${room.other_user_id}`;
    const avatarSrc = room.business_logo || room.profile_pic;
    const timestamp = room.sent_at || room.last_message_time || room.updated_at;
    const preview = room.message_content || room.last_message?.message_content || "No messages yet";
    return (
        <div
            onClick={onClick}
            className={`flex items-center p-3 rounded-xl cursor-pointer transition-all duration-200 hover:bg-red-50 group ${active ? "bg-red-50 ring-1 ring-red-100 shadow-sm" : ""
                }`}
        >
            <div className="relative flex-shrink-0">
                {avatarSrc ? (
                    <img
                        src={avatarSrc}
                        alt={displayName}
                        className="w-12 h-12 rounded-full object-cover shadow-sm border border-gray-100"
                    />
                ) : (
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg text-white shadow-md transition-transform group-hover:scale-105 ${active ? "bg-red-500" : "bg-gray-300 group-hover:bg-red-400"
                        }`}>
                        {displayName.charAt(0).toUpperCase()}
                    </div>
                )}
                {unread > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-600 text-white text-[10px] font-bold w-5 h-5 flex items-center justify-center rounded-full border-2 border-white animate-pulse">
                        {unread}
                    </span>
                )}
            </div>

            <div className="ml-3 flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                    <p className={`font-semibold text-sm truncate ${active ? "text-red-900" : "text-gray-900"}`}>
                        {displayName}
                    </p>
                    {timestamp && (
                        <span className="text-[10px] text-gray-400 flex-shrink-0">
                            {new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                    )}
                </div>
                <p className={`text-xs truncate mt-0.5 ${active ? "text-red-600" : "text-gray-500"}`}>
                    {preview}
                </p>
            </div>

            {active && (
                <div className="ml-2 w-1.5 h-1.5 rounded-full bg-red-500" />
            )}
        </div>
    );
};
