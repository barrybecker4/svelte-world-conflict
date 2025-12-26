import type { Region } from '$lib/game/entities/gameTypes';
import { RegionMap } from '$lib/game/map/RegionMap';
import { Bounds } from '$lib/game/map/Bounds.ts';
import { PositionSet } from '$lib/game/map/PositionSet';
import { GRID_WIDTH, GRID_HEIGHT, randomInt } from './mapConstants';
import { GAME_CONSTANTS } from '$lib/game/constants/gameConstants';
import { logger } from 'multiplayer-framework/shared';

export interface MapGenerationOptions {
    size: 'Small' | 'Medium' | 'Large';
    mapWidth?: number;
    mapHeight?: number;
    playerCount?: number;
}

const MIN_REGION_SIZE_MAP = { Small: 7, Medium: 4, Large: 3 };
const MAX_REGION_SIZE_MAP = { Small: 16, Medium: 12, Large: 10 };
const BASE_NUM_REGIONS_MAP = { Small: 5, Medium: 14, Large: 36 };
const REGIONS_PER_PLAYER_ALLOCATION_MAP = { Small: 2, Medium: 3, Large: 4 };

// Minimum regions = MAX_PLAYERS + 1 (ensures at least one neutral region even at max player count)
const MIN_REGIONS_REQUIRED = GAME_CONSTANTS.MAX_PLAYERS + 1;

// Maximum attempts to generate a valid map before giving up
const MAX_GENERATION_ATTEMPTS = 5;

type MapSize = 'Small' | 'Medium' | 'Large';

/**
 * Main MapGenerator class - Drop-in replacement using original GAS algorithm
 */
export class MapGenerator {
    private mapWidth: number;
    private mapHeight: number;

    constructor(mapWidth = 800, mapHeight = 600) {
        this.mapWidth = mapWidth;
        this.mapHeight = mapHeight;
    }

    generateMap(options: MapGenerationOptions): Region[] {
        const playerCount = options.playerCount || 4;
        const mapSize = options.size;

        // Try generating the map multiple times if it fails
        let lastError: Error | null = null;
        for (let attempt = 1; attempt <= MAX_GENERATION_ATTEMPTS; attempt++) {
            try {
                const regions = this.attemptMapGeneration(mapSize, playerCount);

                // Success! Log if we needed multiple attempts
                if (attempt > 1) {
                    logger.debug(`✅ Map generation succeeded on attempt ${attempt}/${MAX_GENERATION_ATTEMPTS}`);
                }

                return regions;
            } catch (error) {
                lastError = error as Error;
                if (attempt < MAX_GENERATION_ATTEMPTS) {
                    logger.debug(`⚠️ Map generation attempt ${attempt}/${MAX_GENERATION_ATTEMPTS} failed, retrying...`);
                }
            }
        }

        // All attempts failed
        throw new Error(
            `Map generation failed after ${MAX_GENERATION_ATTEMPTS} attempts. ` +
                `Last error: ${lastError?.message || 'Unknown error'}. ` +
                `Try using a larger map size.`
        );
    }

