'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { safeFetch } from '@/src/lib/api/handler';

export default function ShopShareRedirectClient({ code }: { code: string }) {
    const router = useRouter();

    useEffect(() => {
        if (!code) return;

        const resolveLink = async () => {
            try {
                const json = await safeFetch<any>(`/api/shop/resolve/${code}`, {
                    cache: 'no-store'
                });

                if (json.ok && json.data?.slug) {
                    // Redirect to the actual shop page
                    router.replace(`/shop/${json.data.slug}?share=${code}`);
                } else {
                    router.replace('/');
                }
            } catch (err) {
                // If resolving fails (e.g. offline), we fall back home to prevent a hang
                router.replace('/');
            }
        };

        resolveLink();
    }, [code, router]);

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-white">
            <div className="flex flex-col items-center gap-4">
                <div className="w-12 h-12 rounded-full border-4 border-rose-500 border-t-transparent animate-spin" />
                <p className="text-sm font-bold text-slate-500 animate-pulse">Opening Shop...</p>
            </div>
        </div>
    );
}
