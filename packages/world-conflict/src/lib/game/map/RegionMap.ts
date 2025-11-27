import type { Region } from "$lib/game/entities/gameTypes";
import { GRID_WIDTH, GRID_HEIGHT } from "./mapConstants.ts";

const directions = [[-1, 0], [1, 0], [0, -1], [0, 1]];

export class RegionMap {
    private positionToRegion: Array<Array<Region | null>>;

    constructor() {
        this.positionToRegion = Array.from({ length: GRID_WIDTH }, () =>
            Array.from({ length: GRID_HEIGHT }, () => null)
        );
    }

    get(x: number, y: number): Region | null {
        if (x < 0 || x >= GRID_WIDTH || y < 0 || y >= GRID_HEIGHT) {
            return null;
        }
        return this.positionToRegion[x][y];
    }

    set(x: number, y: number, region: Region | null): void {
        if (x >= 0 && x < GRID_WIDTH && y >= 0 && y < GRID_HEIGHT) {
            this.positionToRegion[x][y] = region;
        }
    }

    // Figures out who borders with who, using the 2d grid
    fillNeighborLists(): void {
        for (let x = 1; x < GRID_WIDTH - 1; x++) {
            for (let y = 1; y < GRID_HEIGHT - 1; y++) {
                const region = this.positionToRegion[x][y];
                if (region) {
                    this.updateNeighbors(region, x, y);
                }
            }
        }
    }

    private updateNeighbors(region: Region, x: number, y: number): void {
        // Check cardinal directions
        for (const [dx, dy] of directions) {
            const potentialNeighbor = this.positionToRegion[x + dx][y + dy];
            if (potentialNeighbor &&
                potentialNeighbor !== region &&
                !region.neighbors.includes(potentialNeighbor.index)) {
                region.neighbors.push(potentialNeighbor.index);
            }
        }
    }
}
