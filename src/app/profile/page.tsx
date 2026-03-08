// ProfileHeader.tsx
"use client";

import React, { useEffect, useMemo, useLayoutEffect, useState, useRef } from "react";
import PostModal from "../../components/modal/postModal"; // adjust path if needed
import { useAuth } from "@/src/context/authContext";
import { useRouter } from "next/navigation";
import Header from "../../components/feed/profile/header";
import CreateNoteModal from "../../components/notes/createNoteModal";
import ShimmerGrid from "@/src/components/shimmer";
import { fetchBusinessProducts, fetchProductById, toggleProductLike } from "@/src/lib/api/productApi";
import ProductPreviewModal from "@/src/components/product/addProduct/modal/previewModal";
import type { PreviewPayload, ProductSku } from "@/src/types/product";
import { API_BASE_URL } from "@/src/lib/config";
import { FaHeart, FaRegHeart } from "react-icons/fa";


type ApiPost = any;

type User = { name: string; avatar: string; id?: number | string; };

type Post = {
  id: number;
  src?: string;
  isVideo?: boolean;
  isImage?: boolean;
  caption?: string;
  note_caption?: string;
  text?: string;
  subtitle?: string;
  user: User;
  liked: boolean;
  likeCount: number;
  coverType?: string;
  noteConfig?: any;
  rawCreatedAt?: string;
  apiId?: number;
};

type Props = { postCount?: number };
const STICKY_BUFFER = 10; // px — prevents shaking


const VIDEO_EXT_RE = /\.(mp4|webm|ogg|mov)(\?.*)?$/i;
const IMAGE_EXT_RE = /\.(jpe?g|png|gif|webp|bmp|svg)(\?.*)?$/i;
const isVideoUrl = (u?: string) => !!u && VIDEO_EXT_RE.test(u);
const isImageUrl = (u?: string) => !!u && IMAGE_EXT_RE.test(u);

// Use local images in public folder
const NO_IMAGE_PLACEHOLDER = "/assets/images/favio.png"; // fallback post image
const DEFAULT_AVATAR = "/assets/images/favio.png";       // fallback avatar
const DEFAULT_BG = "/assets/images/background.png";      // fallback background


// keep mapping but mark isImage too
const mapApiPost = (p: any): Post => {
  const apiId = p.social_post_id ?? Math.floor(Math.random() * 1e6);
  let src: string | undefined = undefined;

  if (Array.isArray(p.images) && p.images.length > 0) {
    const cover = p.images.find((i: any) => i.is_cover === 1) ?? p.images[0];
    src = cover?.image_url;
  }

  if (!src && p.cover_type !== "note") {
    src = NO_IMAGE_PLACEHOLDER; // use local fallback
  }

  const isVideo = isVideoUrl(src);
  const isImage = isImageUrl(src);
  const caption = p.text ?? p.subtitle ?? "";
  const note_caption = p.subtitle ?? "";

  return {
    id: apiId,
    apiId,
    src,
    isVideo,
    isImage,
    caption,
    note_caption,
    user: {
      id: p.user_id ?? p.user?.user_id ?? p.user?.id,
      name: p.author_name ?? "---",
      avatar: p.author_pic ?? DEFAULT_AVATAR, // use local fallback
    },
    liked: Boolean(p.liked_by_me),
    likeCount: p.likes_count ?? 0,
    coverType: p.cover_type,
    noteConfig: p.config,
    rawCreatedAt: p.created_at,
  };
};


