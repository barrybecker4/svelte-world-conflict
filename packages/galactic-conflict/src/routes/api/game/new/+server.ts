/**
 * API endpoint to create a new Galactic Conflict game
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { GameStorage, type GameRecord } from '$lib/server/storage/GameStorage';
import { GalacticGameState } from '$lib/game/state/GalacticGameState';
import type { Player, PlayerSlot, GameSettings } from '$lib/game/entities/gameTypes';
import { generateGameId, createPlayer, handleApiError } from '$lib/server/api-utils';
import { GALACTIC_CONSTANTS } from '$lib/game/constants/gameConstants';
import { logger } from 'multiplayer-framework/shared';

interface CreateGameRequest {
    playerName?: string;
    gameType?: string;
    playerSlots?: PlayerSlot[];
    settings?: Partial<GameSettings>;
}

export const POST: RequestHandler = async ({ request, platform }) => {
    try {
        const body = await request.json() as CreateGameRequest;
        const { playerName, playerSlots = [], settings } = body;

        if (!playerName?.trim()) {
            return json({ error: 'Player name is required' }, { status: 400 });
        }

        // After validation, we know playerName is defined
        const gameRecord = createGameRecord({ ...body, playerName: playerName.trim() });
        
        await saveGame(gameRecord, platform!);

        // Find the creator player
        const creatorPlayer = gameRecord.players.find(p => 
            p.name === playerName.trim() && !p.isAI
        );

        if (!creatorPlayer) {
            throw new Error('Creator player not found in game record');
        }

        return json({
            gameId: gameRecord.gameId,
            status: gameRecord.status,
            player: creatorPlayer,
            playerSlotIndex: creatorPlayer.slotIndex,
            message: `Game created successfully as ${gameRecord.status}`,
        });

    } catch (error) {
        return handleApiError(error, 'creating game', { platform });
    }
};

function createGameRecord(body: CreateGameRequest & { playerName: string }): GameRecord {
    const {
        playerName,
        gameType = 'MULTIPLAYER',
        playerSlots = [],
        settings = {},
    } = body;

    const gameId = generateGameId();

    // Merge settings with defaults
    const gameSettings: GameSettings = {
        neutralPlanetCount: settings.neutralPlanetCount ?? GALACTIC_CONSTANTS.DEFAULT_NEUTRAL_PLANET_COUNT,
        armadaSpeed: settings.armadaSpeed ?? GALACTIC_CONSTANTS.DEFAULT_ARMADA_SPEED,
        gameDuration: settings.gameDuration ?? GALACTIC_CONSTANTS.DEFAULT_GAME_DURATION_MINUTES,
        stateBroadcastInterval: settings.stateBroadcastInterval ?? GALACTIC_CONSTANTS.DEFAULT_STATE_BROADCAST_INTERVAL_MS,
        aiDifficulty: settings.aiDifficulty,
        neutralShipsMin: settings.neutralShipsMin ?? GALACTIC_CONSTANTS.NEUTRAL_SHIPS_MIN,
        neutralShipsMultiplierMax: settings.neutralShipsMultiplierMax ?? GALACTIC_CONSTANTS.NEUTRAL_SHIPS_MULTIPLIER_MAX,
        productionRate: settings.productionRate ?? GALACTIC_CONSTANTS.DEFAULT_PRODUCTION_RATE,
    };

    const players: Player[] = [];
    const { hasOpenSlots, gameStatus, finalGameType } = determineGameAttributes(
        gameType,
        playerSlots,
        playerName,
        players,
        gameSettings.aiDifficulty
    );

    // Only create full game state for ACTIVE games
    let gameState;
    if (gameStatus === 'ACTIVE') {
        const state = GalacticGameState.createInitialState(
            gameId,
            playerSlots.length > 0 ? playerSlots : createDefaultSlots(players),
            gameSettings,
            `seed-${gameId}`
        );
        gameState = state.toJSON();
    }

    return {
        gameId,
        status: gameStatus,
        players,
        gameState,
        createdAt: Date.now(),
        lastUpdateAt: Date.now(),
        gameType: finalGameType,
        pendingConfiguration: gameStatus === 'PENDING' ? {
            playerSlots: playerSlots.length > 0 ? playerSlots : createDefaultSlots(players, true),
            settings: gameSettings,
        } : undefined,
    };
}

function createDefaultSlots(players: Player[], includeOpenSlots: boolean = false): PlayerSlot[] {
    const slots: PlayerSlot[] = players.map(p => ({
        slotIndex: p.slotIndex,
        type: p.isAI ? 'AI' : 'Set',
        name: p.name,
        personality: p.personality,
        difficulty: p.difficulty,
    }));

    // Add open slots for multiplayer pending games
    if (includeOpenSlots && slots.length < 2) {
        for (let i = slots.length; i < 2; i++) {
            slots.push({
                slotIndex: i,
                type: 'Open',
            });
        }
    }

    return slots;
}

function determineGameAttributes(
    gameType: string,
    playerSlots: PlayerSlot[],
    playerName: string,
    players: Player[],
    aiDifficulty?: string
): { hasOpenSlots: boolean; gameStatus: 'PENDING' | 'ACTIVE'; finalGameType: 'MULTIPLAYER' | 'AI' } {
    let hasOpenSlots = false;
    let gameStatus: 'PENDING' | 'ACTIVE' = 'ACTIVE';
    let finalGameType: 'MULTIPLAYER' | 'AI' = 'AI';

    if (gameType === 'MULTIPLAYER') {
        if (playerSlots.length === 0) {
            // Simple multiplayer game - just the creator
            const creatorPlayer = createPlayer(playerName.trim(), 0, false);
            players.push(creatorPlayer);
            gameStatus = 'PENDING';
            finalGameType = 'MULTIPLAYER';
        } else {
            // Configured game from GameConfiguration
            const activeSlots = playerSlots.filter(slot => slot.type !== 'Disabled');

            if (activeSlots.length < 2) {
                throw new Error('At least 2 players are required');
            }

            // Check for open slots
            hasOpenSlots = activeSlots.some(slot => slot.type === 'Open');

            if (hasOpenSlots) {
                gameStatus = 'PENDING';
                finalGameType = 'MULTIPLAYER';
            } else {
                gameStatus = 'ACTIVE';
                finalGameType = activeSlots.some(slot => slot.type === 'AI') ? 'AI' : 'MULTIPLAYER';
            }

            let creatorAdded = false;
            for (const slot of activeSlots) {
                if (slot.type === 'Set') {
                    const name = !creatorAdded ? playerName.trim() : (slot.name || `Player ${slot.slotIndex + 1}`);
                    players.push(createPlayer(name, slot.slotIndex, false));
                    if (!creatorAdded) {
                        creatorAdded = true;
                    }
                } else if (slot.type === 'AI') {
                    players.push(createPlayer(slot.name || `AI ${slot.slotIndex + 1}`, slot.slotIndex, true, aiDifficulty, slot.difficulty || 'easy'));
                }
                // Skip 'Open' slots - they'll be filled when players join
            }

            if (!creatorAdded && activeSlots.length > 0) {
                const firstSlot = activeSlots[0];
                players.push(createPlayer(playerName.trim(), firstSlot.slotIndex, false));
            }
        }
    } else {
        // Default: 2-player AI game
        const humanPlayer = createPlayer(playerName.trim(), 0, false);
        const aiPlayer = createPlayer('AI Player', 1, true, aiDifficulty, 'easy');
        players.push(humanPlayer, aiPlayer);
        gameStatus = 'ACTIVE';
        finalGameType = 'AI';
    }

    return { hasOpenSlots, gameStatus, finalGameType };
}

async function saveGame(gameRecord: GameRecord, platform: App.Platform): Promise<void> {
    const gameStorage = GameStorage.create(platform);
    await gameStorage.saveGame(gameRecord);
    logger.info(`Created game: ${gameRecord.status} gameId: ${gameRecord.gameId} with ${gameRecord.players.length} players`);
}
