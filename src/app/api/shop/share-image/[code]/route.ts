/**
 * /app/api/shop/share-image/[code]/route.ts
 *
 * Next.js API route that proxies the SHOP OG image from the Express backend.
 */

import { NextRequest, NextResponse } from 'next/server';
import { API_BASE_URL } from '@/src/lib/config';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  if (!code || code.length > 20) {
    return new NextResponse('Not found', { status: 404 });
  }

  // Ensure we use the backend URL for the upstream fetch
  const BACKEND_URL = API_BASE_URL.replace(/\/$/, '');
  const backendUrl = `${BACKEND_URL}/api/shop/share-image/${code}`;

  try {
    const upstream = await fetch(backendUrl, {
      cache: 'no-store',
      signal: AbortSignal.timeout(10000),
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
        'Cache-Control': 'public, max-age=86400, stale-while-revalidate=3600',
        'X-Proxied-From': 'stoqle-backend-shop',
      },
    });
  } catch (err) {
    console.error('[shop-share-image proxy]', err);
    return new NextResponse('Image generation failed', { status: 500 });
  }
}
