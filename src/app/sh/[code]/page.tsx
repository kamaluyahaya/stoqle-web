import { Metadata } from 'next';
import ShopShareRedirectClient from './ShopShareRedirectClient';

// Env helpers - fallback to localhost for safety
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
const FRONTEND_URL = process.env.NEXT_PUBLIC_FRONTEND_URL || 'https://stoqle.com';

interface Props {
    params: Promise<{ code: string }>;
}

async function getShopShareMeta(code: string) {
    try {
        const res = await fetch(`${API_URL}/api/shop/resolve/${code}`, {
            cache: 'no-store'
        });
        if (!res.ok) return null;
        const json = await res.json();
        return json.ok ? json.data : null;
    } catch (err) {
        console.error('getShopShareMeta error:', err);
        return null;
    }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { code } = await params;
    const data = await getShopShareMeta(code);
    
    const canonical = `${FRONTEND_URL}/sh/${code}`;
    if (!data) return { title: 'Stoqle Shop', alternates: { canonical } };

    const title = `${data.name} | Stoqle Shop`;
    const description = `Check out ${data.name} on Stoqle with ${(data.followers || 0).toLocaleString()} followers and ${(data.products || 0).toLocaleString()} products!`;
    const ogImage = `${FRONTEND_URL}/api/shop/share-image/${code}`;

    return {
        title,
        description,
        openGraph: {
            title,
            description,
            url: canonical,
            images: [{ url: ogImage, width: 1200, height: 630 }],
            type: 'website',
        },
        twitter: {
            card: 'summary_large_image',
            title,
            description,
            images: [ogImage],
        },
        alternates: { canonical },
    };
}

export default async function ShopSharePage({ params }: Props) {
    const { code } = await params;
    
    // Humans get the Client Redirector (which performs the resolve & redirect)
    // Bots only care about the Metadata generated above.
    return <ShopShareRedirectClient code={code} />;
}
