"use client";

import React, { useEffect, useState, useRef, use } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/src/context/authContext";
import { API_BASE_URL } from "@/src/lib/config";
import { ChevronLeft, MapPin, Navigation, User, Clock, Package, Loader2 } from "lucide-react";
import { toast } from "sonner";

const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";

function loadGoogleMapsScript(): Promise<void> {
    return new Promise((resolve, reject) => {
        if (typeof window === "undefined") return reject("Browser only");
        if ((window as any).google && (window as any).google.maps) return resolve();

        const existingScript = document.getElementById("google-maps-script");
        if (existingScript) {
            existingScript.addEventListener("load", () => resolve());
            existingScript.addEventListener("error", (e) => reject(e));
            return;
        }

        const script = document.createElement("script");
        script.id = "google-maps-script";
        script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=places`;
        script.async = true;
        script.defer = true;
        script.onload = () => resolve();
        script.onerror = (e) => reject(e);
        document.head.appendChild(script);
    });
}

export default function TrackingPage() {
    const params = useParams();
    const router = useRouter();
    const { token } = useAuth();
    const saleId = params.saleId as string;

    const [riderLocation, setRiderLocation] = useState<{ 
        latitude: number; 
        longitude: number; 
        rider_name: string;
        rider_phone?: string;
        order_status?: string;
        destination?: { latitude: number; longitude: number; }
    } | null>(null);
    const [currentAddress, setCurrentAddress] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const mapRef = useRef<HTMLDivElement>(null);
    const googleMapRef = useRef<any>(null);
    const riderMarkerRef = useRef<any>(null);
    const destinationMarkerRef = useRef<any>(null);
    const routePolylineRef = useRef<any>(null);
    const directionsRendererRef = useRef<any>(null);
    const geocoderRef = useRef<any>(null);
    const hasInitialMapFit = useRef<boolean>(false);
    const directionsApiFailedOnce = useRef<boolean>(false);

    const fetchRiderLocation = async (isBackground = false) => {
        if (!token || !saleId) return;
        if (!isBackground) setIsLoading(true);
        else setIsRefreshing(true);

        try {
            const res = await fetch(`${API_BASE_URL}/api/orders/${saleId}/rider-location`, {
                headers: {
                    "Authorization": `Bearer ${token}`
                }
            });
            const data = await res.json();
            if (data.success) {
                setRiderLocation(data.data);
                updateMap(data.data);
                reverseGeocode(data.data.latitude, data.data.longitude);
                setError(null); // Clear error if update successful
            } else if (!isBackground) {
                setError(data.message || "Tracking is currently unavailable.");
            }
        } catch (err) {
            console.error("Tracking fetch err:", err);
            // If it's a background refresh, we don't show the error screen, just keep stale data
            if (!isBackground) {
                setError("Failed to connect to tracking service.");
            }
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    };

    const reverseGeocode = (lat: number, lng: number) => {
        if (!geocoderRef.current && (window as any).google) {
            geocoderRef.current = new (window as any).google.maps.Geocoder();
        }
        if (geocoderRef.current) {
            geocoderRef.current.geocode({ location: { lat: Number(lat), lng: Number(lng) } }, (results: any, status: any) => {
                if (status === "OK" && results[0]) {
                    // Try to find a neighborhood or locality for a more human-readable name
                    const neighborhood = results.find((r: any) => r.types.includes("neighborhood") || r.types.includes("sublocality") || r.types.includes("locality"));
                    const fullAddress = neighborhood ? neighborhood.formatted_address : results[0].formatted_address;
                    
                    // Split and take first two significant parts for a clean display (e.g. "Malali, Kaduna")
                    const parts = fullAddress.split(',');
                    const displayAddress = parts.length > 1 ? `${parts[0].trim()}, ${parts[1].trim()}` : parts[0].trim();
                    
                    setCurrentAddress(displayAddress);
                } else if (status === "REQUEST_DENIED") {
                    console.error("Geocoding API denied. Please check API restrictions on your key.");
                    setCurrentAddress("Location restricted");
                }
            });
        }
    };

    const initMap = async () => {
        await loadGoogleMapsScript();
        if (mapRef.current && (window as any).google) {
            const google = (window as any).google;
            googleMapRef.current = new google.maps.Map(mapRef.current, {
                zoom: 15,
                center: { lat: 10.5105, lng: 7.4165 },
                disableDefaultUI: true,
                zoomControl: true,
                // Explicitly set styles to null to ensure all default labels (streets, POIs) are SHOWN
                styles: null 
            });

            directionsRendererRef.current = new google.maps.DirectionsRenderer({
                map: googleMapRef.current,
                suppressMarkers: true,
                polylineOptions: {
                    strokeColor: "#2563eb",
                    strokeOpacity: 0.8,
                    strokeWeight: 5
                }
            });
        }
    };

    const updateMap = (data: any) => {
        if (!googleMapRef.current || !(window as any).google) return;
        const google = (window as any).google;

        const riderPos = { lat: Number(data.latitude), lng: Number(data.longitude) };
        const destPos = data.destination ? { lat: Number(data.destination.latitude), lng: Number(data.destination.longitude) } : null;
        
        const isDefaultGabon = Math.abs(riderPos.lat - 1.303) < 0.001 && Math.abs(riderPos.lng - 11.303) < 0.001;
        const bounds = new google.maps.LatLngBounds();

        // 1. Update/Create Rider Marker (Bike Icon)
        if (!isDefaultGabon) {
            if (!riderMarkerRef.current) {
                // Use a custom bike icon + name label
                riderMarkerRef.current = new google.maps.Marker({
                    position: riderPos,
                    map: googleMapRef.current,
                    title: data.rider_name,
                    label: {
                        text: data.rider_name,
                        color: "#ffffff",
                        className: "bg-blue-600 px-2 py-1 rounded-full text-[10px] font-bold translate-y-8 border-2 border-white shadow-lg whitespace-nowrap"
                    },
                    icon: {
                        url: "https://cdn-icons-png.flaticon.com/512/3198/3198336.png", // Delivery Bike Icon
                        scaledSize: new google.maps.Size(40, 40),
                        origin: new google.maps.Point(0, 0),
                        anchor: new google.maps.Point(20, 20)
                    }
                });
            } else {
                riderMarkerRef.current.setPosition(riderPos);
            }
            bounds.extend(riderPos);
        }

        // 2. Update/Create Destination Marker
        if (destPos && (destPos.lat !== 0 || destPos.lng !== 0)) {
            if (!destinationMarkerRef.current) {
                destinationMarkerRef.current = new google.maps.Marker({
                    position: destPos,
                    map: googleMapRef.current,
                    title: "Delivery Destination",
                    icon: {
                        url: "https://cdn-icons-png.flaticon.com/512/619/619153.png", // House Icon
                        scaledSize: new google.maps.Size(35, 35),
                        origin: new google.maps.Point(0, 0),
                        anchor: new google.maps.Point(17, 17)
                    }
                });
            } else {
                destinationMarkerRef.current.setPosition(destPos);
            }
            bounds.extend(destPos);
        }

        // 3. Draw Road-based Route (with Straight-line Fallback)
        if (!isDefaultGabon && destPos) {
            const directionsService = new google.maps.DirectionsService();
            const lineCoordinates = [riderPos, destPos];

            directionsService.route(
                {
                    origin: riderPos,
                    destination: destPos,
                    travelMode: google.maps.TravelMode.DRIVING
                },
                (result: any, status: any) => {
                    if (status === "OK" && directionsRendererRef.current) {
                        if (routePolylineRef.current) {
                            routePolylineRef.current.setMap(null);
                            routePolylineRef.current = null;
                        }
                        directionsRendererRef.current.setDirections(result);
                    } else {
                        if (!directionsApiFailedOnce.current) {
                            console.warn("Directions API failed (likely disabled in console). Falling back to straight line.");
                            directionsApiFailedOnce.current = true;
                        }
                        if (directionsRendererRef.current) directionsRendererRef.current.setDirections({ routes: [] });

                        if (!routePolylineRef.current) {
                            routePolylineRef.current = new google.maps.Polyline({
                                path: lineCoordinates,
                                geodesic: true,
                                strokeColor: "#2563eb",
                                strokeOpacity: 0.6,
                                strokeWeight: 4,
                                map: googleMapRef.current,
                                icons: [{
                                    icon: { path: google.maps.SymbolPath.CIRCLE, scale: 2, fillOpacity: 1, color: '#2563eb' },
                                    offset: '0%',
                                    repeat: '20px'
                                }]
                            });
                        } else {
                            routePolylineRef.current.setPath(lineCoordinates);
                        }
                    }
                }
            );
        }

        // 4. Fit Map only if not yet done
        if (!bounds.isEmpty() && !hasInitialMapFit.current) {
            if (isDefaultGabon && destPos) {
                googleMapRef.current.setCenter(destPos);
                googleMapRef.current.setZoom(15);
            } else {
                googleMapRef.current.fitBounds(bounds, {
                    top: 100,
                    bottom: 250, 
                    left: 50,
                    right: 50
                });
            }
            hasInitialMapFit.current = true;
        }
    };

    useEffect(() => {
        initMap();
        fetchRiderLocation();

        const interval = setInterval(() => fetchRiderLocation(true), 10000); // Poll every 10 seconds in background
        return () => clearInterval(interval);
    }, [saleId, token]);

    return (
        <div className="flex flex-col h-screen fixed inset-0 bg-slate-50 overflow-hidden">
            {/* Header */}
            <div className="bg-white border-b border-slate-100 p-4 flex items-center justify-between z-10 shadow-sm shrink-0">
                <div className="flex items-center gap-4">
                    <button onClick={() => router.back()} className="p-2 hover:bg-slate-100 rounded-full transition">
                        <ChevronLeft size={24} className="text-slate-900" />
                    </button>
                    <div>
                        <h1 className="text-lg font-bold text-slate-900 leading-tight">Track Order #{saleId}</h1>
                        <p className="text-[10px] font-bold text-slate-400   leading-none">
                            {riderLocation?.order_status?.replace(/_/g, ' ') || 'Tracking'}
                        </p>
                    </div>
                </div>
                {riderLocation?.rider_phone && (
                   <a 
                     href={`tel:${riderLocation.rider_phone}`}
                     className="bg-blue-600 text-white p-3 rounded-2xl shadow-lg active:scale-95 transition"
                   >
                     <Navigation className="rotate-45" size={20} />
                   </a>
                )}
            </div>

            {/* Map Container */}
            <div className="flex-1 relative overflow-hidden">
                <div ref={mapRef} className="w-full h-full" />
                
                {isLoading && (
                    <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex flex-col items-center justify-center gap-4 z-20">
                        <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
                        <p className="text-sm font-bold text-slate-600  ">Connecting...</p>
                    </div>
                )}

                {error && !riderLocation && (
                    <div className="absolute inset-0 bg-white/90 flex flex-col items-center justify-center p-8 text-center gap-6 z-30">
                        <div className="w-20 h-20 bg-rose-50 rounded-full flex items-center justify-center text-rose-500 text-3xl font-bold">!</div>
                        <div>
                            <h2 className="text-xl font-bold text-slate-900 mb-2">Connection Issues</h2>
                            <p className="text-sm text-slate-500 max-w-xs">{error}</p>
                        </div>
                        <button onClick={() => fetchRiderLocation()} className="px-8 py-3 bg-black text-white rounded-2xl font-bold text-xs   shadow-lg">Retry</button>
                    </div>
                )}
                
                {isRefreshing && (
                    <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-white/90 backdrop-blur px-3 py-1.5 rounded-full shadow-sm border border-slate-100 flex items-center gap-2 z-10">
                        <Loader2 size={12} className="text-blue-600 animate-spin" />
                        <span className="text-[9px] font-bold  text-slate-400">Updating...</span>
                    </div>
                )}
            </div>

            {/* Rider Info Card */}
            {riderLocation && (
                <div className="bg-white border-t border-slate-100 p-5 z-10 shadow-[0_-4px_20px_rgba(0,0,0,0.05)] rounded-t-[2.5rem] shrink-0">
                    <div className="max-w-md mx-auto space-y-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600 border border-blue-100">
                                    <User size={24} />
                                </div>
                                <div className="flex flex-col">
                                    <h3 className="text-sm font-bold text-slate-900 leading-tight">{riderLocation.rider_name}</h3>
                                    <p className="text-[9px] font-bold text-slate-400  tracking-tighter">
                                        {riderLocation.rider_phone || 'Delivery Partner'}
                                    </p>
                                </div>
                            </div>
                            <div className="bg-blue-50 text-blue-600 px-3 py-1.5 rounded-xl border border-blue-100 flex items-center gap-2">
                                <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse" />
                                <span className="text-[10px] font-bold  tracking-wider">
                                    {Math.abs(Number(riderLocation.latitude) - 1.303) < 0.001 ? "Locating..." : "Live"}
                                </span>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
                                <div className="flex items-center gap-2 mb-1 text-blue-600">
                                    <MapPin size={12} />
                                    <span className="text-[8px] font-bold  ">Location</span>
                                </div>
                                <p className="text-[10px] font-bold text-slate-900 line-clamp-2 h-7 overflow-hidden">
                                    {Math.abs(Number(riderLocation.latitude) - 1.303) < 0.001 
                                        ? "Detecting signal..." 
                                        : currentAddress || "On the way"}
                                </p>
                            </div>
                            <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
                                <div className="flex items-center gap-2 mb-1 text-indigo-600">
                                    <Clock size={12} />
                                    <span className="text-[8px] font-bold  ">Status</span>
                                </div>
                                <p className="text-[10px] font-bold text-indigo-900 ">
                                    {riderLocation.order_status?.replace(/_/g, ' ') || 'N/A'}
                                </p>
                            </div>
                        </div>
                        
                        <a 
                          href={`tel:${riderLocation.rider_phone}`}
                          className="flex items-center justify-center gap-2 w-full bg-slate-900 text-white py-4 rounded-2xl font-bold text-[10px]   shadow-xl active:scale-95 transition"
                        >
                          <User size={14} />
                          Call {riderLocation.rider_name.split(' ')[0]}
                        </a>
                    </div>
                </div>
            )}
        </div>
    );
}
