import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.ts';
import { KVStorage } from '$lib/storage/kv.ts';
import { GameStorage } from '$lib/storage/games.ts';
import { WorldConflictGameState } from '$lib/game/WorldConflictGameState.ts';
import { WebSocketNotificationHelper } from '$lib/server/WebSocketNotificationHelper.js';
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

interface NewGameRequest {
    playerName: string;
    gameType?: 'MULTIPLAYER' | 'AI';
}

export const POST: RequestHandler = async ({ request, platform }) => {
    const { playerName, gameType = 'MULTIPLAYER' } = await request.json() as NewGameRequest;

    console.log(`🎯 NEW WORLD CONFLICT GAME: Player "${playerName}" wants to play`);

    if (!playerName) {
        return json({ error: 'Player name required' }, { status: 400 });
    }

    const kv = new KVStorage(platform!);
    const gameStorage = new GameStorage(kv);

    const envInfo = WebSocketNotificationHelper.getEnvironmentInfo(platform!);

    // Try to find an existing game to join
    const availableGame = await findAvailableGame(gameStorage, playerName);
    if (availableGame) {
        return json({
            gameId: availableGame.gameId,
            players: availableGame.players,
            playerId: availableGame.newPlayerId,
            playerIndex: availableGame.playerIndex,
            status: 'ACTIVE',
            regions: DEFAULT_REGIONS,
            webSocketNotificationsEnabled: envInfo.webSocketNotificationsAvailable
        });
    }

    // Create new game
    const newGame = await createNewWorldConflictGame(playerName, gameType, gameStorage);

    return json({
        gameId: newGame.gameId,
        players: newGame.players,
        playerId: newGame.players[0].id,
        playerIndex: 0,
        status: gameType === 'AI' ? 'ACTIVE' : 'WAITING',
        regions: DEFAULT_REGIONS,
        webSocketNotificationsEnabled: envInfo.webSocketNotificationsAvailable
    });
};

async function findAvailableGame(gameStorage: GameStorage, playerName: string) {
    // Look for games waiting for players
    const waitingGames = await gameStorage.getGamesByStatus('WAITING');

    for (const game of waitingGames) {
        if (game.players.length < 4 && !game.players.some(p => p.name === playerName)) {
            // Add player to existing game
            const newPlayerId = generatePlayerId();
            const playerIndex = game.players.length;

            const updatedPlayers = [
                ...game.players,
                { id: newPlayerId, name: playerName, index: playerIndex }
            ];

            // Convert to World Conflict game state
            const worldConflictGame = WorldConflictGameState.createInitialState(
                game.gameId,
                updatedPlayers as Player[],
                DEFAULT_REGIONS
            );

            await gameStorage.saveGame({
                ...game,
                players: updatedPlayers,
                status: updatedPlayers.length >= 2 ? 'ACTIVE' : 'WAITING'
            });

            await WebSocketNotificationHelper.sendGameUpdate(worldConflictGame.toJSON(), null);

            return {
                gameId: game.gameId,
                players: updatedPlayers,
                newPlayerId,
                playerIndex
            };
        }
    }

    return null;
}

async function createNewWorldConflictGame(
    playerName: string,
    gameType: string,
    gameStorage: GameStorage
) {
    const gameId = generateGameId();
    const players: Player[] = [
        { id: generatePlayerId(), name: playerName, index: 0 }
    ];

    // Add AI players if requested
    if (gameType === 'AI') {
        players.push(
            { id: generatePlayerId(), name: 'AI Warrior', index: 1 },
            { id: generatePlayerId(), name: 'AI Strategist', index: 2 }
        );
    }

    const worldConflictGame = WorldConflictGameState.createInitialState(
        gameId,
        players,
        DEFAULT_REGIONS
    );

    const gameData = {
        gameId,
        players: players.map(p => ({ id: p.id, name: p.name })),
        status: gameType === 'AI' ? 'ACTIVE' : 'WAITING',
        createdAt: Date.now(),
        lastMoveAt: Date.now(),
        worldConflictState: worldConflictGame.toJSON()
    };

    await gameStorage.saveGame(gameData);

    console.log(`✅ NEW WORLD CONFLICT GAME CREATED: ${gameId}`);
    console.log(`   Players: ${players.map(p => p.name).join(', ')}`);

    return {
        gameId,
        players,
        gameData: worldConflictGame.toJSON()
    };
}

function generateGameId(): string {
    return 'wc_' + Math.random().toString(36).substr(2, 9);
}

function generatePlayerId(): string {
    return Math.random().toString(36).substr(2, 9);
}
