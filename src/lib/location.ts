/**
 * Fetches the user's current city/location name using reverse geocoding.
 */
export async function getCurrentLocationName(): Promise<string | null> {
  if (typeof window === "undefined" || !("geolocation" in navigator)) {
    return null;
  }

  // Check if we are in a secure context (HTTPS or localhost)
  if (!window.isSecureContext) {
    console.warn("--- Geolocation disabled: Not a secure context (HTTPS/localhost required) ---");
  }

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude, longitude } = position.coords;

          // Also save coordinates for delivery estimation (Handled by session or state instead of localStorage now)

          // Using Google Maps Geocoding API for consistency with the Android app
          const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
          console.log("--- Location Fetching: Using Key " + (apiKey ? "FOUND" : "MISSING") + " ---");
          if (!apiKey) throw new Error("Google Maps API Key not defined");

          const res = await fetch(
            `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${apiKey}`
          );
          if (!res.ok) throw new Error("Failed to fetch location from Google");
          const data = await res.json();
          console.log("--- Google Geo Response ---", data?.status, data?.results?.length);

          if (!data.results || data.results.length === 0) {
            console.warn("--- Google Geo: No results found ---");
            resolve(null);
            return;
          }

          // Extract components from the most accurate result (index 0)
          const components = data.results[0].address_components;
          const getComponent = (type: string) =>
            components.find((c: any) => c.types.includes(type))?.long_name;

          // Mirroring Flutter's logic: subLocality -> locality -> name
          // Google equivalent: sublocality_level_1 -> locality -> administrative_area_level_2 (City)
          const location =
            getComponent("sublocality_level_1") ||
            getComponent("locality") ||
            getComponent("administrative_area_level_2") ||
            getComponent("neighborhood") ||
            null;

          if (location) {
            // Cache it in local storage so it persists between tabs/sessions
            localStorage.setItem("user_location_name", location);
            console.log("--- Location successfully updated in cache (Google): " + location + " ---");
          }

          resolve(location);
        } catch (err) {
          console.warn("Reverse geocoding failed (Google):", err);
          resolve(null);
        }
      },
      (err) => {
        console.warn("--- Geolocation failed or timeout (Google): ---", err.message);
        resolve(null);
      },
      { timeout: 10000 }
    );
  });
}

/**
 * Returns the cached location name if available.
 */
export function getCachedLocationName(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("user_location_name");
}

/**
 * Fetches current coordinates and caches them.
 */
export async function getCurrentCoordinates(): Promise<{ latitude: number; longitude: number } | null> {
  if (typeof window === "undefined" || !("geolocation" in navigator)) return null;

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
        resolve(coords);
      },
      () => resolve(null),
      { timeout: 10000 }
    );
  });
}
