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

// Updated game creation in src/routes/api/game/new/+server.ts
export const POST: RequestHandler = async ({ request, platform }) => {
    try {
        const body = await request.json();
        const {
            mapSize = 'Medium',
            playerName,
            gameType = 'MULTIPLAYER', // NEW: Add gameType parameter
            maxPlayers = 4,
            aiDifficulty = 'Nice',
            turns = 10,
            timeLimit = 30,
            playerSlots = [] // For configured games (from GameConfiguration)
        } = body;

        // Validate input
        if (!playerName?.trim()) {
            return json({ error: 'Player name is required' }, { status: 400 });
        }

        // Generate game ID
        const gameId = generateGameId();
        const players: Player[] = [];

        if (gameType === 'MULTIPLAYER' && playerSlots.length === 0) {
            // Simple multiplayer lobby game - just create the creator
            const creatorPlayer = createPlayer(playerName.trim(), 0, false);
            players.push(creatorPlayer);
        } else if (playerSlots && playerSlots.length > 0) {
            // Configured game from GameConfiguration component
            const activeSlots = playerSlots.filter((slot: any) => slot.type !== 'Off');

            if (activeSlots.length < 2) {
                return json({ error: 'At least 2 players are required' }, { status: 400 });
            }

            for (let i = 0; i < activeSlots.length; i++) {
                const slot = activeSlots[i];

                if (slot.type === 'Set' || slot.type === 'Open') {
                    players.push(createPlayer(slot.name, i, false));
                } else if (slot.type === 'AI') {
                    players.push(createPlayer(slot.name, i, true));
                }
            }
        } else {
            // Fallback to 2-player AI game
            const humanPlayer = createPlayer(playerName.trim(), 0, false);
            const aiPlayer = createPlayer('AI Player', 1, true);
            players.push(humanPlayer, aiPlayer);
        }

        // Generate map using the new GAS-style MapGenerator
        const mapGenerator = new MapGenerator(800, 600);
        const regions = mapGenerator.generateMap({
            size: mapSize as 'Small' | 'Medium' | 'Large',
            playerCount: Math.max(players.length, 2) // Ensure at least 2 for map generation
        });

        const initialGameState = WorldConflictGameState.createInitialState(gameId, players, regions);

        // Store game in KV storage
        const storage = new WorldConflictKVStorage(platform);
        const gameStorage = new WorldConflictGameStorage(storage);

        // Determine game status and type
        const isMultiplayerLobby = gameType === 'MULTIPLAYER' && playerSlots.length === 0;
        const gameStatus = isMultiplayerLobby ? 'PENDING' : 'ACTIVE';
        const finalGameType = isMultiplayerLobby ? 'MULTIPLAYER' : 'AI';

        const gameRecord: WorldConflictGameRecord = {
            gameId: gameId,
            status: gameStatus, // PENDING for lobby games, ACTIVE for configured games
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
            gameType: finalGameType
        };

        await gameStorage.saveGame(gameRecord);

        console.log(`Created ${gameStatus} game ${gameId} with ${players.length} players`);

        return json({
            gameId,
            player: players[0], // Return the first player (creator)
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