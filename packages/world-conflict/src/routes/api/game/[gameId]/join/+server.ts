import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { GameStorage, type GameRecord } from '$lib/server/storage/GameStorage';
import { createPlayer, handleApiError } from '$lib/server/api-utils';
import { GameState } from '$lib/game/state/GameState';
import { GAME_CONSTANTS } from '$lib/game/constants/gameConstants';
import { WebSocketNotifications } from '$lib/server/websocket/WebSocketNotifier';
import { logger } from '$lib/game/utils/logger';

interface JoinRequest {
    playerName?: string;
    preferredSlot?: number;
}

interface ValidationResult {
    valid: boolean;
    error?: string;
    statusCode?: number;
}

/**
 * Validate the join request and game state
 */
function validateJoinRequest(
    gameId: string | undefined,
    playerName: string | undefined,
    game: GameRecord | null
): ValidationResult {
    if (!gameId || !playerName?.trim()) {
        return { valid: false, error: 'Game ID and player name are required', statusCode: 400 };
    }

    if (!game) {
        return { valid: false, error: 'Game not found', statusCode: 404 };
    }

    if (game.status !== 'PENDING') {
        return { valid: false, error: 'Game has already started or ended', statusCode: 400 };
    }

    const existingPlayer = game.players.find(p =>
        p.name.toLowerCase() === playerName.trim().toLowerCase()
    );
    if (existingPlayer) {
        return { valid: false, error: `Player name "${playerName}" is already taken`, statusCode: 400 };
    }

    return { valid: true };
}

/**
 * Find the target slot for the joining player
 */
function findTargetSlot(
    game: GameRecord,
    preferredSlot: number | undefined
): { slotIndex: number } | { error: string; statusCode: number } {
    if (preferredSlot !== undefined) {
        const slot = game.pendingConfiguration?.playerSlots?.find((s: any) => s.slotIndex === preferredSlot);

        if (!slot) {
            logger.debug(`Slot ${preferredSlot} not found in playerSlots`);
            return { error: 'Invalid slot', statusCode: 400 };
        }

        if (slot.type !== 'Open') {
            logger.debug(`Slot ${preferredSlot} is type ${slot.type}, not Open`);
            return { error: 'Slot is not available', statusCode: 400 };
        }

        if (game.players.some((p: any) => p.slotIndex === preferredSlot)) {
            logger.debug(`Slot ${preferredSlot} already taken`);
            return { error: 'Slot already taken', statusCode: 400 };
        }

        logger.debug(`Assigning player to slot ${slot.slotIndex}`);
        return { slotIndex: slot.slotIndex };
    }

    // Find first available Open slot
    if (game.pendingConfiguration?.playerSlots) {
        const playerSlots = game.pendingConfiguration.playerSlots;
        const openSlots = playerSlots
            .filter((slot: any) => slot.type === 'Open')
            .sort((a: any, b: any) => a.slotIndex - b.slotIndex);
        
        const availableSlot = openSlots.find((slot: any) => 
            !game.players.some((p: any) => p.slotIndex === slot.slotIndex)
        );
        
        if (!availableSlot) {
            return { error: 'No available slots', statusCode: 400 };
        }
        
        logger.debug(`Auto-assigning player to first open slot ${availableSlot.slotIndex}`);
        return { slotIndex: availableSlot.slotIndex };
    }

    // Fallback to legacy behavior for games without slot configuration
    if (game.players.length >= GAME_CONSTANTS.MAX_PLAYERS) {
        return { error: 'Game is full', statusCode: 400 };
    }
    
    return { slotIndex: game.players.length };
}

/**
 * Check if all open slots are filled and game should auto-start
 */
