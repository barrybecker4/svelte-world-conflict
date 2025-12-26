import { Command, type CommandValidationResult } from './Command';
import type { GameState, Player } from '$lib/game/state/GameState';
import { TEMPLE_UPGRADES_BY_NAME, type TempleUpgradeDefinition } from '$lib/game/constants/templeUpgradeDefinitions';
import { logger } from 'multiplayer-framework/shared';

export class BuildCommand extends Command {
    public regionIndex: number;
    public upgradeIndex: number;

    constructor(gameState: GameState, player: Player, regionIndex: number, upgradeIndex: number) {
        super(gameState, player);
        this.regionIndex = regionIndex;
        this.upgradeIndex = upgradeIndex;
    }

    validate(): CommandValidationResult {
        const errors: string[] = [];

        if (!this.gameState.isOwnedBy(this.regionIndex, this.player)) {
            errors.push("You don't own this region");
        }

        const temple = this.gameState.templesByRegion[this.regionIndex];
        if (!temple) {
            errors.push('No temple at this region');
        }

        const cost = this.calculateCost();
        const playerFaith = this.gameState.faithByPlayer[this.player.slotIndex] || 0;
        if (cost > playerFaith) {
            errors.push(`Need ${cost} faith, have ${playerFaith}`);
        }

        if (errors.length > 0) {
            logger.debug('❌ BuildCommand validation failed:', errors);
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }

    /**
     * Get the upgrade definition for the current upgrade index
     */
    private getUpgradeDefinition(): TempleUpgradeDefinition | undefined {
        return Object.values(TEMPLE_UPGRADES_BY_NAME).find(u => u.index === this.upgradeIndex);
    }

    /**
     * Calculate the cost of the upgrade based on upgrade type and current state
     */
    private calculateCost(): number {
        const temple = this.gameState.templesByRegion[this.regionIndex];

        // Special case: SOLDIER upgrade has dynamic pricing
        if (this.upgradeIndex === TEMPLE_UPGRADES_BY_NAME.SOLDIER.index) {
            const numBought = this.gameState.state.numBoughtSoldiers || 0;
            const costArray = TEMPLE_UPGRADES_BY_NAME.SOLDIER.cost;
            // If we've exhausted the array, use formula: initialCost + numBought
            return costArray[numBought] ?? 8 + numBought;
        }

        // Special case: REBUILD is free
        if (this.upgradeIndex === TEMPLE_UPGRADES_BY_NAME.REBUILD.index) {
            return 0;
        }

        // For temple upgrades (WATER, FIRE, AIR, EARTH)
        const upgrade = this.getUpgradeDefinition();
        if (!upgrade?.cost) {
            return 0;
        }

        // Cost depends on whether we're upgrading same type or switching
        if (temple?.upgradeIndex === this.upgradeIndex) {
            // Upgrading to next level of same type
            return upgrade.cost[temple.level + 1] || 0;
        } else {
            // New temple type - cost for level 0
            return upgrade.cost[0] || 0;
        }
    }

    execute(): GameState {
        this.previousState = this.gameState.copy() as GameState;
        const newState = this.gameState.copy() as GameState;

        const cost = this.calculateCost();
        const currentFaith = newState.getPlayerFaith(this.player.slotIndex);
        newState.setPlayerFaith(this.player.slotIndex, currentFaith - cost);

        const temple = newState.state.templesByRegion[this.regionIndex];
        if (temple) {
            // Update temple based on upgrade type
            if (this.upgradeIndex === TEMPLE_UPGRADES_BY_NAME.SOLDIER.index) {
                // Buy soldier and increment counter
                newState.state.numBoughtSoldiers = (newState.state.numBoughtSoldiers || 0) + 1;
                newState.addSoldiers(this.regionIndex, 1);
            } else if (this.upgradeIndex === TEMPLE_UPGRADES_BY_NAME.REBUILD.index) {
                // Rebuild temple - reset to basic
                // Create new temple object for Svelte reactivity
                const rebuiltTemple = {
                    regionIndex: this.regionIndex,
                    upgradeIndex: undefined,
                    level: 0
                };

                // Replace the entire templesByRegion object to ensure Svelte reactivity
                newState.state.templesByRegion = {
                    ...newState.state.templesByRegion,
                    [this.regionIndex]: rebuiltTemple
                };
            } else {
                // Temple upgrades (WATER, FIRE, AIR, EARTH)
                let newLevel: number;
                let newUpgradeIndex: number;

                if (temple.upgradeIndex === this.upgradeIndex) {
                    // Same type - upgrade to next level
                    newLevel = (temple.level || 0) + 1;
                    newUpgradeIndex = this.upgradeIndex;
                } else {
                    // Different type - switch to new upgrade at level 0
                    newLevel = 0;
                    newUpgradeIndex = this.upgradeIndex;
                }

                logger.debug(`🏛️ BuildCommand: Upgrading temple at region ${this.regionIndex}`, {
                    oldLevel: temple.level,
                    oldUpgradeIndex: temple.upgradeIndex,
                    newLevel,
                    newUpgradeIndex
                });

                // Create new temple object for Svelte reactivity
                const updatedTemple = {
                    regionIndex: this.regionIndex,
                    level: newLevel,
                    upgradeIndex: newUpgradeIndex
                };

                // IMPORTANT: Replace the entire templesByRegion object to ensure Svelte reactivity
                // Shallow copying the Record ensures a new reference that Svelte can detect
                newState.state.templesByRegion = {
                    ...newState.state.templesByRegion,
                    [this.regionIndex]: updatedTemple
                };

                logger.debug(`🏛️ BuildCommand: Updated temple object`, updatedTemple);
                logger.debug(
                    `🏛️ BuildCommand: Verification - temple in newState:`,
                    newState.state.templesByRegion[this.regionIndex]
                );

                // Air upgrade gives immediate extra move
                if (this.upgradeIndex === TEMPLE_UPGRADES_BY_NAME.AIR.index) {
                    const airUpgrade = TEMPLE_UPGRADES_BY_NAME.AIR;
                    if (airUpgrade.grantsImmediateEffect) {
                        const extraMoves = airUpgrade.level[newLevel] || 0;
                        newState.state.movesRemaining += extraMoves;
                    }
                }
            }
        }

        return newState;
    }

    serialize(): any {
        return {
            type: 'BuildCommand',
            playerId: this.player.slotIndex,
            regionIndex: this.regionIndex,
            upgradeIndex: this.upgradeIndex,
            timestamp: this.timestamp,
            id: this.id
        };
    }
}
