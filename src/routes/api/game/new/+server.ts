import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.ts';
import {
    WorldConflictKVStorage,
    WorldConflictGameStorage,
    type WorldConflictGameRecord
} from '$lib/storage/world-conflict/index.ts';
import { WorldConflictGameState, type Player, type Region } from '$lib/game/WorldConflictGameState.ts';
import { WebSocketNotificationHelper } from '$lib/server/WebSocketNotificationHelper.ts';
import { createPlayer, generateGameId, generatePlayerId, getErrorMessage } from '$lib/server/api-utils.ts';

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

export const POST: RequestHandler = async ({ request, platform }) => {
    try {
        const { playerName, gameType = 'MULTIPLAYER' } = await request.json() as NewGameRequest;

        console.log(`🎯 NEW GAME REQUEST: Player "${playerName}" wants to play`);

        if (!playerName) {
            return json({ error: 'Player name required' }, { status: 400 });
        }

        const kv = new WorldConflictKVStorage(platform!);
        const gameStorage = new WorldConflictGameStorage(kv);

        try {
            // Check for existing open games that this player can join
            const openGames = await gameStorage.getOpenGames();
            console.log(`📋 Found ${openGames.length} open games`);

            for (const game of openGames) {
                // Check if player can join this game
                if (game.status === 'PENDING' && game.players.length < 4) {
                    // Make sure player isn't already in the game
                    const existingPlayer = game.players.find(p => p.name === playerName);
                    if (!existingPlayer) {
                        console.log(`🎮 Adding ${playerName} to existing game ${game.gameId}`);

                        // Add player to existing game - use createPlayer to ensure proper typing
                        const newPlayer = createPlayer(playerName, game.players.length, false);
                        // Add id property for compatibility
                        const newPlayerWithId = { ...newPlayer, id: generatePlayerId() };

                        const updatedPlayers = [...game.players, newPlayerWithId];

                        const updatedGame: WorldConflictGameRecord = {
                            ...game,
                            players: updatedPlayers,
                            status: updatedPlayers.length >= 2 ? 'ACTIVE' : 'PENDING',
                            lastMoveAt: Date.now()
                        };

                        await gameStorage.saveGame(updatedGame);

                        // Send WebSocket notification using the proper WorldConflictGameRecord
                        await WebSocketNotificationHelper.sendGameUpdate(updatedGame, platform!);

                        return json({
                            success: true,
                            gameId: game.gameId,
                            playerIndex: newPlayer.index,
                            players: updatedPlayers.map(p => ({
                                name: p.name,
                                index: p.index,
                                color: p.color,
                                isAI: p.isAI
                            })),
                            status: updatedGame.status,
                            message: updatedGame.status === 'ACTIVE' ? 'Game started!' : 'Waiting for more players...'
                        });
                    }
                }
            }

            // Create new game
            const gameId = generateGameId();

            // Create players using the createPlayer utility function to ensure proper typing
            const players: Player[] = [
                { ...createPlayer(playerName, 0, false), id: generatePlayerId() }
            ];

            // Add AI players for AI games
            if (gameType === 'AI') {
                players.push(
                    { ...createPlayer('AI Warrior', 1, true), id: generatePlayerId() },
                    { ...createPlayer('AI Strategist', 2, true), id: generatePlayerId() }
                );
            }

            const status = gameType === 'AI' ? 'ACTIVE' : 'PENDING';

            // Create initial game state for AI games
            let worldConflictState = null;
            if (gameType === 'AI') {
                const wcGameState = WorldConflictGameState.createInitialState(
                    gameId,
                    players,
                    DEFAULT_REGIONS
                );
                worldConflictState = wcGameState.toJSON();
            }

            // Create properly typed WorldConflictGameRecord
            const newGame: WorldConflictGameRecord = {
                gameId,
                players,
                status: status as 'PENDING' | 'ACTIVE' | 'COMPLETED',
                createdAt: Date.now(),
                lastMoveAt: Date.now(),
                currentPlayerIndex: 0, // Add missing required property
                worldConflictState: worldConflictState || {
                    turnIndex: 1,
                    playerIndex: 0,
                    movesRemaining: 3,
                    owners: {},
                    temples: {},
                    soldiersByRegion: {},
                    cash: {},
                    id: 1,
                    gameId,
                    players: players,
                    regions: DEFAULT_REGIONS
                }
            };

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

    } catch (error) {
        console.error('❌ Error in /api/game/new:', error);
        return json({ error: 'Internal server error' }, { status: 500 });
    }
};
