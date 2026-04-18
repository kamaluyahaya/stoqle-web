/**
 * /app/api/social/share-image/[code]/route.ts
 *
 * Next.js API route that proxies the SOCAL OG image from the Express backend.
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

  const version = request.nextUrl.searchParams.get('v') || '';
  const backendUrl = version
    ? `${BACKEND_URL}/api/social/share-image/${code}?v=${encodeURIComponent(version)}`
    : `${BACKEND_URL}/api/social/share-image/${code}`;

  try {
    const upstream = await fetch(backendUrl, {
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
        'Cache-Control': 'public, max-age=86400, stale-while-revalidate=3600',
        'X-Proxied-From': 'stoqle-backend-social',
      },
    });
  } catch (err) {
    console.error('[social-share-image proxy]', err);
    return new NextResponse('Image generation failed', { status: 500 });
  }
}
