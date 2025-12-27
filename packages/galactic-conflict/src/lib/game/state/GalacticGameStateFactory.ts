/**
 * GalacticGameStateFactory - Handles creation and initialization of game states
 */

import type {
    Player,
    PlayerSlot,
    GameSettings,
    GalacticGameStateData,
} from '$lib/game/entities/gameTypes';
import { GALACTIC_CONSTANTS, GAME_STATUS } from '$lib/game/constants/gameConstants';
import { getPlayerColor } from '$lib/game/constants/playerConfigs';
import { GalaxyGenerator } from '$lib/game/map/GalaxyGenerator';
import { logger } from 'multiplayer-framework/shared';
import { v4 as uuidv4 } from 'uuid';
import { GalacticGameState } from './GalacticGameState';

export class GalacticGameStateFactory {
    /**
     * Create initial game state from configuration
     */
    static createInitialState(
        gameId: string,
        playerSlots: PlayerSlot[],
        settings: GameSettings,
        seed?: string
    ): GalacticGameState {
        logger.debug(`Creating initial game state for ${gameId}`);

        // Create players from slots
        const players = this.createPlayersFromSlots(playerSlots);

        // Generate galaxy
        const generator = new GalaxyGenerator(
            GALACTIC_CONSTANTS.GALAXY_WIDTH,
            GALACTIC_CONSTANTS.GALAXY_HEIGHT,
            seed || `galaxy-${gameId}`
        );

        const planets = generator.generate({
            neutralPlanetCount: settings.neutralPlanetCount,
            playerCount: players.length,
            players,
            seed,
            neutralShipsMin: settings.neutralShipsMin,
            neutralShipsMultiplierMax: settings.neutralShipsMultiplierMax,
        });

        const now = Date.now();

        // Initialize player resources (start with 0)
        const resourcesByPlayer = this.initializePlayerResources(players);

        const initialState: GalacticGameStateData = {
            gameId,
            status: GAME_STATUS.ACTIVE,
            startTime: now,
            durationMinutes: settings.gameDuration,
            armadaSpeed: settings.armadaSpeed,
            productionRate: settings.productionRate,
            planets,
            players,
            armadas: [],
            eventQueue: [],
            resourcesByPlayer,
            recentBattleReplays: [],
            recentReinforcementEvents: [],
            recentConquestEvents: [],
            recentPlayerEliminationEvents: [],
            eliminatedPlayers: [],
            rngSeed: seed || `galactic-${gameId}`,
            lastUpdateTime: now,
        };

        const state = new GalacticGameState(initialState);

        // Schedule first resource tick
        state.scheduleResourceTick(now + GALACTIC_CONSTANTS.RESOURCE_TICK_INTERVAL_MS);

        // Schedule game end
        const gameEndTime = now + settings.gameDuration * 60 * 1000;
        state.scheduleEvent({
            id: uuidv4(),
            type: 'game_end',
            scheduledTime: gameEndTime,
            payload: { reason: 'time_expired' },
        });

        return state;
    }

    /**
     * Create Player objects from PlayerSlots
     */
    private static createPlayersFromSlots(slots: PlayerSlot[]): Player[] {
        return slots
            .filter(slot => slot.type === 'Set' || slot.type === 'AI')
            .map(slot => ({
                slotIndex: slot.slotIndex,
                name: slot.name || `Player ${slot.slotIndex + 1}`,
                color: getPlayerColor(slot.slotIndex),
                isAI: slot.type === 'AI',
                personality: slot.personality,
                difficulty: slot.difficulty,
            }));
    }

    /**
     * Initialize resources for all players (starting at 0)
     */
    private static initializePlayerResources(players: Player[]): Record<number, number> {
        const resourcesByPlayer: Record<number, number> = {};
        for (const player of players) {
            resourcesByPlayer[player.slotIndex] = 0;
        }
        return resourcesByPlayer;
    }
}

