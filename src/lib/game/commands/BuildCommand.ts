import { Command, type CommandValidationResult } from "./Command";
import type { GameState, Player } from "$lib/game/state/GameState";
import { TEMPLE_UPGRADES_BY_NAME } from "$lib/game/constants/templeUpgradeDefinitions";

export class BuildCommand extends Command {
    public regionIndex: number;
    public upgradeIndex: number;

    constructor(
        gameState: GameState,
        player: Player,
        regionIndex: number,
        upgradeIndex: number
    ) {
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
            errors.push("No temple at this region");
        }

        const cost = this.calculateCost();
        const playerFaith = this.gameState.faithByPlayer[this.player.slotIndex] || 0;
        if (cost > playerFaith) {
            errors.push(`Need ${cost} faith, have ${playerFaith}`);
        }

        return {
            valid: errors.length === 0,
            errors
        };
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
            return costArray[numBought];
        }

        // Special case: REBUILD is free
        if (this.upgradeIndex === TEMPLE_UPGRADES_BY_NAME.REBUILD.index) {
            return 0;
        }

        // For temple upgrades (WATER, FIRE, AIR, EARTH)
        // Cost depends on whether we're upgrading same type or switching
        if (temple?.upgradeIndex === this.upgradeIndex) {
            // Upgrading to next level of same type
            const upgrade = Object.values(TEMPLE_UPGRADES_BY_NAME).find(u => u.index === this.upgradeIndex);
            if (upgrade && upgrade.cost) {
                return upgrade.cost[temple.level + 1] || 0;
            }
        } else {
            // New temple type - cost for level 0
            const upgrade = Object.values(TEMPLE_UPGRADES_BY_NAME).find(u => u.index === this.upgradeIndex);
            if (upgrade && upgrade.cost) {
                return upgrade.cost[0] || 0;
            }
        }

        return 0;
    }

    execute(): GameState {
        this.previousState = this.gameState.copy() as GameState;
        const newState = this.gameState.copy() as GameState;

        const cost = this.calculateCost();
        const currentFaith = newState.getPlayerFaith(this.player.slotIndex);
        newState.setPlayerFaith(this.player.slotIndex, currentFaith - cost);

        const temple = newState.templesByRegion[this.regionIndex];
        if (temple) {
            // Update temple based on upgrade type
            if (this.upgradeIndex === TEMPLE_UPGRADES_BY_NAME.SOLDIER.index) {
                // Buy soldier and increment counter
                newState.state.numBoughtSoldiers = (newState.state.numBoughtSoldiers || 0) + 1;
                newState.addSoldiers(this.regionIndex, 1);
            } else if (this.upgradeIndex === TEMPLE_UPGRADES_BY_NAME.REBUILD.index) {
                // Rebuild temple - reset to basic
                temple.upgradeIndex = undefined;
                temple.level = 0;
            } else {
                // Temple upgrades (WATER, FIRE, AIR, EARTH)
                if (temple.upgradeIndex === this.upgradeIndex) {
                    // Same type - upgrade to next level
                    temple.level = (temple.level || 0) + 1;
                } else {
                    // Different type - switch to new upgrade at level 0
                    temple.upgradeIndex = this.upgradeIndex;
                    temple.level = 0;
                }

                // Air upgrade gives immediate extra move
                if (this.upgradeIndex === TEMPLE_UPGRADES_BY_NAME.AIR.index) {
                    const airUpgrade = TEMPLE_UPGRADES_BY_NAME.AIR;
                    if (airUpgrade.grantsImmediateEffect) {
                        const extraMoves = airUpgrade.level[temple.level] || 0;
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
