import { safeFetch } from "./handler";

export async function fetchUnifiedSearch(query: string, limit = 5, token?: string | null, tab?: string, subTab?: string) {
  const headers: any = {};
  if (token) headers.Authorization = `Bearer ${token}`;

  let url = `/api/search/unified?query=${encodeURIComponent(query)}&limit=${limit}`;
  if (tab) url += `&tab=${tab}`;
  if (subTab) url += `&subTab=${subTab}`;

  return safeFetch(url, {
    method: "GET",
    headers,
  });
}

export async function fetchSearchSuggestions(query: string) {
  return safeFetch(`/api/search/suggest?query=${encodeURIComponent(query)}`, {
    method: "GET",
  });
}

export async function fetchTrendingSearches() {
  return safeFetch("/api/search/trending", {
    method: "GET",
  });
}

export async function fetchRecentSearches(token: string) {
  return safeFetch("/api/search/recent", {
    method: "GET",
    headers: { 
      Authorization: `Bearer ${token}`
    },
  });
}
