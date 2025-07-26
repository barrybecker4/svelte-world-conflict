import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
    WorldConflictKVStorage,
    WorldConflictGameStorage,
    type WorldConflictGameRecord,
} from '$lib/storage/world-conflict/index';
import { WorldConflictGameState, type Player, type Region } from '$lib/game/WorldConflictGameState';
import { generateGameId, generatePlayerId, createPlayer, getErrorMessage } from "$lib/server/api-utils";
import { MapGenerator } from '$lib/game/data/map/MapGenerator.ts';

export const POST: RequestHandler = async ({ request, platform }) => {
    try {
        const body = await request.json();
        const { mapSize = 'Medium', playerName, aiDifficulty = 'Nice', turns = 10, timeLimit = 30 } = body;

        // Validate input
        if (!playerName?.trim()) {
            return json({ error: 'Player name is required' }, { status: 400 });
        }

        if (!['Small', 'Medium', 'Large'].includes(mapSize)) {
            return json({ error: 'Invalid map size' }, { status: 400 });
        }

        // Generate game ID and player ID
        const gameId = generateGameId();
        const playerId = generatePlayerId();

        // Create human player
        const humanPlayer = createPlayer(playerName.trim(), 0, false);

        // For now, create a simple 2-player game (human + 1 AI)
        const aiPlayer = createPlayer('AI Player', 1, true);
        const players: Player[] = [humanPlayer, aiPlayer];

        // Generate map using the new GAS-style MapGenerator
        const mapGenerator = new MapGenerator(800, 600);
        const regions = mapGenerator.generateMap({
            size: mapSize as 'Small' | 'Medium' | 'Large',
            playerCount: players.length
        });

        console.log(`Generated ${regions.length} regions for ${mapSize} map`);

        // Create initial game state
        const initialGameState = new WorldConflictGameState({
            gameId,
            players,
            regions,
            currentPlayerIndex: 0,
            turn: 1,
            maxTurns: turns,
            timeLimit,
            status: 'active',
            owners: {}, // No regions owned initially
            armies: {}, // No armies initially
            temples: {},
            cash: players.reduce((acc, player) => {
                acc[player.index] = 100; // Starting cash
                return acc;
            }, {} as Record<number, number>),
            movesRemaining: 3,
            lastActivity: Date.now()
        });

        // Assign starting regions to players
        const startingRegionsPerPlayer = Math.floor(regions.length / players.length);
        let regionIndex = 0;

        for (let playerIndex = 0; playerIndex < players.length; playerIndex++) {
            for (let i = 0; i < startingRegionsPerPlayer && regionIndex < regions.length; i++) {
                initialGameState.state.owners[regionIndex] = playerIndex;
                initialGameState.state.armies[regionIndex] = [
                    { playerId: players[playerIndex].id, strength: 3 }
                ];
                regionIndex++;
            }
        }

        // Store game in KV storage
        const storage = new WorldConflictKVStorage(platform);
        const gameStorage = new WorldConflictGameStorage(storage);

        const gameRecord: WorldConflictGameRecord = {
            gameId: gameId,
            status: 'ACTIVE',
            players: players.map(p => ({
                id: p.id || generatePlayerId(),
                name: p.name,
                color: p.color,
                isAI: p.isAI,
                index: p.index
            })),
            worldConflictState: initialGameState.toJSON(),
            createdAt: Date.now(),
            lastMoveAt: Date.now(),
            currentPlayerIndex: 0,
            gameType: 'AI'
        };

        await gameStorage.saveGame(gameRecord);

        console.log(`Created game ${gameId} with ${players.length} players and ${regions.length} regions`);

        return json({
            gameId,
            playerId,
            playerIndex: 0,
            gameState: initialGameState.toJSON(),
            message: 'Game created successfully'
        });

    } catch (error) {
        console.error('Error creating game:', error);
        return json({
            error: 'Failed to create game',
            details: getErrorMessage(error)
        }, { status: 500 });
    }
};
