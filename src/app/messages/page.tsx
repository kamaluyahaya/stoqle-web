"use client";

import { API_BASE_URL } from "@/src/lib/config";
import React, { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";

type ChatRoom = {
  chat_room_id: string | number;
  user1_id: string | number;
  user2_id: string | number;
  created_at?: string | null;
  updated_at?: string | null;
  last_message?: { message_content?: string } | null;
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
  file?: { file_id?: string | number; file_url?: string } | null;
};

export default function MessagesPage({
  userIdProp = null,
}: {
  userIdProp?: string | null;
}) {
  // FRONTEND current user (keeps using localStorage for convenience/testing).
  // Server-side auth middleware should set req.user.user_id; frontend omits sender_id when sending.
  const savedUserId = typeof window !== "undefined" ? localStorage.getItem("userId") : null;
  const userId = String(userIdProp ?? savedUserId ?? "150"); // change/remove fallback in prod
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;

  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<ChatRoom | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [unreadMap, setUnreadMap] = useState<Record<string | number, number>>({});
  const socketRef = useRef<Socket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const [query, setQuery] = useState("");
  const [isSending, setIsSending] = useState(false);

  // debugging (optional)
  const [lastNetwork, setLastNetwork] = useState<any>(null);
  const headers = token ? { Authorization: `Bearer ${token}` } : ({} as Record<string, string>);

  // ---------- API calls that match your backend ----------

  // GET /api/chat/room  (authenticated) -> expected: array of rooms or { rooms: [...] }
  async function fetchRooms() {
    try {
      const res = await fetch(`${API_BASE_URL}/api/chat/room`, { headers });
      const text = await res.text();
      let data: any;
      try { data = text ? JSON.parse(text) : null; } catch { data = text; }
      setLastNetwork({ path: "/api/chat/room", status: res.status, body: data });

      if (!res.ok) {
        setRooms([]);
        return;
      }
      // normalize
      const list = data?.rooms || data?.chatRooms || data?.data || data || [];
      setRooms(Array.isArray(list) ? list : []);
    } catch (err) {
      console.warn("fetchRooms", err);
      setRooms([]);
    }
  }

  // POST /api/chat/create  body { user1_id, user2_id }  -> { message, chatRoom }
  async function createRoomWith(otherUserId: string | number) {
    try {
      const payload = { user1_id: Number(userId), user2_id: Number(otherUserId) };
      const res = await fetch(`${API_BASE_URL}/api/chat/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      setLastNetwork({ path: "/api/chat/create", status: res.status, body: data });

      if (!res.ok) throw new Error(`Create room failed: ${res.status}`);
      // normalize chatRoom
      const room = data.chatRoom || data.data || data;
      if (room) {
        setRooms((p) => {
          // dedupe
          if (p.find((r) => String(r.chat_room_id) === String(room.chat_room_id))) return p;
          return [room, ...p];
        });
        return room as ChatRoom;
      }
      return null;
    } catch (err) {
      console.warn("createRoomWith", err);
      return null;
    }
  }

  // GET /api/chat/messages/:chat_room_id -> { messages: [...] }
  async function fetchMessages(chat_room_id: string | number) {
    try {
      const res = await fetch(`${API_BASE_URL}/api/chat/messages/${chat_room_id}`, { headers });
      const data = await res.json();
      setLastNetwork({ path: `/api/chat/messages/${chat_room_id}`, status: res.status, body: data });

      if (!res.ok) {
        setMessages([]);
        return;
      }

      const list: Message[] = data?.messages || data?.data || data || [];
      setMessages(Array.isArray(list) ? list : []);

      // mark unread messages from others as read (use server endpoint)
      const unreadIds = (Array.isArray(list) ? list : [])
        .filter((m) => (m.is_read === 0 || m.is_read === false) && String(m.sender_id) !== String(userId))
        .map((m) => m.message_id)
        .filter(Boolean);

      if (unreadIds.length) {
        // mark all concurrently
        await Promise.all(unreadIds.map((id) => markMessageAsRead(id)));
      }

      // clear UI unread counter
      setUnreadMap((p) => ({ ...p, [chat_room_id]: 0 }));
      setTimeout(() => scrollToBottom(), 50);
    } catch (err) {
      console.warn("fetchMessages", err);
      setMessages([]);
    }
  }

  // POST /api/chat/message  body: { chat_room_id, message_content, message_type } (server uses req.user)
  async function handleSend() {
    if (!newMessage.trim() || !selectedRoom) return;
    setIsSending(true);
    try {
      const payload = {
        chat_room_id: selectedRoom.chat_room_id,
        message_content: newMessage.trim(),
        message_type: "text",
      };

      const res = await fetch(`${API_BASE_URL}/api/chat/message`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      setLastNetwork({ path: "/api/chat/message", status: res.status, body: data });

      if (!res.ok) throw new Error(`Send failed: ${res.status}`);

      // server sample: { message: "Message sent", data: { message_id, ... } }
      const saved = data.data || data.message || data;
      const m: Message = {
        message_id: saved?.message_id || saved?.id,
        chat_room_id: saved?.chat_room_id || selectedRoom.chat_room_id,
        sender_id: saved?.sender_id || Number(userId),
        message_content: saved?.message_content || payload.message_content,
        message_type: saved?.message_type || "text",
        is_read: saved?.is_read ?? 0,
        sent_at: saved?.sent_at || new Date().toISOString(),
      };
      setMessages((p) => [...p, m]);
      setNewMessage("");
      scrollToBottom();
    } catch (err) {
      console.warn("handleSend", err);
    } finally {
      setIsSending(false);
    }
  }

  // PUT /api/chat/mark-as-read/:messageId
  async function markMessageAsRead(message_id?: string | number) {
    if (!message_id) return;
    try {
      await fetch(`${API_BASE_URL}/api/chat/mark-as-read/${message_id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...headers },
      });
      // optimistic update
      setMessages((prev) => prev.map((m) => (String(m.message_id) === String(message_id) ? { ...m, is_read: 1 } : m)));
    } catch (err) {
      console.warn("markMessageAsRead", err);
    }
  }

  // POST /api/chat/upload (formData: message_id + file)
  async function handleFile(file?: File | null) {
    if (!file || !selectedRoom) return;
    try {
      // create placeholder message on server first (server sample creates message via POST /api/chat/message)
      const createRes = await fetch(`${API_BASE_URL}/api/chat/message`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify({
          chat_room_id: selectedRoom.chat_room_id,
          message_content: "",
          message_type: "file",
        }),
      });
      const createData = await createRes.json();
      const created = createData.data || createData.message || createData;
      const message_id = created?.message_id || created?.id;
      if (!message_id) throw new Error("No message_id returned for file placeholder");

      const form = new FormData();
      form.append("message_id", String(message_id));
      form.append("file", file);

      const upRes = await fetch(`${API_BASE_URL}/api/chat/upload`, {
        method: "POST",
        headers, // do NOT set Content-Type, let browser set boundary
        body: form,
      });
      const upData = await upRes.json();
      setLastNetwork({ path: "/api/chat/upload", status: upRes.status, body: upData });

      if (!upRes.ok) throw new Error("Upload failed");

      const uploadedFile = upData.uploadedFile || upData.data || upData.file || upData;
      // append file message to UI
      const fileMessage: Message = {
        message_id,
        chat_room_id: selectedRoom.chat_room_id,
        sender_id: Number(userId),
        message_type: "file",
        is_read: 0,
        sent_at: new Date().toISOString(),
        file: uploadedFile,
      };
      setMessages((p) => [...p, fileMessage]);
      scrollToBottom();
    } catch (err) {
      console.warn("handleFile", err);
    }
  }

  // ---------- sockets (unchanged event names) ----------
  useEffect(() => {
    if (!userId) return;
    const socket = io(API_BASE_URL, { query: { userId } });
    socketRef.current = socket;

    socket.on("connect", () => console.log("socket connected", socket.id));

    socket.on("chat:room:created", (room: ChatRoom) => {
      setRooms((p) => {
        if (p.find((r) => String(r.chat_room_id) === String(room.chat_room_id))) return p;
        return [room, ...p];
      });
    });

    socket.on("chat:message", (msg: Message) => {
      if (selectedRoom && String(msg.chat_room_id) === String(selectedRoom.chat_room_id)) {
        setMessages((p) => [...p, msg]);
        // mark read on server if from other user
        if (String(msg.sender_id) !== String(userId)) markMessageAsRead(msg.message_id);
        scrollToBottom();
      } else {
        setUnreadMap((p) => ({ ...p, [msg.chat_room_id]: (p[msg.chat_room_id] || 0) + 1 }));
        setRooms((p) => {
          const without = p.filter((r) => String(r.chat_room_id) !== String(msg.chat_room_id));
          const found = p.find((r) => String(r.chat_room_id) === String(msg.chat_room_id));
          if (found) return [found, ...without];
          return [{ chat_room_id: msg.chat_room_id, user1_id: msg.sender_id, user2_id: userId }, ...without];
        });
      }
    });

    socket.on("chat:file", (payload: any) => {
      if (selectedRoom && String(payload.chat_room_id) === String(selectedRoom.chat_room_id)) {
        setMessages((p) => [...p, payload]);
        if (String(payload.sender_id) !== String(userId)) markMessageAsRead(payload.message_id);
        scrollToBottom();
      } else {
        setUnreadMap((p) => ({ ...p, [payload.chat_room_id]: (p[payload.chat_room_id] || 0) + 1 }));
      }
    });

    socket.on("chat:message:read", (data: any) => {
      setMessages((p) => p.map((m) => (String(m.message_id) === String(data.message_id) ? { ...m, is_read: 1 } : m)));
    });

    return () => {
      socket.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, selectedRoom]);

  // initial
  useEffect(() => {
    fetchRooms();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // when selecting a room, fetch messages
  useEffect(() => {
    if (selectedRoom) fetchMessages(selectedRoom.chat_room_id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRoom]);

  const filtered = rooms.filter((r) => {
    const otherId = String(r.user1_id) === String(userId) ? String(r.user2_id) : String(r.user1_id);
    return `${otherId}`.includes(query) || (r.preview || r.last_message?.message_content || "").toLowerCase().includes(query.toLowerCase());
  });

  function scrollToBottom() {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }

  return (
    <div className="h-screen flex bg-gray-50 text-gray-900">
      {/* Left column */}
      <aside className="w-full max-w-[420px] p-4 border-r bg-white shadow-sm flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-semibold">Messages</h1>
            <p className="text-sm text-gray-500">Signed in as <span className="font-medium">{userId}</span></p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => fetchRooms()} className="rounded-lg bg-slate-100 px-3 py-2 text-sm hover:bg-slate-200">Refresh</button>
          </div>
        </div>

        <div className="mb-3">
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search chats or user" className="w-full px-3 py-2 rounded-lg border focus:ring focus:ring-indigo-200" />
        </div>

        <div className="overflow-auto flex-1">
          <ul className="space-y-2">
            {filtered.length === 0 && <li className="text-sm text-gray-400 p-4">No conversations</li>}
            {filtered.map((room) => {
              const otherId = String(room.user1_id) === String(userId) ? room.user2_id : room.user1_id;
              const unread = unreadMap[room.chat_room_id] || 0;
              const active = selectedRoom && String(selectedRoom.chat_room_id) === String(room.chat_room_id);
              return (
                <li key={String(room.chat_room_id)} onClick={() => setSelectedRoom(room)} className={`flex items-center p-3 rounded-lg cursor-pointer hover:bg-gray-50 ${active ? 'bg-indigo-50 ring-1 ring-indigo-200' : ''}`}>
                  <div className="flex-shrink-0 w-12 h-12 rounded-full bg-gradient-to-br from-indigo-400 to-indigo-600 text-white flex items-center justify-center font-semibold mr-3">{String(otherId).slice(-2)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <div className="font-medium truncate">User {otherId}</div>
                      <div className="text-xs text-gray-400">{room.updated_at ? new Date(String(room.updated_at)).toLocaleTimeString() : ''}</div>
                    </div>
                    <div className="text-sm text-gray-500 truncate mt-1">{room.preview || room.last_message?.message_content || 'No messages yet'}</div>
                  </div>
                  {unread > 0 && <div className="ml-3 bg-red-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs">{unread}</div>}
                </li>
              );
            })}
          </ul>
        </div>

        {/* quick create chat for testing */}
        <div className="pt-3 border-t mt-3">
          <CreateChatBox onCreate={async (otherId) => {
            const room = await createRoomWith(otherId);
            if (room) setSelectedRoom(room);
          }} />
        </div>
      </aside>

      {/* Right column */}
      <main className="flex-1 p-2 flex flex-col">
        {!selectedRoom ? (
          <div className="m-auto text-center text-gray-400">
            <h2 className="text-lg font-medium">Select a conversation</h2>
            <p className="mt-2">Start chatting with customers or vendors in real-time.</p>

            {lastNetwork && (
              <details className="mt-3 text-left text-xs text-gray-600">
                <summary className="cursor-pointer">Last network debug</summary>
                <pre className="whitespace-pre-wrap break-words max-h-60 overflow-auto p-2 bg-slate-50 rounded mt-2">{JSON.stringify(lastNetwork, null, 2)}</pre>
              </details>
            )}
          </div>
        ) : (
          <div className="flex-1 flex flex-col bg-white">
            <header className="flex items-center justify-between pb-3 border-b">
              <div className="flex items-center">
                <div className="w-12 h-12 rounded-full bg-indigo-100 mr-3 flex items-center justify-center font-semibold text-indigo-700">{String(selectedRoom.chat_room_id).slice(-2)}</div>
                <div>
                  <div className="font-semibold">Conversation</div>
                  <div className="text-sm text-gray-500">Chat ID {selectedRoom.chat_room_id}</div>
                </div>
              </div>
              <div className="text-sm text-gray-400">{selectedRoom.created_at ? new Date(String(selectedRoom.created_at)).toLocaleDateString() : ''}</div>
            </header>

            <div className="flex-1 overflow-auto mt-4 px-2" style={{ minHeight: 0 }}>
              {messages.length === 0 && <div className="text-center text-gray-400 mt-8">No messages yet — send the first one.</div>}

              <div className="space-y-4">
                {messages.map((m) => {
                  const mine = String(m.sender_id) === String(userId);
                  return (
                    <div key={m.message_id || Math.random()} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                      <div className={`${mine ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-900'} p-3 rounded-2xl max-w-[70%] break-words`}>
                        {!mine && m.sender_name && <div className="text-xs font-medium mb-1">{m.sender_name}</div>}

                        {m.message_type === 'file' ? (
                          <div className="flex flex-col">
                            <div className="text-sm font-medium">File</div>
                            <a href={m.file?.file_url || (m as any).file_url} target="_blank" rel="noreferrer" className="mt-2 underline text-sm">Open file</a>
                          </div>
                        ) : (
                          <div className="whitespace-pre-wrap">{m.message_content}</div>
                        )}

                        <div className={`text-xs mt-2 ${mine ? 'text-indigo-200' : 'text-gray-400'}`}>
                          {m.sent_at ? new Date(String(m.sent_at)).toLocaleTimeString() : ''} {m.is_read ? '• Read' : ''}
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>
            </div>

            <div className="pt-3 mt-4 border-t">
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-2 bg-white px-3 py-2 rounded-lg border cursor-pointer">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h4l3 8 4-16 3 8h4" />
                  </svg>
                  <input type="file" className="hidden" onChange={(e) => handleFile(e.target.files?.[0] ?? null)} />
                  <span className="text-sm text-gray-500">Attach</span>
                </label>

                <input value={newMessage} onChange={(e) => setNewMessage(e.target.value)} placeholder="Write a message..." className="flex-1 px-4 py-3 rounded-lg border focus:ring focus:ring-indigo-200" onKeyDown={(e) => { if (e.key === 'Enter') handleSend(); }} />

                <button onClick={handleSend} disabled={isSending || !newMessage.trim()} className="px-4 py-2 rounded-lg bg-indigo-600 text-white disabled:opacity-60">
                  Send
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

/* CreateChatBox helper */
function CreateChatBox({ onCreate }: { onCreate: (otherId: string | number) => Promise<void> }) {
  const [otherId, setOtherId] = useState("");
  return (
    <div className="pt-3">
      <div className="text-xs text-gray-600 mb-2">Start chat (for testing)</div>
      <div className="flex gap-2">
        <input value={otherId} onChange={(e) => setOtherId(e.target.value)} placeholder="other user id (e.g. 152)" className="flex-1 px-3 py-2 rounded-lg border" />
        <button onClick={() => { if (otherId.trim()) onCreate(otherId.trim()); }} className="px-3 py-2 rounded-lg bg-indigo-600 text-white">Start</button>
      </div>
    </div>
  );
}