function checkShouldAutoStart(game: GameRecord, updatedPlayers: any[]): boolean {
    if (game.pendingConfiguration?.playerSlots) {
        const playerSlots = game.pendingConfiguration.playerSlots;
        const openSlots = playerSlots.filter((slot: any) => slot?.type === 'Open');

        const unfilledOpenSlots = openSlots.filter((slot: any) => {
            return !updatedPlayers.some(p => p.slotIndex === slot.slotIndex);
        });

        return unfilledOpenSlots.length === 0;
    }
    
    return updatedPlayers.length >= GAME_CONSTANTS.MAX_PLAYERS;
}

/**
 * Initialize game state when auto-starting
 */
function initializeGameForStart(
    gameId: string,
    game: GameRecord,
    updatedGame: any,
    updatedPlayers: any[]
): void {
    const regions = game.worldConflictState?.regions || [];
    const moveTimeLimit = game.pendingConfiguration?.settings?.timeLimit ||
                          game.worldConflictState?.moveTimeLimit ||
                          GAME_CONSTANTS.STANDARD_HUMAN_TIME_LIMIT;
    const aiDifficulty = game.pendingConfiguration?.settings?.aiDifficulty ||
                        game.worldConflictState?.aiDifficulty ||
                        'Normal';

    logger.debug(`Auto-starting game with ${updatedPlayers.length} players, timeLimit: ${moveTimeLimit}`);

    const gameState = GameState.createInitialState(
        gameId,
        updatedPlayers,
        regions,
        game.worldConflictState?.maxTurns,
        moveTimeLimit,
        aiDifficulty
    );

    const gameStateJSON = gameState.toJSON();
    updatedGame.worldConflictState = gameStateJSON;
    updatedGame.status = 'ACTIVE';

    // Sync the top-level players array with the sorted players from game state
    updatedGame.players = gameStateJSON.players;
}

export const POST: RequestHandler = async ({ params, request, platform }) => {
    try {
        const gameId = params.gameId;
        const body = await request.json() as JoinRequest;
        const { playerName, preferredSlot } = body;

        logger.debug(`Player "${playerName}" attempting to join game ${gameId}`);

        const gameStorage = GameStorage.create(platform!);
        const game = await gameStorage.getGame(gameId);

        // Validate request
        const validation = validateJoinRequest(gameId, playerName, game);
        if (!validation.valid) {
            return json({ error: validation.error }, { status: validation.statusCode });
        }

        // Find target slot
        const slotResult = findTargetSlot(game!, preferredSlot);
        if ('error' in slotResult) {
            return json({ error: slotResult.error }, { status: slotResult.statusCode });
        }

        // Create new player and update game
        const newPlayer = createPlayer(playerName!.trim(), slotResult.slotIndex, false);
        const updatedPlayers = [...game!.players, newPlayer];

        const updatedGame: any = {
            ...game,
            players: updatedPlayers,
            lastMoveAt: Date.now()
        };

        // Check if game should auto-start
        const shouldStart = checkShouldAutoStart(game!, updatedPlayers);
        if (shouldStart) {
            logger.info('All open slots filled - auto-starting game');
            initializeGameForStart(gameId!, game!, updatedGame, updatedPlayers);
        }

        await gameStorage.saveGame(updatedGame);

        // Send WebSocket notifications
        await WebSocketNotifications.playerJoined(gameId!, newPlayer, updatedGame);

        if (shouldStart) {
            await WebSocketNotifications.gameStarted(gameId!, updatedGame);
            await WebSocketNotifications.gameUpdate(updatedGame);
        }

        logger.info(`Player "${playerName}" joined game ${gameId}${shouldStart ? ' and game started' : ''}`);

        // Return the player from the updated game to ensure correct slot assignment
        const playerToReturn = shouldStart
            ? updatedGame.players.find((p: any) => p.slotIndex === newPlayer.slotIndex) || newPlayer
            : newPlayer;

        return json({
            success: true,
            player: playerToReturn,
            game: {
                ...updatedGame,
                playerCount: updatedGame.players.length
            },
            gameStarted: shouldStart
        });

    } catch (error) {
        return handleApiError(error, 'joining game');
    }
};
