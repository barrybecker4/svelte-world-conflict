import { MapGenerator, type GeneratedRegion, type MapGenerationOptions } from './map/MapGenerator.js';
import { PLAYER_CONFIGS, UPGRADES } from '../constants/index.js';

export class GameDataManager {
    private static instance: GameDataManager | null = null;
    private mapGenerator: MapGenerator;

    public currentMap: GeneratedRegion[] = [];

    private constructor() {
        this.mapGenerator = new MapGenerator(800, 600);
    }

    public static getInstance(): GameDataManager {
        if (!GameDataManager.instance) {
            GameDataManager.instance = new GameDataManager();
        }
        return GameDataManager.instance;
    }

    public generateNewMap(options: MapGenerationOptions): GeneratedRegion[] {
        // Add playerCount if not provided (default to 4 for most games)
        const enhancedOptions = {
            ...options,
            playerCount: options.playerCount || 4
        };

        this.currentMap = this.mapGenerator.generateMap(enhancedOptions);
        return this.currentMap;
    }

    public getCurrentMap(): GeneratedRegion[] {
        return this.currentMap;
    }

    public getRegion(index: number): GeneratedRegion | null {
        return this.currentMap[index] || null;
    }

    public getNeighbors(regionIndex: number): GeneratedRegion[] {
        const region = this.getRegion(regionIndex);
        if (!region) return [];

        return region.neighbors
            .map(idx => this.getRegion(idx))
            .filter(r => r !== null) as GeneratedRegion[];
    }

    public areNeighbors(region1: number, region2: number): boolean {
        const r1 = this.getRegion(region1);
        return r1 ? r1.neighbors.includes(region2) : false;
    }

    public getPlayerConfig(index: number) {
        return PLAYER_CONFIGS[index] || null;
    }

    public getUpgrade(index: number) {
        return UPGRADES[index] || null;
    }

    public calculateRegionValue(regionIndex: number): number {
        const region = this.getRegion(regionIndex);
        if (!region) return 0;

        let value = 1; // Base value

        if (region.hasTemple) {
            value += 2;
        }

        value += region.neighbors.length * 0.5;

        return value;
    }

    public serialize(): object {
        return {
            currentMap: this.currentMap
        };
    }
}

// Export singleton instance
export const gameData = GameDataManager.getInstance();
