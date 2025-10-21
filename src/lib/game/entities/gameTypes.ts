import type { PlayerSlot } from './PlayerSlot';
import type { Region } from '$lib/game/entities/Region';
import type { Regions } from '$lib/game/entities/Regions';

// Re-export types that are used throughout the application
export type { Region, Regions, PlayerSlot };

export interface GameSettings {
    mapSize: 'Small' | 'Medium' | 'Large';
    moveTimeLimit: number;
    maxTurns: number;
}

export interface Player {
    slotIndex: number;
    name: string;
    color: string;
    isAI: boolean;
    personality?: string; // AI personality type if AI player
}

export interface Soldier {
    i: number; // Unique soldier ID
    attackedRegion?: number; // Target region index during attack (for halfway positioning)
    movingToRegion?: number; // Target region index during peaceful move (for full distance animation)
}

export interface Temple {
    regionIndex: number;
    level: number;
    upgradeIndex?: number;
}

export interface FloatingText {
    x: number;
    y: number;
    text: string;
    color: string;
    duration: number;
}

export interface PendingMove {
    fromRegion: number;
    toRegion: number;
    soldierCount: number;
}

export interface GameStateData {
    id: number;
    gameId: string;
    turnNumber: number;
    currentPlayerSlot: number;
    movesRemaining: number;

    ownersByRegion: Record<number, number>; // regionIndex -> playerSlotIndex
    templesByRegion: Record<number, Temple>; // regionIndex -> Temple
    soldiersByRegion: Record<number, Soldier[]>; // regionIndex -> soldiers[]
    faithByPlayer: Record<number, number>; // playerSlotIndex -> amount

    players: Player[];
    regions: Region[]; // Keep as array for simplicity

    floatingText?: FloatingText[];
    conqueredRegions?: number[];
    battlesInProgress?: number[];
    endResult?: Player | 'DRAWN_GAME' | null;
    pendingMoves?: PendingMove[];
    numBoughtSoldiers?: number; // Track soldiers bought this turn for pricing
    eliminatedPlayers?: number[]; // Track player slot indices that were eliminated this turn

    moveTimeLimit?: number;
    maxTurns?: number;
}
