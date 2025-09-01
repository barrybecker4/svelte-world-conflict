import type { Region } from '$lib/game/classes/Region';
import type { Player } from '$lib/game/classes/GameState';

export interface HomeBaseAssignment {
    playerIndex: number;
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
    console.log('🏠 Assigning home base regions...');

    // Find all temple regions (only these can be home bases)
    const templeRegions = regions.filter(region => region.hasTemple);

    if (templeRegions.length < players.length) {
        console.warn(`⚠️ Not enough temple regions (${templeRegions.length}) for all players (${players.length})`);
    }

    const assignments: HomeBaseAssignment[] = [];
    const assignedRegionIndices: number[] = [];

    players.forEach((player, playerIndex) => {
        if (playerIndex >= templeRegions.length) {
            console.warn(`❌ No temple region available for player ${player.index} (${player.name})`);
            return;
        }

        let homeRegion: Region | null = null;

        if (assignments.length === 0) {
            // First player gets any temple region
            homeRegion = templeRegions[0];
            console.log(`🎯 First player ${player.index} gets temple region ${homeRegion.index}`);
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
                console.log(`🎯 Player ${player.index} assigned region ${homeRegion.index} (distance: ${maxDistance.toFixed(1)})`);
            }
        }

        if (homeRegion) {
            assignments.push({
                playerIndex: player.index,
                regionIndex: homeRegion.index,
                region: homeRegion
            });
            assignedRegionIndices.push(homeRegion.index);
        } else {
            console.warn(`❌ Could not assign home region to player ${player.index} (${player.name})`);
        }
    });

    console.log(`✅ Assigned ${assignments.length} home base regions`);
    return assignments;
}

/**
 * Creates owner assignments from home base assignments
 */
export function createOwnerAssignments(assignments: HomeBaseAssignment[]): Record<number, number> {
    const owners: Record<number, number> = {};

    assignments.forEach(assignment => {
        owners[assignment.regionIndex] = assignment.playerIndex;
    });

    return owners;
}
