/**
 * EventManager - Handles event queue and battle replay management
 */

import type {
    GameEvent,
    BattleReplay,
    ReinforcementEvent,
    ConquestEvent,
    PlayerEliminationEvent,
} from '$lib/game/entities/gameTypes';
import { GALACTIC_CONSTANTS } from '$lib/game/constants/gameConstants';
import { logger } from 'multiplayer-framework/shared';
import { v4 as uuidv4 } from 'uuid';

export class EventManager {
    constructor(
        private eventQueue: GameEvent[],
        private recentBattleReplays: BattleReplay[],
        private recentReinforcementEvents: ReinforcementEvent[],
        private recentConquestEvents: ConquestEvent[],
        private recentPlayerEliminationEvents: PlayerEliminationEvent[]
    ) {}

    // ==================== EVENT QUEUE ====================

    scheduleEvent(event: GameEvent): void {
        this.eventQueue.push(event);
        // Keep queue sorted by scheduled time
        this.eventQueue.sort((a, b) => a.scheduledTime - b.scheduledTime);
    }

    getNextEvent(): GameEvent | undefined {
        return this.eventQueue[0];
    }

    popNextEvent(): GameEvent | undefined {
        return this.eventQueue.shift();
    }

    removeEvent(eventId: string): void {
        const index = this.eventQueue.findIndex(e => e.id === eventId);
        if (index >= 0) {
            this.eventQueue.splice(index, 1);
        }
    }

    scheduleResourceTick(time: number): void {
        this.scheduleEvent({
            id: uuidv4(),
            type: 'resource_tick',
            scheduledTime: time,
            payload: {},
        });
    }

    getEventQueue(): GameEvent[] {
        return this.eventQueue;
    }

    // ==================== BATTLE REPLAYS ====================

    /**
     * Add a battle replay for client animation
     */
    addBattleReplay(replay: BattleReplay): void {
        this.recentBattleReplays.push(replay);
        console.log(`[EventManager] Added battle replay ${replay.id} for planet ${replay.planetName}, total replays: ${this.recentBattleReplays.length}`);
    }

    /**
     * Clear replays that have been sent to clients
     * Called after state broadcast
     */
    clearBattleReplays(): void {
        this.recentBattleReplays.length = 0;
    }

    /**
     * Get pending battle replays
     */
    getPendingReplays(): BattleReplay[] {
        return [...this.recentBattleReplays];
    }

    getBattleReplays(): BattleReplay[] {
        return this.recentBattleReplays;
    }

    // ==================== REINFORCEMENT AND CONQUEST EVENTS ====================

    /**
     * Add a reinforcement event for client display
     */
    addReinforcementEvent(event: ReinforcementEvent): void {
        this.recentReinforcementEvents.push(event);
        logger.debug(`[EventManager] Added reinforcement event ${event.id} for planet ${event.planetName}`);
    }

    /**
     * Add a conquest event for client display
     */
    addConquestEvent(event: ConquestEvent): void {
        this.recentConquestEvents.push(event);
        logger.debug(`[EventManager] Added conquest event ${event.id} for planet ${event.planetName}`);
    }

    /**
     * Clear reinforcement events that have been sent to clients
     * Called after state broadcast
     */
    clearReinforcementEvents(): void {
        this.recentReinforcementEvents.length = 0;
    }

    /**
     * Clear conquest events that have been sent to clients
     * Called after state broadcast
     */
    clearConquestEvents(): void {
        this.recentConquestEvents.length = 0;
    }

    getReinforcementEvents(): ReinforcementEvent[] {
        return this.recentReinforcementEvents;
    }

    getConquestEvents(): ConquestEvent[] {
        return this.recentConquestEvents;
    }

    // ==================== PLAYER ELIMINATION EVENTS ====================

    /**
     * Add a player elimination event for client display
     */
    addPlayerEliminationEvent(event: PlayerEliminationEvent): void {
        this.recentPlayerEliminationEvents.push(event);
        logger.debug(`[EventManager] Added player elimination event ${event.id} for player ${event.playerName} at planet ${event.planetName}`);
    }

    /**
     * Clear player elimination events that have been sent to clients
     * Called after state broadcast
     */
    clearPlayerEliminationEvents(): void {
        this.recentPlayerEliminationEvents.length = 0;
    }

    getPlayerEliminationEvents(): PlayerEliminationEvent[] {
        return this.recentPlayerEliminationEvents;
    }
}

