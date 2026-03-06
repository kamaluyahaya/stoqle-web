"use client";

import { API_BASE_URL } from "@/src/lib/config";
import React, { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import { useAuth } from "@/src/context/authContext";
import { useSearchParams } from "next/navigation";
import { RoomItem, ChatBubble, MessageInput, MessageWelcome } from "@/src/components/feed/message";

type ChatRoom = {
  chat_room_id: string | number;
  user1_id?: string | number;
  user2_id?: string | number;
  other_user_id?: string | number;
  full_name?: string;
  profile_pic?: string;
  business_name?: string | null;
  business_logo?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  message_content?: string | null;
  sent_at?: string | null;
  last_message?: { message_content?: string } | null;
  last_message_time?: string | null;
  preview?: string;
};

type Message = {
  message_id?: string | number;
  chat_room_id: string | number;
  sender_id: string | number;
  sender_name?: string;
  sender_profile_pic?: string;
  message_content?: string;
  message_type?: "text" | "file" | string;
  is_read?: number | boolean;
  sent_at?: string | null;
  file?: { file_id?: string | number; file_url?: string } | any;
  file_url?: string | null;
  file_type?: string | null;
};

function MessagesPageContent({
  userIdProp = null,
}: {
  userIdProp?: string | null;
}) {
  const auth = useAuth();
  const ctxUserId = auth?.user?.user_id || auth?.user?.id;
  const savedUserId = typeof window !== "undefined" ? localStorage.getItem("userId") : null;
  const userId = String(userIdProp ?? ctxUserId ?? savedUserId ?? "150");
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
  const searchParams = useSearchParams();
  const roomParam = searchParams.get("room");
  const userParam = searchParams.get("user");

  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<ChatRoom | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [unreadMap, setUnreadMap] = useState<Record<string | number, number>>({});
  const socketRef = useRef<Socket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const prevRoomIdRef = useRef<string | number | null>(null);
  const [query, setQuery] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);

  const headers = token ? { Authorization: `Bearer ${token}` } : ({} as Record<string, string>);

  function scrollToBottom(behavior: ScrollBehavior = "smooth") {
    messagesEndRef.current?.scrollIntoView({ behavior });
  }

  // ---------- API calls ----------

  async function fetchRooms() {
    try {
      const res = await fetch(`${API_BASE_URL}/api/chat/room`, { headers });
      const data = await res.json();
      const list = data?.rooms || data?.chatRooms || data?.data || data || [];
      const roomsList = Array.isArray(list) ? list : [];

      // Initialize unreadMap from the API data
      const initialUnread: Record<string | number, number> = {};
      roomsList.forEach((r: any) => {
        // Assume API provides unread_count or is_read on latest message
        if (r.unread_count !== undefined) {
          initialUnread[r.chat_room_id] = Number(r.unread_count);
        } else if (r.is_read === 0 && String(r.sender_id) !== String(userId)) {
          initialUnread[r.chat_room_id] = 1;
        }
      });
      setUnreadMap(initialUnread);
      setRooms(roomsList);
    } catch (err) {
      console.warn("fetchRooms", err);
      setRooms([]);
    }
  }

  async function fetchMessages(chat_room_id: string | number) {
    try {
      const res = await fetch(`${API_BASE_URL}/api/chat/messages/${chat_room_id}`, { headers });
      const data = await res.json();
      const list = data?.messages || data?.chatMessages || data?.data || data || [];
      setMessages(Array.isArray(list) ? list : []);
      setUnreadMap((p) => ({ ...p, [chat_room_id]: 0 }));

      // Jump instantly to bottom when first opening room
      setTimeout(() => scrollToBottom("auto"), 30);
    } catch (err) {
      console.warn("fetchMessages", err);
      setMessages([]);
    }
  }

  async function handleSend() {
    if ((!newMessage.trim() && !selectedFile) || !selectedRoom || isSending) return;
    setIsSending(true);

    // 1. Optimistic Update (Immediate Feedback)
    const tempId = Date.now();
    const optimisticMsg: Message = {
      message_id: tempId,
      chat_room_id: selectedRoom.chat_room_id,
      sender_id: userId,
      message_content: newMessage.trim(),
      message_type: selectedFile ? "file" : "text",
      sent_at: new Date().toISOString(),
      file_url: filePreview, // Show local DataURL/Blob instantly 
      file_type: selectedFile?.type
    };

    setMessages(prev => [...prev, optimisticMsg]);

    // Cache inputs before clearing for API call
    const savedContent = newMessage.trim();
    const savedFile = selectedFile;
    setNewMessage("");
    setSelectedFile(null);
    setFilePreview(null);
    scrollToBottom("smooth");

    try {
      let finalMessage: Message;

      if (savedFile) {
        const formData = new FormData();
        formData.append("file", savedFile);
        formData.append("chat_room_id", String(selectedRoom.chat_room_id));
        if (savedContent) formData.append("message_content", savedContent);

        const res = await fetch(`${API_BASE_URL}/api/chat/upload`, {
          method: "POST",
          headers,
          body: formData,
        });
        const data = await res.json();
        if (!res.ok) throw new Error("Upload failed");

        const msgObj = data.data || (typeof data.message === 'object' ? data.message : data);
        finalMessage = {
          ...msgObj,
          sender_id: msgObj.sender_id || Number(userId),
          sent_at: msgObj.sent_at || new Date().toISOString(),
          message_content: msgObj.message_content || savedContent,
          // Check common API fields for file URL
          file_url: msgObj.file_url || msgObj.file?.file_url || data.file_url || msgObj.url,
          file_type: msgObj.file_type || msgObj.file?.file_type || data.file_type || msgObj.type
        };
      } else {
        const payload = {
          chat_room_id: selectedRoom.chat_room_id,
          message_content: savedContent,
          message_type: "text",
        };
        const res = await fetch(`${API_BASE_URL}/api/chat/message`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...headers },
          body: JSON.stringify(payload),
        });
        const data = await res.json();

        const msgObj = data.data || (typeof data.message === 'object' ? data.message : data);
        finalMessage = {
          ...msgObj,
          sender_id: msgObj.sender_id || Number(userId),
          sent_at: msgObj.sent_at || new Date().toISOString(),
          message_content: msgObj.message_content || payload.message_content
        };
      }

      // 2. Synchronize with real server data
      setMessages(p => p.map(m => m.message_id === tempId ? finalMessage : m));

      // 3. Update room position in sidebar
      setRooms((p) => {
        const otherRooms = p.filter((r) => String(r.chat_room_id) !== String(selectedRoom.chat_room_id));
        const updatedRoom = {
          ...selectedRoom,
          message_content: finalMessage.message_content || (savedFile ? "Shared a file" : ""),
          sent_at: finalMessage.sent_at,
          updated_at: finalMessage.sent_at
        };
        return [updatedRoom, ...otherRooms];
      });
    } catch (err) {
      console.warn("handleSend", err);
      // Rollback on error
      setMessages(prev => prev.filter(m => m.message_id !== tempId));
    } finally {
      setIsSending(false);
    }
  }

  async function markMessageAsRead(message_id?: string | number) {
    if (!message_id) return;
    try {
      await fetch(`${API_BASE_URL}/api/chat/mark-as-read/${message_id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...headers },
      });
      setMessages((prev) => prev.map((m) => (String(m.message_id) === String(message_id) ? { ...m, is_read: 1 } : m)));
    } catch (err) {
      console.warn("markMessageAsRead", err);
    }
  }

  function handleFile(file: File | null) {
    if (!file) return;
    setSelectedFile(file);
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onloadend = () => setFilePreview(reader.result as string);
      reader.readAsDataURL(file);
    } else {
      setFilePreview(null);
    }
  }

  // ---------- Sockets ----------
  useEffect(() => {
    if (!userId) return;
    const socket = io(API_BASE_URL, { query: { userId } });
    socketRef.current = socket;

    socket.on("chat:message", (msg: Message) => {
      // Update sidebar
      setRooms((p) => {
        const targetRoom = p.find((r) => String(r.chat_room_id) === String(msg.chat_room_id));
        const otherRooms = p.filter((r) => String(r.chat_room_id) !== String(msg.chat_room_id));
        const updatedRoom = targetRoom
          ? { ...targetRoom, message_content: msg.message_content, sent_at: msg.sent_at, updated_at: msg.sent_at }
          : {
            chat_room_id: msg.chat_room_id,
            other_user_id: msg.sender_id,
            full_name: msg.sender_name || `User ${msg.sender_id}`,
            business_name: (msg as any).business_name,
            business_logo: (msg as any).business_logo,
            message_content: msg.message_content,
            sent_at: msg.sent_at,
            updated_at: msg.sent_at
          };
        return [updatedRoom as ChatRoom, ...otherRooms];
      });

      if (selectedRoom && String(msg.chat_room_id) === String(selectedRoom.chat_room_id)) {
        setMessages((p) => {
          if (p.find(m => String(m.message_id) === String(msg.message_id))) return p;
          return [...p, msg];
        });
        if (String(msg.sender_id) !== String(userId)) markMessageAsRead(msg.message_id);
      } else {
        setUnreadMap((p) => ({ ...p, [msg.chat_room_id]: (p[msg.chat_room_id] || 0) + 1 }));
      }
    });

    socket.on("chat:file", (payload: any) => {
      setRooms((p) => {
        const targetRoom = p.find((r) => String(r.chat_room_id) === String(payload.chat_room_id));
        const otherRooms = p.filter((r) => String(r.chat_room_id) !== String(payload.chat_room_id));
        const updatedRoom = targetRoom
          ? { ...targetRoom, message_content: "Shared a file", sent_at: payload.sent_at, updated_at: payload.sent_at }
          : {
            chat_room_id: payload.chat_room_id,
            other_user_id: payload.sender_id,
            full_name: payload.sender_name,
            business_name: payload.business_name,
            business_logo: payload.business_logo,
            message_content: "Shared a file",
            sent_at: payload.sent_at,
            updated_at: payload.sent_at
          };
        return [updatedRoom as ChatRoom, ...otherRooms];
      });

      if (selectedRoom && String(payload.chat_room_id) === String(selectedRoom.chat_room_id)) {
        setMessages((p) => {
          if (p.find(m => String(m.message_id) === String(payload.message_id))) return p;
          return [...p, payload];
        });
        if (String(payload.sender_id) !== String(userId)) markMessageAsRead(payload.message_id);
      } else {
        setUnreadMap((p) => ({ ...p, [payload.chat_room_id]: (p[payload.chat_room_id] || 0) + 1 }));
      }
    });

    socket.on("chat:message:read", (data: any) => {
      setMessages((p) => p.map((m) => (String(m.message_id) === String(data.message_id) ? { ...m, is_read: 1 } : m)));
    });

    return () => { socket.disconnect(); };
  }, [userId, selectedRoom]);

  // Initial load
  useEffect(() => { fetchRooms(); }, []);

  // Handle URL parameters (room or user)
  useEffect(() => {
    if (rooms.length === 0) return;

    if (roomParam) {
      const room = rooms.find(r => String(r.chat_room_id) === String(roomParam));
      if (room) setSelectedRoom(room);
    } else if (userParam) {
      const room = rooms.find(r => String(r.other_user_id) === String(userParam));
      if (room) {
        setSelectedRoom(room);
      } else {
        // Try creating/fetching room for this user
        (async () => {
          try {
            const res = await fetch(`${API_BASE_URL}/api/chat/create`, {
              method: "POST",
              headers: { "Content-Type": "application/json", ...headers },
              body: JSON.stringify({ other_user_id: userParam })
            });
            const data = await res.json();
            const newRoom = data.data || data;
            if (newRoom && newRoom.chat_room_id) {
              setRooms(prev => [newRoom, ...prev]);
              setSelectedRoom(newRoom);
            }
          } catch (e) { console.warn("Auto-init room failed", e); }
        })();
      }
    }
  }, [rooms.length, roomParam, userParam]);

  // Fetch messages on room selection
  useEffect(() => {
    if (selectedRoom) fetchMessages(selectedRoom.chat_room_id);
  }, [selectedRoom]);

  // Scroll to bottom on messages change
  useEffect(() => {
    // If we just switched rooms, jump instantly
    if (selectedRoom?.chat_room_id !== prevRoomIdRef.current) {
      scrollToBottom("auto");
      prevRoomIdRef.current = selectedRoom?.chat_room_id || null;
    } else {
      // If adding a message to the SAME room, smooth scroll
      scrollToBottom("smooth");
    }
  }, [messages, selectedRoom?.chat_room_id]);

  const filtered = rooms.filter((r) => {
    const searchStr = query.toLowerCase();
    const nameMatch = r.full_name?.toLowerCase().includes(searchStr) ||
      r.business_name?.toLowerCase().includes(searchStr);
    const messageMatch = (r.preview || r.last_message?.message_content || r.message_content || "").toLowerCase().includes(searchStr);
    const idMatch = String(r.other_user_id || "").includes(searchStr);
    return nameMatch || messageMatch || idMatch;
  });

  const formatDateLabel = (dateStr: string | null) => {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);
    if (d.toDateString() === today.toDateString()) return "Today";
    if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  };

  return (
    <div className="fixed inset-0 bg-slate-100 lg:pl-[310px] overflow-hidden">
      <div className="flex h-[calc(100vh-64px)] mt-[64px] overflow-hidden">
        <aside className={`${selectedRoom ? 'hidden md:flex' : 'flex'} w-full md:w-[380px] flex-col bg-slate-100 border-r border-gray-100`}>
          <div className="p-6 pb-2 shrink-0">
            <div className="flex items-center justify-between mb-6">
              <h1 className="text-2xl font-bold text-gray-900">Messages</h1>
              <button onClick={fetchRooms} className="p-2 rounded-full hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
            </div>
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search conversations..." className="w-full bg-white pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:ring-2 focus:ring-red-100 focus:border-red-500 outline-none shadow-sm" />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1 custom-scrollbar">
            {filtered.map((room) => (
              <RoomItem key={String(room.chat_room_id)} room={room as any} unread={unreadMap[room.chat_room_id] || 0} active={!!(selectedRoom && String(selectedRoom.chat_room_id) === String(room.chat_room_id))} onClick={() => setSelectedRoom(room)} />
            ))}
          </div>
        </aside>

        <main className={`${selectedRoom ? 'flex' : 'hidden md:flex'} flex-1 flex-col bg-white border-l border-slate-200`}>
          {!selectedRoom ? <MessageWelcome /> : (
            <div className="flex-1 flex flex-col relative overflow-hidden">
              <header className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-white/80 backdrop-blur-md z-10 shrink-0">
                <div className="flex items-center gap-3">
                  <button onClick={() => setSelectedRoom(null)} className="md:hidden p-2 -ml-2 rounded-full hover:bg-gray-100 text-gray-400 hover:text-red-500">
                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                  </button>
                  {/* Logic: business_logo || profile_pic */}
                  {selectedRoom.business_logo || selectedRoom.profile_pic ? (
                    <img src={selectedRoom.business_logo || selectedRoom.profile_pic} className="w-10 h-10 rounded-full object-cover" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-red-500 flex items-center justify-center text-white font-bold">
                      {(selectedRoom.business_name || selectedRoom.full_name || "U").charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <h3 className="font-bold text-gray-900">{selectedRoom.business_name || selectedRoom.full_name || "User"}</h3>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
                      <span className="text-xs text-gray-400 font-medium">Online</span>
                    </div>
                  </div>
                </div>
              </header>

              <div className="flex-1 overflow-y-auto px-6 py-8 space-y-2 custom-scrollbar">
                {messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full opacity-40 py-20">
                    <p className="text-sm font-medium">No messages yet. Say hello!</p>
                  </div>
                ) : (
                  <div className="flex flex-col">
                    {messages.map((m, idx) => {
                      const prevMsg = messages[idx - 1];
                      const currDateString = m.sent_at ? new Date(m.sent_at).toDateString() : "";
                      const prevDateString = prevMsg?.sent_at ? new Date(prevMsg.sent_at).toDateString() : "";
                      const showDateHeader = currDateString !== prevDateString;
                      return (
                        <React.Fragment key={m.message_id || m.sent_at || idx}>
                          {showDateHeader && (
                            <div className="flex justify-center my-6 sticky top-1 z-10">
                              <span className="px-4 py-1.5 bg-gray-100/80 backdrop-blur-sm text-[11px] font-bold text-gray-500 rounded-full shadow-sm border border-gray-200/50 uppercase tracking-widest">
                                {formatDateLabel(m.sent_at || null)}
                              </span>
                            </div>
                          )}
                          <ChatBubble mine={String(m.sender_id) === String(userId)} content={m.message_content} sentAt={m.sent_at} senderName={m.sender_name} isRead={m.is_read} messageType={m.message_type} file={m.file} fileUrl={m.file_url} fileType={m.file_type} />
                        </React.Fragment>
                      );
                    })}
                    <div ref={messagesEndRef} className="h-1" />
                  </div>
                )}
              </div>

              <div className="p-4 bg-white/50 backdrop-blur-sm border-t border-gray-100 shrink-0">
                <MessageInput value={newMessage} onChange={setNewMessage} onSend={handleSend} onFileSelect={handleFile} isSending={isSending} selectedFile={selectedFile} filePreview={filePreview} onCancelFile={() => { setSelectedFile(null); setFilePreview(null); }} />
              </div>
            </div>
          )}
        </main>
      </div>

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar { width: 5px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #cbd5e1; }
      `}</style>
    </div>
  );
}

export default function MessagesPage(props: any) {
  return (
    <React.Suspense fallback={null}>
      <MessagesPageContent {...props} />
    </React.Suspense>
  );
}
