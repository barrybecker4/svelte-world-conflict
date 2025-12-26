import { Region, type RegionData } from './Region';
import { RandomNumberGenerator } from 'multiplayer-framework/shared';

/**
 * A collection class for managing regions in the game
 */
export class Regions {
    private regions: Region[];
    private regionMap: Map<number, Region>;

    constructor(regionData: RegionData[] | Region[] = []) {
        this.regions = [];
        this.regionMap = new Map();

        if (regionData.length > 0) {
            this.initializeFromData(regionData);
        }
    }

    private initializeFromData(data: RegionData[] | Region[]): void {
        Regions.validate(data);
        this.regions = data.map(item => {
            if (item instanceof Region) {
                return item;
            }
            // Handle JSON data that might be missing properties
            return new Region({
                index: item.index ?? 0,
                name: item.name ?? `Region ${item.index ?? 0}`,
                neighbors: Array.isArray(item.neighbors) ? item.neighbors : [],
                x: item.x ?? 0,
                y: item.y ?? 0,
                hasTemple: item.hasTemple ?? false,
                points: item.points
            });
        });

        // Build index map for fast lookups
        this.rebuildIndex();
    }

    /**
     * Rebuild the internal index for fast lookups
     */
    private rebuildIndex(): void {
        this.regionMap.clear();
        this.regions.forEach(region => {
            this.regionMap.set(region.index, region);
        });
    }

    getByIndex(index: number): Region | undefined {
        return this.regionMap.get(index);
    }

    getAll(): Region[] {
        return [...this.regions];
    }

    getCount(): number {
        return this.regions.length;
    }

    isValid(): boolean {
        return (
            this.regions.length > 0 &&
            this.regions.every(region => region instanceof Region && typeof region.getDistanceTo === 'function')
        );
    }

    getTempleRegions(): Region[] {
        return this.regions.filter(region => region.canHaveTemple());
    }

    getBorderRegions(): Region[] {
        const avgNeighbors = this.getAverageNeighborCount();
        return this.regions.filter(region => region.isBorderRegion(avgNeighbors));
    }

    getCentralRegions(): Region[] {
        const avgNeighbors = this.getAverageNeighborCount();
        return this.regions.filter(region => region.isCentralRegion(avgNeighbors));
    }

    getAverageNeighborCount(): number {
        if (this.regions.length === 0) return 0;
        const totalNeighbors = this.regions.reduce((sum, region) => sum + region.getNeighborCount(), 0);
        return totalNeighbors / this.regions.length;
    }

    getRegionsWithinDistance(x: number, y: number, maxDistance: number): Region[] {
        return this.regions.filter(region => region.isWithinDistance(x, y, maxDistance));
    }

    getClosestRegion(x: number, y: number): Region | undefined {
        if (this.regions.length === 0) return undefined;

        let closest = this.regions[0];
        let minDistance = Regions.distanceToPoint(closest, x, y);

        for (let i = 1; i < this.regions.length; i++) {
            const region = this.regions[i];
            const distance = Regions.distanceToPoint(region, x, y);
            if (distance < minDistance) {
                minDistance = distance;
                closest = region;
            }
        }

        return closest;
    }

    /**
     * Calculate Euclidean distance from a region to a point
     */
    private static distanceToPoint(region: Region, x: number, y: number): number {
        const dx = region.x - x;
        const dy = region.y - y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    getNeighborsOf(regionIndex: number): Region[] {
        const region = this.getByIndex(regionIndex);
        if (!region) return [];

        return region
            .getNeighbors()
            .map(neighborIndex => this.getByIndex(neighborIndex))
            .filter((neighbor): neighbor is Region => neighbor !== undefined);
    }

    areNeighbors(regionA: number, regionB: number): boolean {
        const region = this.getByIndex(regionA);
        return region ? region.isNeighborOf(regionB) : false;
    }

    static createBasic(count: number, seed?: string): Regions {
        // Create RNG for map generation if seed provided
        const rng = seed ? new RandomNumberGenerator(seed) : null;

        const regionData: RegionData[] = [];

        for (let i = 0; i < count; i++) {
            regionData.push({
                index: i,
                name: `Region ${i + 1}`,
                neighbors: [],
                x: rng ? rng.next() * 800 : Math.random() * 800,
                y: rng ? rng.next() * 600 : Math.random() * 600,
                hasTemple: i < Math.ceil(count / 3),
                points: []
            });
        }

        const regions = new Regions(regionData);

        // Add some basic neighbor relationships
        regions.regions.forEach((region, index) => {
            const neighborCount = Math.min(3, rng ? rng.nextInt(1, 4) : Math.floor(Math.random() * 4) + 1);
            for (let i = 0; i < neighborCount; i++) {
                const neighborIndex = (index + i + 1) % regions.regions.length;
                if (!region.neighbors.includes(neighborIndex)) {
                    region.neighbors.push(neighborIndex);
                }
            }
        });

        regions.rebuildIndex();
        return regions;
    }

    toJSON(): RegionData[] {
        return this.regions.map(region => region.toJSON());
    }

    static fromJSON(data: any[]): Regions {
        return new Regions(data);
    }

    [Symbol.iterator](): Iterator<Region> {
        return this.regions[Symbol.iterator]();
    }

    get length(): number {
        return this.regions.length;
    }

    filter(predicate: (region: Region) => boolean): Region[] {
        return this.regions.filter(predicate);
    }

    map<T>(mapper: (region: Region) => T): T[] {
        return this.regions.map(mapper);
    }

    find(predicate: (region: Region) => boolean): Region | undefined {
        return this.regions.find(predicate);
    }

    some(predicate: (region: Region) => boolean): boolean {
        return this.regions.some(predicate);
    }

    every(predicate: (region: Region) => boolean): boolean {
        return this.regions.every(predicate);
    }

    /**
     * Add array-like bracket notation support
     * This allows regions[index] to work like it does now
     */
    [index: number]: Region | undefined;

    /**
     * Validate region data structure
     * Accepts both Region instances and plain RegionData objects
     */
    private static validate(regionData: any[]): boolean {
        if (!Array.isArray(regionData) || regionData.length === 0) {
            return false;
        }

        return regionData.every(region => {
            // Accept Region instances
            if (region instanceof Region) {
                return true;
            }
            // Accept plain objects with required fields
            return (
                typeof region === 'object' &&
                region !== null &&
                typeof region.index === 'number' &&
                Array.isArray(region.neighbors)
            );
        });
    }
}
