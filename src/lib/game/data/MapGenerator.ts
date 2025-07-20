import type { Region } from '$lib/game/WorldConflictGameState';

export interface MapGenerationOptions {
    size: 'Small' | 'Medium' | 'Large';
    mapWidth?: number;
    mapHeight?: number;
    lakePercentage?: number; // Percentage of regions to remove as "lakes"
}

export class MapGenerator {
    private mapWidth: number;
    private mapHeight: number;

    constructor(mapWidth = 800, mapHeight = 600) {
        this.mapWidth = mapWidth;
        this.mapHeight = mapHeight;
    }

    generateMap(options: MapGenerationOptions): Region[] {
        const regionCounts = {
            'Small': 9,   // Start with more, then remove some as lakes
            'Medium': 20,
            'Large': 30
        };

        const targetRegions = regionCounts[options.size];

        // Generate initial regions with more organic positioning
        let regions = this.generateOrganicRegions(targetRegions);
        this.connectNeighbors(regions);
        return regions;
    }

    private generateOrganicRegions(count: number): Region[] {
        const regions: Region[] = [];

        // Use more organic positioning instead of strict grid
        const attempts = count * 10; // Try multiple times to place each region
        const minDistance = 60; // Minimum distance between region centers

        let regionIndex = 0;
        let attemptCount = 0;

        while (regionIndex < count && attemptCount < attempts) {
            // Generate position with some clustering tendency (more realistic)
            let x: number, y: number;

            if (regions.length === 0) {
                // First region near center
                x = this.mapWidth * (0.3 + Math.random() * 0.4);
                y = this.mapHeight * (0.3 + Math.random() * 0.4);
            } else {
                // Bias new regions to be near existing ones (creates landmasses)
                const existingRegion = regions[Math.floor(Math.random() * regions.length)];
                const angle = Math.random() * Math.PI * 2;
                const distance = minDistance + Math.random() * minDistance * 2;

                x = existingRegion.x + Math.cos(angle) * distance;
                y = existingRegion.y + Math.sin(angle) * distance;

                // Add some randomness
                x += (Math.random() - 0.5) * minDistance;
                y += (Math.random() - 0.5) * minDistance;

                // Keep within bounds
                x = Math.max(50, Math.min(this.mapWidth - 50, x));
                y = Math.max(50, Math.min(this.mapHeight - 50, y));
            }

            // Check if too close to existing regions
            const tooClose = regions.some(existing => {
                const distance = Math.sqrt(
                    Math.pow(x - existing.x, 2) + Math.pow(y - existing.y, 2)
                );
                return distance < minDistance;
            });

            if (!tooClose) {
                regions.push({
                    index: regionIndex,
                    name: `Region ${regionIndex + 1}`,
                    x: Math.round(x),
                    y: Math.round(y),
                    neighbors: [],
                    hasTemple: Math.random() < 0.3
                });
                regionIndex++;
            }

            attemptCount++;
        }

        return regions;
    }

    private connectNeighbors(regions: Region[]): void {
        // Connect regions based on distance (creates more organic connections)
        for (let i = 0; i < regions.length; i++) {
            const region = regions[i];

            // Find distances to all other regions
            const distances = regions
                .map((other, index) => ({
                    index,
                    distance: index === i ? Infinity : Math.sqrt(
                        Math.pow(other.x - region.x, 2) + Math.pow(other.y - region.y, 2)
                    )
                }))
                .sort((a, b) => a.distance - b.distance);

            // Connect to 2-5 nearest neighbors (varies for organic feel)
            const connectionCount = 2 + Math.floor(Math.random() * 4);

            for (let j = 0; j < Math.min(connectionCount, distances.length); j++) {
                const neighborIndex = distances[j].index;
                const neighbor = regions[neighborIndex];

                // Don't connect to self or if too far
                if (neighborIndex === i || distances[j].distance > 120) continue;

                // Add bidirectional connection
                if (!region.neighbors.includes(neighborIndex)) {
                    region.neighbors.push(neighborIndex);
                }
                if (!neighbor.neighbors.includes(i)) {
                    neighbor.neighbors.push(i);
                }
            }
        }
    }
}
