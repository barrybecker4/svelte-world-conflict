import { GAME_CONSTANTS } from '$lib/game/constants/gameConstants.ts';

export interface GeneratedRegion {
    index: number;
    neighbors: number[];
    x: number;
    y: number;
    hasTemple: boolean;
}

export interface MapGenerationOptions {
    size: 'Small' | 'Medium' | 'Large';
    regionCount?: number;
    templeProbability?: number;
    seed?: number;
}

export class MapGenerator {
    private rng: () => number;

    constructor(seed?: number) {
        // Simple seeded random number generator for reproducible maps
        this.rng = seed ? this.seededRandom(seed) : Math.random;
    }

    /**
     * Generate a procedural map
     */
    generateMap(options: MapGenerationOptions): GeneratedRegion[] {
        const regionCount = this.getRegionCount(options.size, options.regionCount);
        const regions = this.generateRegionPositions(regionCount);
        this.generateConnections(regions);
        this.assignTemples(regions, options.templeProbability || GAME_CONSTANTS.TEMPLE_PROBABILITY);
        this.validateMap(regions);

        return regions;
    }

    private getRegionCount(size: string, override?: number): number {
        if (override) return override;

        switch (size) {
            case 'Small': return 15;
            case 'Medium': return 20;
            case 'Large': return 25;
            default: return 20;
        }
    }

    private generateRegionPositions(count: number): GeneratedRegion[] {
        const regions: GeneratedRegion[] = [];
        const minDistance = 80; // Minimum distance between regions

        for (let i = 0; i < count; i++) {
            let x: number, y: number;
            let attempts = 0;

            do {
                x = this.rng() * (GAME_CONSTANTS.GRID_WIDTH * 20);
                y = this.rng() * (GAME_CONSTANTS.GRID_HEIGHT * 20);
                attempts++;
            } while (attempts < 100 && this.tooCloseToExisting(x, y, regions, minDistance));

            regions.push({
                index: i,
                neighbors: [],
                x: Math.round(x),
                y: Math.round(y),
                hasTemple: false
            });
        }

        return regions;
    }

    private tooCloseToExisting(x: number, y: number, existing: GeneratedRegion[], minDistance: number): boolean {
        return existing.some(region => {
            const dx = x - region.x;
            const dy = y - region.y;
            return Math.sqrt(dx * dx + dy * dy) < minDistance;
        });
    }

    private generateConnections(regions: GeneratedRegion[]): void {
        // Create Delaunay-like triangulation for natural connections
        for (let i = 0; i < regions.length; i++) {
            const region = regions[i];
            const distances = regions
                .map((other, index) => ({
                    index,
                    distance: this.distance(region, other)
                }))
                .filter(d => d.index !== i)
                .sort((a, b) => a.distance - b.distance);

            // Connect to 2-4 nearest neighbors
            const connectionCount = Math.min(
                2 + Math.floor(this.rng() * 3),
                GAME_CONSTANTS.MAX_NEIGHBORS
            );

            for (let j = 0; j < connectionCount && j < distances.length; j++) {
                const neighbor = distances[j].index;

                // Add bidirectional connection
                if (!region.neighbors.includes(neighbor)) {
                    region.neighbors.push(neighbor);
                }
                if (!regions[neighbor].neighbors.includes(i)) {
                    regions[neighbor].neighbors.push(i);
                }
            }
        }

        // Ensure connectivity
        this.ensureConnectivity(regions);
    }

    private distance(a: GeneratedRegion, b: GeneratedRegion): number {
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    private ensureConnectivity(regions: GeneratedRegion[]): void {
        // Use BFS to find disconnected components and connect them
        const visited = new Set<number>();
        const components: number[][] = [];

        for (let i = 0; i < regions.length; i++) {
            if (!visited.has(i)) {
                const component = this.getConnectedComponent(regions, i, visited);
                components.push(component);
            }
        }

        // Connect components
        while (components.length > 1) {
            const comp1 = components.pop()!;
            const comp2 = components[components.length - 1];

            // Find closest regions between components
            let minDistance = Infinity;
            let bestConnection: [number, number] = [comp1[0], comp2[0]];

            for (const r1 of comp1) {
                for (const r2 of comp2) {
                    const dist = this.distance(regions[r1], regions[r2]);
                    if (dist < minDistance) {
                        minDistance = dist;
                        bestConnection = [r1, r2];
                    }
                }
            }

            // Add connection
            regions[bestConnection[0]].neighbors.push(bestConnection[1]);
            regions[bestConnection[1]].neighbors.push(bestConnection[0]);

            // Merge components
            comp2.push(...comp1);
        }
    }

    private getConnectedComponent(regions: GeneratedRegion[], start: number, visited: Set<number>): number[] {
        const component: number[] = [];
        const queue = [start];

        while (queue.length > 0) {
            const current = queue.shift()!;
            if (visited.has(current)) continue;

            visited.add(current);
            component.push(current);

            for (const neighbor of regions[current].neighbors) {
                if (!visited.has(neighbor)) {
                    queue.push(neighbor);
                }
            }
        }

        return component;
    }

    private assignTemples(regions: GeneratedRegion[], probability: number): void {
        for (const region of regions) {
            region.hasTemple = this.rng() < probability;
        }

        // Ensure at least one temple per 4 regions
        const minTemples = Math.ceil(regions.length / 4);
        const currentTemples = regions.filter(r => r.hasTemple).length;

        if (currentTemples < minTemples) {
            const nonTempleRegions = regions.filter(r => !r.hasTemple);
            for (let i = 0; i < minTemples - currentTemples && i < nonTempleRegions.length; i++) {
                const randomIndex = Math.floor(this.rng() * nonTempleRegions.length);
                nonTempleRegions[randomIndex].hasTemple = true;
            }
        }
    }

    private validateMap(regions: GeneratedRegion[]): void {
        // Ensure all regions have at least 2 neighbors
        for (const region of regions) {
            if (region.neighbors.length < GAME_CONSTANTS.MIN_NEIGHBORS) {
                console.warn(`Region ${region.index} has only ${region.neighbors.length} neighbors`);
            }
        }
    }

    private seededRandom(seed: number): () => number {
        let state = seed;
        return () => {
            state = (state * 1664525 + 1013904223) % 4294967296;
            return state / 4294967296;
        };
    }
}
