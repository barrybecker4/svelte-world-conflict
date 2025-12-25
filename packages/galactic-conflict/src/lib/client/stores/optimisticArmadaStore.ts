/**
 * Optimistic Armada Store
 * 
 * Tracks armadas that were created optimistically by the client.
 * This protects against stale server broadcasts (due to Cloudflare KV's
 * eventual consistency) from removing recently-created armadas.
 * 
 * The flow:
 * 1. When user sends an armada, we add it to this store
 * 2. When server state arrives, we merge: keep server armadas + any
 *    locally-tracked armadas that are still within the grace period
 * 3. Once the grace period expires, the server state becomes the source of truth
 */

import { writable, get } from 'svelte/store';
import type { Armada } from '$lib/game/entities/gameTypes';

/**
 * How long to protect optimistic armadas from being removed by stale server state.
 * This should be longer than the typical KV propagation delay (up to 60 seconds globally,
 * but usually much faster for regional reads).
 */
const OPTIMISTIC_ARMADA_GRACE_PERIOD_MS = 10_000; // 10 seconds

interface OptimisticArmada {
    armada: Armada;
    /** When this armada was added optimistically */
    addedAt: number;
}

/**
 * Store for tracking optimistically-added armadas
 */
const optimisticArmadas = writable<Map<string, OptimisticArmada>>(new Map());

/**
 * Track an armada that was just created optimistically.
 * Call this when the API response returns a newly created armada.
 */
export function trackOptimisticArmada(armada: Armada): void {
    optimisticArmadas.update(map => {
        map.set(armada.id, {
            armada,
            addedAt: Date.now(),
        });
        return map;
    });
}

/**
 * Stop tracking an armada (e.g., when confirmed by server or grace period expired).
 */
export function removeOptimisticArmada(armadaId: string): void {
    optimisticArmadas.update(map => {
        map.delete(armadaId);
        return map;
    });
}

/**
 * Clear all tracked optimistic armadas.
 * Call this when leaving a game or starting a new one.
 */
export function clearOptimisticArmadas(): void {
    optimisticArmadas.set(new Map());
}

/**
 * Merge server armadas with locally-tracked optimistic armadas.
 * 
 * This is the key function that prevents stale server broadcasts from
 * removing recently-created armadas.
 * 
 * @param serverArmadas - Armadas from the server state
 * @returns Merged armada list
 */
export function mergeArmadasWithOptimistic(serverArmadas: Armada[]): Armada[] {
    const now = Date.now();
    const currentOptimistic = get(optimisticArmadas);
    
    // Build a set of server armada IDs for quick lookup
    const serverArmadaIds = new Set(serverArmadas.map(a => a.id));
    
    // Start with all server armadas
    const merged: Armada[] = [...serverArmadas];
    
    // Track which optimistic armadas are now confirmed or expired
    const confirmedOrExpired: string[] = [];
    
    // Check each optimistic armada
    for (const [armadaId, { armada, addedAt }] of currentOptimistic.entries()) {
        const age = now - addedAt;
        
        if (serverArmadaIds.has(armadaId)) {
            // Server has this armada - it's been confirmed!
            confirmedOrExpired.push(armadaId);
        } else if (age > OPTIMISTIC_ARMADA_GRACE_PERIOD_MS) {
            // Grace period expired - defer to server (armada might have arrived and been processed)
            confirmedOrExpired.push(armadaId);
        } else {
            // Still within grace period and not in server state - keep the optimistic version
            // This protects against stale server broadcasts
            merged.push(armada);
        }
    }
    
    // Clean up confirmed/expired armadas
    if (confirmedOrExpired.length > 0) {
        optimisticArmadas.update(map => {
            for (const id of confirmedOrExpired) {
                map.delete(id);
            }
            return map;
        });
    }
    
    return merged;
}

/**
 * Check if an armada is currently being tracked as optimistic.
 */
export function isOptimisticArmada(armadaId: string): boolean {
    return get(optimisticArmadas).has(armadaId);
}

