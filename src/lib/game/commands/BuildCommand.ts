import { Command } from "./Command";

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

    validate(): ValidationResult {
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
     * Implementation depends on upgrade system
     * This is a simplified version - you may need to adjust based on your game rules
     */
    private calculateCost(): number {
        const baseCosts = [0, 10, 25, 20, 30, 10]; // NONE, SOLDIER, AIR, DEFENSE, INCOME, REBUILD
        return baseCosts[this.upgradeIndex] || 0;
    }

    execute(): GameState {
        this.previousState = this.gameState.copy() as GameState;
        const newState = this.gameState.copy() as GameState;

        const cost = this.calculateCost();
        newState.faithByPlayer[this.player.slotIndex] = (newState.faithByPlayer[this.player.slotIndex] || 0) - cost;

        const temple = newState.templesByRegion[this.regionIndex];
        if (temple) {
            // Update temple based on upgrade type
            if (this.upgradeIndex === 1) { // SOLDIER upgrade
                // Buy soldier
                newState.numBoughtSoldiers = (newState.numBoughtSoldiers || 0) + 1;
                newState.addSoldiers(this.regionIndex, 1);
            } else if (this.upgradeIndex === 5) { // REBUILD upgrade
                // Rebuild temple
                temple.upgradeIndex = undefined;
                temple.level = 0;
            } else {
                // Other upgrades
                if (temple.upgradeIndex === this.upgradeIndex) {
                    temple.level = (temple.level || 0) + 1;
                } else {
                    temple.upgradeIndex = this.upgradeIndex;
                    temple.level = 0;
                }

                // Air upgrade gives extra move
                if (this.upgradeIndex === 2) { // AIR upgrade
                    newState.movesRemaining++;
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
