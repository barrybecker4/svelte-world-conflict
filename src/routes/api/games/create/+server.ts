import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.ts';
import { WorldConflictKVStorage } from '$lib/storage/world-conflict/index.ts';
import { WorldConflictGameState } from '$lib/game/WorldConflictGameState.ts';
import { WebSocketNotificationHelper } from '$lib/server/WebSocketNotificationHelper.ts';
import type { Player, Region } from '$lib/game/types.ts';

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

interface CreateGameRequest {
    // New format from GameConfiguration component
    players?: Array<{
        name: string;
        type: 'Set' | 'AI' | 'Open';
        index: number;
    }>;
    gameType?: 'MULTIPLAYER' | 'AI';

    // Legacy format (keep for backward compatibility)
    playerName?: string;
    maxPlayers?: number;
}

export const POST: RequestHandler = async ({ request, platform }) => {
    try {
        const requestData = await request.json() as CreateGameRequest;

        console.log('🎯 CREATE GAME REQUEST:', requestData);

        const kv = new WorldConflictKVStorage(platform!);
        const gameId = generateGameId();

        let players: Player[];
        let gameType: string;
        let humanPlayerName: string;
        let humanPlayerId: string;
        let humanPlayerIndex: number;

        // Handle new configuration format vs legacy format
        if (requestData.players) {
            // New format: from GameConfiguration component
            console.log('📋 Using new player configuration format');

            players = requestData.players.map(p => ({
                id: generatePlayerId(),
                name: p.name,
                index: p.index
            }));

            gameType = requestData.gameType || 'MULTIPLAYER';

            // Find the human player
            const humanPlayerConfig = requestData.players.find(p => p.type === 'Set');
            if (!humanPlayerConfig) {
                return json({ error: 'No human player configured' }, { status: 400 });
            }

            const humanPlayer = players.find(p => p.index === humanPlayerConfig.index);
            if (!humanPlayer) {
                return json({ error: 'Human player not found' }, { status: 400 });
            }

            humanPlayerName = humanPlayer.name;
            humanPlayerId = humanPlayer.id;
            humanPlayerIndex = humanPlayer.index;

        } else if (requestData.playerName) {
            // Legacy format: simple game creation
            console.log('📋 Using legacy player format');

            humanPlayerName = requestData.playerName.trim();
            humanPlayerId = generatePlayerId();
            humanPlayerIndex = 0;
            gameType = requestData.gameType || 'MULTIPLAYER';

            players = [{
                id: humanPlayerId,
                name: humanPlayerName,
                index: 0
            }];

            // Add AI players if requested
            if (gameType === 'AI') {
                players.push(
                    { id: generatePlayerId(), name: 'AI Warrior', index: 1 },
                    { id: generatePlayerId(), name: 'AI Strategist', index: 2 }
                );
            }
        } else {
            return json({ error: 'Player configuration required' }, { status: 400 });
        }

        console.log(`🎮 Creating game with ${players.length} players:`, players.map(p => p.name));

        // Create initial World Conflict game state
        const worldConflictState = WorldConflictGameState.createInitialState(
            gameId,
            players,
            DEFAULT_REGIONS
        );

        // Determine game status
        const hasOpenSlots = requestData.players?.some(p => p.type === 'Open') || false;
        const status = (gameType === 'AI' || !hasOpenSlots) ? 'ACTIVE' : 'WAITING';

        // Create game data for storage
        const gameData = {
            gameId,
            players: players.map(p => ({ id: p.id, name: p.name, index: p.index })),
            status,
            gameType,
            createdAt: Date.now(),
            lastActivity: Date.now(),
            worldConflictState: worldConflictState.toJSON()
        };

        // Save game to KV storage
        await kv.put(`wc_game:${gameId}`, gameData);

        console.log(`✅ NEW WORLD CONFLICT GAME CREATED: ${gameId}`);
        console.log(`   Creator: "${humanPlayerName}" (${humanPlayerId})`);
        console.log(`   Type: ${gameType}, Status: ${status}`);
        console.log(`   Players: ${players.map(p => p.name).join(', ')}`);

        // Send WebSocket notification if multiplayer
        if (gameType === 'MULTIPLAYER') {
            try {
                const envInfo = WebSocketNotificationHelper.getEnvironmentInfo(platform!);
                if (envInfo.webSocketNotificationsAvailable) {
                    await WebSocketNotificationHelper.sendGameUpdate(worldConflictState.toJSON(), platform!);
                }
            } catch (wsError) {
                console.warn('WebSocket notification failed:', wsError);
                // Don't fail the game creation if WebSocket fails
            }
        }

        return json({
            gameId,
            playerId: humanPlayerId,
            playerIndex: humanPlayerIndex,
            status,
            gameType,
            regions: DEFAULT_REGIONS
        });

    } catch (error) {
        console.error('❌ Failed to create game:', error);
        return json({ error: 'Failed to create game: ' + error.message }, { status: 500 });
    }
};

function generateGameId(): string {
    return 'wc_' + Math.random().toString(36).substr(2, 9);
}

function generatePlayerId(): string {
    return Math.random().toString(36).substr(2, 9);
}
