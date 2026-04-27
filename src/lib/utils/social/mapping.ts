import type { Post } from "@/src/lib/types";

const DEFAULT_AVATAR = "https://www.gravatar.com/avatar/00000000000000000000000000000000?d=mp&f=y";
const NO_IMAGE_PLACEHOLDER = "https://st4.depositphotos.com/14953852/22772/v/450/depositphotos_227725020-stock-illustration-image-available-icon-flat-vector.jpg";

const isVideoUrl = (url?: string) => {
  if (!url) return false;
  const ext = url.split('.').pop()?.toLowerCase() || '';
  return ['mp4', 'mov', 'wmv', 'flv', 'avi', 'mkv', 'webm'].includes(ext);
};

const isImageUrl = (url?: string) => {
  if (!url) return false;
  const ext = url.split('.').pop()?.toLowerCase() || '';
  return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'].includes(ext);
};

export const mapApiPost = (p: any): Post => {
  if (!p) return { id: 0, user: { id: 0, name: '', avatar: DEFAULT_AVATAR }, liked: false, likeCount: 0 } as Post;
  const apiId = p?.social_post_id ?? Math.floor(Math.random() * 1e6);
  let src: string | undefined = undefined;
  let thumbnail: string | undefined = undefined;
  const images = Array.isArray(p?.images) ? p.images : [];

  if (p?.cover_type === "video") {
    const videoFile = images.find((i: any) => isVideoUrl(i?.image_url));
    const coverFile = images.find((i: any) => !!i?.is_cover);
    src = videoFile?.image_url;
    thumbnail = coverFile?.image_url;
    if (!src) src = coverFile?.image_url;
  } else if (images.length > 0) {
    const cover = images.find((i: any) => !!i?.is_cover) ?? images[0];
    src = cover?.image_url;
  }

  if (!src && p?.cover_type !== "note") {
    src = NO_IMAGE_PLACEHOLDER;
  }

  const isVideo = p?.cover_type === "video" || isVideoUrl(src);
  const isImage = !isVideo && isImageUrl(src);
  const caption = p?.text ?? p?.subtitle ?? "";
  const note_caption = p?.subtitle ?? "";

  const allMedia = images.length > 0
    ? images.map((i: any) => ({ url: i?.image_url, id: i?.social_post_image_id || i?.post_image_id || i?.id }))
    : src ? [{ url: src, id: p?.cover_id || p?.id }] : [];

  return {
    id: apiId,
    apiId,
    src,
    isVideo,
    isImage,
    caption,
    note_caption,
    user: {
      id: p?.user_id ?? p?.user?.user_id ?? p?.user?.id ?? 0,
      name: p?.author_name ?? p?.user?.name ?? p?.user?.full_name ?? "",
      avatar: p?.logo || p?.business_logo || p?.author_pic || p?.user?.profile_pic || p?.user?.logo || DEFAULT_AVATAR,
      author_handle: p?.author_handle ?? p?.user?.username ?? p?.author_username,
      is_trusted: Number(
        p?.author_is_trusted ??
        p?.user?.is_trusted ??
        p?.user?.is_verified_partner ??
        p?.user?.is_partner ??
        p?.user?.policy?.market_affiliation?.trusted_partner ??
        p?.is_verified_partner ??
        p?.is_partner ??
        0
      ) === 1 ||
        !!p?.author_is_verified ||
        !!p?.user?.is_verified_partner ||
        !!p?.user?.is_partner ||
        !!p?.is_verified_partner ||
        !!p?.is_partner ||
        !!p?.author_is_trusted,
    },
    liked: Boolean(p?.liked_by_me),
    likeCount: p?.likes_count ?? 0,
    coverType: p?.cover_type,
    noteConfig: p?.config,
    rawCreatedAt: p?.created_at,
    thumbnail,
    isPinned: Boolean(p?.is_pinned),
    author_handle: p?.author_handle ?? p?.user?.username ?? p?.author_username,
    status: p?.status,
    is_product_linked: Boolean(p?.is_product_linked),
    linked_product: p?.linked_product,
    original_audio_url: p?.original_audio_url,
    original_video_url: p?.original_video_url,
    post_public_id: p?.post_public_id,
    allMedia,
  };
};
