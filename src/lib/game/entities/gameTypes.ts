import type { PlayerSlot } from './PlayerSlot';
import type { Region } from '$lib/game/entities/Region';
import type { Regions } from '$lib/game/entities/Regions';

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

export interface GameStateData {
    id: number;
    gameId: string;
    turnNumber: number;F
    currentPlayerSlot: number;
    movesRemaining: number;

    ownersByRegion: Record<number, number>; // regionIndex -> playerSlotIndex
    templesByRegion: Record<number, Temple>; // regionIndex -> Temple
    soldiersByRegion: Record<number, Soldier[]>; // regionIndex -> soldiers[]
    faithByPlayer: Record<number, number>; // playerSlotIndex -> amount

    players: Player[];
    regions: Regions;

    floatingText?: FloatingText[];
    conqueredRegions?: number[];

    moveTimeLimit?: number;
    maxTurns?: number;
}
