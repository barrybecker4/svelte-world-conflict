import { Command, type CommandValidationResult } from './Command';
import { AttackSequenceGenerator, type AttackEvent } from '$lib/game/mechanics/AttackSequenceGenerator';
import type { GameState, Player, Region, Soldier } from '$lib/game/state/GameState';
import { PlayerEliminationService } from '$lib/game/mechanics/PlayerEliminationService';
import { logger } from '$lib/client/utils/logger';

export class ArmyMoveCommand extends Command {
    public source: number;
    public destination: number;
    public count: number;
    public attackSequence?: AttackEvent[];

    constructor(gameState: GameState, player: Player,
                source: number, destination: number, count: number) {
        super(gameState, player);
        this.source = source;
        this.destination = destination;
        this.count = count;
    }

    validate(): CommandValidationResult {
        const errors: string[] = [];

        if (!this.gameState.isOwnedBy(this.source, this.player)) {
            errors.push("You don't own the source region");
        }

        const availableSoldiers = this.gameState.soldierCount(this.source);
        if (this.count > availableSoldiers) {
            errors.push(`Only ${availableSoldiers} soldiers available`);
        }

        // Check if regions are neighbors (requires regions data)
        const regions = this.gameState.regions;
        const sourceRegion = regions.find((r: Region) => r.index === this.source);
        if (sourceRegion && !sourceRegion.neighbors.includes(this.destination)) {
            errors.push("Destination must be a neighboring region");
        }

        if (this.gameState.conqueredRegions?.includes(this.source)) {
            errors.push("Armies that conquered a region cannot move again this turn");
        }

        if (this.gameState.movesRemaining <= 0) {
            errors.push("No moves remaining");
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }

    execute(): GameState {
      this.previousState = this.gameState.copy() as GameState;
      const newState = this.gameState.copy() as GameState;
      const players = newState.players;

      const targetSoldiers = newState.soldiersAtRegion(this.destination);
      const targetOwner = newState.owner(this.destination);

      // Generate attack sequence for any region with defenders that we don't own
      const needsCombat = targetSoldiers.length > 0 &&
                         (targetOwner === undefined || targetOwner !== this.player.slotIndex);

      if (needsCombat) {
        const generator = new AttackSequenceGenerator({
          source: this.source,
          destination: this.destination,
          count: this.count
        }, newState.rng, this.isSimulation);
        this.attackSequence = generator.createAttackSequenceIfFight(newState, players);

        if (!this.isSimulation) {
          logger.debug('⚔️ Generated attack sequence:', {
            hasSequence: !!this.attackSequence,
            sequenceLength: this.attackSequence?.length || 0
          });
        }
      }

      this.executeMoveLogic(newState);
      return newState;
    }

    private executeMoveLogic(state: GameState): void {
        const fromList = state.soldiersAtRegion(this.source);
        const toList = state.soldiersAtRegion(this.destination);

        const wasEnemyRegion = !state.isOwnedBy(this.destination, this.player) && toList.length > 0;
        const wasNeutralRegion = !state.isOwnedBy(this.destination, this.player) && toList.length === 0;
        const previousOwner = wasEnemyRegion ? state.owner(this.destination) : undefined;

        if (this.attackSequence && this.attackSequence.length > 0) {
            this.handleCombatResult(state, fromList, toList);
        } else {
            // No combat needed - just move soldiers
            this.transferSoldiers(state, fromList, toList, this.count);
        }

        // Check if we conquered the region (defenders eliminated or neutral)
        const conqueredRegion = (wasEnemyRegion && toList.length === 0) || wasNeutralRegion;

        if (conqueredRegion) {
            state.setOwner(this.destination, this.player);

            // Check if the previous owner was eliminated
            if (previousOwner !== undefined && wasEnemyRegion) {
                this.checkPlayerElimination(state, previousOwner);
            }

            // Move remaining attackers to conquered region (after combat with enemy or neutral defenders)
            if ((wasEnemyRegion || wasNeutralRegion) && fromList.length > 0 && this.attackSequence && this.attackSequence.length > 0) {
                const attackersToMove = Math.min(this.count, fromList.length);
                this.transferSoldiers(state, fromList, toList, attackersToMove);
            }

            // Remove temple upgrades when region is conquered
            this.removeTempleUpgrade(state, this.destination);

            // Update conquered regions list
            if (!state.conqueredRegions) {
                state.conqueredRegions = [];
            }
            state.conqueredRegions.push(this.destination);
        }

        state.movesRemaining = Math.max(0, state.movesRemaining - 1);
    }

    /**
     * Check if a player has been eliminated (owns 0 regions)
     */
    private checkPlayerElimination(state: GameState, playerSlotIndex: number): void {
        const gameStateData = state.toJSON();
        
        if (PlayerEliminationService.isPlayerEliminated(gameStateData, playerSlotIndex)) {
            // Player has been eliminated!
            if (!this.isSimulation) {
                logger.debug(`💀 Player ${playerSlotIndex} has been ELIMINATED!`);
            }
            
            // Initialize eliminatedPlayers array if it doesn't exist
            if (!state.state.eliminatedPlayers) {
                state.state.eliminatedPlayers = [];
            }
            
            // Add to eliminated players list if not already there
            if (!state.state.eliminatedPlayers.includes(playerSlotIndex)) {
                state.state.eliminatedPlayers.push(playerSlotIndex);
            }
        }
    }

    /**
     * Remove temple upgrade from a conquered region
     * Resets the temple back to basic (no upgrade, level 0)
     */
    private removeTempleUpgrade(state: GameState, regionIndex: number): void {
        const temple = state.state.templesByRegion[regionIndex];
        
        if (temple && temple.upgradeIndex !== undefined) {
            if (!this.isSimulation) {
                logger.debug(`🏛️ ArmyMoveCommand: Removing temple upgrade at conquered region ${regionIndex}`);
            }
            
            // Reset temple to basic (no upgrade)
            const basicTemple = {
                regionIndex: regionIndex,
                upgradeIndex: undefined,
                level: 0
            };
            
            // Replace the entire templesByRegion object to ensure Svelte reactivity
            state.state.templesByRegion = {
                ...state.state.templesByRegion,
                [regionIndex]: basicTemple
            };
        }
    }

    // Apply attack sequence results
    private handleCombatResult(state: GameState, fromList: Soldier[], toList: Soldier[]): void {
        if (!this.isSimulation) {
            logger.debug('🔍 handleCombatResult - before combat:', {
                attackers: fromList.length,
                defenders: toList.length,
                hasAttackSequence: !!this.attackSequence
            });
        }

        if (!this.attackSequence) return;

        // Apply combat results from attack sequence
        for (const event of this.attackSequence) {
            if (event.attackerCasualties && event.attackerCasualties > 0) {
                for (let i = 0; i < event.attackerCasualties && fromList.length > 0; i++) {
                    fromList.pop();
                }
            }

            if (event.defenderCasualties && event.defenderCasualties > 0) {
                for (let i = 0; i < event.defenderCasualties && toList.length > 0; i++) {
                    toList.pop();
                }
            }
        }

        if (!this.isSimulation) {
            logger.debug('🔍 handleCombatResult - after combat:', {
                attackers: fromList.length,
                defenders: toList.length,
                defendersEliminated: toList.length === 0
            });
        }
    }

    private transferSoldiers(state: GameState, fromList: Soldier[], toList: Soldier[], count: number): void {
        const actualCount = Math.min(count, fromList.length);
        for (let i = 0; i < actualCount; i++) {
            const soldier = fromList.pop();
            if (soldier) {
                toList.push(soldier);
            }
        }
    }

    serialize(): any {
        return {
            type: 'ArmyMoveCommand',
            playerId: this.player.slotIndex,
            source: this.source,
            destination: this.destination,
            count: this.count,
            timestamp: this.timestamp,
            id: this.id,
            attackSequence: this.attackSequence
        };
    }
}
