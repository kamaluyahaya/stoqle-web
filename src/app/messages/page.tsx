"use client";

import { API_BASE_URL } from "@/src/lib/config";
import React, { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import { useAuth } from "@/src/context/authContext";
import { useChat } from "@/src/context/chatContext";
import { useSearchParams } from "next/navigation";
import { RoomItem, ChatBubble, MessageInput, MessageWelcome } from "@/src/components/feed/message";
import { motion, AnimatePresence } from "framer-motion";
import ProductPreviewModal from "@/src/components/product/addProduct/modal/previewModal";
import { fetchProductById } from "@/src/lib/api/productApi";
import type { PreviewPayload, ProductSku } from "@/src/types/product";
import { mapProductToPreviewPayload } from "@/src/lib/utils/product/mapping";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile, toBlobURL } from "@ffmpeg/util";
import { ChevronLeftIcon, ChevronRightIcon, ChatBubbleBottomCenterTextIcon, PlusIcon } from "@heroicons/react/24/outline";
import { chatDb, type CachedMessage, type CachedRoom } from "@/src/lib/services/chatDb";
import { Package, X, CheckCircle, ChevronRight, Zap, RefreshCw, AlertCircle, AlertTriangle, Copy, XCircle } from "lucide-react";
import ImageViewer from "@/src/components/modal/imageViewer"; // Added ImageViewer import
import { MESSAGES_CACHE } from "@/src/lib/cache";
import { copyToClipboard } from "@/src/lib/utils/utils";

const formatUrl = (path?: string | null) => {
  if (!path) return "";
  if (path.startsWith("http") || path.startsWith("blob:") || path.startsWith("data:")) return path;
  return `${API_BASE_URL}${path.startsWith("/") ? "" : "/"}${path}`;
};


type ChatRoom = {
  chat_room_id: string | number;
  user1_id?: string | number;
  user2_id?: string | number;
  other_user_id?: string | number;
  full_name?: string;
  profile_pic?: string;
  username?: string;
  business_name?: string | null;
  business_logo?: string | null;
  business_slug?: string | null;
  business_category?: string | null;
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
  status?: "sending" | "sent" | "failed" | "processing";
  file?: { file_id?: string | number; file_url?: string } | any;
  file_url?: string | null;
  file_type?: string | null;
  file_name?: string | null;
  product_id?: string | number | null;
  product_name?: string | null;
  product_price?: string | null;
  product_image?: string | null;
  product_variant?: string | null;
  order_id?: string | number | null;
  order_ref?: string | null;
  updated_at?: string | null;
  video_thumbnail?: string | null;
};

