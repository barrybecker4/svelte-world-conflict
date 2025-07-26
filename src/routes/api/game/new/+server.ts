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
            aiDifficulty = 'Nice', 
            turns = 10, 
            timeLimit = 30,
            playerSlots = [] // NEW: Accept player slots configuration
        } = body;

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
        const players: Player[] = [];
        
        if (playerSlots && playerSlots.length > 0) {
            // Process the configured player slots
            const activeSlots = playerSlots.filter((slot: any) => slot.type !== 'Off');
            
            if (activeSlots.length < 2) {
                return json({ error: 'At least 2 players are required' }, { status: 400 });
            }

            for (let i = 0; i < activeSlots.length; i++) {
                const slot = activeSlots[i];
                
                if (slot.type === 'Set' || slot.type === 'Open') {
                    // Human player
                    players.push(createPlayer(slot.name, i, false));
                } else if (slot.type === 'AI') {
                    // AI player
                    players.push(createPlayer(slot.name, i, true));
                }
            }
            
            console.log(`Created ${players.length} players from configuration:`, 
                       players.map(p => `${p.name} (${p.isAI ? 'AI' : 'Human'})`));
        } else {
            // Fallback to 2-player game if no configuration provided
            console.log('No player slots provided, creating default 2-player game');
            const humanPlayer = createPlayer(playerName.trim(), 0, false);
            const aiPlayer = createPlayer('AI Player', 1, true);
            players.push(humanPlayer, aiPlayer);
        }

        // Generate map using the new GAS-style MapGenerator
        const mapGenerator = new MapGenerator(800, 600);
        const regions = mapGenerator.generateMap({
            size: mapSize as 'Small' | 'Medium' | 'Large',
            playerCount: players.length // NOW uses actual player count!
        });

        console.log(`Generated ${regions.length} regions for ${mapSize} map with ${players.length} players`);

        const initialGameState = WorldConflictGameState.createInitialState(gameId, players, regions);

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
