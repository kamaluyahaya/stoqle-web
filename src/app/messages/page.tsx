"use client";

import { API_BASE_URL } from "@/src/lib/config";
import React, { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import { useAuth } from "@/src/context/authContext";
import { useSearchParams } from "next/navigation";
import { RoomItem, ChatBubble, MessageInput, MessageWelcome } from "@/src/components/feed/message";
import { AnimatePresence } from "framer-motion";
import ProductPreviewModal from "@/src/components/product/addProduct/modal/previewModal";
import { fetchProductById } from "@/src/lib/api/productApi";
import type { PreviewPayload, ProductSku } from "@/src/types/product";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { ChevronLeftIcon, ChatBubbleBottomCenterTextIcon, PlusIcon } from "@heroicons/react/24/outline";

const formatUrl = (path?: string) => {
  if (!path) return "";
  if (path.startsWith("http")) return path;
  return `${API_BASE_URL}${path.startsWith("/") ? "" : "/"}${path}`;
};


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
  sender_business_name?: string | null;
  sender_business_logo?: string | null;
  message_content?: string;
  message_type?: "text" | "file" | string;
  is_read?: number | boolean;
  sent_at?: string | null;
  file?: { file_id?: string | number; file_url?: string } | any;
  file_url?: string | null;
  file_type?: string | null;
  product_id?: string | number | null;
  product_name?: string | null;
  product_price?: string | null;
  product_image?: string | null;
  product_variant?: string | null;
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
  const router = useRouter();

  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<ChatRoom | null>(null);
  const selectedRoomRef = useRef<ChatRoom | null>(null);
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
  const [taggedProduct, setTaggedProduct] = useState<{
    id: string;
    name: string;
    price: string;
    variant?: string;
    img?: string;
    targetUserId?: string | number;
  } | null>(null);

  // Preview Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedProductPayload, setSelectedProductPayload] = useState<PreviewPayload | null>(null);
  const [fetchingProductId, setFetchingProductId] = useState<number | string | null>(null);
  const [clickPos, setClickPos] = useState({ x: 0, y: 0 });
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [loadingRecs, setLoadingRecs] = useState(false);

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

  async function fetchRecommendations() {
    setLoadingRecs(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/users/suggestions`, { headers });
      const data = await res.json();
      const usersList = data?.data?.users || [];
      const vendorsList = data?.data?.vendors || [];
      const combined = [...usersList, ...vendorsList].map((u: any) => ({
        ...u,
        user_id: u.user_id || u.id,
        full_name: u.business_name || u.full_name || u.name || "Stoqle User",
        profile_pic: u.business_logo || u.profile_pic || u.avatar
      }));
      setRecommendations(combined.slice(0, 10));
    } catch (err) {
      console.warn("fetchRecommendations", err);
    } finally {
      setLoadingRecs(false);
    }
  }

  async function handleStartNewChat(otherUserId: string | number) {
    if (!otherUserId) return;
    try {
      // Check if room already exists in our local list
      const existing = rooms.find(r => String(r.other_user_id) === String(otherUserId));
      if (existing) {
        setSelectedRoom(existing);
        window.history.pushState({}, '', '/messages');
        return;
      }

      const res = await fetch(`${API_BASE_URL}/api/chat/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify({ other_user_id: otherUserId })
      });
      const data = await res.json();
      const newRoom = data.chatRoom || data.data || data;
      
      if (newRoom && newRoom.chat_room_id) {
        // Ensure other_user_id is correctly set for the room object
        if (!newRoom.other_user_id) {
          const otherId = String(newRoom.user1_id) === String(userId) ? newRoom.user2_id : newRoom.user1_id;
          newRoom.other_user_id = otherId;
        }
        
        setRooms(prev => {
          const alreadyInList = prev.find(r => String(r.chat_room_id) === String(newRoom.chat_room_id));
          if (alreadyInList) return prev;
          return [newRoom, ...prev];
        });
        setSelectedRoom(newRoom);
        
        const finalOtherId = otherUserId || newRoom.other_user_id;
        if (finalOtherId) {
           setRecommendations(prev => prev.filter(r => String(r.user_id) !== String(finalOtherId)));
        }
        // Refresh recommendations to get fresh data excluding existing chats
        fetchRecommendations();
        window.history.pushState({}, '', '/messages');
      }
    } catch (err) {
      console.warn("handleStartNewChat", err);
    }
  }

  const handleProductClick = async (productId: string | number) => {
    if (fetchingProductId === productId) return; // Allow switching but prevent duplicate fetch
    setClickPos({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
    
    try {
      setFetchingProductId(productId);
      const res = await fetchProductById(productId, token);
      if (res?.data?.product) {
        const dbProduct = res.data.product;
        const mappedPayload: PreviewPayload = {
          productId: dbProduct.product_id,
          title: dbProduct.title,
          description: dbProduct.description,
          category: dbProduct.category,
          hasVariants: dbProduct.has_variants === 1,
          price: dbProduct.price ?? "",
          quantity: dbProduct.quantity ?? "",
          samePriceForAll: false,
          sharedPrice: null,
          businessId: Number(dbProduct.business_id),
          productImages: (dbProduct.media || []).filter((m: any) => m.type === "image").map((m: any) => ({ name: "img", url: formatUrl(m.url) })),
          productVideo: (dbProduct.media || []).find((m: any) => m.type === "video") ? { name: "vid", url: formatUrl(dbProduct.media.find((m: any) => m.type === "video")!.url) } : null,
          useCombinations: dbProduct.use_combinations === 1,
          params: (dbProduct.params || []).map((p: any) => ({ key: p.param_key, value: p.param_value })),
          variantGroups: (dbProduct.variant_groups || []).map((g: any) => ({
            id: String(g.group_id),
            title: g.title,
            allowImages: g.allow_images === 1,
            entries: (g.options || []).map((o: any) => {
              const inventoryMatch = (dbProduct.inventory || []).find((inv: any) => Number(inv.variant_option_id) === Number(o.option_id));
              return {
                id: String(o.option_id),
                name: o.name,
                price: o.price,
                quantity: inventoryMatch ? inventoryMatch.quantity : (Number(o.initial_quantity || 0) - Number(o.sold_count || 0)),
                images: (o.media || []).map((m: any) => ({ name: "img", url: formatUrl(m.url) }))
              };
            })
          })),
          skus: (dbProduct.skus || []).map((s: any) => {
            let vIds: string[] = [];
            try { vIds = typeof s.variant_option_ids === 'string' ? JSON.parse(s.variant_option_ids) : s.variant_option_ids; } catch (e) { }
            const inventoryMatch = (dbProduct.inventory || []).find((inv: any) => inv.sku_id === s.sku_id);
            return {
              id: String(s.sku_id),
              sku: s.sku_code || "",
              name: "Combination",
              price: s.price,
              quantity: inventoryMatch ? inventoryMatch.quantity : 0,
              enabled: s.status === 'active',
              variantOptionIds: vIds.map(String)
            } as ProductSku;
          })
        };
        const baseInv = (dbProduct.inventory || []).find((inv: any) => !inv.sku_id && !inv.variant_option_id);
        if (baseInv) mappedPayload.quantity = baseInv.quantity;

        // Update URL to match messages page pattern but with product_id for deep linking
        const newUrl = `/messages?user=${userParam ?? ""}&room=${roomParam ?? ""}&product_id=${productId}`;
        window.history.pushState(window.history.state, "", newUrl);

        setSelectedProductPayload(mappedPayload);
        setModalOpen(true);
      }
    } catch (err) {
      console.error("Failed to fetch product", err);
      toast.error("Could not load product details.");
    } finally {
      setFetchingProductId(null);
    }
  };

  async function handleSend(customContent?: string) {
    const finalContent = customContent || newMessage;
    if ((!finalContent.trim() && !selectedFile) || !selectedRoom || isSending) return;
    setIsSending(true);

    // 1. Optimistic Update (Immediate Feedback)
    const tempId = Date.now();
    const optimisticMsg: Message = {
      message_id: tempId,
      chat_room_id: selectedRoom.chat_room_id,
      sender_id: userId,
      message_content: finalContent.trim(),
      message_type: selectedFile ? "file" : "text",
      sent_at: new Date().toISOString(),
      file_url: filePreview, // Show local DataURL/Blob instantly 
      file_type: selectedFile?.type,
      product_id: taggedProduct?.id,
      product_name: taggedProduct?.name,
      product_price: taggedProduct?.price,
      product_image: taggedProduct?.img,
      product_variant: taggedProduct?.variant
    };

    setMessages(prev => [...prev, optimisticMsg]);

    // Cache inputs before clearing for API call
    const savedContent = finalContent.trim();
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
        if (optimisticMsg.product_id) {
          formData.append("product_id", String(optimisticMsg.product_id));
          if (optimisticMsg.product_name) formData.append("product_name", optimisticMsg.product_name);
          if (optimisticMsg.product_price) formData.append("product_price", String(optimisticMsg.product_price));
          if (optimisticMsg.product_image) formData.append("product_image", optimisticMsg.product_image);
          if (optimisticMsg.product_variant) formData.append("product_variant", optimisticMsg.product_variant);
        }

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
          product_id: optimisticMsg.product_id,
          product_name: optimisticMsg.product_name,
          product_price: optimisticMsg.product_price,
          product_image: optimisticMsg.product_image,
          product_variant: optimisticMsg.product_variant,
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

  // Sync selectedRoom to ref to avoid socket re-subscriptions
  useEffect(() => {
    selectedRoomRef.current = selectedRoom;
  }, [selectedRoom]);

  // ---------- Sockets ----------
  useEffect(() => {
    if (!userId) return;
    const socket = io(API_BASE_URL, { query: { userId } });
    socketRef.current = socket;

    socket.on("connect", () => {
      console.log("Connected to Realtime Messaging as:", userId);
      fetchRooms();
    });

    socket.on("connect_error", (err) => {
      console.warn("Realtime Messaging Connection Error:", err.message);
    });

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
            full_name: msg.sender_name || `stoqleID ${msg.sender_id}`,
            business_name: (msg as any).business_name,
            business_logo: (msg as any).business_logo,
            message_content: msg.message_content,
            sent_at: msg.sent_at,
            updated_at: msg.sent_at
          };
        return [updatedRoom as ChatRoom, ...otherRooms];
      });

      if (selectedRoomRef.current && String(msg.chat_room_id) === String(selectedRoomRef.current.chat_room_id)) {
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

      if (selectedRoomRef.current && String(payload.chat_room_id) === String(selectedRoomRef.current.chat_room_id)) {
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

    // Handle potential new room event
    socket.on("chat:room:created", (room: any) => {
      setRooms(prev => {
        const exists = prev.find(r => String(r.chat_room_id) === String(room.chat_room_id));
        if (exists) return prev;
        return [room, ...prev];
      });
      // Also remove from recommendations if it arrived via socket
      const oId = room.other_user_id;
      if (oId) {
        setRecommendations(prev => prev.filter(r => String(r.user_id) !== String(oId)));
      }
      // Re-fetch to ensure the server-side filtered list is up to date
      fetchRecommendations();
    });

    return () => { socket.disconnect(); };
  }, [userId]);

  // Initial load
  useEffect(() => { 
    fetchRooms();
    fetchRecommendations();
  }, []);

  // Handle URL parameters (room or user)
  useEffect(() => {
    if (rooms.length === 0) return;

    if (roomParam) {
      const room = rooms.find(r => String(r.chat_room_id) === String(roomParam));
      if (room) {
        setSelectedRoom(room);
      } else if (userParam) {
        handleStartNewChat(userParam);
      }
    } else if (userParam) {
      const room = rooms.find(r => String(r.other_user_id) === String(userParam));
      if (room) {
        setSelectedRoom(room);
      } else {
        handleStartNewChat(userParam);
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

  useEffect(() => {
    const pid = searchParams.get("product_id");
    const pname = searchParams.get("pname");
    const pprice = searchParams.get("pprice");
    const pvariant = searchParams.get("pvariant");
    const pimg = searchParams.get("pimg");

    if (pid && pname) {
      setTaggedProduct({
        id: pid,
        name: pname,
        price: pprice || "",
        variant: pvariant || undefined,
        img: pimg || undefined,
        targetUserId: userParam || undefined
      });
    }
  }, [searchParams]);

  // Handle browser back button for product modal
  useEffect(() => {
    const handlePopState = () => {
      const url = new URL(window.location.href);
      const hasProdId = url.searchParams.has("product_id");

      if (modalOpen && !hasProdId) {
        setModalOpen(false);
        setSelectedProductPayload(null);
      }
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [modalOpen]);

  return (
    <div className="bg-slate-100 overflow-hidden pt-[env(safe-area-inset-top)] sm:pt-0">
      {/* Balanced height for full-screen experience without bottom nav */}
      <div className="flex h-dvh sm:h-[calc(100dvh-64px)] overflow-hidden">
        <aside className={`${selectedRoom ? 'hidden md:flex' : 'flex'} w-full md:w-[380px] flex-col bg-slate-100 border-r border-gray-100`}>
          <div className="p-6 pb-2 shrink-0">
            <div className="flex items-center gap-4 mb-6">
              <button 
                onClick={() => router.push("/")}
                className="lg:hidden p-2 -ml-2 rounded-full hover:bg-white transition-colors"
                title="Back to Home"
              >
                <ChevronLeftIcon className="h-6 w-6 text-gray-500" />
              </button>
              <h1 className="text-2xl font-bold text-gray-900">Messages</h1>
              <div className="flex-1" />
              <button onClick={fetchRooms} className="p-2 rounded-full hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
            </div>
            {rooms.length > 0 && (
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search conversations..." className="w-full bg-white pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:ring-2 focus:ring-red-100 focus:border-red-500 outline-none shadow-sm" />
              </div>
            )}
          </div>
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1 custom-scrollbar">
            {rooms.length > 0 ? (
              <>
                {filtered.map((room) => (
                  <RoomItem key={String(room.chat_room_id)} room={room as any} unread={unreadMap[room.chat_room_id] || 0} active={!!(selectedRoom && String(selectedRoom.chat_room_id) === String(room.chat_room_id))} onClick={() => setSelectedRoom(room)} />
                ))}
                
                {/* Show recommendations at the end if not searching */}
                {!query && recommendations.length > 0 && (
                   <div className="pt-8 pb-4">
                     <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2 mb-3">People You May Know</h4>
                     <div className="space-y-1">
                        {recommendations.map((rec, i) => (
                          <div 
                            key={rec.user_id || i}
                            onClick={() => router.push(`/user/profile/${rec.user_id}`)}
                            className="flex items-center gap-3 p-2 rounded-xl hover:bg-white cursor-pointer transition-colors text-left group"
                          >
                             <img 
                              src={rec.business?.logo || rec.business_logo || rec.profile_pic || `https://i.pravatar.cc/150?u=${rec.user_id}`} 
                              className="w-8 h-8 rounded-full border border-white shadow-sm object-cover" 
                            />
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-bold text-slate-800 truncate">{rec.business?.business_name || rec.business_name || rec.full_name}</p>
                              <p className="text-[9px] text-slate-400 truncate">@{rec.username || "stoqleID"+rec.user_id}</p>
                            </div>
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                handleStartNewChat(rec.user_id);
                              }}
                              className="px-3 py-1 rounded-full border-[0.5px] border-red-500 text-red-500 hover:bg-red-50 text-[9px] font-bold transition-all active:scale-95"
                            >
                               Message
                            </button>
                          </div>
                        ))}
                     </div>
                   </div>
                )}
              </>
            ) : (
              <div className="py-10 text-center space-y-6">
                <div className="flex flex-col items-center">
                  <img src="/assets/images/message-icon.png" className="w-20 opacity-40 mb-4" alt="No messages" />
                  <p className="text-sm font-bold text-gray-900 px-10">No messages yet</p>
                  <p className="text-xs text-gray-400 mt-1 px-10">Connect with people and start a conversation</p>
                </div>

                <div className="pt-6 border-t border-gray-50 mx-2">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-left px-2 mb-3">People You May Know</h4>
                  <div className="space-y-1">
                    {loadingRecs ? (
                      <div className="py-4 flex justify-center">
                        <div className="w-5 h-5 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
                      </div>
                    ) : (
                      recommendations.map((rec, i) => (
                        <div 
                          key={rec.user_id || i}
                          onClick={() => router.push(`/user/profile/${rec.user_id}`)}
                          className="flex items-center gap-3 p-2 rounded-xl hover:bg-white cursor-pointer transition-colors text-left group"
                        >
                             <img 
                              src={rec.business?.logo || rec.business_logo || rec.profile_pic || `https://i.pravatar.cc/150?u=${rec.user_id}`} 
                              className="w-8 h-8 rounded-full border border-white shadow-sm object-cover" 
                            />
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-bold text-slate-800 truncate">{rec.business?.business_name || rec.business_name || rec.full_name}</p>
                              <p className="text-[9px] text-slate-400 truncate">@{rec.username || "stoqleID"+rec.user_id}</p>
                            </div>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              handleStartNewChat(rec.user_id);
                            }}
                            className="px-3 py-1 rounded-full border-[0.5px] border-red-500 text-red-500 hover:bg-red-50 text-[9px] font-bold transition-all active:scale-95"
                          >
                             Message
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </aside>

        <main className={`${selectedRoom ? 'flex' : 'hidden md:flex'} flex-1 flex-col bg-white border-l border-slate-200`}>
          {!selectedRoom ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 bg-slate-50/30 overflow-y-auto">
               <div className="flex flex-col items-center max-w-2xl w-full">
                  <div className="relative mb-8">
                    <div className="w-28 h-28 bg-white rounded-full flex items-center justify-center shadow-2xl shadow-red-100 animate-in fade-in zoom-in duration-700">
                      <img src="/assets/images/message-icon.png" className="w-14" alt="Messages" />
                    </div>
                    <div className="absolute -bottom-1 -right-1 bg-green-500 w-5 h-5 rounded-full border-4 border-white shadow-sm" />
                  </div>
                  
                  <h2 className="text-3xl font-black text-slate-900 uppercase tracking-tight mb-3 flex items-center gap-3">
                    <img 
                      src={auth?.user?.profile_pic || auth?.user?.avatar || `https://i.pravatar.cc/150?u=${userId}`} 
                      className="w-10 h-10 rounded-full border-2 border-white shadow-md object-cover"
                      alt=""
                    />
                    {auth?.user?.full_name || auth?.user?.name || "Ready to Connect?"}
                  </h2>
                  <p className="text-slate-400 font-medium mb-12 text-center max-w-sm leading-relaxed">
                    Select a conversation from the sidebar or start a new one with people you may know.
                  </p>

                  <div className="w-full">
                    <div className="flex items-center justify-between mb-6 px-2">
                       <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                         <span className="w-2 h-2 bg-red-500 rounded-full" />
                         People You May Know
                       </h3>
                       <button onClick={fetchRecommendations} className="p-1 rounded-full hover:bg-white text-slate-300 hover:text-red-500 transition-all">
                          <svg className={`h-4 w-4 ${loadingRecs ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                       </button>
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {loadingRecs && recommendations.length === 0 ? (
                        Array.from({ length: 4 }).map((_, i) => (
                          <div key={i} className="h-20 bg-white/50 rounded-2xl animate-pulse border border-slate-100" />
                        ))
                      ) : recommendations.slice(0, 6).map((rec, i) => (
                        <div 
                          key={rec.user_id || i}
                          onClick={() => router.push(`/user/profile/${rec.user_id}`)}
                          className="group bg-white p-4 rounded-2xl border border-slate-100 hover:border-red-100 hover:shadow-xl hover:shadow-red-500/5 transition-all cursor-pointer flex items-center gap-4"
                        >
                           <div className="relative shrink-0">
                            <img 
                              src={rec.business?.logo || rec.business_logo || rec.profile_pic || `https://i.pravatar.cc/150?u=${rec.user_id}`} 
                              className="w-12 h-12 rounded-full object-cover ring-2 ring-slate-50" 
                              alt=""
                            />
                            <div className="absolute -bottom-1 -right-1 bg-white p-0.5 rounded-full shadow-sm">
                              <div className="w-2 h-2 bg-green-500 rounded-full" />
                            </div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-slate-800 truncate mb-0.5">{rec.business?.business_name || rec.business_name || rec.full_name}</p>
                            <p className="text-[10px] text-slate-400 font-medium truncate uppercase tracking-tighter">@{rec.username || "stoqleID"+rec.user_id}</p>
                          </div>
                          <div className="shrink-0">
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                handleStartNewChat(rec.user_id);
                              }}
                              className="px-4 py-1.5 rounded-full border-[0.5px] border-red-500 text-red-500 hover:bg-red-50 text-[10px] font-bold transition-all active:scale-95"
                            >
                              Message
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>

                    {!loadingRecs && recommendations.length === 0 && (
                      <div className="text-center py-10 bg-white/50 rounded-2xl border border-dashed border-slate-200">
                        <p className="text-xs font-bold text-slate-300 uppercase tracking-widest">No suggestions yet</p>
                      </div>
                    )}
                  </div>
               </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col relative overflow-hidden">
              <header className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-white/80 backdrop-blur-md z-10 shrink-0">
                <div className="flex items-center gap-3">
                  <button onClick={() => setSelectedRoom(null)} className="md:hidden p-2 -ml-2 rounded-full hover:bg-gray-100 text-gray-400 hover:text-red-500">
                    <ChevronLeftIcon className="h-6 w-6" />
                  </button>
                  <div 
                    onClick={() => {
                      const targetId = selectedRoom.other_user_id || (String(selectedRoom.user1_id) === String(userId) ? selectedRoom.user2_id : selectedRoom.user1_id);
                      if (targetId) {
                        if (String(targetId) === String(userId)) {
                          router.push("/profile");
                        } else {
                          router.push(`/user/profile/${targetId}`);
                        }
                      }
                    }}
                    className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity min-w-0"
                  >
                    {selectedRoom.business_logo || selectedRoom.profile_pic ? (
                      <img src={selectedRoom.business_logo || selectedRoom.profile_pic} className="w-10 h-10 rounded-full object-cover shrink-0" />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-red-500 flex items-center justify-center text-white font-bold shrink-0">
                        {(selectedRoom.business_name || selectedRoom.full_name || "U").charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0">
                      <h3 className="font-bold text-gray-900 truncate">{selectedRoom.business_name || selectedRoom.full_name || `stoqleID ${selectedRoom.other_user_id}`}</h3>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
                        <span className="text-xs text-gray-400 font-medium">Online</span>
                      </div>
                    </div>
                  </div>
                </div>
              </header>

              <div className="flex-1 overflow-y-auto px-2 py-4 space-y-1 custom-scrollbar">
                {messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center py-20">
                    <div className="relative mb-6">
                      <div className="w-24 h-24 bg-red-50 rounded-full flex items-center justify-center animate-pulse">
                        <img src="/assets/images/message-icon.png" className="w-12 opacity-80" alt="" />
                      </div>
                      <div className="absolute -bottom-1 -right-1 bg-green-500 w-4 h-4 rounded-full border-2 border-white shadow-sm" />
                    </div>
                    <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight mb-2">
                       {auth?.user?.full_name || auth?.user?.name || "Ready to Chat?"}
                    </h3>
                    <p className="text-sm text-slate-400 max-w-[250px] font-medium leading-relaxed">
                      Select a friend or business to start a real-time conversation.
                    </p>
                    <div className="mt-8 px-6 py-2 bg-slate-50 rounded-full border border-slate-100 text-[10px] font-bold text-red-500 uppercase tracking-widest">
                      Say Hello 
                    </div>
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
                            <div className="flex justify-center my-4 sticky top-0 z-20">
                              <span className="px-3 py-1 bg-white/70 backdrop-blur-md text-[9px] font-black text-slate-400 rounded-full shadow-sm border border-slate-100 uppercase tracking-widest">
                                {formatDateLabel(m.sent_at || null)}
                              </span>
                            </div>
                          )}
                          <ChatBubble 
                            mine={String(m.sender_id) === String(userId)} 
                            content={m.message_content} 
                            sentAt={m.sent_at} 
                            senderName={m.sender_business_name || m.sender_name} 
                            senderAvatar={formatUrl(
                              String(m.sender_id) === String(userId) 
                                ? (auth?.user?.business_logo || auth?.user?.profile_pic || auth?.user?.avatar)
                                : (m.sender_business_logo || m.sender_profile_pic)
                            )}
                            isRead={m.is_read} 
                            messageType={m.message_type} 
                            file={m.file} 
                            fileUrl={m.file_url} 
                            fileType={m.file_type}
                            product_id={m.product_id}
                            product_name={m.product_name}
                            product_price={m.product_price}
                            product_image={m.product_image}
                            product_variant={m.product_variant}
                            onProductClick={handleProductClick}
                          />
                        </React.Fragment>
                      );
                    })}
                    <div ref={messagesEndRef} className="h-1" />
                  </div>
                )}
              </div>

              <div className="p-4 bg-white border-t border-gray-100 shrink-0 pb-[calc(1rem+env(safe-area-inset-bottom))]">
                {taggedProduct && selectedRoom && String(selectedRoom.other_user_id) === String(taggedProduct.targetUserId) && (
                  <div className="mb-4 w-full p-2.5 sm:p-3 bg-red-50 border border-red-100 rounded-xl flex items-start gap-3 relative animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <button 
                      onClick={() => setTaggedProduct(null)}
                      className="absolute -top-2 -right-2 w-6 h-6 bg-white border border-red-100 rounded-full flex items-center justify-center text-red-500 shadow-sm hover:bg-red-50 transition-colors z-20"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 6l12 12M6 18L18 6" />
                      </svg>
                    </button>
                    {taggedProduct.img && (
                      <div className="w-12 h-12 rounded-lg overflow-hidden border border-red-200 bg-white shrink-0 mt-0.5">
                        <img src={taggedProduct.img} className="w-full h-full object-cover" alt="" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0 pt-0.5 pr-1">
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="text-[10px] sm:text-xs font-bold text-slate-900 uppercase tracking-tight leading-tight line-clamp-2 max-w-[calc(100%-65px)]">
                          {taggedProduct.name}
                        </h4>
                        <span className="text-[11px] sm:text-sm font-black text-red-600 ml-auto">
                          ₦{Number(taggedProduct.price || 0).toLocaleString()}
                        </span>
                      </div>
                      {taggedProduct.variant && (
                        <p className="text-[9px] sm:text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-widest leading-none truncate">
                          {taggedProduct.variant}
                        </p>
                      )}
                      <p className="text-[9px] sm:text-[10px] font-medium text-red-400 mt-1.5 italic uppercase tracking-tighter leading-none">
                        Inquiring about this product...
                      </p>
                    </div>
                  </div>
                )}
                <MessageInput value={newMessage} onChange={setNewMessage} onSend={() => {
                  if (newMessage.trim() === "" && taggedProduct) {
                    // If message is empty but we have a tagged product, send a default "hello" or the product info
                    const intro = `Hello, I'm interested in "${taggedProduct.name}" ${taggedProduct.variant ? `(${taggedProduct.variant})` : ''} at ₦${Number(taggedProduct.price || 0).toLocaleString()}.`;
                    handleSend(intro);
                  } else {
                    handleSend();
                  }
                  if (taggedProduct) setTaggedProduct(null);
                }} onFileSelect={handleFile} isSending={isSending} selectedFile={selectedFile} filePreview={filePreview} onCancelFile={() => { setSelectedFile(null); setFilePreview(null); }} />
              </div>
            </div>
          )}
        </main>
      </div>

      <AnimatePresence>
        {modalOpen && selectedProductPayload && (
          <ProductPreviewModal
            open={modalOpen}
            payload={selectedProductPayload}
            origin={clickPos}
            onProductClick={handleProductClick}
            onClose={() => {
              setModalOpen(false);
              setSelectedProductPayload(null);
              
              // If we pushed a product_id to the URL, going back is cleaner for history
              const url = new URL(window.location.href);
              if (url.searchParams.has("product_id")) {
                window.history.back();
              }
            }}
          />
        )}
      </AnimatePresence>

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
