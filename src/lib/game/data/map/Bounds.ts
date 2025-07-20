import type { Region } from "$lib/game/WorldConflictGameState.ts";
import { RegionMap } from "$lib/game/data/map/RegionMap.ts";
import { GRID_WIDTH, GRID_HEIGHT, randomInt } from "./mapConstants.ts";

// Bitmap for overlapping parts
const TOP_OVERLAP = 1;
const BOTTOM_OVERLAP = 2;
const LEFT_OVERLAP = 4;
const RIGHT_OVERLAP = 8;
const CENTER_OVERLAP = 16;

// Perturb constant for consistent randomization across map generation
let perturbConst: number | null = null;
const PERTURB_SCALE = 0.4;

/**
 * Bounds class - ported from original Bounds.gs
 */
export class Bounds {
    public left: number;
    public top: number;
    public width: number;
    public height: number;

    constructor(left: number, top: number, width: number, height: number) {
        this.left = left;
        this.top = top;
        this.width = width;
        this.height = height;
    }

    markInMap(region: Region, regionMap: RegionMap): void {
        for (let x = this.left; x < this.left + this.width; x++) {
            for (let y = this.top; y < this.top + this.height; y++) {
                regionMap.set(x, y, region);
            }
        }
    }

    shrink(minRegionArea: number, overlapBitmap: number): boolean {
        if ((overlapBitmap & TOP_OVERLAP) > 0) {
            this.top++;
            this.height--;
        } else if ((overlapBitmap & BOTTOM_OVERLAP) > 0) {
            this.height--;
        } else if ((overlapBitmap & LEFT_OVERLAP) > 0) {
            this.left++;
            this.width--;
        } else if ((overlapBitmap & RIGHT_OVERLAP) > 0) {
            this.width--;
        } else {
            this.shrinkRandomly();
        }
        return (this.width * this.height < minRegionArea);
    }

    private shrinkRandomly(): void {
        const r = randomInt(0, 4);
        if (r % 2) this.width--;
        else this.height--;
        if (r === 2) this.top++;
        if (r === 3) this.left++;
    }

    overlaps(regionMap: RegionMap): number {
        let overlapBitmap = 0;
        const right = this.left + this.width - 1;
        const bottom = this.top + this.height - 1;

        // Check top and bottom edges
        for (let i = this.left; i <= right; i++) {
            if (regionMap.get(i, this.top)) overlapBitmap |= TOP_OVERLAP;
            if (regionMap.get(i, bottom)) overlapBitmap |= BOTTOM_OVERLAP;
        }

        // Check left and right edges
        for (let j = this.top; j <= bottom; j++) {
            if (regionMap.get(this.left, j)) overlapBitmap |= LEFT_OVERLAP;
            if (regionMap.get(right, j)) overlapBitmap |= RIGHT_OVERLAP;
        }

        // Check center
        const centerX = Math.floor((this.left + right) / 2);
        const centerY = Math.floor((this.top + bottom) / 2);
        if (regionMap.get(centerX, centerY)) overlapBitmap |= CENTER_OVERLAP;

        return overlapBitmap;
    }

    makeRegion(index: number, mapWidth: number, mapHeight: number): Region & { points?: Array<{x: number, y: number}> } {
        const left = this.left;
        const top = this.top;
        const width = this.width;
        const height = this.height;

        console.log(`Creating region ${index} with bounds: left=${left}, top=${top}, width=${width}, height=${height}`);

        // Create perturbed border points (like original GAS)
        const points: Array<{x: number, y: number}> = [];

        // Top edge (left to right)
        for (let i = 0; i < width; i++) {
            points[i] = Bounds.perturbPoint(left + i, top);
        }
        // Right edge (top to bottom)
        for (let i = 0; i < height; i++) {
            points[width + i] = Bounds.perturbPoint(left + width, top + i);
        }
        // Bottom edge (right to left)
        for (let i = 0; i < width; i++) {
            points[width + height + i] = Bounds.perturbPoint(left + width - i, top + height);
        }
        // Left edge (bottom to top)
        for (let i = 0; i < height; i++) {
            points[width + height + width + i] = Bounds.perturbPoint(left, top + height - i);
        }

        console.log(`Generated ${points.length} grid points for region ${index}`);

        // Convert grid coordinates to pixel coordinates
        const pixelPoints = points.map(point => ({
            x: Math.round(point.x * (mapWidth / GRID_WIDTH)),
            y: Math.round(point.y * (mapHeight / GRID_HEIGHT))
        }));

        console.log(`Converted to ${pixelPoints.length} pixel points for region ${index}`);

        // Convert grid coordinates to pixel coordinates for center
        const pixelX = Math.round((left + width / 2) * (mapWidth / GRID_WIDTH));
        const pixelY = Math.round((top + height / 2) * (mapHeight / GRID_HEIGHT));

        return {
            index,
            name: `Region ${index + 1}`,
            x: pixelX,
            y: pixelY,
            neighbors: [],
            hasTemple: Math.random() < 0.4, // 40% chance
            points: pixelPoints
        };
    }

    /**
     * Get the perturbation constant (consistent across map generation)
     */
    static getPerturbConst(): number {
        if (perturbConst === null) {
            perturbConst = randomInt(10000, 100000);
        }
        return perturbConst;
    }

    /**
     * Perturbs a point to give the region borders a natural feel
     * This is the exact algorithm from the original Bounds.gs
     */
    static perturbPoint(x: number, y: number): {x: number, y: number} {
        // Uncomment to disable perturbation: return { x, y };
        const pc = Bounds.getPerturbConst();
        const angle = (Math.sin(x * x * y * y * 600 + pc * 357)) * 2 * Math.PI;
        const dist = PERTURB_SCALE * (Math.sin(x * y * 600 + pc * 211));
        const xPos = x + Math.sin(angle) * dist;
        const yPos = y + Math.cos(angle) * dist;
        return { x: xPos, y: yPos };
    }

    /**
     * Reset perturbation constant for new map generation
     */
    static resetPerturbation(): void {
        perturbConst = null;
    }
}
