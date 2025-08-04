import type { Region } from '$lib/game/classes/Region';

export interface Player {
    index: number;
    name: string;
    color: string;
    isAI: boolean;
}

export interface Soldier {
    i: number; // Unique soldier ID
}

export interface Temple {
    regionIndex: number;
    level: number;
}

export interface FloatingText {
    x: number;
    y: number;
    text: string;
    color: string;
    duration: number;
}

export interface WorldConflictGameStateData {
    id: number;
    gameId: string;
    turnIndex: number;
    playerIndex: number;
    movesRemaining: number;

    // Region ownership (regionIndex -> playerIndex)
    owners: Record<number, number>;

    // Temples (regionIndex -> temple)
    temples: Record<number, Temple>;

    // Soldiers by region (regionIndex -> soldiers[])
    soldiersByRegion: Record<number, Soldier[]>;

    // Player cash (playerIndex -> amount)
    cash: Record<number, number>;

    // Game data
    players: Player[];
    regions: Region[];

    // UI state
    floatingText?: FloatingText[];
    conqueredRegions?: number[];

    // Game settings
    moveTimeLimit?: number;
    maxTurns?: number;
}

export interface GameSettings {
    mapSize: 'Small' | 'Medium' | 'Large';
    moveTimeLimit: number;
    maxTurns: number;
}

export interface PlayerSlot {
    index: number;
    type: 'Human' | 'AI' | 'Empty';
    name: string;
    color: string;
}
