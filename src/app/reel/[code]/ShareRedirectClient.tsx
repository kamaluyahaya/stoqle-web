'use client';
/**
 * ShareRedirectClient.tsx
 * Handles client-side redirect for human users who land on /reel/[code].
 * Bots never execute JS — they only see the server-rendered OG HTML.
 */

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { API_BASE_URL } from '@/src/lib/config';

export default function ShareRedirectClient({ code }: { code: string }) {
  const router = useRouter();

  useEffect(() => {
    if (!code) return;

    // Call the social JSON resolve endpoint
    fetch(`${API_BASE_URL}/api/social/resolve/${code}`)
      .then((res) => res.json())
      .then((json) => {
        if (json?.ok && json?.data?.path) {
          router.replace(json.data.path);
        } else {
          router.replace('/discover');
        }
      })
      .catch(() => router.replace('/discover'));
  }, [code, router]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-white">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 rounded-full bg-rose-100 flex items-center justify-center">
          <svg className="w-6 h-6 text-rose-500 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
          </svg>
        </div>
        <p className="text-sm font-semibold text-slate-600 animate-pulse">Opening post…</p>
      </div>
    </div>
  );
}
