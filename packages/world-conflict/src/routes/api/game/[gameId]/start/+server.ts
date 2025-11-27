import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { GameStorage } from '$lib/server/storage/GameStorage';
import { GameState } from '$lib/game/state/GameState';
import { Region } from '$lib/game/entities/Region';
import { handleApiError } from '$lib/server/api-utils';
import { GAME_CONSTANTS } from "$lib/game/constants/gameConstants";
import { WebSocketNotifications } from '$lib/server/websocket/WebSocketNotifier';
import { AI_PERSONALITIES, AI_LEVELS } from '$lib/game/entities/aiPersonalities';
import { getPlayerConfig } from '$lib/game/constants/playerConfigs';
import { logger } from '$lib/game/utils/logger';

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

        // Get AI difficulty before filling slots
        const aiDifficulty = game.pendingConfiguration?.settings?.aiDifficulty ||
                            game.worldConflictState?.aiDifficulty ||
                            'Normal';

        const updatedPlayers = fillRemainingSlotsWithAI(game, aiDifficulty);

        logger.info(`Starting game with ${updatedPlayers.length} players (${updatedPlayers.filter(p => !p.isAI).length} human)`);
        const regions = reconstructRegions(game.worldConflictState?.regions);

        // Get time limit from pending configuration or use default
        const moveTimeLimit = game.pendingConfiguration?.settings?.timeLimit ||
                              game.worldConflictState?.moveTimeLimit ||
                              GAME_CONSTANTS.STANDARD_HUMAN_TIME_LIMIT;

        logger.debug(`Starting game with AI difficulty: ${aiDifficulty}`);

        // Initialize World Conflict game state with properly constructed regions
        const gameState = GameState.createInitialState(
            gameId,
            updatedPlayers,
            regions,
            game.worldConflictState?.maxTurns,
            moveTimeLimit,
            aiDifficulty
        );

        const gameStateJSON = gameState.toJSON();

        const updatedGame = {
            ...game,
            players: updatedPlayers,
            status: 'ACTIVE' as const,
            worldConflictState: gameStateJSON,
            lastMoveAt: Date.now()
        };

        await gameStorage.saveGame(updatedGame);

        // Notify clients that the game has started
        await WebSocketNotifications.gameStarted(gameId, updatedGame);
        await WebSocketNotifications.gameUpdate(updatedGame);

        // AI turns will be triggered by the client after it loads the initial state and connects to WebSocket
        // This ensures clients can see and animate the AI's moves properly

        return json({
            success: true,
            gameId: updatedGame.gameId,
            gameStatus: updatedGame.status,
            worldConflictState: updatedGame.worldConflictState,
            players: updatedGame.players
        });

    } catch (error) {
        return handleApiError(error, `starting game ${params.gameId}`);
    }
};

// Helper function to map difficulty string to AI level
function getAiLevelFromDifficulty(difficulty: string): number {
    switch (difficulty) {
        case 'Nice':
            return AI_LEVELS.NICE;
        case 'Normal':
            return AI_LEVELS.RUDE;
        case 'Hard':
            return AI_LEVELS.MEAN;
        default:
            return AI_LEVELS.RUDE;
    }
}

// Helper function to get personalities matching the difficulty level
function getPersonalitiesForDifficulty(difficulty: string): any[] {
    const targetLevel = getAiLevelFromDifficulty(difficulty);
    const matchingPersonalities = AI_PERSONALITIES.filter(p => p.level === targetLevel);

    // If no exact match, return all personalities (shouldn't happen)
    return matchingPersonalities.length > 0 ? matchingPersonalities : [...AI_PERSONALITIES];
}

function fillRemainingSlotsWithAI(game: any, aiDifficulty: string): any[] {
    const players = [...game.players];
    const availablePersonalities = getPersonalitiesForDifficulty(aiDifficulty);

    logger.debug(`Filling AI slots with ${aiDifficulty} difficulty personalities:`,
        availablePersonalities.map(p => p.name).join(', '));

    if (game.pendingConfiguration?.playerSlots) {
        const playerSlots = game.pendingConfiguration.playerSlots;
        const activeSlots = playerSlots.filter((slot: any) => slot && slot.type !== 'Off');

        for (const slot of activeSlots) {
            // Use slotIndex property (not index) as saved by GameConfiguration
            const slotIndex = slot.slotIndex;
            
            if (slot.type === 'Open' && !players.find(p => p.slotIndex === slotIndex)) {
                // Pick personality from those matching the difficulty level
                const personality = availablePersonalities[slotIndex % availablePersonalities.length];

                // Get default name from player config (not stored in slot)
                const playerConfig = getPlayerConfigForSlot(slotIndex);
                const aiName = playerConfig.defaultName;

                logger.debug(`Adding AI player to open slot ${slotIndex}: ${aiName} (${personality.name})`);

                players.push({
                    id: `ai_${slotIndex}`,
                    slotIndex: slotIndex,
                    name: aiName,
                    color: getPlayerColor(slotIndex),
                    isAI: true,
                    personality: personality.name
                });
            }
        }
    } else {
        // Fill up to max players
        while (players.length < GAME_CONSTANTS.MAX_PLAYERS) {
            const aiIndex = players.length;
            const personality = availablePersonalities[aiIndex % availablePersonalities.length];

            players.push({
                id: `ai_${aiIndex}`,
                slotIndex: aiIndex,
                name: `AI Player ${aiIndex + 1}`,
                color: getPlayerColor(aiIndex),
                isAI: true,
                personality: personality.name
            });
        }
    }

    return players;
}

function reconstructRegions(regionData: any): Region[] {
    if (!regionData?.length) {
        logger.debug('No region data provided, creating basic regions');
        return [];
    }

    logger.debug(`Reconstructed ${regionData.length} regions as Region instances`);
    return regionData.map((data: any) => new Region(data));
}

function getPlayerColor(index: number): string {
    const colors = ['#ef4444', '#3b82f6', '#10b981', '#f59e0b'];
    return colors[index % colors.length];
}

function getPlayerConfigForSlot(slotIndex: number) {
    return getPlayerConfig(slotIndex);
}
