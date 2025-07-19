import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.ts';
import {
    WorldConflictKVStorage,
    WorldConflictGameStorage,
    type WorldConflictGameRecord
} from '$lib/storage/world-conflict/index.ts';
import { WorldConflictGameState, type Player, type Region } from '$lib/game/WorldConflictGameState.ts';
import { MapGenerator, type MapGenerationOptions } from '$lib/game/data/MapGenerator.ts';
import { WebSocketNotificationHelper } from '$lib/server/WebSocketNotificationHelper.ts';
import { createPlayer, generateGameId, generatePlayerId, getErrorMessage } from '$lib/server/api-utils.ts';

interface NewGameRequest {
    playerName: string;
    gameType?: 'MULTIPLAYER' | 'AI';
    mapSize?: 'Small' | 'Medium' | 'Large';
}

export const POST: RequestHandler = async ({ request, platform }) => {
    try {
        const {
            playerName,
            gameType = 'MULTIPLAYER',
            mapSize = 'Medium'
        } = await request.json() as NewGameRequest;

        console.log(`🎯 NEW GAME REQUEST: Player "${playerName}" wants ${gameType} game (${mapSize} map)`);

        if (!playerName) {
            return json({ error: 'Player name required' }, { status: 400 });
        }

        const kv = new WorldConflictKVStorage(platform!);
        const gameStorage = new WorldConflictGameStorage(kv);

        // For multiplayer games, check for existing pending games that aren't expired
        if (gameType === 'MULTIPLAYER') {
            const pendingGames = await gameStorage.getGamesByStatus('PENDING');

            // Filter out expired games (older than 20 minutes)
            const TWENTY_MINUTES = 20 * 60 * 1000;
            const now = Date.now();
            const validGames = pendingGames.filter(game =>
                (now - game.createdAt) < TWENTY_MINUTES
            );

            for (const game of validGames) {
                if (game.players.length < 4) {
                    // Check if player name is already taken
                    if (!game.players.some(p => p.name === playerName.trim())) {
                        const newPlayer = {
                            ...createPlayer(playerName, game.players.length),
                            id: generatePlayerId()
                        };
                        const updatedPlayers = [...game.players, newPlayer];

                        const updatedGame = {
                            ...game,
                            players: updatedPlayers,
                            lastMoveAt: Date.now()
                        };

                        // Start game when we have enough players
                        if (updatedPlayers.length >= 2) {
                            updatedGame.status = 'ACTIVE';

                            // Initialize game state with dynamic map if not already done
                            if (!game.worldConflictState?.owners || Object.keys(game.worldConflictState.owners).length === 0) {
                                const gameState = WorldConflictGameState.createInitialState(
                                    game.gameId,
                                    updatedPlayers,
                                    game.worldConflictState.regions
                                );
                                updatedGame.worldConflictState = gameState.toJSON();
                            }
                        }

                        await gameStorage.saveGame(updatedGame);
                        await WebSocketNotificationHelper.sendGameUpdate(updatedGame, platform!);

                        return json({
                            success: true,
                            gameId: game.gameId,
                            players: updatedPlayers.map(p => ({
                                name: p.name,
                                index: p.index,
                                color: p.color,
                                isAI: p.isAI
                            })),
                            playerIndex: updatedPlayers.length - 1,
                            status: updatedGame.status,
                            message: updatedGame.status === 'ACTIVE' ?
                                'Game started!' : 'Waiting for more players...'
                        });
                    }
                }
            }
        }

        // Create new game with dynamic map generation
        const gameId = generateGameId();

        // Generate dynamic map using MapGenerator
        const mapGenerator = new MapGenerator(Date.now()); // Use timestamp as seed for variety
        const mapOptions: MapGenerationOptions = {
            size: mapSize,
            templeProbability: 0.4 // 40% of regions have temples
        };

        const generatedRegions = mapGenerator.generateMap(mapOptions);

        // Convert to Region format (remove names, add required properties)
        const regions: Region[] = generatedRegions.map(r => ({
            index: r.index,
            name: `Region ${r.index}`, // Simple numeric names
            neighbors: r.neighbors,
            x: r.x,
            y: r.y,
            hasTemple: r.hasTemple
        }));

        console.log(`🗺️  Generated ${regions.length} regions with ${regions.filter(r => r.hasTemple).length} temples`);

        // Create players
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

        // ALWAYS create proper initial game state (this was the bug!)
        let worldConflictState;
        if (gameType === 'AI' || players.length >= 2) {
            // For AI games or when we have enough players, fully initialize
            const wcGameState = WorldConflictGameState.createInitialState(
                gameId,
                players,
                regions
            );
            worldConflictState = wcGameState.toJSON();
            console.log(`🏰 Initialized game with ${Object.keys(worldConflictState.owners).length} owned regions`);
        } else {
            // For pending multiplayer games, create minimal state but with proper structure
            worldConflictState = {
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
                regions: regions
            };
        }

        const newGame: WorldConflictGameRecord = {
            gameId,
            players,
            status: status as 'PENDING' | 'ACTIVE' | 'COMPLETED',
            createdAt: Date.now(),
            lastMoveAt: Date.now(),
            currentPlayerIndex: 0,
            gameType,
            worldConflictState
        };

        await gameStorage.saveGame(newGame);

        console.log(`✅ Created new ${gameType} game ${gameId} for ${playerName}`);
        console.log(`   Map: ${mapSize} (${regions.length} regions)`);
        console.log(`   Status: ${status}`);

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
