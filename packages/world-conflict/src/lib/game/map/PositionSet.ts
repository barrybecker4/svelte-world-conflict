import { Bounds } from "./Bounds.ts";
import { RegionMap } from "./RegionMap.ts";
import { GRID_WIDTH, GRID_HEIGHT, randomInt } from "./mapConstants.ts";

export class PositionSet {
    private positions: Array<[number, number]> = [];

    addPosition(position: [number, number]): void {
        this.positions.push(position);
    }

    addPositionIfValid(x: number, y: number, minRegionSize: number, regionMap: RegionMap): void {
        const maxX = GRID_WIDTH - minRegionSize - 1;
        const maxY = GRID_HEIGHT - minRegionSize - 1;
        const inbounds = x > 0 && y > 0 && x < maxX && y < maxY;

        if (inbounds && !regionMap.get(x, y)) {
            this.addPosition([x, y]);
        }
    }

    removeRandomPosition(): [number, number] {
        if (this.isEmpty()) {
            throw new Error("Cannot remove a position when the set is empty");
        }
        const len = this.positions.length;
        const idx = randomInt(0, len);
        const value = this.positions[idx];
        if (idx < len - 1) {
            this.positions[idx] = this.positions[len - 1];
        }
        this.positions.pop();
        return value;
    }

    addPositionsForBounds(bounds: Bounds, minRegionSize: number, regionMap: RegionMap): void {
        const left = bounds.left - minRegionSize + 1;
        const top = bounds.top - minRegionSize + 1;
        const right = bounds.left + bounds.width - 1;
        const bottom = bounds.top + bounds.height - 1;

        // Add positions around the border of the bounds
        for (let x = left; x <= right; x++) {
            this.addPositionIfValid(x, top - 1, minRegionSize, regionMap);
            this.addPositionIfValid(x, bottom + 1, minRegionSize, regionMap);
        }
        for (let y = top; y <= bottom; y++) {
            this.addPositionIfValid(left - 1, y, minRegionSize, regionMap);
            this.addPositionIfValid(right + 1, y, minRegionSize, regionMap);
        }
    }

    isEmpty(): boolean {
        return this.positions.length === 0;
    }
}
