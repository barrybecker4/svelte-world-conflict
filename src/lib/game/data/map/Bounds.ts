import type { Region } from "$lib/game/WorldConflictGameState.ts";
import { RegionMap } from "$lib/game/data/map/RegionMap.ts";
import { GRID_WIDTH, GRID_HEIGHT, randomInt } from "./mapConstants.ts";

// Bitmap for overlapping parts
const TOP_OVERLAP = 1;
const BOTTOM_OVERLAP = 2;
const LEFT_OVERLAP = 4;
const RIGHT_OVERLAP = 8;
const CENTER_OVERLAP = 16;

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

    makeRegion(index: number, mapWidth: number, mapHeight: number): Region {
        // Convert grid coordinates to pixel coordinates for display
        const pixelX = Math.round((this.left + this.width / 2) * (mapWidth / GRID_WIDTH));
        const pixelY = Math.round((this.top + this.height / 2) * (mapHeight / GRID_HEIGHT));

        return {
            index,
            name: `Region ${index + 1}`,
            x: pixelX,
            y: pixelY,
            neighbors: [],
            hasTemple: Math.random() < 0.4 // 40% chance
        };
    }
}
