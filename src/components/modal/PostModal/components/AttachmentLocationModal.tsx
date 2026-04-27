import React, { useRef, useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { XMarkIcon } from "@heroicons/react/24/outline";
import { MapPin, Search, Navigation } from "lucide-react";
import { PostModalContext } from "../types";
import { getCurrentCoordinates } from "@/src/lib/location";
import StoqleLoader from "@/src/components/common/StoqleLoader";
import { API_BASE_URL } from "@/src/lib/config";
import { safeFetch } from "@/src/lib/api/handler";

interface AttachmentLocationModalProps {
  ctx: PostModalContext;
  onClose: () => void;
  onInsertToken: (token: string, metadata: any) => void;
}

export default function AttachmentLocationModal({ ctx, onClose, onInsertToken }: AttachmentLocationModalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(false);
  const [nearby, setNearby] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [coords, setCoords] = useState<{lat: number, lng: number} | null>(null);

  useEffect(() => {
    initLocation();
  }, []);

  const initLocation = async () => {
    setLoading(true);
    const pos = await getCurrentCoordinates();
    if (pos) {
      setCoords({ lat: pos.latitude, lng: pos.longitude });
      fetchNearby(pos.latitude, pos.longitude);
    } else {
      // Fallback if no GPS
      setLoading(false);
      setNearby([
        { name: "Lagos, Nigeria", address: "City Center" },
        { name: "Abuja, Nigeria", address: "Capital City" },
        { name: "Victoria Island", address: "Business District" }
      ]);
    }
  };

  const fetchNearby = async (lat: number, lng: number) => {
    setLoading(true);
    setError(null);
    try {
      const res = await safeFetch(`${API_BASE_URL}/api/search/places/nearby?lat=${lat}&lng=${lng}&radius=1500`);
      if (res?.success && Array.isArray(res.data)) {
        setNearby(res.data);
      } else {
        setError("Could not find nearby places.");
      }
    } catch (err) {
      console.error("Location fetch error", err);
      setError("Failed to load nearby places.");
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = useCallback(async (query: string) => {
    if (!query.trim()) {
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    try {
      let url = `${API_BASE_URL}/api/search/places/search?query=${encodeURIComponent(query)}`;
      if (coords) {
        url += `&lat=${coords.lat}&lng=${coords.lng}`;
      }
      
      const res = await safeFetch(url);
      if (res?.success && Array.isArray(res.data)) {
        setNearby(res.data);
      }
    } catch (err) {
      console.error("Search places error", err);
    } finally {
      setIsSearching(false);
    }
  }, [coords]);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery) handleSearch(searchQuery);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchQuery, handleSearch]);

  const handleLocationSelect = (loc: any) => {
    const token = `[Location: ${loc.name}]`;
    onInsertToken(token, {
      type: "location",
      id: loc.id || "current",
      name: loc.name,
      address: loc.address,
      lat: loc.lat,
      lng: loc.lng,
      display: token
    });
    onClose();
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: "100%" }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: "100%" }}
        transition={{ type: "spring", damping: 25, stiffness: 200 }}
        className="fixed bottom-0 left-0 right-0 z-[200] bg-white rounded-t-[1.5rem] flex flex-col h-[70vh] sm:max-h-[70vh] sm:absolute sm:w-full sm:max-w-md sm:left-1/2 sm:-translate-x-1/2"
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
        ref={containerRef}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-orange-50 flex items-center justify-center text-orange-500">
              <MapPin className="w-4 h-4" />
            </div>
            <h3 className="text-md font-bold text-slate-800 tracking-tight">Share Location</h3>
          </div>
          <button
            onClick={onClose}
            className="p-2 -mr-2 bg-slate-100/50 hover:bg-slate-200 rounded-full text-slate-500 transition-colors"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 relative flex flex-col">
          <div className="relative mb-4">
            {isSearching ? (
              <div className="absolute left-3 top-1/2 -translate-y-1/2">
                <div className="w-4 h-4 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            )}
            <input 
              type="text" 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search for a place or city..." 
              className="w-full bg-slate-100 border-none rounded-[0.5rem] py-2.5 pl-10 pr-4 text-sm font-medium focus:ring-2 focus:ring-orange-200 transition-all outline-none"
            />
          </div>

          <div className="flex-1 flex flex-col">
            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
              <Navigation className="w-3 h-3" />
              {searchQuery ? "Search Results" : "Nearby Locations"}
            </h4>

            {loading ? (
              <div className="flex-1 flex items-center justify-center">
                <StoqleLoader size={30} />
              </div>
            ) : error ? (
              <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
                <p className="text-slate-400 text-xs font-medium mb-4">{error}</p>
                <button 
                  onClick={initLocation}
                  className="text-xs font-bold text-orange-500 hover:text-orange-600 underline"
                >
                  Try Again
                </button>
              </div>
            ) : nearby.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center p-10 text-center">
                 <p className="text-slate-400 text-sm font-medium">No locations found</p>
                 <p className="text-slate-300 text-[11px] mt-1">Try searching for a city or landmark above.</p>
              </div>
            ) : (
              <div className="space-y-1">
                {!searchQuery && nearby.length > 3 && (
                  <div className="mb-2 p-2 bg-orange-50/50 rounded-[0.5rem] border border-orange-100/50">
                    <p className="text-[10px] text-orange-600 font-bold leading-tight">
                      Showing nearby locations. Use the search bar to find places in other cities.
                    </p>
                  </div>
                )}
                {nearby.map((loc, idx) => (
                  <button
                    key={loc.id || idx}
                    onClick={() => handleLocationSelect(loc)}
                    className="w-full flex items-start gap-3 p-3 hover:bg-orange-50 rounded-[0.5rem] transition-colors group text-left"
                  >
                    <div className="mt-0.5 w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 group-hover:bg-white group-hover:text-orange-500 transition-colors shrink-0">
                      <MapPin className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-slate-800 truncate">{loc.name}</p>
                      <p className="text-[11px] font-medium text-slate-500 truncate">{loc.address}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

