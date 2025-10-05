/**
 * Represents a territory on the game map
 */
export interface RegionData {
    index: number;
    name: string;
    neighbors: number[];
    x: number;
    y: number;
    hasTemple?: boolean;
    points: Array<{ x: number; y: number }> | undefined; // Optional points for visual representation
}

export class Region {
    public readonly index: number;
    public readonly name: string;
    public readonly neighbors: number[];
    public readonly x: number;
    public readonly y: number;
    public readonly hasTemple: boolean;
    public readonly points: Array<{ x: number; y: number }> | undefined;

    constructor(data: RegionData) {
        this.index = data.index;
        this.name = data.name;
        this.neighbors = [...data.neighbors];
        this.x = data.x;
        this.y = data.y;
        this.hasTemple = data.hasTemple || false;
        this.points = data.points;
    }

    /**
     * Check if this region is adjacent to another region
     */
    isNeighborOf(regionIndex: number): boolean {
        return this.neighbors.includes(regionIndex);
    }

    /**
     * Check if this region is adjacent to another region object
     */
    isNeighborOfRegion(region: Region): boolean {
        return this.isNeighborOf(region.index);
    }

    getNeighbors(): number[] {
        return [...this.neighbors];
    }

    getNeighborCount(): number {
        return this.neighbors.length;
    }

    /**
     * Get distance to another region (Euclidean)
     */
    getDistanceTo(other: Region): number {
        const dx = this.x - other.x;
        const dy = this.y - other.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    /**
     * Get Manhattan distance to another region
     */
    getManhattanDistanceTo(other: Region): number {
        return Math.abs(this.x - other.x) + Math.abs(this.y - other.y);
    }

    /**
     * Check if this region can support a temple
     */
    canHaveTemple(): boolean {
        return this.hasTemple;
    }

    /**
     * Get region position as coordinate pair
     */
    getPosition(): { x: number; y: number } {
        return { x: this.x, y: this.y };
    }

    /**
     * Check if a point is within a certain distance of this region
     */
    isWithinDistance(x: number, y: number, maxDistance: number): boolean {
        const dx = this.x - x;
        const dy = this.y - y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        return distance <= maxDistance;
    }

    /**
     * Create a copy of this region
     */
    copy(): Region {
        return new Region({
            index: this.index,
            name: this.name,
            neighbors: [...this.neighbors],
            x: this.x,
            y: this.y,
            hasTemple: this.hasTemple,
            points: this.points
        });
    }

    /**
     * Serialize region to plain object
     */
    toJSON(): RegionData {
        return {
            index: this.index,
            name: this.name,
            neighbors: [...this.neighbors],
            x: this.x,
            y: this.y,
            hasTemple: this.hasTemple,
            points: this.points || []
        };
    }

    /**
     * Create region from plain object
     */
    static fromJSON(data: RegionData): Region {
        return new Region(data);
    }

    getDisplayName(): string {
        return this.name;
    }

    getDescription(): string {
        const neighborCount = this.neighbors.length;
        const templeStatus = this.hasTemple ? 'Has temple site' : 'No temple site';
        return `${this.name} (${neighborCount} neighbors, ${templeStatus})`;
    }

    equals(other: Region): boolean {
        return this.index === other.index;
    }

    /**
     * Get strategic value based on position and connections
     */
    getStrategicValue(): number {
        let value = 0;

        // More neighbors = more strategic (can attack/defend more regions)
        value += this.neighbors.length * 2;

        // Temple sites are valuable
        if (this.hasTemple) {
            value += 5;
        }

        // Central position is valuable (this is simplified)
        // In a real implementation, you'd calculate based on the full map
        value += Math.max(0, 3 - this.neighbors.length); // Border regions are less valuable

        return value;
    }

    /**
     * Check if this region is on the border (has few neighbors)
     */
    isBorderRegion(averageNeighbors: number = 4): boolean {
        return this.neighbors.length < averageNeighbors;
    }

    /**
     * Check if this region is central (has many neighbors)
     */
    isCentralRegion(averageNeighbors: number = 4): boolean {
        return this.neighbors.length > averageNeighbors;
    }
}
