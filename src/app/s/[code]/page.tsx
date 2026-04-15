/**
 * /app/s/[code]/page.tsx  — SERVER COMPONENT
 *
 * This page has two responsibilities:
 *
 * 1. BOTS (WhatsApp, Facebook, Twitterbot, etc.)
 *    → generateMetadata() runs server-side and injects full OG tags into <head>
 *    → Bots read the meta tags, render rich previews, never execute JS
 *
 * 2. HUMANS
 *    → ShareRedirectClient runs in the browser after hydration
 *    → Calls backend JSON endpoint and performs router.replace() to the product page
 */

import type { Metadata } from 'next';
import ShareRedirectClient from './ShareRedirectClient';

// ── Env helpers ──────────────────────────────────────────────────────────────
// These run server-side only — safe to use process.env directly.
// FRONTEND_URL = the public-facing URL (ngrok in dev, real domain in prod)
const FRONTEND_URL =
  process.env.NEXT_PUBLIC_FRONTEND_URL ||
  process.env.NEXT_PUBLIC_APP_URL ||
  'http://10.123.11.181:3000';

// BACKEND_URL = used for the resolve JSON fetch (server → server, LAN OK)
const BACKEND_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  'http://10.123.11.181:4000';

// ── Fetch helpers ────────────────────────────────────────────────────────────
interface ShareMeta {
  title: string;
  description: string;
  price: number;
  bizSlug: string;
  productSlug: string;
  updatedAt: string;
  bizName?: string;
}

async function fetchShareMeta(code: string): Promise<ShareMeta | null> {
  try {
    const res = await fetch(`${BACKEND_URL}/api/share/resolve/${code}`, {
      // Don't cache — always show fresh product data in OG tags
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const json = await res.json();
    if (!json.ok) return null;
    return json.data as ShareMeta;
  } catch {
    return null;
  }
}

// ── generateMetadata — runs exclusively on the SERVER ────────────────────────
export async function generateMetadata({
  params,
}: {
  params: Promise<{ code: string }>;
}): Promise<Metadata> {
  const { code } = await params;

  const meta = await fetchShareMeta(code);

  const canonicalUrl = `${FRONTEND_URL}/s/${code}`;

  if (!meta) {
    // Fallback: minimal metadata, no product OG image
    return {
      title: 'Product on Stoqle',
      description: 'Check out this product on Stoqle.',
      openGraph: {
        title: 'Product on Stoqle',
        description: 'Check out this product on Stoqle.',
        url: canonicalUrl,
        siteName: 'Stoqle',
        type: 'website',
      },
    };
  }

  const title = meta.title; // Already includes "Product | Business Name" from backend
  const formattedPrice = meta.price
    ? `₦${Number(meta.price).toLocaleString('en-NG')}`
    : '';
  const description = meta.description
    ? meta.description.slice(0, 155)
    : `${formattedPrice ? formattedPrice + ' · ' : ''}Shop now on ${meta.bizName || 'Stoqle'}`;

  // og:image goes through Next.js API proxy at /api/share-image/:code
  // This makes the image reachable by WhatsApp/Facebook even in dev (via ngrok on port 3000)
  const imageVersion = meta.updatedAt
    ? encodeURIComponent(meta.updatedAt)
    : Date.now();
  const ogImageUrl = `${FRONTEND_URL}/api/share-image/${code}?v=${imageVersion}`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: canonicalUrl,
      siteName: 'Stoqle',
      type: 'website',
      images: [
        {
          url: ogImageUrl,        // Absolute URL — required by WhatsApp/Facebook
          width: 1200,
          height: 630,
          alt: meta.title,
          type: 'image/png',
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [ogImageUrl],
    },
    // Prevent robots from indexing share redirect pages
    robots: { index: false, follow: false },
    alternates: { canonical: canonicalUrl },
  };
}

// ── Page component — renders loading UI for humans ────────────────────────────
export default async function SharePage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;

  // ShareRedirectClient handles the JS-based redirect for human users.
  // Bots never execute this — they only consume the OG tags from generateMetadata().
  return <ShareRedirectClient code={code} />;
}
