import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.ts';
import {
    WorldConflictKVStorage,
    WorldConflictGameStorage, type WorldConflictGameRecord,
} from '$lib/storage/world-conflict/index.ts';
import { WorldConflictGameState } from '$lib/game/WorldConflictGameState.ts';
import { WebSocketNotificationHelper } from '$lib/server/WebSocketNotificationHelper.ts';
import type { Player, Region } from '$lib/game/WorldConflictGameState.ts';
import { generateGameId } from "$lib/server/api-utils.ts";

// Default World Conflict map data
const DEFAULT_REGIONS: Region[] = [
    { index: 0, name: "Northern Wastes", neighbors: [1, 3], x: 100, y: 50, hasTemple: true },
    { index: 1, name: "Eastern Plains", neighbors: [0, 2, 4], x: 200, y: 80, hasTemple: false },
    { index: 2, name: "Southern Desert", neighbors: [1, 5], x: 180, y: 200, hasTemple: true },
    { index: 3, name: "Western Mountains", neighbors: [0, 4, 6], x: 50, y: 120, hasTemple: false },
    { index: 4, name: "Central Valley", neighbors: [1, 3, 5, 7], x: 150, y: 120, hasTemple: true },
    { index: 5, name: "Eastern Coast", neighbors: [2, 4, 8], x: 250, y: 150, hasTemple: false },
    { index: 6, name: "Ancient Ruins", neighbors: [3, 7], x: 80, y: 180, hasTemple: true },
    { index: 7, name: "Sacred Grove", neighbors: [4, 6, 8], x: 150, y: 180, hasTemple: true },
    { index: 8, name: "Dragon's Lair", neighbors: [5, 7], x: 220, y: 220, hasTemple: true }
];

interface NewGameRequest {
    playerName: string;
    gameType?: 'MULTIPLAYER' | 'AI';
}

/**
 * Helper function to safely get error message
 */
function getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
        return error.message;
    }
    return String(error);
}

/**
 * Create a proper World Conflict Player object
 */
function createPlayer(name: string, index: number, isAI: boolean = false): Player {
    const colors = [
        '#dc2626', // Red
        '#2563eb', // Blue
        '#16a34a', // Green
        '#ca8a04'  // Yellow
    ];

    return {
        index,
        name: name.trim(),
        color: colors[index % colors.length],
        isAI
    };
}

export const POST: RequestHandler = async ({ request, platform }) => {
    try {
        const { playerName, gameType = 'MULTIPLAYER' } = await request.json() as NewGameRequest;

        console.log(`🎯 NEW GAME REQUEST: Player "${playerName}" wants to play`);

        if (!playerName) {
            return json({ error: 'Player name required' }, { status: 400 });
        }

        const kv = new WorldConflictKVStorage(platform!);
        const gameStorage = new WorldConflictGameStorage(kv);

        // Try to find an existing waiting game first (for multiplayer)
        if (gameType === 'MULTIPLAYER') {
            const waitingGames = await gameStorage.getGamesByStatus('PENDING');

            for (const game of waitingGames) {
                if (game.players.length < 4 && !game.players.some((p: Player) => p.name === playerName)) {
                    // Add player to existing game
                    const newPlayer = createPlayer(playerName, game.players.length);
                    const updatedPlayers = [...game.players, newPlayer];

                    // Start game if we have enough players
                    const shouldStart = updatedPlayers.length >= 2;
                    const status = shouldStart ? 'ACTIVE' : 'PENDING';

                    let gameState = null;
                    if (shouldStart) {
                        const wcGameState = WorldConflictGameState.createInitialState(
                            game.gameId,
                            updatedPlayers,
                            DEFAULT_REGIONS
                        );
                        gameState = wcGameState.toJSON();
                    }

                    const updatedGame = {
                        ...game,
                        players: updatedPlayers,
                        status,
                        lastMoveAt: Date.now(),
                        worldConflictState: gameState || game.worldConflictState
                    } as WorldConflictGameRecord;

                    await gameStorage.saveGame(updatedGame);

                    if (platform) {
                        await WebSocketNotificationHelper.sendGameUpdate(updatedGame, platform);
                    }

                    console.log(`✅ Player ${playerName} joined existing game ${game.gameId}`);

                    return json({
                        success: true,
                        gameId: game.gameId,
                        players: updatedGame.players,
                        playerIndex: newPlayer.index,
                        status: updatedGame.status,
                        message: shouldStart ? 'Game started!' : 'Waiting for more players...'
                    });
                }
            }
        }

        // Create new game
        const gameId = generateGameId();
        const players: Player[] = [
            createPlayer(playerName, 0, false)
        ];

        // Add AI players for AI games
        if (gameType === 'AI') {
            players.push(
                createPlayer('AI Warrior', 1, true),
                createPlayer('AI Strategist', 2, true)
            );
        }

        const status = gameType === 'AI' ? 'ACTIVE' : 'PENDING';

        // Create initial game state for AI games
        let initialGameState = null;
        if (gameType === 'AI') {
            const wcGameState = WorldConflictGameState.createInitialState(
                gameId,
                players,
                DEFAULT_REGIONS
            );
            initialGameState = wcGameState.toJSON();
        }

        const newGame = {
            gameId,
            players,
            status: gameType === 'AI' ? 'ACTIVE' : 'PENDING' as const, // Ensure proper typing
            createdAt: Date.now(),
            lastMoveAt: Date.now(),
            currentPlayerIndex: 0,
            worldConflictState: initialGameState || {
                regions: DEFAULT_REGIONS,
                players: players
            }
        } as WorldConflictGameRecord;
        await gameStorage.saveGame(newGame);

        console.log(`✅ Created new ${gameType} game ${gameId} for ${playerName}`);

        return json({
            success: true,
            gameId,
            players: players.map(p => ({
                name: p.name,
                index: p.index,
                color: p.color,
                isAI: p.isAI
            })),
            playerIndex: 0,
            status,
            message: gameType === 'AI' ? 'Game started!' : 'Waiting for other players...'
        });

    } catch (error) {
        console.error('❌ Error creating new game:', error);
        return json({
            error: 'Failed to create game: ' + getErrorMessage(error)
        }, { status: 500 });
    }
};
