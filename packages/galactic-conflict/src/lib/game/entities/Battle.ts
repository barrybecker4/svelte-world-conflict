/**
 * Battle entity helper functions
 */

import type { Battle, BattleParticipant, BattleRoundResult } from './gameTypes';
import { v4 as uuidv4 } from 'uuid';

/**
 * Create a new battle at a planet
 */
export function createBattle(
    planetId: number,
    defenderId: number | null,
    defenderShips: number,
    attackerId: number,
    attackerShips: number,
    currentTime: number = Date.now()
): Battle {
    const participants: BattleParticipant[] = [];
    
    // Add defender if planet is owned
    if (defenderId !== null && defenderShips > 0) {
        participants.push({
            playerId: defenderId,
            ships: defenderShips,
            isDefender: true,
            arrivedAt: currentTime,
        });
    }
    
    // Add attacker
    participants.push({
        playerId: attackerId,
        ships: attackerShips,
        isDefender: false,
        arrivedAt: currentTime,
    });
    
    return {
        id: uuidv4(),
        planetId,
        participants,
        rounds: [],
        status: 'active',
        startTime: currentTime,
    };
}

/**
 * Add a new participant to an existing battle
 */
export function addBattleParticipant(
    battle: Battle,
    playerId: number,
    ships: number,
    currentTime: number = Date.now()
): Battle {
    // Check if this player is already in the battle
    const existingParticipant = battle.participants.find(p => p.playerId === playerId);
    
    if (existingParticipant) {
        // Reinforce existing participant
        existingParticipant.ships += ships;
    } else {
        // Add new participant
        battle.participants.push({
            playerId,
            ships,
            isDefender: false,
            arrivedAt: currentTime,
        });
    }
    
    return battle;
}

/**
 * Get the participant with the fewest ships (the target in multi-player battles)
 */
export function getWeakestParticipant(battle: Battle): BattleParticipant | null {
    const activeParticipants = battle.participants.filter(p => p.ships > 0);
    
    if (activeParticipants.length === 0) {
        return null;
    }
    
    return activeParticipants.reduce((weakest, current) => 
        current.ships < weakest.ships ? current : weakest
    );
}

/**
 * Get all participants except the weakest (the attackers in multi-player battles)
 */
export function getAttackingParticipants(battle: Battle): BattleParticipant[] {
    const weakest = getWeakestParticipant(battle);
    if (!weakest) return [];
    
    return battle.participants.filter(p => p.ships > 0 && p.playerId !== weakest.playerId);
}

/**
 * Check if a battle is still active (more than one player with ships)
 */
export function isBattleActive(battle: Battle): boolean {
    const playersWithShips = battle.participants.filter(p => p.ships > 0);
    return playersWithShips.length > 1;
}

/**
 * Get the winner of a resolved battle
 */
export function getBattleWinner(battle: Battle): BattleParticipant | null {
    const survivors = battle.participants.filter(p => p.ships > 0);
    return survivors.length === 1 ? survivors[0] : null;
}

/**
 * Record a battle round result
 */
export function recordBattleRound(
    battle: Battle,
    attackerPlayerId: number,
    defenderPlayerId: number,
    attackerLosses: number,
    defenderLosses: number,
    attackerRolls: number[],
    defenderRolls: number[],
    currentTime: number = Date.now()
): BattleRoundResult {
    const result: BattleRoundResult = {
        attackerPlayerId,
        defenderPlayerId,
        attackerLosses,
        defenderLosses,
        attackerRolls,
        defenderRolls,
        timestamp: currentTime,
    };
    
    battle.rounds.push(result);
    
    // Apply losses to participants
    const attacker = battle.participants.find(p => p.playerId === attackerPlayerId);
    const defender = battle.participants.find(p => p.playerId === defenderPlayerId);
    
    if (attacker) {
        attacker.ships = Math.max(0, attacker.ships - attackerLosses);
    }
    if (defender) {
        defender.ships = Math.max(0, defender.ships - defenderLosses);
    }
    
    // Check if battle is resolved
    if (!isBattleActive(battle)) {
        battle.status = 'resolved';
        battle.resolvedTime = currentTime;
        
        const winner = getBattleWinner(battle);
        battle.winnerId = winner ? winner.playerId : null;
    }
    
    return result;
}

/**
 * Get total ships for a player in a battle
 */
export function getPlayerShipsInBattle(battle: Battle, playerId: number): number {
    const participant = battle.participants.find(p => p.playerId === playerId);
    return participant ? participant.ships : 0;
}

/**
 * Get number of active participants in a battle
 */
export function getActiveParticipantCount(battle: Battle): number {
    return battle.participants.filter(p => p.ships > 0).length;
}