export default function ProfileHeader({ postCount = 12 }: Props) {
  // PROFILE state (from /api/auth/profile/me)
  const [profileApi, setProfileApi] = useState<any | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);

  // Posts UI state: we now keep media (images/videos) separate from notes
  const [mediaPosts, setMediaPosts] = useState<Post[]>([]);
  const [notePosts, setNotePosts] = useState<Post[]>([]);
  const [postsLoading, setPostsLoading] = useState(true);
  const [postsError, setPostsError] = useState<string | null>(null);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [createNoteOpen, setCreateNoteOpen] = useState(false);

  // Products state
  const [vendorProducts, setVendorProducts] = useState<any[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [selectedProductPayload, setSelectedProductPayload] = useState<PreviewPayload | null>(null);
  const [productModalOpen, setProductModalOpen] = useState(false);
  const [fetchingProduct, setFetchingProduct] = useState(false);
  const [productLikeData, setProductLikeData] = useState<Record<number, { liked: boolean, count: number }>>({});

  const formatUrl = (url: string) => {
    if (!url) return NO_IMAGE_PLACEHOLDER;
    if (url.startsWith("http")) return url;
    return url.startsWith("/public") ? `${API_BASE_URL}${url}` : `${API_BASE_URL}/public/${url}`;
  };

  const auth = useAuth();
  const router = useRouter();

  // Tabs state & animation
  const [activeTabIndex, setActiveTabIndex] = useState(0);
  const tabs = useMemo(() => {
    const base = ["Notes", "Posts"];
    if (profileApi?.is_business_owner) base.push("Products");
    return base;
  }, [profileApi?.is_business_owner]);

  // history push tracking for modal
  const pushedRef = useRef(false);

  // swipe handling
  const touchStartX = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);

  // fetch profile from auth endpoint
  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    async function loadProfile() {
      setProfileLoading(true);
      setProfileError(null);
      try {
        const base = process.env.NEXT_PUBLIC_API_URL;
        if (!base) throw new Error("NEXT_PUBLIC_API_URL is not defined in environment");

        const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
        const headers: HeadersInit = { "Content-Type": "application/json" };
        if (token) headers["Authorization"] = `Bearer ${token}`;

        const res = await fetch(`${base.replace(/\/$/, "")}/api/auth/profile/me`, {
          signal: controller.signal,
          headers,
        });

        if (!res.ok) {
          throw new Error(`Profile API returned ${res.status}`);
        }

        const json = await res.json();
        if (cancelled) return;
        const d = json?.data ?? json;
        const normalized = {
          user: d?.user ?? null,
          staff_profiles: d?.staff_profiles ?? [],
          business: d?.business ?? null,
          stats: d?.stats ?? null,
          recent_followers: d?.recent_followers ?? [],
          is_business_owner: Boolean(d?.is_business_owner),
        };
        setProfileApi(normalized);
      } catch (err: any) {
        if (err.name === "AbortError") return;
        console.error("Failed to fetch profile:", err);
        if (!cancelled) setProfileError(err.message ?? "Failed to load profile");
      } finally {
        if (!cancelled) setProfileLoading(false);
      }
    }

    loadProfile();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, []);

  // fetch vendor products if owner
  useEffect(() => {
    // Extensive debug logging to see what profileApi contains
    console.log("Profile state updated:", {
      isOwner: profileApi?.is_business_owner,
      business: profileApi?.business,
      all: profileApi
    });

    const businessId = profileApi?.business?.business_id || profileApi?.business?.id;
    const isOwner = profileApi?.is_business_owner;

    if (!businessId || !isOwner) {
      console.log("Conditions not met for product load. businessId:", businessId, "isOwner:", isOwner);
      return;
    }

    const loadVendorProducts = async () => {
      console.log("Loading products for business ID:", businessId);
      setProductsLoading(true);
      try {
        const res = await fetchBusinessProducts(businessId, 100);
        console.log("Raw business products API response:", res);

        // Handle variations in API response structure
        let foundProducts = [];
        if (res?.data?.products && Array.isArray(res.data.products)) {
          foundProducts = res.data.products;
        } else if (res?.data && Array.isArray(res.data)) {
          foundProducts = res.data;
        } else if (Array.isArray(res)) {
          foundProducts = res;
        }

        console.log("Successfully extracted products:", foundProducts.length);
        setVendorProducts(foundProducts);
      } catch (err) {
        console.error("Critical: Failed to load vendor products:", err);
      } finally {
        setProductsLoading(false);
      }
    };

    loadVendorProducts();
  }, [profileApi]);

  const handleProductLike = async (e: React.MouseEvent, productId: number, baseCount: number) => {
    e.stopPropagation();
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    if (!token) return;

    const current = productLikeData[productId] || { liked: false, count: baseCount };
    const newLiked = !current.liked;
    const newCount = newLiked ? current.count + 1 : Math.max(0, current.count - 1);

    setProductLikeData(prev => ({
      ...prev,
      [productId]: { liked: newLiked, count: newCount }
    }));

    try {
      const res = await toggleProductLike(productId, token);
      setProductLikeData(prev => ({
        ...prev,
        [productId]: { liked: res.data.liked, count: res.data.likes_count }
      }));
    } catch (err) {
      console.error("Product like error", err);
      setProductLikeData(prev => ({ ...prev, [productId]: current }));
    }
  };

  const handleProductClick = async (productId: number) => {
    if (fetchingProduct) return;
    try {
      setFetchingProduct(true);
      const res = await fetchProductById(productId);
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
          productVideo: (dbProduct.media || []).find((m: any) => m.type === "video")
            ? { name: "vid", url: formatUrl(dbProduct.media.find((m: any) => m.type === "video")!.url) }
            : null,
          useCombinations: dbProduct.use_combinations === 1,
          params: (dbProduct.params || []).map((p: any) => ({ key: p.param_key, value: p.param_value })),
          variantGroups: (dbProduct.variant_groups || []).map((g: any) => ({
            id: String(g.group_id),
            title: g.title,
            allowImages: g.allow_images === 1,
            entries: (g.options || []).map((o: any) => ({
              id: String(o.option_id),
              name: o.name,
              price: o.price,
              quantity: o.initial_quantity || 0,
              images: (o.media || []).map((m: any) => ({ name: "img", url: formatUrl(m.url) }))
            }))
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

        setSelectedProductPayload(mappedPayload);
        setProductModalOpen(true);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setFetchingProduct(false);
    }
  };

  // fetch posts separately and partition into media vs notes
  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    async function loadPosts() {
      setPostsLoading(true);
      setPostsError(null);
      try {
        const base = process.env.NEXT_PUBLIC_API_URL;
        if (!base) throw new Error("NEXT_PUBLIC_API_URL is not defined in environment");
        const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
        const headers: HeadersInit = { "Content-Type": "application/json" };
        if (token) headers["Authorization"] = `Bearer ${token}`;

        const resp = await fetch(`${base.replace(/\/$/, "")}/api/social/me`, {
          signal: controller.signal,
          headers,
        });

        if (!resp.ok) {
          throw new Error(`Posts API returned ${resp.status}`);
        }

        const json = await resp.json();
        const apiPosts: any[] =
          json?.data?.posts && Array.isArray(json.data.posts) ? json.data.posts : (Array.isArray(json?.data) ? json.data : (Array.isArray(json?.posts) ? json.posts : []));

        if (cancelled) return;

        // map
        const mapped = apiPosts.map((p) => mapApiPost(p));

        // ordering (keep your existing logic: Recommend = backend order, else newest first)
        const ordered =
          mapped;
        const media: Post[] = [];
        const notes: Post[] = [];

        for (const m of ordered) {
          if (m.coverType === "note") {
            notes.push(m);
            continue;
          }
          if (m.isVideo || m.isImage) {
            media.push(m);
            continue;
          }
          // fallback: if src absent or unknown type, treat as note
          notes.push(m);
        }

        setMediaPosts(media.slice(0, postCount));
        setNotePosts(notes.slice(0, postCount));
      } catch (err: any) {
        if (err.name === "AbortError") return;
        console.error("Failed to load posts:", err);
        if (!cancelled) setPostsError(err.message ?? "Failed to load posts");
      } finally {
        if (!cancelled) setPostsLoading(false);
      }
    }

    loadPosts();
    return () => {
      cancelled = true;
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postCount]);

  // When posts change (or on load), check if URL has ?post=<id> -> open modal.
  useEffect(() => {
    const tryOpenFromUrl = async () => {
      if (typeof window === "undefined") return;
      const url = new URL(window.location.href);
      const param = url.searchParams.get("post");
      if (!param) return;
      const postId = Number(param);
      if (isNaN(postId)) return;

      // search both mediaPosts and notePosts
      const all = [...mediaPosts, ...notePosts];
      const found = all.find((p) => Number(p.id) === postId);
      if (found) {
        setSelectedPost(found);
        pushedRef.current = false;
        return;
      }

      try {
        const base = process.env.NEXT_PUBLIC_API_URL;
        if (!base) throw new Error("NEXT_PUBLIC_API_URL is not defined in environment");
        const res = await fetch(`${base.replace(/\/$/, "")}/api/social/${postId}`);
        if (!res.ok) throw new Error("Post not found");
        const json = await res.json();
        const single = mapApiPost(json?.data ?? json);
        setSelectedPost(single);
        pushedRef.current = false;
      } catch (err) {
        setSelectedPost({
          id: postId,
          subtitle: "postId",
          caption: "Post unavailable",
          user: { name: "---", avatar: `---` },
          liked: false,
          likeCount: 0,
        });
        pushedRef.current = false;
      }
    };

    tryOpenFromUrl();
  }, [mediaPosts, notePosts]);

  // handle back/forward (popstate): open/close modal based on URL or state
  useEffect(() => {
    const onPop = (ev: PopStateEvent) => {
      const url = new URL(window.location.href);
      const param = url.searchParams.get("post");
      if (param) {
        const postId = Number(param);
        if (isNaN(postId)) {
          setSelectedPost(null);
          return;
        }
        const all = [...mediaPosts, ...notePosts];
        const found = all.find((p) => Number(p.id) === postId);
        if (found) {
          setSelectedPost(found);
          pushedRef.current = false;
        } else {
          (async () => {
            try {
              const base = process.env.NEXT_PUBLIC_API_URL;
              if (!base) throw new Error("NEXT_PUBLIC_API_URL is not defined in environment");
              const res = await fetch(`${base.replace(/\/$/, "")}/api/social/${postId}`);
              if (!res.ok) throw new Error("Post not found");
              const json = await res.json();
              setSelectedPost(mapApiPost(json?.data ?? json));
            } catch {
              setSelectedPost({
                id: postId,
                caption: "Post unavailable",
                user: { name: "---", avatar: `---` },
                liked: false,
                likeCount: 0,
              });
            }
          })();
        }
      } else {
        setSelectedPost(null);
      }
    };

    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [mediaPosts, notePosts]);

  // Open modal and push URL param
  const openPostWithUrl = (post: Post) => {
    setSelectedPost(post);
    try {
      const url = new URL(window.location.href);
      url.searchParams.set("post", String(post.id));
      window.history.pushState({ postId: post.id, modal: true }, "", url.toString());
      pushedRef.current = true;
    } catch (err) {
      console.warn("Failed to update URL", err);
      pushedRef.current = false;
    }
  };

  // Close modal and remove param safely
  const closeModal = () => {
    setSelectedPost(null);

    try {
      const url = new URL(window.location.href);
      const hadParam = url.searchParams.has("post");
      if (!hadParam) return;

      if (pushedRef.current && window.history.state && window.history.state.modal) {
        window.history.back();
        pushedRef.current = false;
        return;
      }

      url.searchParams.delete("post");
      window.history.replaceState({}, "", url.toString());
      pushedRef.current = false;
    } catch (err) {
      console.warn("Failed to clean URL after modal close", err);
    }
  };

  const toggleLike = (postId: string | number) => {
    // noop - implement your API call here if desired
  };

  // Tab change helpers
  const goToTab = (index: number) => {
    if (index < 0 || index >= tabs.length) return;
    setActiveTabIndex(index);
  };

  const nextTab = () => goToTab(Math.min(tabs.length - 1, activeTabIndex + 1));
  const prevTab = () => goToTab(Math.max(0, activeTabIndex - 1));

  // keyboard arrows for tab navigation
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") nextTab();
      if (e.key === "ArrowLeft") prevTab();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activeTabIndex, tabs.length]);

  // touch handlers for swipe
  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchEndX.current = null;
  };
  const onTouchMove = (e: React.TouchEvent) => {
    touchEndX.current = e.touches[0].clientX;
  };
  const onTouchEnd = () => {
    if (touchStartX.current == null || touchEndX.current == null) return;
    const diff = touchStartX.current - touchEndX.current;
    const threshold = 40;
    if (diff > threshold) {
      nextTab();
    } else if (diff < -threshold) {
      prevTab();
    }
    touchStartX.current = null;
    touchEndX.current = null;
  };

  // derive display name: business_name if owner else user's full_name
  const displayName = useMemo(() => {
    const business = profileApi?.business;
    const user = profileApi?.user;
    if (profileApi?.is_business_owner && business?.business_name) return business.business_name;
    return user?.full_name ?? user?.name ?? "---";
  }, [profileApi]);




  const tabsWrapperRef = useRef<HTMLDivElement | null>(null);
  const tabsInnerRef = useRef<HTMLDivElement | null>(null);
  const tabsPlaceholderRef = useRef<HTMLDivElement | null>(null);
  const [isSticky, setIsSticky] = useState(false);
  const [stickyStyle, setStickyStyle] = useState<React.CSSProperties | undefined>(undefined);
  const tabsInitialTopRef = useRef<number | null>(null);

  // helper to find navbar element (tries multiple selectors)
  const findNavbar = () =>
    document.querySelector("header, [role='banner'], .main-navbar") as HTMLElement | null;

  const updateStickyState = () => {
    const el = tabsWrapperRef.current;
    const initialTop = tabsInitialTopRef.current;
    if (!el || initialTop === null) return;

    const navbar = findNavbar();
    const navbarHeight = navbar ? navbar.offsetHeight : 0;

    const shouldStick =
      window.scrollY + navbarHeight >= initialTop + STICKY_BUFFER;

    if (shouldStick) {
      const rect = el.getBoundingClientRect();

      setStickyStyle({
        position: "fixed",
        top: `${navbarHeight}px`,
        left: `${rect.left}px`,
        width: `${rect.width}px`,
        zIndex: 60,
      });

      if (tabsPlaceholderRef.current) {
        tabsPlaceholderRef.current.style.height = `${rect.height}px`;
      }
    } else {
      setStickyStyle(undefined);

      if (tabsPlaceholderRef.current) {
        tabsPlaceholderRef.current.style.height = "0px";
      }
    }

    setIsSticky(shouldStick);
  };
  const getNoteStyles = (config: any) => {
    if (!config) return { background: "#f1f5f9" }; // Fallback

    // Ensure config is an object (parse if it's a string from API)
    let cfg = config;
    if (typeof config === "string") {
      try { cfg = JSON.parse(config); } catch (e) { return { background: "#f1f5f9" }; }
    }

    const { template, startColor, endColor, lineSpacing = 25 } = cfg;
    const baseBg = endColor ? `linear-gradient(135deg, ${startColor}, ${endColor})` : startColor;

    let patternCSS = "";
    let bgSize = "auto";

    if (template === "grid") {
      patternCSS = `linear-gradient(to right, rgba(0,0,0,0.05) 1px, transparent 1px), linear-gradient(to bottom, rgba(0,0,0,0.05) 1px, transparent 1px)`;
      bgSize = `${lineSpacing}px ${lineSpacing}px`;
    } else if (template === "diagonal") {
      patternCSS = `repeating-linear-gradient(45deg, transparent, transparent ${lineSpacing}px, rgba(255,255,255,0.2) ${lineSpacing}px, rgba(255,255,255,0.2) ${lineSpacing * 2}px)`;
    } else if (template === "stripes") {
      patternCSS = `repeating-linear-gradient(0deg, transparent, transparent ${lineSpacing}px, rgba(0,0,0,0.03) ${lineSpacing}px, rgba(0,0,0,0.03) ${lineSpacing + 1}px)`;
    } else if (template === "dots") {
      patternCSS = `radial-gradient(rgba(0,0,0,0.1) 1.5px, transparent 0)`;
      bgSize = `${lineSpacing}px ${lineSpacing}px`;
    }

    return {
      backgroundColor: startColor,
      backgroundImage: patternCSS ? `${patternCSS}, ${baseBg}` : baseBg,
      backgroundSize: bgSize,
      color: cfg.textStyle?.color ?? "#111827",
      fontSize: `${(cfg.textStyle?.fontSize ?? 28) * 0.6}px`, // Scale down for grid thumbnails
      fontWeight: cfg.textStyle?.fontWeight ?? "800",
    };
  };



  // measure on layout and add listeners
  useLayoutEffect(() => {
    const el = tabsWrapperRef.current;
    if (!el) return;

    const rect = el.getBoundingClientRect();
    tabsInitialTopRef.current = rect.top + window.scrollY;

    const onScroll = () => updateStickyState();
    const onResize = () => updateStickyState();

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
    };
  }, []);


  // Tab panes content
  const TabsBar = (
    <>
      {/* placeholder prevents layout jump when tabs become fixed */}
      <div ref={tabsPlaceholderRef} style={{ height: 0, transition: "height 160ms ease" }} />

      <div
        ref={tabsWrapperRef}
        className="bg-white p-3 flex justify-center"
        style={stickyStyle}
      >

        {/* inner container to allow horizontal scroll preserving natural layout */}
        <div ref={tabsInnerRef} className="flex gap-2 overflow-x-auto">
          {tabs.map((t, i) => (
            <button
              key={t}
              onClick={() => setActiveTabIndex(i)}
              className={`px-3 py-2 rounded-lg text-sm font-bold transition whitespace-nowrap ${i === activeTabIndex ? "bg-slate-100 text-black" : "text-slate-400 hover:bg-slate-100"
                }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>
    </>
  );


  const TabPanes = (
    <div
      className="relative overflow-hidden"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      <div
        className="flex transition-transform duration-450 ease-in-out"
        style={{
          width: `${tabs.length * 100}%`,
          transform: `translateX(-${activeTabIndex * (100 / tabs.length)}%)`,
        }}
      >
        {/* Notes pane */}
        <div style={{ width: `${100 / tabs.length}%`, flexShrink: 0 }}>
          {postsLoading ? (
            <ShimmerGrid count={10} />
          ) : notePosts.length === 0 ? (
            <div className="py-16 flex flex-col items-center justify-center text-center text-slate-500">
              <img src="/assets/images/post.png" alt="No posts" className="w-40 h-40 object-contain mb-4 opacity-80" />
              <button
                onClick={() => setCreateNoteOpen(true)}
                className="mt-4 inline-flex items-center gap-2 rounded-full bg-rose-500 px-5 py-2 text-sm font-medium text-white"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                Create
              </button>
              <p className="text-sm font-medium">Create your first note</p>
            </div>
          ) : (
            <div className="post-grid mb-20">
              {notePosts.map((post) => (
                <article
                  key={post.id}
                  onClick={() => openPostWithUrl(post)}
                  className="group flex flex-col rounded-3xl bg-white cursor-pointer transition"
                >
                  <div className="relative overflow-hidden rounded-2xl bg-slate-200">
                    {post.isVideo && (
                      <div className="absolute top-3 right-3 z-20 flex h-6 w-6 items-center justify-center rounded-full bg-black/50">
                        <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 text-white ml-0.5">
                          <path d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347c-.75.412-1.667-.13-1.667-.986V5.653z" />
                        </svg>
                      </div>
                    )}
                    {post.coverType === "note" && !post.src ? (
                      <div
                        className="w-full min-h-[200px] max-h-[400px] lg:h-[350px] h-[300px] flex items-center justify-center p-6 rounded-2xl border border-slate-200 relative overflow-hidden"
                        style={getNoteStyles(post.noteConfig)}
                      >
                        {/* Emoji Layer (Parsed from config) */}
                        {(() => {
                          const cfg = typeof post.noteConfig === 'string' ? JSON.parse(post.noteConfig) : post.noteConfig;
                          if (cfg?.emojis?.length > 0) {
                            return (
                              <div
                                className="absolute inset-0 flex items-center justify-around opacity-30 pointer-events-none"
                                style={{ filter: cfg.emojiBlur ? "blur(4px)" : "none" }}
                              >
                                {cfg.emojis.slice(0, 3).map((emoji: string, idx: number) => (
                                  <span key={idx} className="text-4xl transform rotate-12">{emoji}</span>
                                ))}
                              </div>
                            );
                          }
                        })()}

                        <div className="text-center relative z-10">
                          <p className="line-clamp-4 px-2" style={{ color: 'inherit', fontSize: 'inherit', fontWeight: 'inherit' }}>
                            {post.noteConfig?.text ?? post.caption ?? "Note"}
                          </p>
                        </div>
                      </div>
                    ) : post.isVideo ? (
                      <video src={post.src} className="w-full h-auto min-h-[200px] max-h-[350px] object-cover rounded-2xl border border-slate-200" muted loop playsInline />
                    ) : (
                      <img src={post.src} alt={post.caption} className="w-full h-auto min-h-[200px] max-h-[350px] object-cover border border-slate-200 rounded-2xl transition-transform duration-500 group-hover:scale-105 hover:border" />
                    )}
                  </div>
                  <div className="flex flex-col p-4">
                    <p className="text-sm text-slate-600 line-clamp-2 leading-relaxed font-semibold mb-2">
                      {post.coverType === "note" ? post.note_caption : post.caption}
                    </p>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <img src={post.user.avatar} className="h-5 w-5 rounded-full object-cover ring-2 ring-white" alt={post.user.name} />
                        <span className="max-w-[150px] truncate text-xs font-medium text-slate-400 capitalize">{post.user.name}</span>
                      </div>
                      <button onClick={(e) => e.stopPropagation()} className="flex items-center gap-1.5 transition-all active:scale-90">
                        <svg viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" fill={post.liked ? "currentColor" : "none"} className={`w-6 h-6 transition-colors duration-300 ${post.liked ? "text-rose-500" : "text-slate-300 hover:text-slate-400"}`}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
                        </svg>
                        <span className={`text-xs font-bold ${post.liked ? "text-rose-500" : "text-slate-400"}`}>{post.likeCount}</span>
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>

        {/* Posts pane */}
        <div style={{ width: `${100 / tabs.length}%`, flexShrink: 0 }} className="p-2">
          {postsLoading ? (
            <ShimmerGrid count={10} />
          ) : mediaPosts.length === 0 ? (
            <div className="py-16 flex flex-col items-center justify-center text-center text-slate-500">
              <img src="/assets/images/post.png" alt="No posts" className="w-40 h-40 object-contain mb-4 opacity-80" />
              <button
                onClick={() => router.push("/products/new")}
                className="mt-4 inline-flex items-center gap-2 rounded-full bg-rose-500 px-5 py-2 text-sm font-medium text-white shadow-sm hover:bg-rose-600 active:scale-95 transition"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                Post
              </button>
              <p className="text-sm font-medium">Make your first post.</p>
            </div>
          ) : (
            <div className="post-grid mb-20">
              {mediaPosts.map((post) => (
                <article
                  key={post.id}
                  onClick={() => openPostWithUrl(post)}
                  className="group flex flex-col rounded-3xl bg-white cursor-pointer transition"
                >
                  <div className="relative overflow-hidden rounded-2xl bg-slate-200">
                    {post.isVideo && (
                      <div className="absolute top-3 right-3 z-20 flex h-6 w-6 items-center justify-center rounded-full bg-black/50">
                        <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 text-white ml-0.5">
                          <path d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347c-.75.412-1.667-.13-1.667-.986V5.653z" />
                        </svg>
                      </div>
                    )}
                    {post.isVideo ? (
                      <video src={post.src} className="w-full h-auto min-h-[200px] max-h-[350px] object-cover rounded-2xl border border-slate-200" muted loop playsInline />
                    ) : (
                      <img src={post.src} alt={post.caption} className="w-full h-auto min-h-[200px] max-h-[350px] object-cover border border-slate-200 rounded-2xl transition-transform duration-500 group-hover:scale-105 hover:border" />
                    )}
                  </div>
                  <div className="flex flex-col p-4">
                    <p className="text-sm text-slate-600 line-clamp-2 leading-relaxed font-semibold mb-2">{post.caption}</p>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <img src={post.user.avatar} className="h-5 w-5 rounded-full object-cover ring-2 ring-white" alt={post.user.name} />
                        <span className="max-w-[150px] truncate text-xs font-medium text-slate-400 capitalize">{post.user.name}</span>
                      </div>
                      <button onClick={(e) => e.stopPropagation()} className="flex items-center gap-1.5 transition-all active:scale-90" aria-label="Like post">
                        <svg viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" fill={post.liked ? "currentColor" : "none"} className={`w-6 h-6 transition-colors duration-300 ${post.liked ? "text-rose-500" : "text-slate-300 hover:text-slate-400"}`}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
                        </svg>
                        <span className={`text-xs font-bold ${post.liked ? "text-rose-500" : "text-slate-400"}`}>{post.likeCount}</span>
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>

        {/* Products pane */}
        {profileApi?.is_business_owner && (
          <div style={{ width: `${100 / tabs.length}%`, flexShrink: 0 }} className="p-2 sm:p-4">
            {productsLoading ? (
              <ShimmerGrid count={6} />
            ) : vendorProducts.length === 0 ? (
              <div className="py-16 flex flex-col items-center justify-center text-center text-slate-500">
                <img src="/assets/images/post.png" alt="No products" className="w-40 h-40 object-contain mb-4 opacity-80" />
                <p className="text-sm font-medium mb-4">No products available in your store yet.</p>
                <button
                  onClick={() => router.push("/products/new")}
                  className="inline-flex items-center gap-2 rounded-full bg-rose-500 px-5 py-2 text-sm font-medium text-white shadow-sm hover:bg-rose-600 active:scale-95 transition"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                  Add Product
                </button>
              </div>
            ) : (
              <div className="post-grid mb-20">
                {vendorProducts.map((p: any) => {
                  const isPromoActive = p.promo_title && p.promo_discount && (!p.promo_end || new Date(p.promo_end) >= new Date());
                  return (
                    <article
                      key={p.product_id}
                      onClick={() => {
                        if (p.product_video) {
                          router.push(`/shopping-reels?product_id=${p.product_id}`);
                        } else {
                          handleProductClick(p.product_id);
                        }
                      }}
                      className="group flex flex-col rounded-[1.05rem] bg-white cursor-pointer transition-all border border-slate-100 overflow-hidden"
                    >
                      <div className="relative w-full aspect-[4/5] bg-slate-100 overflow-hidden">
                        {p.product_video ? (
                          <video
                            src={formatUrl(p.product_video)}
                            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                            muted
                            loop
                            onMouseOver={(e) => (e.currentTarget as HTMLVideoElement).play()}
                            onMouseOut={(e) => {
                              (e.currentTarget as HTMLVideoElement).pause();
                              (e.currentTarget as HTMLVideoElement).currentTime = 0;
                            }}
                          />
                        ) : (
                          <img
                            src={formatUrl(p.first_image)}
                            alt={p.title}
                            loading="lazy"
                            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                          />
                        )}
                        {p.product_video && (
                          <div className="absolute top-2 right-2 bg-black/50 backdrop-blur-md rounded-full p-2 z-10">
                            <svg className="w-3" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.14v14l11-7-11-7z" /></svg>
                          </div>
                        )}
                        {fetchingProduct && selectedProductPayload?.productId === p.product_id && (
                          <div className="absolute inset-0 bg-white/30 z-20 flex items-center justify-center">
                            <div className="w-5 h-5 border-2 border-slate-600 border-t-transparent rounded-full animate-spin"></div>
                          </div>
                        )}
                      </div>
                      <div className="p-3">
                        <div className="flex items-center justify-between pt-1 mb-1">
                          <span className="text-slate-900 text-sm font-bold">₦{Number(p.price || 0).toLocaleString()}</span>
                          <div className="flex items-center gap-1 cursor-pointer" onClick={(e) => handleProductLike(e, p.product_id, p.likes_count || 0)}>
                            {(productLikeData[p.product_id]?.liked) ? <FaHeart className="text-red-500 text-xs" /> : <FaRegHeart className="text-slate-400 text-xs" />}
                            <span className="text-[10px] font-semibold text-slate-600">{productLikeData[p.product_id]?.count ?? (p.likes_count || 0)}</span>
                          </div>
                        </div>
                        <h3 className="text-xs font-semibold text-slate-800 line-clamp-2 leading-snug" title={p.title}>
                          {p.title}
                        </h3>
                        <div className="mt-2 min-h-[14px]">
                          {isPromoActive ? (
                            <span className="text-[9px] font-bold text-rose-500 border-red-500 border px-1 uppercase tracking-tighter">
                              {p.promo_discount}% OFF
                            </span>
                          ) : p.sale_type ? (
                            <span className="text-[9px] font-bold text-rose-500 border-red-500 border px-1 uppercase tracking-tighter">
                              {p.sale_discount}% Off
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="">
      <Header
        profileApi={profileApi}
        displayName={displayName}
        onLogout={async () => {
          try {
            await auth.logout();
          } finally {
            window.location.replace("/discover");
          }
        }}
      />


      {/* Tabs: use TabsBar (sticky-capable) */}
      {TabsBar}

      {TabPanes}

      {/* Media Modal */}
      {selectedPost && <PostModal post={selectedPost} onClose={closeModal} onToggleLike={toggleLike} />}

      {/* Product Modal */}
      {productModalOpen && selectedProductPayload && (
        <ProductPreviewModal
          open={productModalOpen}
          payload={selectedProductPayload}
          onClose={() => {
            setProductModalOpen(false);
            setSelectedProductPayload(null);
          }}
          onProductClick={handleProductClick}
        />
      )}

      <CreateNoteModal
        open={createNoteOpen}
        onClose={() => setCreateNoteOpen(false)}
        onCreated={(newPost) => {
          // Optimistic update: prepend new note
          const mapped = mapApiPost(newPost);
          setNotePosts((prev) => [mapped, ...prev]);
          setCreateNoteOpen(false);
        }}
      />

    </div>
  );
}