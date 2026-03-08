"use client";

import React, { createContext, useContext, useEffect, useState, useRef } from "react";
import { io, Socket } from "socket.io-client";
import { useAuth } from "./authContext";
import { API_BASE_URL } from "@/src/lib/config";

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
        if (!token) {
            setUnreadCount(0);
            return;
        }
        try {
            const res = await fetch(`${API_BASE_URL}/api/chat/room`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            const data = await res.json();
            const rooms = data?.rooms || data?.chatRooms || data?.data || data || [];

            if (Array.isArray(rooms)) {
                const total = rooms.reduce((acc: number, room: any) => {
                    // Check for unread_count or is_read on last message
                    if (room.unread_count) return acc + Number(room.unread_count);
                    if (room.is_read === 0 || room.is_read === false) return acc + 1;
                    return acc;
                }, 0);
                setUnreadCount(total);
            }
        } catch (err) {
            console.warn("fetchUnreadCount failed", err);
        }
    };

    useEffect(() => {
        if (user && token) {
            fetchUnreadCount();

            const userId = user.user_id || user.id;
            if (userId) {
                const socket = io(API_BASE_URL, { query: { userId } });
                socketRef.current = socket;

                const handleNewMessage = (msg: any) => {
                    // Only increment if we are not on the messages page (or let the page handle it)
                    // Actually, we can just fetchUnreadCount again or increment
                    // To be safe and simple, let's just re-fetch or increment
                    if (String(msg.sender_id) !== String(userId)) {
                        setUnreadCount(prev => prev + 1);
                    }
                };

                socket.on("chat:message", handleNewMessage);
                socket.on("chat:file", handleNewMessage);

                // When a message is read, we might want to decrement
                // But it's easier to just re-fetch when needed or listen for read events
                socket.on("chat:message:read", () => {
                    fetchUnreadCount();
                });

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
