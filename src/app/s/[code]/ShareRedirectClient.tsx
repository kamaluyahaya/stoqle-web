'use client';
/**
 * ShareRedirectClient.tsx
 * Handles client-side redirect for human users who land on /s/[code].
 * Bots never execute JS — they only see the server-rendered OG HTML.
 */

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { API_BASE_URL } from '@/src/lib/config';

export default function ShareRedirectClient({ code }: { code: string }) {
  const router = useRouter();

  useEffect(() => {
    if (!code) return;

    // Call the JSON resolve endpoint — avoids cross-origin redirect issues
    fetch(`${API_BASE_URL}/api/share/resolve/${code}`)
      .then((res) => res.json())
      .then((json) => {
        if (json?.ok && json?.data?.path) {
          router.replace(json.data.path);
        } else {
          router.replace('/market');
        }
      })
      .catch(() => router.replace('/market'));
  }, [code]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-white">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 rounded-full bg-rose-100 flex items-center justify-center">
          <svg className="w-6 h-6 text-rose-500 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
          </svg>
        </div>
        <p className="text-sm font-semibold text-slate-600 animate-pulse">Opening product…</p>
      </div>
    </div>
  );
}
