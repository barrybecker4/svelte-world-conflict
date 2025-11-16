import type { Region } from '$lib/game/state/GameState';
import { RegionMap } from '$lib/game/map/RegionMap';
import { Bounds } from '$lib/game/map/Bounds.ts';
import { PositionSet } from '$lib/game/map/PositionSet';
import { GRID_WIDTH, GRID_HEIGHT, randomInt } from './mapConstants';

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

// Minimum regions required for a playable game
const MIN_REGIONS_FOR_PLAYERS = 5;

// Perturb constant for consistent randomization
let perturbConst: number | null = null;
const PERTURB_SCALE = 0.4;

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

        // Reset perturbation constant for each map generation
        perturbConst = null;

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
        if (regions.length < MIN_REGIONS_FOR_PLAYERS) {
            throw new Error(
                `Map generation failed: Generated ${regions.length} regions but need at least ${MIN_REGIONS_FOR_PLAYERS} for ${playerCount} players. ` +
                `Try using a larger map size or reduce the number of players.`
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
            console.log(`⚠️ Only ${templeRegions.length} temple regions found, need ${neededTemples} for ${playerCount} players`);
            
            // Get non-temple regions
            const nonTempleRegions = regions.filter(r => !r.hasTemple);
            
            // Convert enough non-temple regions to temple regions
            const templeDeficit = neededTemples - templeRegions.length;
            for (let i = 0; i < Math.min(templeDeficit, nonTempleRegions.length); i++) {
                const region = nonTempleRegions[i];
                // Modify the hasTemple property directly (it's a readonly property, but we're in the generation phase)
                (region as any).hasTemple = true;
                console.log(`✅ Converted region ${region.index} to temple region`);
            }
            
            const finalTempleCount = regions.filter(r => r.hasTemple).length;
            console.log(`🏛️ Final temple count: ${finalTempleCount} (need ${neededTemples})`);
        } else {
            console.log(`✅ Sufficient temples: ${templeRegions.length} temple regions for ${playerCount} players`);
        }
    }

    private addRegion(bounds: Bounds, regionCount: number, regions: Region[], regionMap: RegionMap): number {
        const region = bounds.makeRegion(regionCount, this.mapWidth, this.mapHeight);
        if (!region) throw new Error("Failed to create region with bounds " + bounds);
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