"use client";

import React, { useState, useEffect, useMemo } from "react";
import ProductCard from "./ProductCard";

const MasonryGrid = ({ 
    items, 
    likeData, 
    postLikeData, 
    fetchingProductId, 
    handleProductClick, 
    handleReelsClick, 
    handleLikeClick, 
    handlePostLikeClick, 
    handlePrefetch, 
    formatUrl, 
    router, 
    isRestored, 
    isPartnerTab 
}: any) => {
    const [columns, setColumns] = useState(5);

    useEffect(() => {
        const updateColumns = () => {
            const w = window.innerWidth;
            if (w < 700) setColumns(2);
            else if (w < 1350) setColumns(3);
            else if (w < 1650) setColumns(4);
            else setColumns(5);
        };
        updateColumns();
        window.addEventListener('resize', updateColumns);
        return () => window.removeEventListener('resize', updateColumns);
    }, []);

    const columnData = useMemo(() => {
        const data = Array.from({ length: columns }, () => [] as any[]);
        items.forEach((item: any, index: number) => {
            data[index % columns].push({ ...item, originalIndex: index });
        });
        return data;
    }, [items, columns]);

    return (
        <div className="flex gap-2 sm:gap-6 items-start w-full max-w-full overflow-hidden">
            {columnData.map((colItems, colIdx) => {
                let visibilityClass = "flex-1 flex flex-col gap-2 sm:gap-6 min-w-0";
                if (colIdx === 2) visibilityClass += " hidden [@media(min-width:700px)]:flex";
                if (colIdx === 3) visibilityClass += " hidden [@media(min-width:1210px)]:flex";
                if (colIdx === 4) visibilityClass += " hidden [@media(min-width:1430px)]:flex";

                return (
                    <div key={colIdx} className={visibilityClass}>
                        {colItems.map((p: any) => {
                            const rawPostId = p.is_social_post ? String(p.product_id).replace('post-', '') : null;
                            const ld = p.is_social_post
                                ? (postLikeData?.[rawPostId!] ?? { liked: !!p.isLiked, count: p.likes_count || 0 })
                                : (likeData[p.product_id] || { liked: !!p.isLiked, count: p.likes_count || 0 });
                            return (
                                <ProductCard
                                    key={`${p.product_id}-${p.originalIndex}`}
                                    index={p.originalIndex}
                                    isVideoCover={!!p.product_video}
                                    p={p}
                                    formatUrl={formatUrl}
                                    handleProductClick={handleProductClick}
                                    handleReelsClick={handleReelsClick}
                                    handleLikeClick={handleLikeClick}
                                    handlePostLikeClick={handlePostLikeClick}
                                    handlePrefetch={handlePrefetch}
                                    isLiked={ld.liked}
                                    likeCount={ld.count}
                                    postLikeData={postLikeData}
                                    fetchingProduct={fetchingProductId === p.product_id}
                                    router={router}
                                    isRestored={isRestored || p.isRestored}
                                    isPartnerTab={isPartnerTab}
                                />
                            );
                        })}
                    </div>
                );
            })}
        </div>
    );
};

export default MasonryGrid;