function MessagesPageContent({
  userIdProp = null,
}: {
  userIdProp?: string | null;
}) {
  const auth = useAuth();
  const { refreshUnread } = useChat();
  const ctxUserId = auth?.user?.user_id || auth?.user?.id;
  const savedUserId = typeof window !== "undefined" ? localStorage.getItem("userId") : null;
  const userId = String(userIdProp ?? ctxUserId ?? savedUserId ?? "150");
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
  const searchParams = useSearchParams();
  const roomParam = searchParams.get("room") || searchParams.get("room_id");
  const userParam = searchParams.get("user") || searchParams.get("user_id") || searchParams.get("u_id");
  const router = useRouter();

  const [rooms, setRooms] = useState<ChatRoom[]>(MESSAGES_CACHE.chatSessions);
  const [selectedRoom, setSelectedRoom] = useState<ChatRoom | null>(null);
  const selectedRoomRef = useRef<ChatRoom | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isMessagesLoading, setIsMessagesLoading] = useState(false);
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
  const [taggedOrderRef, setTaggedOrderRef] = useState<string | null>(null);
  const [taggedOrderId, setTaggedOrderId] = useState<string | number | null>(null);
  const [taggedOrderData, setTaggedOrderData] = useState<any | null>(null);
  const [isOrderDataLoading, setIsOrderDataLoading] = useState(false);
  const [isTrimming, setIsTrimming] = useState(false);
  const [trimmingProgress, setTrimmingProgress] = useState(0);
  const ffmpegRef = useRef<any>(null);

  const loadFFmpeg = async () => {
    if (ffmpegRef.current) return ffmpegRef.current;
    const ffmpeg = new FFmpeg();
    const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd';
    await ffmpeg.load({
      coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
      wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
    });
    ffmpegRef.current = ffmpeg;
    return ffmpeg;
  };

  // Tracking Modal State
  const [trackingOrderId, setTrackingOrderId] = useState<string | number | null>(null);
  const [trackingOrderRef, setTrackingOrderRef] = useState<string | null>(null);
  const [isTrackingModalOpen, setIsTrackingModalOpen] = useState(false);

  // Preview Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedProductPayload, setSelectedProductPayload] = useState<PreviewPayload | null>(null);
  const [fetchingProductId, setFetchingProductId] = useState<number | string | null>(null);
  const [clickPos, setClickPos] = useState({ x: 0, y: 0 });
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [loadingRecs, setLoadingRecs] = useState(false);

  // Image Viewer State
  const [isViewerOpen, setIsViewerOpen] = useState(false);
  const [viewerImages, setViewerImages] = useState<string[]>([]);
  const [viewerIndex, setViewerIndex] = useState(0);
  const [isSearchingList, setIsSearchingList] = useState(false);
  const [roomsLoaded, setRoomsLoaded] = useState(Date.now() - MESSAGES_CACHE.lastFetchedAt < 1000 * 60 * 5 || MESSAGES_CACHE.chatSessions.length > 0);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [visibleHeight, setVisibleHeight] = useState<number | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || !window.visualViewport) return;
    const vv = window.visualViewport;
    const updateVisibility = () => {
      // Logic: Use vv.height for exact visible area. 
      // Subtracting vv.offsetTop handles cases where the browser scrolls the page up to show the input.
      setVisibleHeight(vv.height);
      setKeyboardHeight(window.innerHeight - vv.height);
    };
    vv.addEventListener("resize", updateVisibility);
    vv.addEventListener("scroll", updateVisibility);
    updateVisibility();
    return () => {
      vv.removeEventListener("resize", updateVisibility);
      vv.removeEventListener("scroll", updateVisibility);
    };
  }, []);

  const headers = token ? { Authorization: `Bearer ${token}` } : ({} as Record<string, string>);

  function scrollToBottom(behavior: ScrollBehavior = "smooth") {
    messagesEndRef.current?.scrollIntoView({ behavior });
  }

  // Ensure page starts from top on navigation (crucial for mobile/tablet)
  useEffect(() => {
    if (typeof window !== "undefined") {
      window.scrollTo(0, 0);
    }
  }, [roomParam]);

  // ---------- API calls ----------

  function setSelectedRoomWithCleanup(room: ChatRoom | null) {
    if (room && selectedRoom && String(room.chat_room_id) !== String(selectedRoom.chat_room_id)) {
      setTaggedProduct(null);
      setTaggedOrderRef(null);
      setTaggedOrderId(null);
      // Clean URL params if switching rooms
      if (typeof window !== "undefined") {
        const url = new URL(window.location.href);
        ['product_id', 'pname', 'pprice', 'pvariant', 'pimg', 'order_ref', 'order_id'].forEach(p => url.searchParams.delete(p));
        window.history.replaceState(null, "", url.toString());
      }
    }
    setSelectedRoom(room);
  }

  async function fetchRooms() {
    // ⚡ STEP 1: Immediate Render from Cache (NO LOADER)
    const cached = await chatDb.getRooms();
    const CACHE_TTL = 1000 * 60 * 5; // 5 mins
    const isRecent = Date.now() - MESSAGES_CACHE.lastFetchedAt < CACHE_TTL;

    if (cached.length > 0 || isRecent) {
      if (cached.length > 0 && rooms.length === 0 && MESSAGES_CACHE.chatSessions.length === 0) {
        MESSAGES_CACHE.chatSessions = cached as any;
        setRooms(cached as any);
      }

      // Seed unreadMap from cache for instant feedback
      const cacheUnread: Record<string | number, number> = {};
      cached.forEach((r: any) => {
        if (r.unread_count) cacheUnread[r.chat_room_id] = Number(r.unread_count);
      });
      setUnreadMap(cacheUnread);
      setRoomsLoaded(true); // Allow UI to proceed with cached (or legitimately empty) data
    }

    // We removed the early return to enforce background Stale-While-Revalidate (SWR).
    // The UI is already populated from the cache above, so the network request below 
    // happens silently in the background, updating state on success without spinners.
    try {
      const res = await fetch(`${API_BASE_URL}/api/chat/room`, { headers });
      const data = await res.json();
      const list = data?.rooms || data?.chatRooms || data?.data || data || [];
      const roomsList = Array.isArray(list) ? list : [];

      // ⚡ STEP 2: Background Sync
      setRooms(roomsList);
      chatDb.saveRooms(roomsList as any);
      MESSAGES_CACHE.chatSessions = roomsList;

      // Initialize unreadMap from the API data
      const initialUnread: Record<string | number, number> = {};
      roomsList.forEach((r: any) => {
        if (r.unread_count !== undefined) {
          initialUnread[r.chat_room_id] = Number(r.unread_count);
        } else if (r.is_read === 0 && String(r.sender_id) !== String(userId)) {
          initialUnread[r.chat_room_id] = 1;
        }
      });
      setUnreadMap(initialUnread);
      setRoomsLoaded(true);
      MESSAGES_CACHE.lastFetchedAt = Date.now();
    } catch (err) {
      console.warn("fetchRooms sync failed", err);
      // Fallback: If network fails, already showing cache
      setRoomsLoaded(true);
    }
  }

  async function markRoomAsRead(chat_room_id: string | number) {
    try {
      await fetch(`${API_BASE_URL}/api/chat/mark-room-as-read/${chat_room_id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...headers },
      });
      setUnreadMap((p) => ({ ...p, [chat_room_id]: 0 }));
      refreshUnread(); // Real-time update for sidebar 
    } catch (err) {
      console.warn("markRoomAsRead", err);
    }
  }

  async function fetchMessages(chat_room_id: string | number) {
    // ⚡ STEP 1: LOAD FROM LOCAL CACHE FIRST (INSTANT) - Try cache BEFORE showing loader
    const cached = await chatDb.getMessages(chat_room_id);
    const CACHE_TTL = 1000 * 60 * 5;
    const lastFetch = MESSAGES_CACHE.roomsFetchedAt[String(chat_room_id)] || 0;
    const isRecent = Date.now() - lastFetch < CACHE_TTL;

    if (cached.length > 0 || isRecent) {
      if (cached.length > 0) {
        setMessages(cached as any);
      }
      setIsMessagesLoading(false); // Bypasses loader entirely
      // Synchronous scroll for instant feel
      setTimeout(() => scrollToBottom("auto"), 5);
      
      // We removed the early return here as well. Data will continuously
      // sync via SWR behind the scenes if there are changes.
    } else {
      // ⚡ Only clear and show spinner if we HAVE NO CACHED DATA
      setMessages([]);
      setIsMessagesLoading(true);
    }

    try {
      const res = await fetch(`${API_BASE_URL}/api/chat/messages/${chat_room_id}`, { headers });
      const data = await res.json();
      const list = data?.messages || data?.chatMessages || data?.data || data || [];
      const freshMessages = Array.isArray(list) ? list : [];

      // ⚡ STEP 2: SYNC SILENTLY IN BACKGROUND
      // Update local cache and state silently
      if (JSON.stringify(freshMessages) !== JSON.stringify(cached) || !cached.length) {
        setMessages(freshMessages);
        chatDb.saveMessages(freshMessages as any);
      }

      MESSAGES_CACHE.roomsFetchedAt[String(chat_room_id)] = Date.now();
      setIsMessagesLoading(false);
      markRoomAsRead(chat_room_id);
      setTimeout(() => scrollToBottom("auto"), 30);
    } catch (err) {
      console.warn("fetchMessages sync failed", err);
      setIsMessagesLoading(false);
      if (messages.length === 0 && !cached.length) setMessages([]);
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
        router.push(`/messages?room=${existing.chat_room_id}`);
        return;
      }

      const res = await fetch(`${API_BASE_URL}/api/chat/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify({ other_user_id: otherUserId })
      });
      const data = await res.json();

      if (res.status === 403) {
        toast.error(data.error || data.message || "Message restricted by recipient's privacy settings");
        return;
      }

      if (!res.ok) {
        toast.error(data.error || data.message || "Failed to start conversation");
        return;
      }

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
        router.push(`/messages?room=${newRoom.chat_room_id}`);
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
        const mappedPayload = mapProductToPreviewPayload(dbProduct, formatUrl);
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

  const handleImageClick = (clickedUrl: string) => {
    const allMedia = messages
      .filter(m => {
        const url = m.file_url || m.file?.file_url;
        const type = m.file_type || m.file?.file_type;
        return url && (
          type?.includes('image') ||
          ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(type || '') ||
          type?.includes('video') ||
          ['mp4', 'webm', 'ogg'].includes(type || '')
        );
      })
      .map(m => formatUrl(m.file_url || m.file?.file_url));

    if (allMedia.length === 0 && clickedUrl) allMedia.push(clickedUrl);

    setViewerImages(allMedia);
    const idx = allMedia.indexOf(clickedUrl);
    setViewerIndex(idx >= 0 ? idx : 0);
    setIsViewerOpen(true);
  };

  async function handleSend(customContent?: any) {
    // ⚡ FIX: Check if customContent is a string (manual send) or a MouseEvent (click)
    let finalContent = (typeof customContent === 'string') ? customContent : (newMessage || "");

    // ⚡ AUTO-INTRO for tagged items if message is empty
    if (!finalContent.trim() && !selectedFile) {
      if (taggedProduct) {
        finalContent = `Hello, I'm interested in "${taggedProduct.name}" ${taggedProduct.variant ? `(${taggedProduct.variant})` : ''} at ₦${Number(taggedProduct.price || 0).toLocaleString()}.`;
      } else if (taggedOrderRef) {
        finalContent = `Hello, I'm reaching out regarding my order #${taggedOrderRef}.`;
      }
    }

    if ((!finalContent.trim() && !selectedFile) || !selectedRoom || isSending) return;

    // Use URL.createObjectURL for faster, synchronous file preview
    let localFileUrl: string | null = null;
    if (selectedFile) {
      localFileUrl = URL.createObjectURL(selectedFile);
    }

    const tempId = `temp-${Date.now()}`;
    const optimisticMsg: Message = {
      message_id: tempId,
      chat_room_id: selectedRoom.chat_room_id,
      sender_id: userId,
      message_content: finalContent.trim(),
      message_type: selectedFile ? (selectedFile.name.startsWith('voice_') ? 'voice' : "file") : "text",
      sent_at: new Date().toISOString(),
      file_url: localFileUrl || filePreview,
      file_type: selectedFile?.type,
      file_name: selectedFile?.name,
      status: "sending",
      product_id: taggedProduct?.id,
      product_name: taggedProduct?.name,
      product_price: String(taggedProduct?.price || ""),
      product_variant: taggedProduct?.variant,
      order_id: taggedOrderId ? Number(taggedOrderId) : null,
      order_ref: taggedOrderRef,
      product_image: taggedProduct?.img || taggedOrderData?.items?.[0]?.product_image
    };

    setMessages(prev => [...prev, optimisticMsg]);

    const savedContent = finalContent.trim();
    const savedFile = selectedFile;
    const currentRoomId = selectedRoom.chat_room_id;

    // Clear inputs immediately
    setNewMessage("");
    setSelectedFile(null);
    setFilePreview(null);
    setTaggedProduct(null);
    setTaggedOrderRef(null);
    setTaggedOrderId(null);
    setTaggedOrderData(null);
    scrollToBottom("smooth");

    // ⚡ CLEAN URL: Remove product tagging params after send so they don't reappear on refresh
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      ['product_id', 'pname', 'pprice', 'pvariant', 'pimg', 'order_ref', 'order_id'].forEach(p => url.searchParams.delete(p));
      window.history.replaceState(null, "", url.toString());
    }

    await performSendMessage(optimisticMsg, savedFile, savedContent, currentRoomId);
  }

  async function performSendMessage(tempMsg: Message, file: File | null, content: string, roomId: string | number) {
    try {
      let finalMessage: Message;
      let uploadFile = file;

      if (uploadFile) {
        if (uploadFile.type.startsWith('video/')) {
          setMessages(p => p.map(m => m.message_id === tempMsg.message_id ? { ...m, status: "processing" } : m));

          try {
            const tempVideo = document.createElement("video");
            const objectUrl = URL.createObjectURL(uploadFile);
            tempVideo.preload = "metadata";

            await new Promise<void>((resolve, reject) => {
              tempVideo.onloadedmetadata = () => resolve();
              tempVideo.onerror = () => reject(new Error("Failed to load video metadata"));
              tempVideo.src = objectUrl;
            });

            if (tempVideo.duration > 120) {
              const ffmpeg = await loadFFmpeg();
              const inputName = `input_${Date.now()}.mp4`;
              const outputName = `output_${Date.now()}.mp4`;
              const thumbName = `thumb_${Date.now()}.jpg`;

              await ffmpeg.writeFile(inputName, await fetchFile(uploadFile));

              // Generate thumbnail at 3s simultaneously with trimming
              await ffmpeg.exec(['-i', inputName, '-ss', '00:00:03', '-vframes', '1', thumbName]);
              const thumbData = await ffmpeg.readFile(thumbName);
              const thumbBlob = new Blob([(thumbData as any).buffer], { type: 'image/jpeg' });
              const thumbUrl = URL.createObjectURL(thumbBlob);

              setMessages(p => p.map(m => m.message_id === tempMsg.message_id ? { ...m, video_thumbnail: thumbUrl } : m));

              await ffmpeg.exec(['-i', inputName, '-t', '120', '-c', 'copy', outputName]);

              const data = await ffmpeg.readFile(outputName);
              const trimmedBlob = new Blob([(data as any).buffer], { type: 'video/mp4' });
              uploadFile = new File([trimmedBlob], uploadFile.name, { type: 'video/mp4' });

              await ffmpeg.deleteFile(inputName);
              await ffmpeg.deleteFile(outputName);
              await ffmpeg.deleteFile(thumbName);
            } else {
              // Even if not trimming, generate thumbnail for instant view
              const ffmpeg = await loadFFmpeg();
              const inputName = `input_${Date.now()}.mp4`;
              const thumbName = `thumb_${Date.now()}.jpg`;
              await ffmpeg.writeFile(inputName, await fetchFile(uploadFile));
              await ffmpeg.exec(['-i', inputName, '-ss', '00:00:03', '-vframes', '1', thumbName]);
              const thumbData = await ffmpeg.readFile(thumbName);
              const thumbBlob = new Blob([(thumbData as any).buffer], { type: 'image/jpeg' });
              const thumbUrl = URL.createObjectURL(thumbBlob);
              setMessages(p => p.map(m => m.message_id === tempMsg.message_id ? { ...m, video_thumbnail: thumbUrl } : m));
              await ffmpeg.deleteFile(inputName);
              await ffmpeg.deleteFile(thumbName);
            }
            URL.revokeObjectURL(objectUrl);
          } catch (err) {
            console.error("Background video processing failed:", err);
          }

          setMessages(p => p.map(m => m.message_id === tempMsg.message_id ? { ...m, status: "sending" } : m));
        }

        const formData = new FormData();
        formData.append("file", uploadFile);
        if (tempMsg.video_thumbnail?.startsWith('blob:')) {
          try {
            const thumbRes = await fetch(tempMsg.video_thumbnail);
            const thumbBlob = await thumbRes.blob();
            formData.append("video_thumbnail_file", thumbBlob, "thumbnail.jpg");
          } catch (e) { console.error("Could not fetch thumb blob", e); }
        }
        formData.append("chat_room_id", String(roomId));
        if (content) formData.append("message_content", content);
        if (tempMsg.product_id) {
          formData.append("product_id", String(tempMsg.product_id));
          if (tempMsg.product_name) formData.append("product_name", tempMsg.product_name);
          if (tempMsg.product_price) formData.append("product_price", String(tempMsg.product_price));
          if (tempMsg.product_image) formData.append("product_image", tempMsg.product_image);
          if (tempMsg.product_variant) formData.append("product_variant", tempMsg.product_variant);
        }
        if (tempMsg.order_id) formData.append("order_id", String(tempMsg.order_id));
        if (tempMsg.order_ref) formData.append("order_ref", tempMsg.order_ref);

        const res = await fetch(`${API_BASE_URL}/api/chat/upload`, {
          method: "POST",
          headers,
          body: formData,
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || "Upload failed");

        const msgObj = data.data || (typeof data.message === 'object' ? data.message : data);
        finalMessage = {
          ...msgObj,
          message_id: msgObj.message_id || data.message_id || tempMsg.message_id,
          sender_id: msgObj.sender_id || Number(userId),
          sent_at: msgObj.sent_at || new Date().toISOString(),
          message_content: msgObj.message_content || content,
          file_url: msgObj.file_url || msgObj.file?.file_url || data.uploadedFile?.file_url || data.file_url || msgObj.url,
          file_type: msgObj.file_type || msgObj.file?.file_type || data.uploadedFile?.file_type || data.file_type || msgObj.type,
          status: "sent"
        };
      } else {
        const payload = {
          chat_room_id: roomId,
          message_content: content,
          message_type: tempMsg.message_type || "text",
          product_id: tempMsg.product_id,
          product_name: tempMsg.product_name,
          product_price: tempMsg.product_price,
          product_image: tempMsg.product_image,
          product_variant: tempMsg.product_variant,
          order_id: tempMsg.order_id,
          order_ref: tempMsg.order_ref,
        };
        const res = await fetch(`${API_BASE_URL}/api/chat/message`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...headers },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || "Sending failed");

        const msgObj = data.data || (typeof data.message === 'object' ? data.message : data);
        finalMessage = {
          ...msgObj,
          sender_id: msgObj.sender_id || Number(userId),
          sent_at: msgObj.sent_at || new Date().toISOString(),
          message_content: msgObj.message_content || payload.message_content,
          status: "sent"
        };
      }

      setMessages(p => p.map(m => m.message_id === tempMsg.message_id ? finalMessage : m));

      // Clean up local blob URL
      if (tempMsg.file_url && tempMsg.file_url.startsWith('blob:')) {
        URL.revokeObjectURL(tempMsg.file_url);
      }

      setRooms((p) => {
        const targetRoom = p.find(r => String(r.chat_room_id) === String(roomId));
        if (!targetRoom) return p;
        const otherRooms = p.filter((r) => String(r.chat_room_id) !== String(roomId));
        const updatedRoom = {
          ...targetRoom,
          message_content: finalMessage.message_content || (file ? "Shared a photo" : ""),
          sent_at: finalMessage.sent_at,
          updated_at: finalMessage.sent_at
        };
        return [updatedRoom, ...otherRooms];
      });
    } catch (err) {
      console.warn("performSendMessage Error:", err);
      // Mark as failed instead of removing
      setMessages(p => p.map(m => m.message_id === tempMsg.message_id ? { ...m, status: "failed" } : m));
      toast.error(err instanceof Error ? err.message : "Message failed to send. Please try again.");
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

    if (file.type.startsWith('image/') || file.type === 'application/pdf') {
      const reader = new FileReader();
      reader.onloadend = () => setFilePreview(reader.result as string);
      reader.readAsDataURL(file);
    } else if (file.type.startsWith('video/')) {
      const url = URL.createObjectURL(file);
      setFilePreview(url);
    } else {
      setFilePreview(null);
    }
  }

  // Sync selectedRoom to ref to avoid socket re-subscriptions
  useEffect(() => {
    selectedRoomRef.current = selectedRoom;
  }, [selectedRoom]);

  const [isPdfViewerOpen, setIsPdfViewerOpen] = useState(false);
  const [activePdfUrl, setActivePdfUrl] = useState<string | null>(null);

  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [activeProfileId, setActiveProfileId] = useState<string | number | null>(null);
  const [activeAvatarUrl, setActiveAvatarUrl] = useState<string | null>(null);
  const [activeProfileName, setActiveProfileName] = useState("");

  function handlePdfClick(url: string) {
    setActivePdfUrl(url);
    setIsPdfViewerOpen(true);
  }

  function handleAvatarClick(userId: string | number, avatarUrl: string, name: string) {
    if (!avatarUrl) return; // Only if there's a pic
    setActiveProfileId(userId);
    setActiveAvatarUrl(avatarUrl);
    setActiveProfileName(name);
    setIsProfileModalOpen(true);
  }

  const [selectedMessageForAction, setSelectedMessageForAction] = useState<Message | null>(null);
  const [isMessageActionOpen, setIsMessageActionOpen] = useState(false);
  const [isEditingMessage, setIsEditingMessage] = useState(false);

  function handleMessageLongPress(id: string | number) {
    const msg = messages.find(m => String(m.message_id) === String(id));
    if (msg) {
      setSelectedMessageForAction(msg);
      setIsMessageActionOpen(true);
    }
  }

  async function handleDeleteMessage() {
    if (!selectedMessageForAction?.message_id) return;
    const msgId = selectedMessageForAction.message_id;
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE_URL}/api/chat/message/${msgId}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (res.ok) {
        // Optimistic update already handled by socket, but ensure local state is clean
        setMessages(prev => prev.filter(m => String(m.message_id) !== String(msgId)));
        chatDb.deleteMessages([msgId]);
        setIsMessageActionOpen(false);
        toast.success("Message deleted");
      } else {
        const errorData = await res.json();
        throw new Error(errorData.message || "Failed to delete message");
      }
    } catch (err) {
      console.error("Delete failed", err);
      toast.error("Failed to delete message");
    } finally {
      setSelectedMessageForAction(null);
    }
  }

  async function handleReportMessage() {
    if (!selectedMessageForAction?.message_id) return;
    // We could potentially call a /report endpoint here
    toast.success("Message reported to moderators.");
    setIsMessageActionOpen(false);
    setSelectedMessageForAction(null);
  }

  function startEditing() {
    if (!selectedMessageForAction) return;
    setIsEditingMessage(true);
    setNewMessage(selectedMessageForAction.message_content || "");
    setIsMessageActionOpen(false);
  }

  async function handleUpdateMessage() {
    if (!selectedMessageForAction?.message_id || !newMessage.trim()) return;
    const msgId = selectedMessageForAction.message_id;
    const updatedContent = newMessage.trim();
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE_URL}/api/chat/message-content/${msgId}`, {
        method: "PUT",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ message_content: updatedContent })
      });
      if (res.ok) {
        const now = new Date().toISOString();
        setMessages(prev => prev.map(m => String(m.message_id) === String(msgId) ? { ...m, message_content: updatedContent, updated_at: now } : m));
        chatDb.saveMessages([{ message_id: msgId, message_content: updatedContent, updated_at: now } as any]);
        setNewMessage("");
        setIsEditingMessage(false);
        setSelectedMessageForAction(null);
        toast.success("Message updated");
      } else {
        const errorData = await res.json();
        const errTitle = errorData.error || errorData.message || "Update failed";
        toast.error(`${errTitle}`);
        throw new Error(errTitle);
      }
    } catch (err: any) {
      console.error("Update failed", err);
      // Already toasted above if it was a fetch error, but handle network errors here
      if (!err.message.includes("Update failed")) {
        toast.error("Network error: Could not update message");
      }
    } finally {
      setSelectedMessageForAction(null);
    }
  }

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

    socket.on("chat:message:delete", ({ message_id }: { message_id: string | number }) => {
      setMessages(prev => prev.filter(m => String(m.message_id) !== String(message_id)));
      chatDb.deleteMessages([message_id]);
    });

    socket.on("chat:message:update", ({ message_id, message_content }: { message_id: string | number, message_content: string }) => {
      setMessages(prev => prev.map(m => String(m.message_id) === String(message_id) ? { ...m, message_content } : m));
      chatDb.saveMessages([{ message_id, message_content } as any]);
    });

    socket.on("chat:message", (msg: Message) => {
      // ⚡ Instant Cache Update
      chatDb.saveMessages([msg as any]);

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

        const finalRooms = [updatedRoom as ChatRoom, ...otherRooms];
        chatDb.saveRooms(finalRooms as any);
        return finalRooms;
      });

      if (selectedRoomRef.current && String(msg.chat_room_id) === String(selectedRoomRef.current.chat_room_id)) {
        setMessages((p) => {
          // 1. Check if we already have this message by ID
          if (p.find(m => String(m.message_id) === String(msg.message_id))) return p;

          // 2. Prevent duplication from optimistic UI (especially from our own sends)
          if (String(msg.sender_id) === String(userId)) {
            // Find an optimistic message that hasn't been synced yet
            const tempMatch = p.find(m =>
              String(m.message_id).startsWith('temp-') &&
              m.message_content === msg.message_content
            );
            if (tempMatch) {
              // Replace the temporary message with the real one
              const merged = p.map(m => m.message_id === tempMatch.message_id ? msg : m);
              return merged;
            }
          }

          return [...p, msg];
        });
        if (String(msg.sender_id) !== String(userId)) {
          markRoomAsRead(msg.chat_room_id);
        }
      } else {
        setUnreadMap((p) => ({ ...p, [msg.chat_room_id]: (p[msg.chat_room_id] || 0) + 1 }));
        refreshUnread();
      }
    });

    socket.on("chat:file", (payload: any) => {
      chatDb.saveMessages([payload as any]);

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

        const finalRooms = [updatedRoom as ChatRoom, ...otherRooms];
        chatDb.saveRooms(finalRooms as any);
        return finalRooms;
      });

      if (selectedRoomRef.current && String(payload.chat_room_id) === String(selectedRoomRef.current.chat_room_id)) {
        setMessages((p) => {
          if (p.find(m => String(m.message_id) === String(payload.message_id))) return p;
          return [...p, payload];
        });
        if (String(payload.sender_id) !== String(userId)) {
          markRoomAsRead(payload.chat_room_id);
        }
      } else {
        setUnreadMap((p) => ({ ...p, [payload.chat_room_id]: (p[payload.chat_room_id] || 0) + 1 }));
        refreshUnread();
      }
    });

    socket.on("chat:message:read", (data: any) => {
      setMessages((p) => {
        const updated = p.map((m) => (String(m.message_id) === String(data.message_id) ? { ...m, is_read: 1 } : m));
        // Update local DB to persist the read status
        chatDb.saveMessages(updated.filter(m => String(m.message_id) === String(data.message_id)) as any);
        return updated;
      });
    });

    socket.on("chat:room:read", (data: any) => {
      setMessages((p) => {
        // If the other user read the room, all MY sent messages are now READ
        const updated = p.map((m) =>
          (String(m.sender_id) === String(userId) && m.is_read !== 1) ? { ...m, is_read: 1 } : m
        );
        // Persist all updated messages to DB
        chatDb.saveMessages(updated.filter(m => String(m.sender_id) === String(userId)) as any);
        return updated;
      });
    });

    // Handle potential new room event
    socket.on("chat:room:created", (room: any) => {
      setRooms(prev => {
        const exists = prev.find(r => String(r.chat_room_id) === String(room.chat_room_id));
        if (exists) return prev;
        const newRooms = [room, ...prev];
        chatDb.saveRooms(newRooms as any);
        return newRooms;
      });
      // ...
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
    if (!roomsLoaded) return;

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

  const isShowingChat = !!selectedRoom || !!roomParam || !!userParam;

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
      if (!newMessage) {
        setNewMessage(`Hello, I am interested in: ${pname}`);
      }
    }

    const oref = searchParams.get("order_ref");
    const oid = searchParams.get("order_id");
    if (oref) {
      setTaggedOrderRef(oref);
      if (oid) setTaggedOrderId(oid);
      if (!newMessage) {
        setNewMessage(`Hello, I'm reaching out regarding my Order: ${oref}`);
      }

      // ⚡ Fetch Order Details for Immersive Preview
      (async () => {
        try {
          setIsOrderDataLoading(true);
          const res = await fetch(`${API_BASE_URL}/api/orders/${oid || oref}`, { headers });
          const data = await res.json();
          if (data.success) {
            setTaggedOrderData(data.data);
          }
        } catch (err) {
          console.warn("Failed to fetch tagged order data", err);
        } finally {
          setIsOrderDataLoading(false);
        }
      })();
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

  const handleOrderClick = async (orderId: string | number, orderRef: string) => {
    const identifier = orderId || orderRef;
    if (!identifier) return;

    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
      const res = await fetch(`${API_BASE_URL}/api/orders/${identifier}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();

      if (data.success) {
        const order = data.data;
        const currentUserId = String(userId);

        // Check if current user owns any business in this order or matches a staff member
        const isVendorForThisOrder = order.vendors?.some((v: any) =>
          String(v.business_owner_id) === currentUserId ||
          String(v.user_id) === currentUserId ||
          String(v.staff_id) === currentUserId
        );

        if (isVendorForThisOrder) {
          router.push(`/profile/business/customer-order?orderId=${order.master_order_id || order.id || orderId}&orderRef=${orderRef}`);
        } else {
          setTrackingOrderId(orderId);
          setTrackingOrderRef(orderRef);
          setIsTrackingModalOpen(true);
        }
      } else {
        setTrackingOrderId(orderId);
        setTrackingOrderRef(orderRef);
        setIsTrackingModalOpen(true);
      }
    } catch (err) {
      console.error("Order click handling error", err);
      // Fallback
      setTrackingOrderId(orderId);
      setTrackingOrderRef(orderRef);
      setIsTrackingModalOpen(true);
    }
  };


  const OrderTrackingModal = ({ orderId, orderRef, open, onClose }: { orderId: string | number | null, orderRef: string | null, open: boolean, onClose: () => void }) => {
    const [order, setOrder] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [selectedShipmentIdx, setSelectedShipmentIdx] = useState(0);
    const [isDeliveryCodeModalOpen, setIsDeliveryCodeModalOpen] = useState(false);
    const [selectedDeliveryCode, setSelectedDeliveryCode] = useState<string | null>(null);
    const [selectedDeliveryOrderRef, setSelectedDeliveryOrderRef] = useState<string | null>(null);
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;

    useEffect(() => {
      const identifier = orderId || orderRef;
      if (open && identifier) {
        setLoading(true);
        fetch(`${API_BASE_URL}/api/orders/${identifier}`, {
          headers: { Authorization: `Bearer ${token}` }
        })
          .then(res => res.json())
          .then(data => {
            if (data.success) {
              setOrder(data.data);
            }
          })
          .catch(err => console.error("Tracking fetch error", err))
          .finally(() => setLoading(false));
      }
    }, [open, orderId]);

    const [trackingHistory, setTrackingHistory] = useState<any[]>([]);

    useEffect(() => {
      if (order) {
        // Find the specific vendor matching the orderRef (Transaction ID)
        const targetVendor = order.vendors?.find((v: any) => v.reference_no === orderRef) || order.vendors?.[0];
        const shipment = targetVendor?.shipments?.[selectedShipmentIdx];

        // Tracking history is tied to the actual order items, not the shipment ID
        const trackingOrderId = shipment?.items?.[0]?.order_id || shipment?.id || orderId;

        if (trackingOrderId) {
          fetch(`${API_BASE_URL}/api/orders/${trackingOrderId}/tracking`, {
            headers: { Authorization: `Bearer ${token}` }
          })
            .then(res => res.json())
            .then(data => {
              if (data.success) setTrackingHistory(data.data);
            })
            .catch(err => console.error("History fetch error", err));
        }
      }
    }, [order, orderRef, selectedShipmentIdx]);

    if (!open) return null;

    const steps = [
      { key: 'placed', label: 'Order Placed', status: ['pending', 'processing', 'confirmed', 'shipped', 'out_for_delivery', 'delivered', 'completed'] },
      { key: 'confirmed', label: 'Confirmed', status: ['confirmed', 'processing', 'shipped', 'out_for_delivery', 'delivered', 'completed'] },
      { key: 'shipped', label: 'Shipped', status: ['shipped', 'out_for_delivery', 'delivered', 'completed'] },
      { key: 'out_for_delivery', label: 'Out for Delivery', status: ['out_for_delivery', 'delivered', 'completed'] },
      { key: 'delivered', label: 'Delivered', status: ['delivered', 'completed'] },
    ];

    const targetVendor = order?.vendors?.find((v: any) => v.reference_no === orderRef) || order?.vendors?.[0];
    const currentShipment = targetVendor?.shipments?.[selectedShipmentIdx];
    const currentStatus = (currentShipment?.status || targetVendor?.status || order?.status || 'pending').toLowerCase();

    return (
      <div className="fixed inset-0 z-[99999999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
        <div className="bg-white w-full max-w-md rounded-[0.5rem] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col max-h-[85vh]">
          <div className="p-6 border-b border-slate-50 flex items-center justify-between shrink-0">
            <div>
              <h3 className="text-xl font-bold text-slate-900 leading-tight">Tracking History</h3>
              <p className="text-[10px] font-bold text-slate-400 mt-1">Order {orderRef || order?.display_id || orderId}</p>
            </div>
            <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-50 text-slate-400 transition-colors"><X size={20} /></button>
          </div>

          <div className="p-6 overflow-y-auto flex-1 bg-slate-50/50">
            {loading ? (
              <div className="py-10 space-y-6 animate-pulse">
                <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm space-y-4">
                  <div className="h-4 w-32 bg-slate-100 rounded-full" />
                  <div className="space-y-3">
                    <div className="h-2 w-full bg-slate-50 rounded-full" />
                    <div className="h-2 w-5/6 bg-slate-50 rounded-full" />
                  </div>
                </div>
                <div className="flex flex-col items-center gap-2">
                  <div className="h-3 w-40 bg-slate-200 rounded-full" />
                  <p className="text-[10px] font-black text-slate-300 tracking-widest ">Fetching Status</p>
                </div>
              </div>
            ) : order ? (
              <div className="space-y-6">
                <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                  {targetVendor?.shipments?.length > 1 && (
                    <div className="flex gap-2 overflow-x-auto pb-4 mb-2 no-scrollbar">
                      {targetVendor.shipments.map((s: any, idx: number) => (
                        <button
                          key={s.id || `ship-${idx}`}
                          onClick={() => setSelectedShipmentIdx(idx)}
                          className={`px-3 py-1.5 rounded-full text-[10px] font-black whitespace-nowrap transition-all ${selectedShipmentIdx === idx
                            ? "bg-slate-900 text-white shadow-md shadow-slate-900/20"
                            : "bg-slate-50 text-slate-400 border border-slate-200 hover:border-slate-300"
                            }`}
                        >
                          Shipment #{idx + 1}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Dynamic Timeline logic copied from Orders page */}
                  {(() => {
                    const dispSteps: any[] = [];
                    trackingHistory.forEach((item, index) => {
                      const isCurrent = index === trackingHistory.length - 1;
                      dispSteps.push({
                        id: `hist-${index}`,
                        isCompleted: !isCurrent || ['delivered', 'cancelled', 'refunded'].includes(item.status),
                        isCurrent: isCurrent && !['delivered', 'cancelled', 'refunded'].includes(item.status),
                        isPending: false,
                        status: item.status,
                        label: item.status?.replace(/_/g, ' '),
                        message: item.message || `Shipment status updated to ${item.status?.replace(/_/g, ' ')}`,
                        date: item.created_at
                      });
                    });

                    const lastEvent = trackingHistory[trackingHistory.length - 1];
                    const seq = ['order_placed', 'confirmed', 'ready_for_shipping', 'out_for_delivery', 'delivered'];
                    const isCancelled = lastEvent ? ['cancelled', 'refunded', 'disputed'].includes(lastEvent.status) : false;

                    if (lastEvent && !isCancelled && lastEvent.status !== 'delivered') {
                      let lastSeqIdx = -1;
                      for (let i = seq.length - 1; i >= 0; i--) {
                        if (trackingHistory.some(h => h.status === seq[i])) {
                          lastSeqIdx = i;
                          break;
                        }
                      }
                      if (lastSeqIdx !== -1) {
                        for (let i = lastSeqIdx + 1; i < seq.length; i++) {
                          dispSteps.push({
                            id: `seq-${seq[i]}`,
                            isCompleted: false,
                            isCurrent: false,
                            isPending: true,
                            status: seq[i],
                            label: seq[i].replace(/_/g, ' '),
                            message: seq[i] === 'delivered' ? 'Waiting for delivery confirmation.' : 'Pending update...',
                            date: null
                          });
                        }
                      }
                    }

                    if (dispSteps.length === 0) {
                      return (
                        <div className="text-center py-10">
                          <p className="text-sm font-bold text-slate-500">No tracking history available yet.</p>
                        </div>
                      );
                    }

                    return (
                      <div className="mt-2">
                        {dispSteps.map((step, index) => {
                          const isLast = index === dispSteps.length - 1;
                          return (
                            <div key={step.id} className="relative flex gap-4 pb-8 last:pb-2">
                              {/* Timeline Line */}
                              {!isLast && (
                                <div className={`absolute left-[11px] top-6 bottom-[-24px] w-[2px] ${step.isCompleted || step.isCurrent ? 'bg-emerald-500' : 'bg-slate-200'}`}></div>
                              )}

                              {/* Status Indicator Icon */}
                              <div className={`relative z-10 w-6 h-6 rounded-full flex items-center justify-center shrink-0 border-2 mt-0.5 ${step.isCompleted ? 'bg-emerald-500 border-emerald-500 text-white shadow-sm' :
                                step.isCurrent ? 'bg-white border-emerald-500 text-emerald-500 shadow-sm' :
                                  'bg-slate-50 border-slate-200 text-transparent'
                                }`}>
                                {step.isCompleted && <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                                {step.isCurrent && <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />}
                              </div>

                              <div className="flex-1 -mt-1">
                                <h4 className={`text-[13px] font-bold  tracking-widest ${step.isCompleted || step.isCurrent ? 'text-slate-900' : 'text-slate-400'
                                  }`}>
                                  {step.label}
                                </h4>
                                <p className={`text-[11px] font-medium mt-1.5 leading-relaxed bg-white p-3 rounded-xl border ${step.isCompleted || step.isCurrent ? 'text-slate-600 border-slate-100 shadow-sm' : 'text-slate-400 border-slate-50/50 opacity-60'
                                  }`}>
                                  {step.message}
                                </p>
                                {step.date && (
                                  <p className="text-[10px] font-bold text-slate-400 mt-2 flex items-center gap-1.5">
                                    {new Date(step.date).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                  </p>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                </div>


                <div className="space-y-3 px-1">
                  <div className="flex justify-between items-start text-[11px]">
                    <span className="font-bold text-slate-400">Reference</span>
                    <span className="font-black text-slate-900  tracking-tighter">{orderRef || order.display_id || order.id}</span>
                  </div>
                  <div className="flex justify-between items-start text-[11px]">
                    <span className="font-bold text-slate-400">Recipient</span>
                    <span className="font-black text-slate-900 text-right max-w-[150px] leading-tight line-clamp-2">{order.full_name}</span>
                  </div>
                  <div className="flex justify-between items-start text-[11px]">
                    <span className="font-bold text-slate-400">Address</span>
                    <span className="font-black text-slate-900 text-right max-w-[180px] leading-tight line-clamp-3">
                      {typeof order.delivery_address === 'object' && order.delivery_address !== null
                        ? `${order.delivery_address.address || ''}, ${order.delivery_address.region || ''}`.trim() || 'Standard Delivery'
                        : order.delivery_address || 'Provided at checkout'}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-10 text-center">
                <p className="text-sm font-bold text-slate-400">Unable to load tracking info.</p>
              </div>
            )}
          </div>

          <div className="p-6 border-t border-slate-50 bg-white shrink-0 space-y-3">
            {currentStatus === 'out_for_delivery' && (
              <button
                onClick={() => {
                  setSelectedDeliveryCode(currentShipment?.delivery_code || 'N/A');
                  setSelectedDeliveryOrderRef(targetVendor?.reference_no || 'ORDER');
                  setIsDeliveryCodeModalOpen(true);
                }}
                className="w-full py-4 bg-amber-500 text-white rounded-2xl font-bold text-[11px] active:scale-95 transition flex items-center justify-center gap-2"
              >
                <div className="w-5 h-5 bg-white/20 rounded-full flex items-center justify-center">
                  <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                </div>
                View Delivery Code
              </button>
            )}
            <button onClick={onClose} className="w-full py-4 bg-slate-100 text-slate-700 rounded-2xl font-bold text-[11px] active:scale-95 transition hover:bg-slate-200">Close History</button>
          </div>

          {/* Secure Delivery Code Modal (Chat Integration) */}
          {isDeliveryCodeModalOpen && (
            <div className="fixed inset-0 z-[99999999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
              <div className="bg-white w-full max-w-sm rounded-[2rem] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200 relative">
                <button onClick={() => setIsDeliveryCodeModalOpen(false)} className="absolute top-4 right-4 p-2 text-slate-400 hover:bg-slate-50 rounded-full transition-colors z-10">
                  <X size={20} />
                </button>

                <div className="p-8 text-center flex flex-col items-center">
                  <div className="w-16 h-16 bg-amber-50 rounded-full flex items-center justify-center mb-6">
                    <AlertTriangle size={28} className="text-amber-500" strokeWidth={2.5} />
                  </div>

                  <h3 className="text-xl font-black text-slate-900 tracking-tight mb-2">Secure Delivery Code</h3>
                  <p className="text-xs font-medium text-slate-500 leading-relaxed mb-6">
                    Reference: <strong className="text-slate-800 ">{selectedDeliveryOrderRef}</strong>
                  </p>

                  <div className="bg-slate-50 border-2 border-slate-100 rounded-xl p-6 w-full mb-6 cursor-pointer"
                    onClick={() => {
                      copyToClipboard(selectedDeliveryCode || 'N/A');
                      toast.success('Code copied to clipboard!');
                    }}
                  >
                    <span className="text-4xl font-black text-slate-800 tracking-[0.4em]">{selectedDeliveryCode || 'N/A'}</span>
                    <div className="mt-3 flex items-center justify-center gap-1.5 text-[10px] font-bold text-slate-400">
                      <Copy size={12} /> Tap to copy
                    </div>
                  </div>

                  <div className="bg-rose-50 border border-rose-100 p-4 rounded-xl text-left flex gap-3 text-rose-700 w-full mb-2">
                    <XCircle size={16} className="shrink-0 mt-0.5" />
                    <div className="text-[10px] font-bold leading-relaxed">
                      <span className=" tracking-widest text-rose-800 font-black text-[9px] mb-1 block">Critical Warning</span>
                      Do <strong>NOT</strong> disclose this 4-digit code to the vendor or rider until you have successfully received AND inspected your complete order in good condition. Handing over this code confirms delivery and authorizes payment!
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="bg-slate-100 overflow-hidden pt-[env(safe-area-inset-top)] sm:pt-0 overscroll-none">
      {/* ⚡ VISUAL VIEWPORT SYNC: By using visibleHeight, we precisely track the top of the mobile keyboard */}
      <div 
        className={`flex ${isShowingChat ? 'h-dvh' : 'h-[calc(100dvh-56px)]'} sm:h-[calc(100dvh-64px)] overflow-hidden overscroll-none`}
        style={visibleHeight && isShowingChat ? { height: `${visibleHeight}px` } : {}}
      >
        <aside className={`${isShowingChat ? 'hidden md:flex' : 'flex'} w-full md:w-[380px] flex-col bg-slate-100 border-r border-gray-100`}>
          <div className="p-4 sm:p-6 pb-2 shrink-0 h-[80px] flex flex-col justify-center">
            <AnimatePresence mode="wait">
              {!isSearchingList ? (
                <motion.div
                  key="header-content"
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="flex items-center gap-4"
                >
                  <h1 className="text-2xl font-bold text-gray-900">Messages</h1>
                  <div className="flex-1" />
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setIsSearchingList(true)}
                      className="p-2 rounded-full hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
                    >
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                    </button>
                    <button onClick={fetchRooms} className="p-2 rounded-full hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors">
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                    </button>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="search-mode"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="relative group w-full"
                >
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg className="h-4 w-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                  <input
                    autoFocus
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search conversations..."
                    className="w-full bg-white pl-10 pr-10 py-2.5 rounded-full border border-red-200 text-sm focus:ring-2 focus:ring-red-100 focus:border-red-500 outline-none shadow-sm"
                  />
                  <button
                    onClick={() => {
                      setIsSearchingList(false);
                      setQuery("");
                    }}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-red-500 transition-colors"
                  >
                    <X size={18} />
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1 custom-scrollbar">
            {!roomsLoaded && rooms.length === 0 ? (
              <div className="space-y-1">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="flex items-center p-3.5 rounded-[1.25rem] bg-white/40 animate-pulse gap-3">
                    <div className="w-12 h-12 rounded-full bg-slate-200 shrink-0" />
                    <div className="flex-1 min-w-0 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="h-3 w-28 bg-slate-200 rounded-full" />
                        <div className="h-2 w-10 bg-slate-100 rounded-full" />
                      </div>
                      <div className="h-2.5 w-40 bg-slate-100 rounded-full" />
                    </div>
                  </div>
                ))}
              </div>
            ) : rooms.length > 0 ? (
              <>
                {filtered.map((room) => (
                  <RoomItem
                    key={String(room.chat_room_id)}
                    room={room as any}
                    unread={unreadMap[room.chat_room_id] || 0}
                    active={!!(selectedRoom && String(selectedRoom.chat_room_id) === String(room.chat_room_id))}
                    onClick={() => {
                      setSelectedRoomWithCleanup(room);
                      router.push(`/messages?room=${room.chat_room_id}`);
                    }}
                    onAvatarClick={handleAvatarClick}
                  />
                ))}

                {/* Show recommendations at the end if not searching */}
                {!query && recommendations.length > 0 && (
                  <div className="pt-8 pb-4">
                    <h4 className="text-[10px] font-bold text-slate-400   px-2 mb-3">People You May Know</h4>
                    <div className="space-y-1">
                      {recommendations.map((rec, i) => (
                        <div
                          key={rec.user_id || i}
                          onClick={() => {
                            const handle = rec.username || rec.business?.business_slug || rec.business_slug;
                            router.push(handle ? `/${handle}` : `/user/profile/${rec.user_id}`);
                          }}
                          className="flex items-center gap-3 p-2 rounded-xl hover:bg-white cursor-pointer transition-colors text-left group"
                        >
                          <img
                            src={rec.business?.logo || rec.business_logo || rec.profile_pic || `https://i.pravatar.cc/150?u=${rec.user_id}`}
                            className="w-8 h-8 rounded-full border border-white shadow-sm object-cover cursor-pointer transition-transform hover:scale-105"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleAvatarClick(rec.user_id, rec.business?.logo || rec.business_logo || rec.profile_pic || "", rec.business?.business_name || rec.business_name || rec.full_name);
                            }}
                          />
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-bold text-slate-800 truncate">{rec.business?.business_name || rec.business_name || rec.full_name}</p>
                            <p className="text-[9px] text-slate-400 truncate">@{rec.username || "stoqleID" + rec.user_id}</p>
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
                  <h4 className="text-[10px] font-bold text-slate-400   text-left px-2 mb-3">People You May Know</h4>
                  {loadingRecs ? (
                    <div className="p-2 space-y-3 animate-pulse">
                      {[1, 2, 3].map(i => (
                        <div key={i} className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-slate-100 flex-shrink-0" />
                          <div className="flex-1 space-y-2">
                            <div className="h-2 w-24 bg-slate-100 rounded" />
                            <div className="h-1.5 w-16 bg-slate-50 rounded" />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <AnimatePresence mode="popLayout">
                      <motion.div
                        key="recs-list"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.4, ease: "easeOut" }}
                        className="space-y-1"
                      >
                        {recommendations.map((rec, i) => (
                          <div
                            key={rec.user_id || i}
                            onClick={() => {
                              const handle = rec.username || rec.business?.business_slug || rec.business_slug;
                              router.push(handle ? `/${handle}` : `/user/profile/${rec.user_id}`);
                            }}
                            className="flex items-center gap-3 p-2 rounded-xl hover:bg-white cursor-pointer transition-colors text-left group"
                          >
                            <img
                              src={rec.business?.logo || rec.business_logo || rec.profile_pic || `https://i.pravatar.cc/150?u=${rec.user_id}`}
                              className="w-8 h-8 rounded-full border border-white shadow-sm object-cover"
                              alt=""
                            />
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-bold text-slate-800 truncate">{rec.business?.business_name || rec.business_name || rec.full_name}</p>
                              <p className="text-[9px] text-slate-400 truncate">@{rec.username || "stoqleID" + rec.user_id}</p>
                            </div>
                            <ChevronRight size={14} className="text-slate-200 group-hover:text-slate-400 transition-colors" />
                          </div>
                        ))}
                      </motion.div>
                    </AnimatePresence>
                  )}
                </div>
              </div>
            )}
          </div>
        </aside>

        <main className={`${isShowingChat ? 'flex' : 'hidden md:flex'} flex-1 flex-col bg-white border-l border-slate-200`}>
          {!selectedRoom ? (
            (roomParam || userParam) ? (
              <div className="flex-1 flex flex-col items-center justify-center p-8 bg-slate-50/10 overflow-y-auto">
                <div className="w-full max-w-sm flex flex-col items-center gap-10 animate-pulse">
                  <div className="flex items-center gap-4 w-6xs md:w-full">
                    <div className="w-12 h-12 rounded-full bg-slate-100 flex-shrink-0" />
                    <div className="flex-1 space-y-3">
                      <div className="h-3 w-32 bg-slate-100 rounded-full" />
                      <div className="h-2 w-20 bg-slate-50 rounded-full" />
                    </div>
                  </div>
                  <div className="w-full space-y-6">
                    <div className="flex flex-col items-start gap-1">
                      <div className="h-10 w-48 bg-slate-100 rounded-2xl rounded-tl-none shadow-sm" />
                      <div className="h-2 w-12 bg-slate-50 rounded-full ml-1" />
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <div className="h-12 w-56 bg-red-100/50 rounded-2xl rounded-tr-none shadow-sm" />
                      <div className="h-2 w-12 bg-slate-50 rounded-full mr-1" />
                    </div>
                    <div className="flex flex-col items-start gap-1">
                      <div className="h-16 w-64 bg-slate-100 rounded-2xl rounded-tl-none shadow-sm" />
                    </div>
                  </div>
                  <p className="text-[10px] font-black text-slate-300 tracking-[0.2em] ">Securing Connection...</p>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-8 bg-slate-50/30 overflow-y-auto">
                <div className="flex flex-col items-center max-w-2xl w-full">
                  <div className="relative mb-8">
                    <div className="w-28 h-28 bg-white rounded-full flex items-center justify-center shadow-2xl shadow-red-100 animate-in fade-in zoom-in duration-700">
                      <img src="/assets/images/message-icon.png" className="w-14" alt="Messages" />
                    </div>
                    <div className="absolute -bottom-1 -right-1 bg-green-500 w-5 h-5 rounded-full border-4 border-white shadow-sm" />
                  </div>

                  <h2 className="text-3xl font-bold text-slate-900  tracking-tight mb-3 flex items-center gap-3">
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
                      <h3 className="text-xs font-bold text-slate-400   flex items-center gap-2">
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
                          onClick={() => {
                            const handle = rec.username || rec.business?.business_slug || rec.business_slug;
                            router.push(handle ? `/${handle}` : `/user/profile/${rec.user_id}`);
                          }}
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
                            <p className="text-[10px] text-slate-400 font-medium truncate  tracking-tighter">@{rec.username || "stoqleID" + rec.user_id}</p>
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
                        <p className="text-xs font-bold text-slate-300  ">No suggestions yet</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )) : (
            <div className="flex-1 flex flex-col relative overflow-hidden bg-white">
              {/* ⚡ Constant Static Chat Background Layer (Behind scrollable content) */}
              <div
                className="absolute inset-0 w-full h-full z-0 pointer-events-none opacity-[0.45]"
                style={{
                  backgroundImage: 'url("/assets/system/default-chat-background2.png")',
                  backgroundSize: '420px',
                  backgroundRepeat: 'repeat',
                  backgroundAttachment: 'fixed'
                }}
              />
              {/* ⚡ Subtle Brand Red Overlay */}
              <div className="absolute inset-0 z-0 pointer-events-none bg-red-500/5" />

              <header className="px-4 py-2 border-b border-gray-100 flex items-center justify-between bg-white/80 backdrop-blur-md z-10 shrink-0 relative">
                <div className="flex items-center">
                  <button onClick={() => {
                    setSelectedRoom(null);
                    router.push("/messages");
                  }} className="md:hidden p-2 -ml-3 rounded-full hover:bg-gray-100 text-gray-400 hover:text-red-500 transition-all active:scale-95">
                    <ChevronLeftIcon className="h-6 w-6" />
                  </button>
                  <div
                    onClick={() => {
                      const targetId = selectedRoom.other_user_id || (String(selectedRoom.user1_id) === String(userId) ? selectedRoom.user2_id : selectedRoom.user1_id);
                      if (targetId) {
                          if (String(targetId) === String(userId)) {
                            router.push("/profile");
                          } else {
                            const handle = selectedRoom.username || selectedRoom.business_slug;
                            router.push(handle ? `/${handle}` : `/user/profile/${targetId}`);
                          }
                      }
                    }}
                    className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity min-w-0"
                  >
                    {selectedRoom.business_logo || selectedRoom.profile_pic ? (
                      <img
                        src={selectedRoom.business_logo || selectedRoom.profile_pic}
                        className="w-10 h-10 rounded-full object-cover shrink-0 cursor-pointer transition-transform hover:scale-105"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAvatarClick(selectedRoom.other_user_id || 0, selectedRoom.business_logo || selectedRoom.profile_pic || "", selectedRoom.business_name || selectedRoom.full_name || "");
                        }}
                      />
                    ) : (
                      <div
                        className="w-10 h-10 rounded-full bg-red-500 flex items-center justify-center text-white text-[12px] shrink-0 cursor-pointer"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAvatarClick(selectedRoom.other_user_id || 0, "", selectedRoom.business_name || selectedRoom.full_name || "");
                        }}
                      >
                        {(selectedRoom.business_name || selectedRoom.full_name || "U").charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0">
                      <h3 className="font-bold text-gray-900 truncate">{selectedRoom.business_name || selectedRoom.full_name || `stoqleID ${selectedRoom.other_user_id}`}</h3>
                      <div className="flex items-center gap-1.5 truncate">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse shrink-0"></span>
                        <span className="text-[10px] text-gray-400 font-medium shrink-0">Online</span>
                        {selectedRoom.business_name && (
                          <>
                            <span className="text-gray-300 mx-0.5 shrink-0">•</span>
                            <span className="text-[10px] text-slate-400  ">
                              Business account {selectedRoom.business_category ? `• ${selectedRoom.business_category}` : ''}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </header>

              <div className="flex-1 overflow-y-auto px-2 py-4 space-y-1 custom-scrollbar relative z-10 overscroll-contain">
                <div className="relative z-10 min-h-full flex flex-col">
                  {isMessagesLoading ? (
                    <div className="flex-1 flex flex-col gap-6 py-8 px-2 animate-pulse">
                      {/* Left shimmer bubble */}
                      <div className="flex flex-col items-start gap-2">
                        <div className="flex items-center gap-2 mb-1">
                          <div className="w-8 h-8 rounded-full bg-slate-100 shrink-0" />
                          <div className="h-2.5 w-20 bg-slate-100 rounded-full" />
                        </div>
                        <div className="h-12 w-3/4 max-w-[320px] bg-slate-100 rounded-[1.25rem] rounded-tl-none shadow-sm" />
                        <div className="h-2 w-14 bg-slate-50/50 rounded-full ml-10" />
                      </div>

                      {/* Right shimmer bubble */}
                      <div className="flex flex-col items-end gap-2 mt-2">
                        <div className="h-10 w-2/3 max-w-[280px] bg-red-100/30 rounded-[1.25rem] rounded-tr-none shadow-sm border border-red-50/50" />
                        <div className="h-2 w-14 bg-slate-50/50 rounded-full mr-2" />
                      </div>

                      {/* Left shimmer bubble (Medium) */}
                      <div className="flex flex-col items-start gap-2 mt-2">
                        <div className="flex items-center gap-2 mb-1">
                          <div className="w-8 h-8 rounded-full bg-slate-100 shrink-0" />
                          <div className="h-2.5 w-24 bg-slate-100 rounded-full" />
                        </div>
                        <div className="h-24 w-[85%] max-w-[400px] bg-slate-100 rounded-[1.25rem] rounded-tl-none shadow-sm" />
                        <div className="h-2 w-14 bg-slate-50/50 rounded-full ml-10" />
                      </div>

                      {/* Right shimmer bubble (Small) */}
                      <div className="flex flex-col items-end gap-2 mt-2">
                        <div className="h-8 w-32 bg-red-100/30 rounded-[1.25rem] rounded-tr-none shadow-sm border border-red-50/50" />
                      </div>
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center py-20 flex-1">
                      <div className="relative mb-6">
                        <div className="w-24 h-24 bg-red-50 rounded-full flex items-center justify-center animate-pulse">
                          <img src="/assets/images/message-icon.png" className="w-12 opacity-80" alt="" />
                        </div>
                        <div className="absolute -bottom-1 -right-1 bg-green-500 w-4 h-4 rounded-full border-2 border-white shadow-sm" />
                      </div>
                      <h3 className="text-xl font-bold text-slate-900  tracking-tight mb-2">
                        {auth?.user?.full_name || auth?.user?.name || "Ready to Chat?"}
                      </h3>
                      <p className="text-sm text-slate-400 max-w-[250px] font-medium leading-relaxed">
                        Select a friend or business to start a real-time conversation.
                      </p>
                      <div className="mt-8 px-6 py-2 bg-slate-50 rounded-full border border-slate-100 text-[10px] font-bold text-red-500  ">
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
                                <span className="px-3 py-1 bg-white/70 backdrop-blur-md text-[9px] font-bold text-slate-400 rounded-full shadow-sm border border-slate-100  ">
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
                              status={m.status || "sent"}
                              onRetry={() => {
                                // We can't retry if it was a file since we didn't save the File object in Message state
                                // but let's at least try if it was text or if we refactor more.
                                // For now, let's just toast.
                                toast.info("Retrying message...");
                                if (m.message_type === "text") {
                                  performSendMessage(m, null, m.message_content || "", m.chat_room_id);
                                }
                              }}
                              messageType={m.message_type}
                              file={m.file}
                              fileUrl={formatUrl(m.file_url)}
                              fileType={m.file_type}
                              file_name={m.file_name || m.file?.file_name}
                              product_id={m.product_id}
                              product_name={m.product_name}
                              product_price={m.product_price}
                              product_image={m.product_image}
                              product_variant={m.product_variant}
                              order_id={m.order_id}
                              order_ref={m.order_ref}
                              onOrderClick={handleOrderClick}
                              onProductClick={handleProductClick}
                              onImageClick={handleImageClick}
                              onPdfClick={handlePdfClick}
                              onVideoClick={handleImageClick}
                              senderId={m.sender_id}
                              onAvatarClick={handleAvatarClick}
                              messageId={m.message_id}
                              onLongPress={handleMessageLongPress}
                              isEdited={!!m.updated_at && m.updated_at !== m.sent_at}
                              video_thumbnail={m.video_thumbnail}
                            />
                          </React.Fragment>
                        );
                      })}
                      <div ref={messagesEndRef} className="h-1" />
                    </div>
                  )}
                </div>
              </div>

              {/* ⚡ Immersive Product Tag Preview Overlay (BEFORE SENDING) */}
              <AnimatePresence mode="wait">
                {taggedProduct && !selectedFile && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 1.05, y: 10 }}
                    className="absolute inset-0 z-[120] bg-white/95 backdrop-blur-xl flex flex-col p-4 sm:p-8"
                  >
                    <div className="flex items-center justify-between mb-6 shrink-0">
                      <div className="flex flex-col text-left">
                        <h3 className="text-xl font-black text-slate-900 tracking-tight">Tagging Product</h3>
                        <p className="text-[10px] font-bold text-red-500  tracking-widest font-black">Inquiry Mode</p>
                      </div>
                      <button
                        onClick={() => {
                          setTaggedProduct(null);
                          setNewMessage("");

                          // Scrub URL params so it doesn't reappear on refresh
                          const url = new URL(window.location.href);
                          ['product_id', 'pname', 'pprice', 'pvariant', 'pimg'].forEach(p => url.searchParams.delete(p));
                          window.history.replaceState(null, "", url.toString());
                        }}
                        className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all active:scale-95"
                      >
                        <X size={20} />
                      </button>
                    </div>

                    <div className="flex-1 min-h-0 flex items-center justify-center relative group">
                      <div className="relative max-w-sm rounded-[0.5rem] overflow-hidden  border-red-50- bg-white transition-all hover:shadow-red-500/10 hover:-translate-y-1">
                        {taggedProduct.img && (
                          <div className="aspect-square rounded-[0.5rem] overflow-hidden mb-5  border-slate-50 shadow-inner">
                            <img src={taggedProduct.img} className="w-full h-full object-cover" alt="" />
                          </div>
                        )}
                        <h4 className="text-lg font-black text-slate-900 leading-tight mb-2 tracking-tight">{taggedProduct.name}</h4>
                        <p className="text-[12px] font-bold text-slate-400 mb-5">{taggedProduct.variant || "Base Model"}</p>
                        <div className="flex items-center justify-between pt-4 border-t border-slate-50">
                          <div className="flex flex-col">
                            <span className="text-[9px] font-bold text-slate-300  tracking-widest mb-1">Total Price</span>
                            <span className="text-xl font-black text-red-600 tracking-tighter">
                              ₦{Number(taggedProduct.price || 0).toLocaleString()}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="mt-8 mx-auto w-full max-w-xl">
                      <div className="mb-3 px-2 flex justify-between items-end">
                        <span className="text-[11px] font-black text-slate-400 tracking-widest flex items-center gap-2">
                          <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                          Your Inquiry Message
                        </span>
                        <button onClick={() => {
                          setTaggedProduct(null);
                          setNewMessage("");

                          // Scrub URL params
                          const url = new URL(window.location.href);
                          ['product_id', 'pname', 'pprice', 'pvariant', 'pimg'].forEach(p => url.searchParams.delete(p));
                          window.history.replaceState(null, "", url.toString());
                        }} className="text-[10px] font-black text-slate-400 hover:text-red-500  tracking-widest transition-colors">Discard Tag</button>
                      </div>
                      <MessageInput
                        value={newMessage}
                        onChange={setNewMessage}
                        onSend={handleSend}
                        onFileSelect={handleFile}
                        isSending={isSending}
                        selectedFile={selectedFile}
                        filePreview={filePreview}
                        onCancelFile={() => { setSelectedFile(null); setFilePreview(null); }}
                        alwaysAllowSend={!!taggedProduct}
                      />
                    </div>
                  </motion.div>
                )}

                {taggedOrderRef && !selectedFile && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 1.05, y: 10 }}
                    className="absolute inset-0 z-[125] bg-white/95 backdrop-blur-xl flex flex-col p-4 sm:p-8"
                  >
                    <div className="flex items-center justify-between mb-6 shrink-0">
                      <div className="flex flex-col text-left">
                        <h3 className="text-xl font-black text-slate-900 tracking-tight">Tagging Order</h3>
                        <p className="text-[10px] font-bold text-rose-500 tracking-widest font-black ">Support Mode</p>
                      </div>
                      <button
                        onClick={() => {
                          setTaggedOrderRef(null);
                          setTaggedOrderId(null);
                          setTaggedOrderData(null);
                          setNewMessage("");

                          // Scrub URL params
                          const url = new URL(window.location.href);
                          ['order_ref', 'order_id'].forEach(p => url.searchParams.delete(p));
                          window.history.replaceState(null, "", url.toString());
                        }}
                        className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all active:scale-95"
                      >
                        <X size={20} />
                      </button>
                    </div>

                    <div className="flex-1 min-h-0 flex items-center justify-center relative group">
                      <div className="relative max-w-sm w-full shadow-2xl rounded-[2.5rem] overflow-hidden border border-slate-100 p-8 bg-white transition-all hover:-translate-y-1">
                        <div className="w-16 h-16 rounded-[1.5rem] overflow-hidden mb-6 shadow-inner border border-rose-100 flex items-center justify-center bg-rose-50 text-rose-500">
                          {taggedOrderData?.items?.[0]?.product_image ? (
                            <img src={taggedOrderData.items[0].product_image} className="w-full h-full object-cover" alt="" />
                          ) : (
                            <Package size={28} />
                          )}
                        </div>

                        <div className="space-y-1 mb-6">
                          <p className="text-[10px] font-black text-slate-300  tracking-widest">Order Reference</p>
                          <h4 className="text-2xl font-black text-slate-900 leading-tight tracking-tighter ">{taggedOrderRef}</h4>
                        </div>

                        {taggedOrderData && (
                          <div className="grid grid-cols-2 gap-4 mb-8">
                            <div>
                              <p className="text-[9px] font-black text-slate-300  tracking-widest mb-1">Status</p>
                              <span className={`text-[10px] px-2 py-0.5 rounded-full font-black  tracking-wider ${taggedOrderData.status?.toLowerCase().includes('delivered') ? 'bg-emerald-100 text-emerald-600' :
                                taggedOrderData.status?.toLowerCase().includes('cancel') ? 'bg-rose-100 text-rose-600' :
                                  'bg-amber-100 text-amber-600'
                                }`}>
                                {taggedOrderData.status?.replace(/_/g, ' ')}
                              </span>
                            </div>
                            <div>
                              <p className="text-[9px] font-black text-slate-300  tracking-widest mb-1">Payment</p>
                              <span className="text-[10px] font-bold text-slate-600">₦{Number(taggedOrderData.total_amount || 0).toLocaleString()}</span>
                            </div>
                          </div>
                        )}

                        <div className="flex items-center justify-between pt-6 border-t border-slate-50">
                          <div className="flex flex-col">
                            <span className="text-[9px] font-black text-slate-300  tracking-widest mb-1">Context</span>
                            <span className="text-xs font-bold text-slate-500">Order Inquiry</span>
                          </div>
                          <div className="px-4 py-2 bg-rose-50 text-rose-600 rounded-2xl text-[10px] font-black  tracking-widest shadow-sm shadow-rose-100">
                            Selected
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="mt-8 mx-auto w-full max-w-xl">
                      <div className="mb-3 px-2 flex justify-between items-end">
                        <span className="text-[11px] font-black text-slate-400 tracking-widest flex items-center gap-2">
                          <div className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                          Your Inquiry Message
                        </span>
                        <button onClick={() => {
                          setTaggedOrderRef(null);
                          setTaggedOrderId(null);
                          setTaggedOrderData(null);
                          setNewMessage("");

                          // Scrub URL params
                          const url = new URL(window.location.href);
                          ['order_ref', 'order_id'].forEach(p => url.searchParams.delete(p));
                          window.history.replaceState(null, "", url.toString());
                        }} className="text-[10px] font-black text-slate-400 hover:text-red-500 tracking-widest transition-colors">Discard Tag</button>
                      </div>
                      <MessageInput
                        value={newMessage}
                        onChange={setNewMessage}
                        onSend={handleSend}
                        onFileSelect={handleFile}
                        isSending={isSending}
                        selectedFile={selectedFile}
                        filePreview={filePreview}
                        onCancelFile={() => { setSelectedFile(null); setFilePreview(null); }}
                        alwaysAllowSend={!!taggedOrderRef}
                      />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* ⚡ Fullscreen File Preview Overlay (BEFORE SENDING) */}
              <AnimatePresence>
                {selectedFile && filePreview && (selectedFile.type.startsWith('image/') || selectedFile.type.startsWith('video/') || selectedFile.type === 'application/pdf') && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 1.05, y: 10 }}
                    className="absolute inset-0 z-[120] bg-white/95 backdrop-blur-xl flex flex-col p-4 sm:p-8"
                  >
                    <div className="flex items-center justify-between mb-6 shrink-0">
                      <div className="flex flex-col text-left">
                        <h3 className="text-xl font-black text-slate-900 tracking-tight">
                          {selectedFile.type === 'application/pdf' ? 'Send PDF Document' :
                            selectedFile.type.startsWith('video/') ? 'Send Video' : 'Send Photo'}
                        </h3>
                        <p className="text-[10px] font-bold text-slate-400 tracking-widest">{selectedFile.name} • {(selectedFile.size / 1024).toFixed(1)} KB</p>
                      </div>
                      <button
                        onClick={() => { setSelectedFile(null); setFilePreview(null); }}
                        className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all active:scale-95"
                      >
                        <X size={20} />
                      </button>
                    </div>

                    <div className="flex-1 min-h-0 flex items-center justify-center relative rounded-3xl overflow-hidden border border-gray-100 bg-gray-50/50 p-2 sm:p-4">
                      {selectedFile.type.startsWith('image/') ? (
                        <img src={filePreview} className="max-w-full max-h-full object-contain rounded-2xl shadow-sm" alt="" />
                      ) : selectedFile.type.startsWith('video/') ? (
                        <video src={filePreview} className="max-w-full max-h-full object-contain rounded-2xl shadow-sm" controls autoPlay loop />
                      ) : selectedFile.type === 'application/pdf' ? (
                        <iframe src={filePreview} className="w-full h-full min-h-[50vh] rounded-2xl" title="PDF Preview" />
                      ) : (
                        <div className="flex flex-col items-center gap-4">
                          <div className="w-20 h-20 bg-red-50 text-red-500 rounded-3xl flex items-center justify-center shadow-sm">
                            <Package size={32} />
                          </div>
                          <p className="text-xs font-bold text-slate-400  tracking-widest">{selectedFile.name}</p>
                        </div>
                      )}
                    </div>

                    <div className="mt-8 mx-auto w-full max-w-xl">
                      <div className="mb-2 px-2 flex justify-between">
                        <span className="text-[10px] font-black text-slate-400  tracking-widest">Add your caption</span>
                        <button onClick={() => { setSelectedFile(null); setFilePreview(null); }} className="text-[10px] font-black text-red-500  tracking-widest hover:underline">Discard</button>
                      </div>
                      <MessageInput
                        value={newMessage}
                        onChange={setNewMessage}
                        onSend={handleSend}
                        onFileSelect={handleFile}
                        isSending={isSending}
                        selectedFile={selectedFile}
                        filePreview={null} // Hide the internal tiny preview since we have the big one
                        onCancelFile={() => { setSelectedFile(null); setFilePreview(null); }}
                        alwaysAllowSend={!!(taggedProduct || taggedOrderRef)}
                      />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div 
                className="p-4 border-t border-gray-100 shrink-0 relative z-[110]"
                style={{ 
                  paddingBottom: keyboardHeight > 50 ? '0.75rem' : 'calc(1rem + env(safe-area-inset-bottom))'
                }}
              >
                <style dangerouslySetInnerHTML={{
                  __html: `
                  @media (max-width: 1023px) {
                    nav[aria-label="Primary"] { display: ${isShowingChat ? 'none' : 'flex'} !important; }
                  }
                ` }} />
                {taggedOrderRef && (
                  <div className="mb-4 w-full p-2.5 sm:p-3 bg-rose-50 border border-rose-100 rounded-xl flex items-center justify-between gap-3 animate-in fade-in slide-in-from-bottom-1">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 bg-rose-500 rounded-lg text-white shadow-sm shadow-rose-200">
                        <Package size={14} />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[10px] sm:text-xs font-black text-rose-600 tracking-tight leading-none ">Referencing Order</span>
                        <span className="text-[11px] sm:text-sm font-bold text-rose-900 mt-1">{taggedOrderRef}</span>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        setTaggedOrderRef(null);
                        setTaggedOrderId(null);
                      }}
                      className="p-1.5 rounded-full hover:bg-white text-rose-400 hover:text-rose-600 transition-colors shadow-sm active:scale-95"
                    >
                      <X size={16} />
                    </button>
                  </div>
                )}

                <MessageInput
                  value={newMessage}
                  onChange={setNewMessage}
                  onSend={isEditingMessage ? handleUpdateMessage : handleSend}
                  onFileSelect={handleFile}
                  isSending={isSending}
                  selectedFile={selectedFile}
                  filePreview={filePreview}
                  onCancelFile={() => { setSelectedFile(null); setFilePreview(null); }}
                  alwaysAllowSend={!!(taggedProduct || taggedOrderRef)}
                />
              </div>
            </div>
          )}
        </main>
      </div>
      <AnimatePresence>
        {isViewerOpen && (
          <ChatImageViewer
            images={viewerImages}
            currentIndex={viewerIndex}
            onClose={() => setIsViewerOpen(false)}
            onChange={(idx) => setViewerIndex(idx)}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {isPdfViewerOpen && activePdfUrl && (
          <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 sm:p-20 bg-black/60 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="w-full h-full max-w-5xl bg-white rounded-[0.5rem] shadow-2xl flex flex-col overflow-hidden relative border border-slate-100"
            >
              <div className="p-6 border-b border-slate-50 flex items-center justify-between shrink-0">
                <div className="flex flex-col">
                  <h3 className="text-xl font-black text-slate-900 tracking-tight">Document Review</h3>
                  <p className="text-[10px] font-bold text-slate-400  tracking-widest">In-page Viewer</p>
                </div>
                <button
                  onClick={() => { setIsPdfViewerOpen(false); setActivePdfUrl(null); }}
                  className="w-10 h-10 rounded-full flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all active:scale-95"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto bg-slate-50 p-4 sm:p-8">
                <iframe
                  src={activePdfUrl}
                  className="w-full h-full min-h-[60vh] rounded-2xl shadow-lg bg-white border border-slate-100"
                  title="PDF Viewer"
                />
              </div>

              <div className="p-6 bg-white border-t border-slate-50 flex justify-end shrink-0">
                <button
                  onClick={() => { setIsPdfViewerOpen(false); setActivePdfUrl(null); }}
                  className="px-8 py-3 bg-red-500 text-white rounded-full text-[11px] shadow-lg shadow-red-500/20 active:scale-95 transition-all"
                >
                  Close Review
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Profile Picture Modal (using social image viewer) */}
      {isProfileModalOpen && activeAvatarUrl && (
        <ImageViewer
          src={activeAvatarUrl}
          onClose={() => setIsProfileModalOpen(false)}
          profileUserId={activeProfileId || undefined}
        />
      )}

      <AnimatePresence>
        {isMessageActionOpen && selectedMessageForAction && (
          <div className="fixed inset-0 z-[500] flex items-center justify-center p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-md"
              onClick={() => setIsMessageActionOpen(false)}
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 10 }}
              className="relative w-full max-w-xs bg-white rounded-[0.5rem] overflow-hidden border border-slate-100"
            >
              <div className="p-4 border-b border-slate-50 bg-slate-50/50">
                <p className="text-[10px] font-black text-slate-400  tracking-widest text-center">Message Options</p>
              </div>

              <div className="p-2 space-y-1">
                {String(selectedMessageForAction.sender_id) === String(userId) ? (
                  <>
                    <button
                      onClick={startEditing}
                      className="w-full flex items-center gap-3 p-4 hover:bg-slate-50 rounded-2xl transition-all text-slate-700 font-bold text-sm active:scale-[0.98]"
                    >
                      <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center text-blue-500">
                        <Zap size={16} />
                      </div>
                      Edit Message
                    </button>

                    <button
                      onClick={handleDeleteMessage}
                      className="w-full flex items-center gap-3 p-4 hover:bg-red-50 rounded-2xl transition-all text-red-600 font-bold text-sm active:scale-[0.98]"
                    >
                      <div className="w-8 h-8 rounded-full bg-red-50 flex items-center justify-center text-red-500">
                        <X size={16} />
                      </div>
                      Delete for everyone
                    </button>
                  </>
                ) : (
                  <button
                    onClick={handleReportMessage}
                    className="w-full flex items-center gap-3 p-4 hover:bg-red-50 rounded-2xl transition-all text-red-600 font-bold text-sm active:scale-[0.98]"
                  >
                    <div className="w-8 h-8 rounded-full bg-red-50 flex items-center justify-center text-red-500">
                      <AlertCircle size={16} />
                    </div>
                    Report Message
                  </button>
                )}

                <button
                  onClick={() => {
                    copyToClipboard(selectedMessageForAction.message_content || "");
                    setIsMessageActionOpen(false);
                    toast.success("Copied to clipboard");
                  }}
                  className="w-full flex items-center gap-3 p-4 hover:bg-slate-50 rounded-2xl transition-all text-slate-700 font-bold text-sm active:scale-[0.98]"
                >
                  <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-400">
                    <CheckCircle size={16} />
                  </div>
                  Copy Text
                </button>
              </div>

              <button
                onClick={() => setIsMessageActionOpen(false)}
                className="w-full p-4 border-t border-slate-50 text-slate-400 font-bold text-xs  tracking-widest hover:bg-slate-50"
              >
                Cancel
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isEditingMessage && selectedMessageForAction && (
          <div className="fixed inset-0 z-[550] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/20 backdrop-blur-md"
              onClick={() => setIsEditingMessage(false)}
            />

            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.98 }}
              className="relative w-full max-w-lg bg-gray-100 rounded-[0.5rem] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.2)] overflow-hidden p-6 border border-slate-300 transition-transform"
            >
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-black text-slate-400  tracking-[0.2em] flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                    Replying with Update
                  </span>
                  <span className="text-[9px] font-bold text-slate-300 tabular-nums">
                    {new Date(selectedMessageForAction.sent_at || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>

                <textarea
                  autoFocus
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  className="w-full
    rounded-3xl
    bg-gray-100
    border
    border-slate-300
    px-5
    py-2
    pr-11
    text-sm
    caret-red-500
    text-gray-500
    transition
    focus:outline-none focus:ring-0
    resize-none
    overflow-y-auto
    leading-tight
    mb-0
    block" rows={4}
                  placeholder="Type your update..."
                />

                <div className="flex items-center justify-between mt-4 bg-white/50 -mx-6 -mb-6 p-4 px-6 border-t border-slate-200">
                  <button
                    onClick={() => setIsEditingMessage(false)}
                    className="text-[10px] font-black text-slate-400 hover:text-red-500  tracking-widest transition-colors"
                  >
                    Discard
                  </button>
                  <div className="flex items-center gap-4">
                    <button
                      onClick={handleUpdateMessage}
                      className="flex items-center gap-2 bg-red-500 text-white px-6 py-2.5 rounded-full font-black text-[11px] shadow-xl shadow-red-100 hover:bg-red-600 transition-all active:scale-95"
                    >
                      Save Changes
                      <CheckCircle size={14} strokeWidth={3} />
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {modalOpen && selectedProductPayload && (
          <ProductPreviewModal
            open={modalOpen}
            payload={selectedProductPayload}
            onClose={() => {
              setModalOpen(false);
              setSelectedProductPayload(null);
              const url = new URL(window.location.href);
              if (url.searchParams.has("product_id")) {
                window.history.back();
              }
            }}
            onProductClick={handleProductClick}
            origin={clickPos}
          />
        )}
      </AnimatePresence>

      <OrderTrackingModal
        orderId={trackingOrderId}
        orderRef={trackingOrderRef}
        open={isTrackingModalOpen}
        onClose={() => {
          setIsTrackingModalOpen(false);
          setTrackingOrderId(null);
          setTrackingOrderRef(null);
        }}
      />
    </div>
  );
}

// ------------------- Image Viewer Component -------------------

function ChatImageViewer({
  images,
  currentIndex,
  onClose,
  onChange
}: {
  images: string[],
  currentIndex: number,
  onClose: () => void,
  onChange: (idx: number) => void
}) {
  const [direction, setDirection] = useState(0);

  const paginate = (newDirection: number) => {
    const nextIdx = currentIndex + newDirection;
    if (nextIdx >= 0 && nextIdx < images.length) {
      setDirection(newDirection);
      onChange(nextIdx);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[9999] bg-black/95 backdrop-blur-xl flex items-center justify-center select-none"
      onClick={onClose}
    >
      <div className="absolute top-6 left-6 right-6 flex items-center justify-between z-20 text-white">
        <div className="flex flex-col">
          <span className="text-xs font-black tracking-widest opacity-50">Stoqle Chat Gallery</span>
          <span className="text-sm font-bold">{currentIndex + 1} / {images.length}</span>
        </div>
        <button
          onClick={(e: any) => { e.stopPropagation(); onClose(); }}
          className="p-3 bg-white/10 hover:bg-white/20 rounded-full transition-all active:scale-90"
        >
          <X className="w-6 h-6" />
        </button>
      </div>

      <AnimatePresence initial={false} custom={direction}>
        <motion.div
          key={currentIndex}
          custom={direction}
          variants={{
            enter: (direction: number) => ({
              x: direction > 0 ? 1000 : -1000,
              opacity: 0,
              scale: 0.8
            }),
            center: {
              zIndex: 1,
              x: 0,
              opacity: 1,
              scale: 1
            },
            exit: (direction: number) => ({
              zIndex: 0,
              x: direction < 0 ? 1000 : -1000,
              opacity: 0,
              scale: 1.1
            })
          }}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{
            x: { type: "spring", stiffness: 300, damping: 30 },
            opacity: { duration: 0.2 },
            scale: { duration: 0.3 }
          }}
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={1}
          onDragEnd={(e: any, { offset, velocity }: any) => {
            const swipe = Math.abs(offset.x) > 50;
            if (swipe) {
              if (offset.x > 0) paginate(-1);
              else paginate(1);
            }
          }}
          className="absolute inset-x-0 inset-y-20 flex items-center justify-center p-4 sm:p-12 cursor-grab active:cursor-grabbing"
          onClick={(e: any) => e.stopPropagation()}
        >
          {(images[currentIndex]?.includes('.mp4') || images[currentIndex]?.includes('.webm') || images[currentIndex]?.includes('.ogg') || images[currentIndex]?.includes('blob:http') && !images[currentIndex]?.includes('image')) ? (
            <video
              src={images[currentIndex]}
              autoPlay
              controls
              controlsList="nodownload"
              playsInline
              className="max-w-full max-h-full object-contain rounded-2xl shadow-2xl ring-1 ring-white/10 pointer-events-auto"
            />
          ) : (
            <img
              src={images[currentIndex]}
              alt={`Media ${currentIndex + 1}`}
              className="max-w-full max-h-full object-contain rounded-2xl shadow-2xl ring-1 ring-white/10"
            />
          )}
        </motion.div>
      </AnimatePresence>

      {/* Navigation Arrows */}
      <div className="absolute inset-x-4 top-1/2 -translate-y-1/2 hidden sm:flex items-center justify-between pointer-events-none">
        <button
          className={`p-4 rounded-full bg-white/5 hover:bg-white/10 text-white transition-all pointer-events-auto active:scale-90 ${currentIndex === 0 ? 'opacity-20 pointer-events-none' : ''}`}
          onClick={(e: any) => { e.stopPropagation(); paginate(-1); }}
        >
          <ChevronLeftIcon className="w-8 h-8" />
        </button>
        <button
          className={`p-4 rounded-full bg-white/5 hover:bg-white/10 text-white transition-all pointer-events-auto active:scale-90 ${currentIndex === images.length - 1 ? 'opacity-20 pointer-events-none' : ''}`}
          onClick={(e: any) => { e.stopPropagation(); paginate(1); }}
        >
          <ChevronRightIcon className="w-8 h-8" />
        </button>
      </div>

      <div className="absolute bottom-10 left-0 right-0 flex justify-center gap-2 overflow-x-auto px-10 no-scrollbar">
        {images.map((img, i) => (
          <div
            key={i}
            onClick={(e: any) => { e.stopPropagation(); onChange(i); }}
            className={`w-12 h-12 rounded-lg border-2 transition-all cursor-pointer overflow-hidden shrink-0 ${currentIndex === i ? 'border-red-500 scale-110 shadow-lg shadow-red-500/50' : 'border-transparent opacity-50 hover:opacity-100'
              }`}
          >
            {(img?.includes('.mp4') || img?.includes('.webm') || img?.includes('.ogg') || img?.includes('blob:http') && !img?.includes('image')) ? (
              <video src={`${img}#t=1.0`} className="w-full h-full object-cover pointer-events-none" preload="metadata" />
            ) : (
              <img src={img} className="w-full h-full object-cover pointer-events-none" alt="" />
            )}
          </div>
        ))}
      </div>
    </motion.div>
  );
}

// ------------------- Helper Components -------------------

function OrderTrackingModal({ orderId, orderRef, open, onClose }: any) {
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [selectedShipmentIdx, setSelectedShipmentIdx] = useState(0);
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;

  useEffect(() => {
    const identifier = orderId || orderRef;
    if (open && identifier) {
      setLoading(true);
      fetch(`${API_BASE_URL}/api/orders/${identifier}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
        .then(res => res.json())
        .then(data => {
          if (data.success) setOrder(data.data);
        })
        .catch(err => console.error("Tracking fetch error", err))
        .finally(() => setLoading(false));
    }
  }, [open, orderId, orderRef]);

  if (!open) return null;

  const targetVendor = order?.vendors?.find((v: any) => v.reference_no === orderRef) || order?.vendors?.[0];

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-white rounded-3xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300">
        <header className="px-6 py-5 border-b border-slate-50 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-500 rounded-xl flex items-center justify-center text-white shadow-sm ring-4 ring-red-50">
              <Package size={20} />
            </div>
            <div>
              <h3 className="font-black text-slate-900 text-base leading-tight">Order Tracking</h3>
              <p className="text-[10px] font-bold text-slate-400 mt-0.5  tracking-wider">{orderRef}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white rounded-full text-slate-400 hover:text-slate-900 transition-all active:scale-90 shadow-sm border border-transparent hover:border-slate-100">
            <X size={20} />
          </button>
        </header>

        <div className="p-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
          {loading ? (
            <div className="py-20 space-y-8 animate-pulse">
              <div className="flex flex-col items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-slate-100" />
                <div className="h-4 w-40 bg-slate-100 rounded-full" />
              </div>
              <div className="space-y-4">
                <div className="h-12 w-full bg-slate-50 rounded-2xl" />
                <div className="h-24 w-full bg-slate-50 rounded-2xl" />
              </div>
            </div>
          ) : order && targetVendor ? (
            <div className="space-y-6">
              {targetVendor.shipments?.length > 0 ? (
                <div>
                  <div className="flex gap-2 overflow-x-auto pb-4 mb-2 no-scrollbar">
                    {targetVendor.shipments.map((s: any, idx: number) => (
                      <button
                        key={s.id || idx}
                        onClick={() => setSelectedShipmentIdx(idx)}
                        className={`px-3 py-1.5 rounded-full text-[10px] font-black transition-all ${selectedShipmentIdx === idx
                          ? "bg-red-500 text-white shadow-md shadow-red-500/20"
                          : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                          }`}
                      >
                        Shipment #{idx + 1}
                      </button>
                    ))}
                  </div>
                  <div className="relative pl-6 space-y-6 after:absolute after:left-[11px] after:top-2 after:bottom-2 after:w-[2px] after:bg-slate-100">
                    <div className="relative group">
                      <div className="absolute -left-[23px] top-1.5 w-[16px] h-[16px] rounded-full border-4 border-white z-10 shadow-sm bg-green-500 ring-4 ring-green-100" />
                      <div>
                        <p className="text-xs font-black tracking-tight leading-tight text-slate-900">
                          {targetVendor.shipment_status?.replace(/_/g, ' ') || 'Processing'}
                        </p>
                        <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">
                          Parcel is currently being processed. Status: {targetVendor.shipment_status || 'In Transit'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-10 opacity-50">
                  <Package className="w-12 h-12 mx-auto mb-4 text-slate-300" />
                  <p className="text-sm font-bold">No shipment assigned yet.</p>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-10 opacity-50">Unable to load details.</div>
          )}
        </div>
      </div>
    </div>
  );
}

// Ensure the default export is at the end
export default function MessagesPage(props: any) {
  return (
    <React.Suspense fallback={null}>
      <MessagesPageContent {...props} />
    </React.Suspense>
  );
}
