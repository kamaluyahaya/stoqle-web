"use client";

import React, { createContext, useContext, useEffect, useState, useRef } from "react";
import { io, Socket } from "socket.io-client";
import { useAuth } from "./authContext";
import { API_BASE_URL } from "@/src/lib/config";
import { isOffline, safeFetch } from "@/src/lib/api/handler";

type ChatContextType = {
    unreadCount: number;
    refreshUnread: () => Promise<void>;
};

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export function ChatProvider({ children }: { children: React.ReactNode }) {
    const { user, token } = useAuth();
    const [unreadCount, setUnreadCount] = useState(0);
    const socketRef = useRef<Socket | null>(null);

    const fetchUnreadCount = async () => {
        const userId = user?.user_id || user?.id;
        if (!token) {
            setUnreadCount(0);
            return;
        }
        // Skip fetch when offline — keep existing count
        if (isOffline()) return;
        try {
            const data = await safeFetch("/api/chat/room", {
                headers: { Authorization: `Bearer ${token}` },
            });
            const rooms = data?.rooms || data?.chatRooms || data?.data || data || [];

            if (Array.isArray(rooms)) {
                const total = rooms.reduce((acc: number, room: any) => {
                    // Favor the dedicated unread_count field from backend
                    if (room.unread_count !== undefined) {
                        return acc + Number(room.unread_count);
                    }
                    // Fallback for rooms without the field
                    if (room.is_read === 0 && String(room.sender_id) !== String(userId)) {
                        return acc + 1;
                    }
                    return acc;
                }, 0);
                setUnreadCount(total);
            }
        } catch (err) {
            // Silent — keep existing unread count
        }
    };

    useEffect(() => {
        if (user && token) {
            fetchUnreadCount();

            const userId = user.user_id || user.id;
            if (userId) {
                const socket = io(API_BASE_URL, {
                    query: { userId },
                    // Resilient reconnection config
                    reconnection: true,
                    reconnectionAttempts: Infinity,
                    reconnectionDelay: 2000,
                    reconnectionDelayMax: 30000,
                    timeout: 10000,
                });
                socketRef.current = socket;

                socket.on("connect", () => {
                    // Refresh unread on reconnect to catch missed messages
                    fetchUnreadCount();
                });

                socket.on("connect_error", () => {
                    // Silent — socket.io auto-reconnects
                });

                const handleNewMessage = (msg: any) => {
                    // Only increment if we are not the sender
                    if (String(msg.sender_id) !== String(userId)) {
                        setUnreadCount(prev => prev + 1);
                    }
                };

                socket.on("chat:message", handleNewMessage);
                socket.on("chat:file", handleNewMessage);

                // Listen for both message-specific and room-wide read events
                socket.on("chat:message:read", () => fetchUnreadCount());
                socket.on("chat:room:read", () => fetchUnreadCount());

                return () => {
                    socket.disconnect();
                };
            }
        } else {
            setUnreadCount(0);
        }
    }, [user, token]);

    return (
        <ChatContext.Provider value={{ unreadCount, refreshUnread: fetchUnreadCount }}>
            {children}
        </ChatContext.Provider>
    );
}

export function useChat() {
    const context = useContext(ChatContext);
    if (context === undefined) {
        throw new Error("useChat must be used within a ChatProvider");
    }
    return context;
}
