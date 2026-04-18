/**
 * /app/reel/[code]/page.tsx  — SERVER COMPONENT
 *
 * Pattern:
 * 1. BOTS: Injects social OG tags via generateMetadata.
 * 2. HUMANS: ShareRedirectClient handles dynamic path-based redirect.
 */

import type { Metadata } from 'next';
import ShareRedirectClient from './ShareRedirectClient';

const FRONTEND_URL =
  process.env.NEXT_PUBLIC_FRONTEND_URL ||
  process.env.NEXT_PUBLIC_APP_URL ||
  'http://10.123.11.181:3000';

const BACKEND_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  'http://10.123.11.181:4000';

interface SocialMeta {
  code: string;
  postId: number;
  authorName: string;
  caption: string;
  imageUrl: string;
  likes: number;
  followers: number;
  updatedAt: string;
}

async function fetchSocialMeta(code: string): Promise<SocialMeta | null> {
  try {
    const res = await fetch(`${BACKEND_URL}/api/social/resolve/${code}`, {
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const json = await res.json();
    if (!json.ok) return null;
    return json.data as SocialMeta;
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ code: string }>;
}): Promise<Metadata> {
  const { code } = await params;
  const meta = await fetchSocialMeta(code);

  const canonicalUrl = `${FRONTEND_URL}/reel/${code}`;

  if (!meta) {
    return {
      title: 'Post on Stoqle',
      description: 'Check out this post on Stoqle.',
      openGraph: {
        title: 'Post on Stoqle',
        description: 'Check out this post on Stoqle.',
        url: canonicalUrl,
        siteName: 'Stoqle',
      },
    };
  }

  const title = `${meta.authorName} on Stoqle`;
  const description = meta.caption
    ? meta.caption.slice(0, 160)
    : `Watch this post by ${meta.authorName} on Stoqle. ${meta.likes} likes · ${meta.followers} followers`;

  const imageVersion = meta.updatedAt ? encodeURIComponent(meta.updatedAt) : Date.now();
  const ogImageUrl = `${FRONTEND_URL}/api/social/share-image/${code}?v=${imageVersion}`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: canonicalUrl,
      siteName: 'Stoqle',
      type: 'video.movie',
      images: [
        {
          url: ogImageUrl,
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [ogImageUrl],
    },
    robots: { index: false, follow: false },
    alternates: { canonical: canonicalUrl },
  };
}

export default async function ReelPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  return <ShareRedirectClient code={code} />;
}
