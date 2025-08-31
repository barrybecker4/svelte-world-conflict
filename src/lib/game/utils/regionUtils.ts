import { Region } from '$lib/game/classes/Region';

/**
 * Safely reconstruct Region instances from JSON data
 * This ensures regions have proper methods like getDistanceTo
 */
export function reconstructRegionsFromJSON(regionData: any[]): Region[] {
    if (!regionData || !Array.isArray(regionData)) {
        console.warn('⚠️ Invalid region data provided for reconstruction');
        return [];
    }

    try {
        const regions = regionData.map((data, index) => {
            // Ensure required properties exist
            if (typeof data.index !== 'number' || !data.name || !data.neighbors) {
                console.warn(`⚠️ Invalid region data at index ${index}:`, data);

                // Create a minimal valid region
                return new Region({
                    index: data.index || index,
                    name: data.name || `Region ${index}`,
                    neighbors: Array.isArray(data.neighbors) ? data.neighbors : [],
                    x: typeof data.x === 'number' ? data.x : 0,
                    y: typeof data.y === 'number' ? data.y : 0,
                    hasTemple: Boolean(data.hasTemple),
                    points: data.points || []
                });
            }

            return new Region(data);
        });

        console.log(`✅ Successfully reconstructed ${regions.length} Region instances`);

        // Verify reconstruction worked
        const testRegion = regions[0];
        if (testRegion && typeof testRegion.getDistanceTo === 'function') {
            console.log('✅ Region methods verified - getDistanceTo is available');
        } else {
            console.error('❌ Region reconstruction failed - methods not available');
        }

        return regions;
    } catch (error) {
        console.error('❌ Error reconstructing regions:', error);
        return [];
    }
}

/**
 * Validate that regions are proper Region instances
 */
export function validateRegionInstances(regions: any[]): boolean {
    if (!Array.isArray(regions) || regions.length === 0) {
        return false;
    }

    return regions.every(region =>
        region instanceof Region &&
        typeof region.getDistanceTo === 'function'
    );
}

/**
 * Convert regions to JSON safely
 */
export function regionsToJSON(regions: Region[]): any[] {
    return regions.map(region => region.toJSON());
}

/**
 * Create Region instances from minimal data (for fallback)
 */
export function createBasicRegions(count: number): Region[] {
    const regions: Region[] = [];

    for (let i = 0; i < count; i++) {
        regions.push(new Region({
            index: i,
            name: `Region ${i + 1}`,
            neighbors: [],
            x: Math.random() * 800,
            y: Math.random() * 600,
            hasTemple: i < Math.ceil(count / 3), // About 1/3 have temples
            points: []
        }));
    }

    // Add some basic neighbors
    regions.forEach((region, index) => {
        const neighborCount = Math.min(3, Math.floor(Math.random() * 4) + 1);
        for (let i = 0; i < neighborCount; i++) {
            const neighborIndex = (index + i + 1) % regions.length;
            if (!region.neighbors.includes(neighborIndex)) {
                region.neighbors.push(neighborIndex);
            }
        }
    });

    return regions;
}
