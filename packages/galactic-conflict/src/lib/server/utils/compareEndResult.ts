/**
 * Utility functions for comparing endResult values
 * Handles object equality after JSON serialization
 */

import type { Player } from '$lib/game/entities/gameTypes';
import { logger } from 'multiplayer-framework/shared';

export type EndResult = Player | 'DRAWN_GAME' | null | undefined;

/**
 * Compare two endResult values to determine if they changed
 * Handles object equality after JSON serialization by comparing slotIndex
 * @returns true if endResult changed, false otherwise
 */
export function compareEndResult(endResultBefore: EndResult, endResultAfter: EndResult): boolean {
    try {
        // Same reference (shouldn't happen after JSON, but check anyway)
        if (endResultBefore === endResultAfter) return false;
        
        // Both null or undefined
        if ((!endResultBefore || endResultBefore === null) && (!endResultAfter || endResultAfter === null)) {
            return false;
        }
        
        // One is null/undefined, other is not
        if (!endResultBefore || !endResultAfter) return true;
        
        // Check for DRAWN_GAME string
        if (endResultBefore === 'DRAWN_GAME' || endResultAfter === 'DRAWN_GAME') {
            return endResultBefore !== endResultAfter;
        }
        
        // Both should be Player objects - compare slotIndex (handles JSON deserialization)
        const beforeSlot = typeof endResultBefore === 'object' && endResultBefore !== null 
            ? (endResultBefore as Player).slotIndex 
            : undefined;
        const afterSlot = typeof endResultAfter === 'object' && endResultAfter !== null
            ? (endResultAfter as Player).slotIndex
            : undefined;
            
        if (beforeSlot !== undefined && afterSlot !== undefined) {
            return beforeSlot !== afterSlot;
        }
        
        // If we can't determine, they're different objects so assume changed
        return true;
    } catch (error) {
        // If comparison fails, log and assume changed (safer to broadcast)
        logger.warn(`[compareEndResult] Error comparing endResult, assuming changed:`, error);
        return true;
    }
}

