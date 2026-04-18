"use client";

import { useMemo } from 'react';
import { useAuth } from '@/src/context/authContext';
import { API_BASE_URL } from '@/src/lib/config';

// Global cache to prevent duplicate requests across different component instances
const stoqleIdCache: Record<string, string> = {};
const pendingRequests: Record<string, Promise<string | null>> = {};

/**
 * useStoqle Hook
 * 
 * Centralized hook for managing and retrieving Stoqle IDs.
 * - Provides the current user's Stoqle ID instantly from AuthContext.
 * - Efficiently resolves other users' Stoqle IDs with intelligent caching
 *   and request deduplication to minimize network overhead.
 */
export function useStoqle() {
  const { user } = useAuth();

  /**
   * currentStoqleId
   * The authenticated user's unique Stoqle ID.
   */
  const currentStoqleId = useMemo(() => user?.stoqle_id || null, [user?.stoqle_id]);

  /**
   * resolveStoqleId
   * Asynchronously fetches a Stoqle ID for a given userId.
   * Uses a global cache and deduplicates simultaneous requests for the same ID.
   * 
   * @param userId The database ID of the user to resolve
   * @returns Promise resolving to the stoqle_id string or null
   */
  const resolveStoqleId = async (userId: string | number): Promise<string | null> => {
    if (!userId) return null;
    const id = String(userId);

    // 1. Check local cache
    if (stoqleIdCache[id]) {
      return stoqleIdCache[id];
    }

    // 2. Check for an in-flight request for the same ID to prevent duplication
    if (id in pendingRequests) {
      return await pendingRequests[id];
    }

    // 3. Initiate new resolution request
    pendingRequests[id] = (async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/auth/users/${id}/stoqle-id`);
        if (!response.ok) return null;

        const result = await response.json();
        
        if (result.status === 'success' && result.data?.stoqle_id) {
          const sid = String(result.data.stoqle_id);
          stoqleIdCache[id] = sid; // Cache the result
          return sid;
        }

        return null;
      } catch (error) {
        console.error(`[useStoqle] Failed to resolve Stoqle ID for user ${id}:`, error);
        return null;
      } finally {
        // Clear pending status once done
        delete pendingRequests[id];
      }
    })();

    return await pendingRequests[id];
  };

  /**
   * formatStoqleId
   * Utility for consistent display of Stoqle IDs (e.g. adding prefixes or formatting)
   */
  const formatStoqleId = (id: string | number | null) => {
    if (!id) return '';
    return String(id); // Use as-is for now, easy to change platform-wide here
  };

  return {
    currentStoqleId,
    resolveStoqleId,
    formatStoqleId,
    isLoading: !!(user && !user.stoqle_id), // Useful for identifying if ID is still being hydrated
  };
}
