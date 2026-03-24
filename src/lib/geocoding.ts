/**
 * Utility for geocoding addresses using Google Maps JavaScript API.
 * This approach works with API keys that have "Website (Referer) Restrictions".
 */

const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";

export interface GeoPoint {
    latitude: number;
    longitude: number;
}

/**
 * Dynamically loads the Google Maps JavaScript API script.
 */
function loadGoogleMapsScript(): Promise<void> {
    return new Promise((resolve, reject) => {
        if (typeof window === "undefined") return reject("Browser only");
        if ((window as any).google && (window as any).google.maps) return resolve();

        // Check if script is already being loaded
        const existingScript = document.getElementById("google-maps-geocoding-script");
        if (existingScript) {
            existingScript.addEventListener("load", () => resolve());
            existingScript.addEventListener("error", (e) => reject(e));
            return;
        }

        const script = document.createElement("script");
        script.id = "google-maps-geocoding-script";
        script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=places`;
        script.async = true;
        script.defer = true;
        script.onload = () => resolve();
        script.onerror = (e) => reject(e);
        document.head.appendChild(script);
    });
}

/**
 * Converts a string address to latitude and longitude using Google Maps JS Geocoder.
 */
export async function geocodeAddress(address: string): Promise<GeoPoint | null> {
    if (!GOOGLE_MAPS_API_KEY) {
        console.warn("Geocoding failed: NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is not set.");
        return null;
    }

    try {
        await loadGoogleMapsScript();

        const geocoder = new (window as any).google.maps.Geocoder();

        return new Promise((resolve) => {
            geocoder.geocode({ address }, (results: any, status: any) => {
                if (status === "OK" && results && results[0]) {
                    const location = results[0].geometry.location;
                    resolve({
                        latitude: location.lat(),
                        longitude: location.lng(),
                    });
                } else {
                    console.error("Geocoding Status Error:", status);
                    resolve(null);
                }
            });
        });
    } catch (error) {
        console.error("Geocoding exception:", error);
        return null;
    }
}
/**
 * Formats an address specifically for Nigeria-based geocoding as requested.
 * Format: address(street, LGA(lga), State(state))
 */
export function arrangeAddressForNigeria(address: string, lga: string, state: string): string {
    return `address(${address}, LGA(${lga}), State(${state}))`;
}
