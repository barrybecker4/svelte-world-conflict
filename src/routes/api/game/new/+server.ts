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
        const {
            mapSize = 'Medium',
            playerName,
            gameType = 'MULTIPLAYER',
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

        // Check if this should be a PENDING multiplayer lobby game
        let hasOpenSlots = false;
        let gameStatus: 'PENDING' | 'ACTIVE' = 'ACTIVE';
        let finalGameType: 'MULTIPLAYER' | 'AI' = 'AI';

        if (gameType === 'MULTIPLAYER') {
            if (playerSlots.length === 0) {
                // Simple multiplayer lobby game - just create the creator
                const creatorPlayer = createPlayer(playerName.trim(), 0, false);
                players.push(creatorPlayer);
                gameStatus = 'PENDING';
                finalGameType = 'MULTIPLAYER';
            } else {
                // Configured game from GameConfiguration component
                const activeSlots = playerSlots.filter((slot: any) => slot.type !== 'Off');

                if (activeSlots.length < 2) {
                    return json({ error: 'At least 2 players are required' }, { status: 400 });
                }

                // Check if ANY slots are "Open" - if so, game should be PENDING
                hasOpenSlots = activeSlots.some((slot: any) => slot.type === 'Open');

                if (hasOpenSlots) {
                    gameStatus = 'PENDING';
                    finalGameType = 'MULTIPLAYER';
                } else {
                    gameStatus = 'ACTIVE';
                    finalGameType = 'AI'; // All slots are filled with Set/AI players
                }

                for (let i = 0; i < activeSlots.length; i++) {
                    const slot = activeSlots[i];

                    if (slot.type === 'Set') {
                        // Human player
                        players.push(createPlayer(slot.name, i, false));
                    } else if (slot.type === 'Open') {
                        // Open slot - don't add a player yet, they'll join later
                        // We still need to track this slot exists for the total count
                        continue;
                    } else if (slot.type === 'AI') {
                        // Only add AI players if the game is starting immediately (ACTIVE)
                        if (gameStatus === 'ACTIVE') {
                            players.push(createPlayer(slot.name, i, true));
                        }
                    }
                }
            }
        } else {
            // Fallback to 2-player AI game
            const humanPlayer = createPlayer(playerName.trim(), 0, false);
            const aiPlayer = createPlayer('AI Player', 1, true);
            players.push(humanPlayer, aiPlayer);
            gameStatus = 'ACTIVE';
            finalGameType = 'AI';
        }

        // Generate map using the new GAS-style MapGenerator
        const mapGenerator = new MapGenerator(800, 600);
        const regions = mapGenerator.generateMap({
            size: mapSize as 'Small' | 'Medium' | 'Large',
            playerCount: Math.max(players.length, 2) // Ensure at least 2 for map generation
        });

        // Only initialize full game state for ACTIVE games
        let initialGameState;
        if (gameStatus === 'ACTIVE') {
            initialGameState = WorldConflictGameState.createInitialState(gameId, players, regions);
        } else {
            // For PENDING games, create minimal state
            initialGameState = {
                gameId,
                regions,
                players: [],
                currentPlayerIndex: 0,
                turnCount: 0,
                gamePhase: 'SETUP'
            };
        }

        // Store game in KV storage
        const storage = new WorldConflictKVStorage(platform);
        const gameStorage = new WorldConflictGameStorage(storage);

        const gameRecord: WorldConflictGameRecord = {
            gameId: gameId,
            status: gameStatus, // PENDING for games with open slots, ACTIVE for complete games
            players: players.map(p => ({
                id: p.id || generatePlayerId(),
                name: p.name,
                color: p.color,
                isAI: p.isAI,
                index: p.index
            })),
            worldConflictState: gameStatus === 'ACTIVE' ? initialGameState.toJSON() : initialGameState,
            createdAt: Date.now(),
            lastMoveAt: Date.now(),
            currentPlayerIndex: 0,
            gameType: finalGameType,
            // Store configuration for PENDING games so we know how to complete setup
            pendingConfiguration: gameStatus === 'PENDING' && playerSlots.length > 0 ? {
                playerSlots,
                mapSize,
                aiDifficulty
            } : undefined
        };

        await gameStorage.saveGame(gameRecord);

        console.log(`Created ${gameStatus} game ${gameId} with ${players.length} players (hasOpenSlots: ${hasOpenSlots})`);

        return json({
            gameId,
            player: players[0], // Return the first player (creator)
            playerIndex: 0,
            gameState: gameStatus === 'ACTIVE' ? initialGameState.toJSON() : initialGameState,
            message: `Game created successfully as ${gameStatus}`
        });

    } catch (error) {
        console.error('Error creating game:', error);
        return json({
            error: 'Failed to create game',
            details: getErrorMessage(error)
        }, { status: 500 });
    }
};