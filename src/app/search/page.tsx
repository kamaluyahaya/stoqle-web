"use client";

import React, { Suspense } from "react";
import SearchResultsModal from "@/src/components/modal/SearchResultsModal";
import { useSearchParams, useRouter } from "next/navigation";

function SearchContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const q = searchParams.get("q") || "";
  const tab = searchParams.get("tab") || "all";

  // When used as a page, we don't need the internal "onClose" 
  // to do more than navigate back.
  return (
    <div className="min-h-screen bg-white">
      <SearchResultsModal
        isOpen={true}
        isPage={true}
        onClose={() => router.back()}
        onSearchClick={() => {
          const params = new URLSearchParams(searchParams.toString());
          params.set('typing', 'true');
          router.replace(`/search?${params.toString()}`);
        }}
        initialQuery={q}
        initialTab={tab as any}
      />
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<div className="p-10 text-center">Loading search results...</div>}>
      <SearchContent />
    </Suspense>
  );
}