    /**
     * Single attempt to generate a map
     * @throws Error if minimum region requirements are not met
     */
    private attemptMapGeneration(mapSize: MapSize, playerCount: number): Region[] {
        // Reset perturbation constant for each attempt (in Bounds.ts)
        Bounds.resetPerturbation();

        const minRegionSize = MIN_REGION_SIZE_MAP[mapSize];
        const maxRegionSize = MAX_REGION_SIZE_MAP[mapSize] - playerCount;
        const neededRegions = BASE_NUM_REGIONS_MAP[mapSize] + playerCount * REGIONS_PER_PLAYER_ALLOCATION_MAP[mapSize];
        const minRegionArea = Math.pow(minRegionSize, 2);

        let regionCount = 0;
        const regions: Region[] = [];
        const regionMap = new RegionMap();
        const positionSet = new PositionSet();

        // Start with a region in the center
        let bounds = this.createBoundsAtCenter(minRegionSize, maxRegionSize);
        positionSet.addPositionsForBounds(bounds, minRegionSize, regionMap);
        regionCount = this.addRegion(bounds, regionCount, regions, regionMap);

        // Add regions systematically around existing ones
        while (regionCount < neededRegions && !positionSet.isEmpty()) {
            const pos = positionSet.removeRandomPosition();
            if (!regionMap.get(pos[0], pos[1])) {
                bounds = this.createBoundsAtPosition(pos[0], pos[1], minRegionSize, maxRegionSize);
                let overlapBitmap = bounds.overlaps(regionMap);

                // Shrink bounds until no overlaps
                while (overlapBitmap > 0 && !bounds.shrink(minRegionArea, overlapBitmap)) {
                    overlapBitmap = bounds.overlaps(regionMap);
                }

                if (overlapBitmap === 0) {
                    regionCount = this.addRegion(bounds, regionCount, regions, regionMap);
                    positionSet.addPositionsForBounds(bounds, minRegionSize, regionMap);
                }
            }
        }

        regionMap.fillNeighborLists();

        // Validate minimum region count for playable game
        // Always need MIN_REGIONS_REQUIRED (MAX_PLAYERS + 1) to ensure at least one neutral region
        if (regions.length < MIN_REGIONS_REQUIRED) {
            throw new Error(
                `Generated ${regions.length} regions but need at least ${MIN_REGIONS_REQUIRED} ` +
                    `(${GAME_CONSTANTS.MAX_PLAYERS} max players + 1 neutral region minimum)`
            );
        }

        // Ensure we have enough temple regions for all players
        this.ensureMinimumTemples(regions, playerCount);

        return regions;
    }

    /**
     * Ensures there are enough temple regions for all players
     * If there aren't enough temples, converts non-temple regions to temple regions
     */
    private ensureMinimumTemples(regions: Region[], playerCount: number): void {
        const templeRegions = regions.filter(r => r.hasTemple);
        const neededTemples = playerCount;

        if (templeRegions.length < neededTemples) {
            logger.debug(
                `⚠️ Only ${templeRegions.length} temple regions found, need ${neededTemples} for ${playerCount} players`
            );

            // Get non-temple regions
            const nonTempleRegions = regions.filter(r => !r.hasTemple);

            // Convert enough non-temple regions to temple regions
            const templeDeficit = neededTemples - templeRegions.length;
            for (let i = 0; i < Math.min(templeDeficit, nonTempleRegions.length); i++) {
                const region = nonTempleRegions[i];
                // Modify the hasTemple property directly (it's a readonly property, but we're in the generation phase)
                (region as any).hasTemple = true;
                logger.debug(`✅ Converted region ${region.index} to temple region`);
            }

            const finalTempleCount = regions.filter(r => r.hasTemple).length;
            logger.debug(`🏛️ Final temple count: ${finalTempleCount} (need ${neededTemples})`);
        } else {
            logger.debug(`✅ Sufficient temples: ${templeRegions.length} temple regions for ${playerCount} players`);
        }
    }

    private addRegion(bounds: Bounds, regionCount: number, regions: Region[], regionMap: RegionMap): number {
        const region = bounds.makeRegion(regionCount, this.mapWidth, this.mapHeight);
        if (!region) throw new Error('Failed to create region with bounds ' + bounds);
        regions.push(region);
        bounds.markInMap(region, regionMap);
        return regionCount + 1;
    }

    private createBoundsAtCenter(minRegionSize: number, maxRegionSize: number): Bounds {
        const left = Math.floor((GRID_WIDTH - maxRegionSize + 1) / 2);
        const top = Math.floor((GRID_HEIGHT - maxRegionSize + 1) / 2);
        return this.createBoundsAtPosition(left, top, minRegionSize, maxRegionSize);
    }

    private createBoundsAtPosition(left: number, top: number, minRegionSize: number, maxRegionSize: number): Bounds {
        const maxWidth = Math.min(maxRegionSize - 1, GRID_WIDTH - left - 1);
        const maxHeight = Math.min(maxRegionSize - 1, GRID_HEIGHT - top - 1);
        const width = randomInt(minRegionSize + 1, maxWidth);
        const height = randomInt(minRegionSize + 1, maxHeight);

        if (left + width >= GRID_WIDTH || top + height >= GRID_HEIGHT) {
            throw new Error(`region out of bounds = ${left} + ${width}, ${top} + ${height}`);
        }
        return new Bounds(left, top, width, height);
    }
}
