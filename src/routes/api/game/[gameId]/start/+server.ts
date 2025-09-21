import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { GameStorage } from '$lib/server/storage/GameStorage';
import { GameState } from '$lib/game/state/GameState';
import { Region } from '$lib/game/entities/Region';
import { getErrorMessage } from '$lib/server/api-utils';
import { GAME_CONSTANTS } from "$lib/game/constants/gameConstants";
import { WebSocketNotificationHelper } from '$lib/server/websocket/WebSocketNotificationHelper';
import { GameNotifications } from '$lib/server/websocket/websocket';
import { processAiTurns } from '$lib/server/ai/AiTurnProcessor';

/**
 * Start a pending multiplayer game
 * Forces the game to start even with open slots by filling them with AI players
 */
export const POST: RequestHandler = async ({ params, platform }) => {
    try {
        const { gameId } = params;

        const gameStorage = GameStorage.create(platform!);

        const game = await gameStorage.getGame(gameId);
        if (!game) {
            return json({ error: 'Game not found' }, { status: 404 });
        }

        if (game.status !== 'PENDING') {
            return json({ error: 'Game is not in pending state' }, { status: 400 });
        }

        const updatedPlayers = fillRemainingSlotsWithAI(game);

        console.log(`Starting game with ${updatedPlayers.length} players (${updatedPlayers.filter(p => !p.isAI).length} human)`);
        const regions = reconstructRegions(game.worldConflictState?.regions);

        // Initialize World Conflict game state with properly constructed regions
        const gameState = GameState.createInitialState(
            gameId,
            updatedPlayers,
            regions,
            game.worldConflictState?.maxTurns
        );

        const updatedGame = {
            ...game,
            players: updatedPlayers,
            status: 'ACTIVE' as const,
            worldConflictState: gameState.toJSON(),
            lastMoveAt: Date.now()
        };

        await gameStorage.saveGame(updatedGame);

        // Check if first player is AI and process AI turns if needed
        const initialGameState = new GameState(updatedGame.worldConflictState);
        const firstPlayer = initialGameState.activePlayer();

        if (firstPlayer?.isAI) {
            console.log(`First player is AI (${firstPlayer.name}), processing AI turns after manual start...`);

            // Process AI turns until we reach a human player
            const processedGameState = await processAiTurns(initialGameState, gameStorage, gameId, platform);

            // Update the game with the processed state
            updatedGame.worldConflictState = processedGameState.toJSON();
            updatedGame.currentPlayerIndex = processedGameState.playerIndex;
            updatedGame.lastMoveAt = Date.now();

            console.log(`AI processing complete after manual start, current player: ${processedGameState.playerIndex}`);

            // Save the updated game record
            await gameStorage.saveGame(updatedGame);
        }

        // Notify all connected clients
        await WebSocketNotificationHelper.sendGameUpdate(updatedGame, platform!.env);
        await GameNotifications.gameStarted(gameId, updatedGame);

        return json({
            success: true,
            gameId: updatedGame.gameId,
            gameStatus: updatedGame.status,
            worldConflictState: updatedGame.worldConflictState,
            players: updatedGame.players
        });

    } catch (error) {
        console.error(`Error starting game ${params.gameId}:`, error);
        return json({ error: 'Failed to start game: ' + getErrorMessage(error) }, { status: 500 });
    }
};

// Rest of the file remains the same...
function fillRemainingSlotsWithAI(game: any): any[] {
    const players = [...game.players];

    if (game.pendingConfiguration?.playerSlots) {
        const playerSlots = game.pendingConfiguration.playerSlots;
        const activeSlots = playerSlots.filter((slot: any) => slot && slot.type !== 'Off');

        for (const slot of activeSlots) {
            if (slot.type === 'Open' && !players.find(p => p.index === slot.index)) {
                console.log(`Adding AI player to open slot ${slot.index}:`, {
                    index: slot.index,
                    name: slot.defaultName || `AI Player ${slot.index + 1}`,
                    type: 'AI',
                    personality: {
                        name: slot.defaultName || `AI Player ${slot.index + 1}`,
                        level: 1,
                        soldierEagerness: 0.5,
                        upgradePreference: []
                    }
                });

                players.push({
                    id: `ai_${slot.index}`,
                    index: slot.index,
                    name: slot.defaultName || `AI Player ${slot.index + 1}`,
                    color: getPlayerColor(slot.index),
                    isAI: true,
                    personality: {
                        name: slot.defaultName || `AI Player ${slot.index + 1}`,
                        level: 1,
                        soldierEagerness: 0.5,
                        upgradePreference: []
                    }
                });
            }
        }
    } else {
        // Fill up to max players
        while (players.length < GAME_CONSTANTS.MAX_PLAYERS) {
            const aiIndex = players.length;
            players.push({
                id: `ai_${aiIndex}`,
                index: aiIndex,
                name: `AI Player ${aiIndex + 1}`,
                color: getPlayerColor(aiIndex),
                isAI: true,
                personality: {
                    name: `AI Player ${aiIndex + 1}`,
                    level: 1,
                    soldierEagerness: 0.5,
                    upgradePreference: []
                }
            });
        }
    }

    return players;
}

function reconstructRegions(regionData: any): Region[] {
    if (!regionData?.length) {
        console.log('No region data provided, creating basic regions');
        return [];
    }

    console.log(`Reconstructed ${regionData.length} regions as Region instances`);
    return regionData.map((data: any) => new Region(data));
}

function getPlayerColor(index: number): string {
    const colors = ['#ef4444', '#3b82f6', '#10b981', '#f59e0b'];
    return colors[index % colors.length];
}