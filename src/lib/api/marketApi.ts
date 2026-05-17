// src/lib/api/marketApi.ts
import { safeFetch } from "./handler";

export interface Market {
  id: number;
  market_name: string;
  market_slug: string;
}

export async function fetchMarkets(): Promise<Market[]> {
  try {
    const json = await safeFetch<any>("/api/markets");
    if (json?.success && Array.isArray(json.data)) {
      return json.data as Market[];
    }
    return [];
  } catch (error) {
    console.error("Failed to fetch markets:", error);
    return [];
  }
}
