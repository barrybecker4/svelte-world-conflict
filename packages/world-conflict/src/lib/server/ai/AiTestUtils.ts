/**
 * Test Utilities for AI Module Testing
 * Provides mock factories and helpers for creating test data
 */

import { vi } from 'vitest';
import { GameState, type Player, type GameStateData, type Temple } from '$lib/game/state/GameState';
import { Region } from '$lib/game/entities/Region';
import type { GameStorage } from '$lib/server/storage/GameStorage';
import { GAME_CONSTANTS } from '$lib/game/constants/gameConstants';
import { AiDifficulty } from '$lib/game/entities/aiPersonalities';

/**
 * Create a mock player with configurable properties
 */
export function createMockPlayer(options: {
    slotIndex: number;
    name?: string;
    isAI?: boolean;
    personality?: string;
    color?: string;
}): Player {
    return {
        slotIndex: options.slotIndex,
        name: options.name || `Player ${options.slotIndex}`,
        isAI: options.isAI ?? false,
        personality: options.personality,
        color: options.color || `#${Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0')}`
    };
}

/**
 * Create a mock region with configurable properties
 */
export function createMockRegion(options: {
    index: number;
    neighbors?: number[];
    x?: number;
    y?: number;
}): Region {
    return new Region({
        index: options.index,
        name: `Region ${options.index}`,
        neighbors: options.neighbors || [],
        x: options.x ?? 100 + options.index * 50,
        y: options.y ?? 100 + options.index * 50,
        hasTemple: false,
        points: [
            { x: options.x ?? 100, y: options.y ?? 100 },
            { x: (options.x ?? 100) + 30, y: options.y ?? 100 },
            { x: (options.x ?? 100) + 30, y: (options.y ?? 100) + 30 },
            { x: options.x ?? 100, y: (options.y ?? 100) + 30 }
        ]
    });
}

/**
 * Create a mock temple
 */
export function createMockTemple(options: {
    regionIndex: number;
    upgradeIndex?: number;
    level?: number;
}): Temple {
    return {
        regionIndex: options.regionIndex,
        upgradeIndex: options.upgradeIndex,
        level: options.level ?? 1
    };
}

/**
 * Create a complete mock GameStateData with configurable properties
 */
export function createMockGameStateData(options: {
    players?: Player[];
    regions?: Region[];
    turnNumber?: number;
    currentPlayerSlot?: number;
    movesRemaining?: number;
    maxTurns?: number;
    aiDifficulty?: string;
    ownersByRegion?: Record<number, number>;
    soldiersByRegion?: Record<number, any[]>;
    templesByRegion?: Record<number, Temple>;
    faithByPlayer?: Record<number, number>;
    eliminatedPlayers?: number[];
    rngSeed?: string;
}): GameStateData {
    const players = options.players || [
        createMockPlayer({ slotIndex: 0, name: 'Player 1', isAI: false }),
        createMockPlayer({ slotIndex: 1, name: 'AI Player', isAI: true, personality: 'Defender' })
    ];

    const regions = options.regions || [
        createMockRegion({ index: 0, neighbors: [1] }),
        createMockRegion({ index: 1, neighbors: [0, 2] }),
        createMockRegion({ index: 2, neighbors: [1] })
    ];

    return {
        id: 1,
        gameId: 'test-game-' + Date.now(),
        turnNumber: options.turnNumber ?? 1,
        currentPlayerSlot: options.currentPlayerSlot ?? 0,
        players,
        regions,
        movesRemaining: options.movesRemaining ?? 3,
        maxTurns: options.maxTurns ?? 100,
        moveTimeLimit: GAME_CONSTANTS.STANDARD_HUMAN_TIME_LIMIT,
        aiDifficulty: options.aiDifficulty || AiDifficulty.RUDE,
        ownersByRegion: options.ownersByRegion || {},
        soldiersByRegion: options.soldiersByRegion || {},
        templesByRegion: options.templesByRegion || {},
        faithByPlayer: options.faithByPlayer || { 0: 100, 1: 100 },
        conqueredRegions: [],
        eliminatedPlayers: options.eliminatedPlayers || [],
        rngSeed: options.rngSeed || 'test-seed-12345' // Fixed seed for deterministic tests
    };
}

/**
 * Create a mock GameState instance
 */
export function createMockGameState(options: Parameters<typeof createMockGameStateData>[0] = {}): GameState {
    const data = createMockGameStateData(options);
    return new GameState(data);
}

