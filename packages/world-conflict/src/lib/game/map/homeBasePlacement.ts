import type { Region } from '$lib/game/entities/Region';
import type { Player } from '$lib/game/entities/gameTypes';
import { logger } from 'multiplayer-framework/shared';

export interface HomeBaseAssignment {
    playerSlotIndex: number;
    regionIndex: number;
    region: Region;
}

/**
 * Assigns home base regions to players using distance maximization algorithm
 * Ensures home bases are placed as far apart as possible
 */
export function assignHomeBaseRegions(
    players: Player[],
    regions: Region[]
): HomeBaseAssignment[] {
    logger.debug('🏠 Assigning home base regions...');

    // Find all temple regions (only these can be home bases)
    const templeRegions = regions.filter(region => region.hasTemple);

    if (templeRegions.length < players.length) {
        logger.warn(`⚠️ Not enough temple regions (${templeRegions.length}) for all players (${players.length})`);
    }

    const assignments: HomeBaseAssignment[] = [];
    const assignedRegionIndices: number[] = [];

    players.forEach((player, arrayIndex) => {
        if (arrayIndex >= templeRegions.length) {
            logger.warn(`❌ No temple region available for player ${player.slotIndex} (${player.name})`);
            return;
        }

        let homeRegion: Region | null = null;

        if (assignments.length === 0) {
            // First player gets any temple region
            homeRegion = templeRegions[0];
            logger.debug(`🎯 First player ${player.slotIndex} gets temple region ${homeRegion.index}`);
        } else {
            // Subsequent players get temple regions that are furthest from already assigned ones
            let maxDistance = 0;
            let bestRegion: Region | null = null;

            for (const candidateRegion of templeRegions) {
                // Skip already assigned regions
                if (assignedRegionIndices.includes(candidateRegion.index)) continue;

                // Find minimum distance to any already assigned home base
                let minDistanceToAssigned = Infinity;

                for (const assignment of assignments) {
                    const assignedRegion = assignment.region;

                    // Calculate Euclidean distance between candidate and assigned region
                    const distance = candidateRegion.getDistanceTo(assignedRegion);

                    // Track the closest assigned region to this candidate
                    minDistanceToAssigned = Math.min(minDistanceToAssigned, distance);
                }

                // If this candidate is further from all assigned regions than our current best
                if (minDistanceToAssigned > maxDistance) {
                    maxDistance = minDistanceToAssigned;
                    bestRegion = candidateRegion;
                }
            }

            homeRegion = bestRegion || templeRegions.find(r => !assignedRegionIndices.includes(r.index)) || null;

            if (homeRegion) {
                logger.debug(`🎯 Player ${player.slotIndex} assigned region ${homeRegion.index} (distance: ${maxDistance.toFixed(1)})`);
            }
        }

        if (homeRegion) {
            assignments.push({
                playerSlotIndex: player.slotIndex,
                regionIndex: homeRegion.index,
                region: homeRegion
            });
            assignedRegionIndices.push(homeRegion.index);
        } else {
            logger.warn(`❌ Could not assign home region to player ${player.slotIndex} (${player.name})`);
        }
    });

    logger.debug(`✅ Assigned ${assignments.length} home base regions`);
    return assignments;
}
