import { PreviewPayload } from "@/src/types/product";
import { API_BASE_URL } from "@/src/lib/config";

const NO_IMAGE_PLACEHOLDER = "/assets/images/favio.png";

export const defaultFormatImageUrl = (url: string) => {
    if (!url) return NO_IMAGE_PLACEHOLDER;
    let formatted = url;
    if (!url.startsWith("http")) {
        formatted = url.startsWith("/public") ? `${API_BASE_URL}${url}` : `${API_BASE_URL}/public/${url}`;
    }
    return encodeURI(formatted);
};

export function mapProductToPreviewPayload(dbProduct: any, customFormatUrl?: (url: string) => string): PreviewPayload {
    const formatUrl = customFormatUrl || defaultFormatImageUrl;

    const mapped: PreviewPayload = {
        productId: dbProduct.product_id,
        title: dbProduct.title,
        description: dbProduct.description,
        category: dbProduct.category,
        hasVariants: dbProduct.has_variants === 1,
        price: dbProduct.price ?? "",
        quantity: dbProduct.quantity ?? "",
        businessId: Number(dbProduct.business_id),
        productImages: (() => {
            const media = dbProduct.media || [];
            const imgs = media.filter((m: any) => m.type === "image");
            if (imgs.length > 0) {
                const coverRef = dbProduct.first_image || dbProduct.image_url;
                
                // Deterministic sort: 
                // Promote items marked as is_cover OR matching the product's first_image field
                const sorted = [...imgs].sort((a, b) => {
                    const isACover = a.is_cover === 1 || (coverRef && a.url && a.url.includes(coverRef));
                    const isBCover = b.is_cover === 1 || (coverRef && b.url && b.url.includes(coverRef));
                    if (isACover && !isBCover) return -1;
                    if (!isACover && isBCover) return 1;
                    return 0;
                });

                return sorted.map((m: any) => ({ 
                    name: m.name || "img", 
                    url: formatUrl(m.url),
                    isCover: m.is_cover === 1 || (coverRef && m.url && m.url.includes(coverRef))
                }));
            }
            if (dbProduct.first_image || dbProduct.image_url) {
                return [{ name: "img", url: formatUrl(dbProduct.first_image || dbProduct.image_url) }];
            }
            return [];
        })(),
        productVideo: (() => {
            const vid = (dbProduct.media || []).find((m: any) => m.type === "video");
            if (vid) return { name: "vid", url: formatUrl(vid.url) };
            if (dbProduct.product_video) return { name: "vid", url: formatUrl(dbProduct.product_video) };
            return null;
        })(),
        useCombinations: dbProduct.use_combinations === 1,
        params: (dbProduct.params || []).map((p: any) => ({ key: p.param_key, value: p.param_value })),
        soldCount: dbProduct.sold_count,
        samePriceForAll: dbProduct.same_price_for_all === 1,
        sharedPrice: dbProduct.price ?? "",
        variantGroups: (dbProduct.variant_groups || []).map((g: any) => ({
            id: String(g.group_id),
            title: g.title,
            allowImages: g.allow_images === 1,
            entries: (g.options || []).map((o: any) => {
                const inventoryMatch = (dbProduct.inventory || []).find((inv: any) => Number(inv.variant_option_id) === Number(o.option_id));
                return {
                    id: String(o.option_id),
                    name: o.name,
                    price: o.price,
                    quantity: inventoryMatch ? inventoryMatch.quantity : (Number(o.initial_quantity || 0) - Number(o.sold_count || 0)),
                    images: (o.media || []).map((m: any) => ({ name: "img", url: formatUrl(m.url) }))
                };
            })
        })),
        skus: (dbProduct.skus || []).map((s: any) => {
            let vIds: string[] = [];
            try {
                vIds = typeof s.variant_option_ids === 'string'
                    ? JSON.parse(s.variant_option_ids)
                    : (s.variant_option_ids || []);
            } catch (e) { }

            const inventoryMatch = (dbProduct.inventory || []).find((inv: any) => inv.sku_id === s.sku_id);
            return {
                id: String(s.sku_id),
                name: s.sku_code || "Combination",
                variantOptionIds: vIds.map(String),
                price: s.price ?? "",
                quantity: inventoryMatch ? inventoryMatch.quantity : (s.quantity ?? 0),
                enabled: s.status === 'active'
            };
        }),
        policyOverrides: dbProduct.policy_settings ? {
            useStoreDefaultReturn: !!dbProduct.policy_settings.use_store_default_return,
            returnPolicy: {
                returnShippingSubsidy: !!dbProduct.policy_settings.return_shipping_subsidy,
                sevenDayNoReasonReturn: !!dbProduct.policy_settings.seven_day_no_reason_return,
                rapidRefund: !!dbProduct.policy_settings.rapid_refund,
                returnWindow: dbProduct.policy_settings.return_window || 3,
            },
            useStoreDefaultShipping: !!dbProduct.policy_settings.use_store_default_shipping,
            shippingPolicy: {
                avgDuration: dbProduct.policy_settings.avg_duration,
                avgUnit: dbProduct.policy_settings.avg_unit,
                promiseDuration: dbProduct.policy_settings.promise_duration,
                promiseUnit: dbProduct.policy_settings.promise_unit,
                radiusKm: dbProduct.policy_settings.radius_km,
            },
            useStoreDefaultPromotions: !!dbProduct.policy_settings.use_store_default_promotions,
            promotions: (() => {
                const data = typeof dbProduct.policy_settings.promotions_data === 'string'
                    ? JSON.parse(dbProduct.policy_settings.promotions_data)
                    : dbProduct.policy_settings.promotions_data;
                if (!Array.isArray(data)) return [];
                return data.map((p: any) => ({
                    ...p,
                    discount_percent: p.discount_percent ?? p.discount ?? 0,
                    isActive: p.isActive ?? p.is_active ?? true,
                    title: p.title ?? p.occasion ?? "Promotion"
                }));
            })(),
            saleDiscount: (() => {
                const data = typeof dbProduct.policy_settings.sale_discount_data === 'string'
                    ? JSON.parse(dbProduct.policy_settings.sale_discount_data)
                    : dbProduct.policy_settings.sale_discount_data;
                if (!data) return null;
                // Normalize keys if they differ from what the frontend expects
                return {
                    ...data,
                    discount_percent: data.discount_percent ?? data.discount ?? 0,
                    discount_type: data.discount_type ?? data.type ?? "Sales Discount"
                };
            })(),
        } : undefined
    };
    return mapped;
}