/**
 * Create a simple 2-player game state with basic setup
 */
export function createSimpleTwoPlayerGame(): GameState {
    const player1 = createMockPlayer({ slotIndex: 0, name: 'Human', isAI: false });
    const player2 = createMockPlayer({ slotIndex: 1, name: 'AI', isAI: true, personality: 'Defender' });

    const regions = [
        createMockRegion({ index: 0, neighbors: [1, 2] }),
        createMockRegion({ index: 1, neighbors: [0, 2] }),
        createMockRegion({ index: 2, neighbors: [0, 1, 3] }),
        createMockRegion({ index: 3, neighbors: [2] })
    ];

    const ownersByRegion = {
        0: 0, // Player 1 owns region 0
        1: 0, // Player 1 owns region 1
        2: 1, // Player 2 owns region 2
        3: 1  // Player 2 owns region 3
    };

    const soldiersByRegion = {
        0: [{ i: 1 }, { i: 2 }],        // 2 soldiers
        1: [{ i: 3 }],                   // 1 soldier
        2: [{ i: 4 }, { i: 5 }, { i: 6 }], // 3 soldiers
        3: [{ i: 7 }]                    // 1 soldier
    };

    const templesByRegion = {
        0: createMockTemple({ regionIndex: 0, upgradeIndex: undefined, level: 0 }),
        2: createMockTemple({ regionIndex: 2, upgradeIndex: undefined, level: 0 })
    };

    return createMockGameState({
        players: [player1, player2],
        regions,
        ownersByRegion,
        soldiersByRegion,
        templesByRegion,
        faithByPlayer: { 0: 50, 1: 50 },
        currentPlayerSlot: 0,
        movesRemaining: 3
    });
}

/**
 * Create a mock GameStorage instance for testing
 */
export function createMockGameStorage(): {
    storage: GameStorage;
    saveGameMock: any;
    getGameMock: any;
    saveCalls: any[];
} {
    const saveCalls: any[] = [];
    const mockGame = {
        gameId: 'test-game',
        worldConflictState: createMockGameStateData({}),
        currentPlayerSlot: 0,
        lastMoveAt: Date.now(),
        players: []
    };

    const saveGameMock = vi.fn(async (game: any) => {
        saveCalls.push({ ...game });
        return game;
    });

    const getGameMock = vi.fn(async (gameId: string) => {
        return { ...mockGame, gameId };
    });

    const storage = {
        saveGame: saveGameMock,
        getGame: getGameMock
    } as any as GameStorage;

    return {
        storage,
        saveGameMock,
        getGameMock,
        saveCalls
    };
}

/**
 * Set up a game state with specific soldier counts for testing threat/opportunity
 */
export function createGameStateWithSoldierCounts(
    player1Regions: Array<{ index: number; soldiers: number }>,
    player2Regions: Array<{ index: number; soldiers: number }>,
    neighbors: Record<number, number[]>
): GameState {
    const player1 = createMockPlayer({ slotIndex: 0, name: 'Player 1' });
    const player2 = createMockPlayer({ slotIndex: 1, name: 'Player 2', isAI: true, personality: 'Defender' });

    const allRegionIndices = [
        ...player1Regions.map(r => r.index),
        ...player2Regions.map(r => r.index)
    ];

    const regions = allRegionIndices.map(index =>
        createMockRegion({ index, neighbors: neighbors[index] || [] })
    );

    const ownersByRegion: Record<number, number> = {};
    const soldiersByRegion: Record<number, any[]> = {};

    player1Regions.forEach(({ index, soldiers }) => {
        ownersByRegion[index] = 0;
        soldiersByRegion[index] = Array.from({ length: soldiers }, (_, i) => ({ i: index * 100 + i }));
    });

    player2Regions.forEach(({ index, soldiers }) => {
        ownersByRegion[index] = 1;
        soldiersByRegion[index] = Array.from({ length: soldiers }, (_, i) => ({ i: index * 100 + i + 50 }));
    });

    return createMockGameState({
        players: [player1, player2],
        regions,
        ownersByRegion,
        soldiersByRegion,
        faithByPlayer: { 0: 100, 1: 100 }
    });
}

/**
 * Helper to verify that a command is of a specific type
 */
export function isCommandType(command: any, typeName: string): boolean {
    return command.constructor.name === typeName;
}

