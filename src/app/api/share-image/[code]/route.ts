/**
 * /app/api/share-image/[code]/route.ts
 *
 * Next.js API route that proxies the OG image from the Express backend.
 *
 * WHY: The Express backend runs on a LAN IP (10.x.x.x:4000) that WhatsApp's
 * crawlers cannot reach. By proxying through Next.js (which is exposed via ngrok),
 * the og:image URL becomes publicly accessible.
 *
 * og:image URL used in generateMetadata:
 *   {ngrokUrl}/api/share-image/{code}?v={updatedAt}
 *   ↓ proxied to ↓
 *   http://10.123.11.181:4000/api/share-image/{code}?v={updatedAt}
 */

import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://10.123.11.181:4000';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  if (!code || code.length > 16) {
    return new NextResponse('Not found', { status: 404 });
  }

  // Forward the version query param if present
  const version = request.nextUrl.searchParams.get('v') || '';
  const backendUrl = version
    ? `${BACKEND_URL}/api/share-image/${code}?v=${encodeURIComponent(version)}`
    : `${BACKEND_URL}/api/share-image/${code}`;

  try {
    const upstream = await fetch(backendUrl, {
      // Reuse the backend's own caching — don't add another layer
      cache: 'no-store',
      signal: AbortSignal.timeout(8000),
    });

    if (!upstream.ok) {
      return new NextResponse('Image not available', { status: upstream.status });
    }

    const imageBuffer = await upstream.arrayBuffer();

    return new NextResponse(imageBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'image/jpeg',
        'Content-Length': String(imageBuffer.byteLength),
        // Cache aggressively at CDN/browser level — WhatsApp respects this
        'Cache-Control': 'public, max-age=86400, stale-while-revalidate=3600',
        'X-Proxied-From': 'stoqle-backend',
      },
    });
  } catch (err) {
    console.error('[share-image proxy]', err);
    return new NextResponse('Image generation failed', { status: 500 });
  }
}
