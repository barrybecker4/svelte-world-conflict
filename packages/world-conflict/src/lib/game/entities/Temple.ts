import { GAME_CONSTANTS } from '$lib/game/constants/gameConstants';
import { TEMPLE_UPGRADES, type TempleUpgradeDefinition } from '$lib/game/constants/templeUpgradeDefinitions';

const TEMPLE_LEVELS = ['Basic', 'Minor', 'Major', 'Grand'] as const;

export class Temple {
    regionIndex: number;
    level: number;
    upgradeIndex?: number;

    constructor(regionIndex: number, level: number = 0, upgradeIndex?: number) {
        this.regionIndex = regionIndex;
        this.level = level;
        this.upgradeIndex = upgradeIndex;
    }

    getCurrentUpgrade(): TempleUpgradeDefinition | null {
        if (this.upgradeIndex === undefined) {
            return null;
        }
        return this.getUpgradeByIndex(this.upgradeIndex);
    }

    hasUpgrade(upgradeName: string): boolean {
        const currentUpgrade = this.getCurrentUpgrade();
        return currentUpgrade?.name === upgradeName;
    }

    getDisplayInfo(): { name: string; description: string } {
        if (!this.upgradeIndex) {
            return {
                name: 'Basic Temple',
                description: 'No upgrades'
            };
        }

        const upgrade = this.getCurrentUpgrade();
        if (!upgrade) {
            return {
                name: 'Basic Temple',
                description: 'Unknown upgrade'
            };
        }

        return {
            name: this.getUpgradeFormattedName(upgrade, this.level),
            description: this.getUpgradeFormattedDescription(upgrade, this.level)
        };
    }

    getUpgradeFormattedName(upgrade: TempleUpgradeDefinition, level: number): string {
        const templateLevel = TEMPLE_LEVELS[level] || 'Unknown';
        return upgrade.displayName.replace('{level}', templateLevel);
    }

    getUpgradeFormattedDescription(upgrade: TempleUpgradeDefinition, level: number): string {
        const value = upgrade.level[level];
        return upgrade.description.replace('{value}', value.toString());
    }

    getUpgradeByIndex(index: number): TempleUpgradeDefinition | null {
        return TEMPLE_UPGRADES[index] || null;
    }

    getUpgradeCost(): number {
        const upgrade = this.getCurrentUpgrade();
        if (!upgrade || !this.canUpgrade()) {
            return 0;
        }
        return upgrade.cost[this.level + 1];
    }

    canUpgrade(): boolean {
        // Check if temple has an upgrade type set
        if (this.upgradeIndex === undefined) {
            return false;
        }

        const upgrade = this.getCurrentUpgrade();
        if (!upgrade) {
            return false;
        }

        // Check if there's a cost defined for the next level
        const nextLevel = this.level + 1;
        return upgrade.cost[nextLevel] !== undefined;
    }

    // Apply an upgrade to the temple
    applyUpgrade(upgradeIndex: number): void {
        if (this.upgradeIndex === upgradeIndex) {
            // Same upgrade type - increase level
            if (this.canUpgrade()) {
                this.level++;
            }
        } else {
            // Different upgrade type - replace and reset to level 0
            this.upgradeIndex = upgradeIndex;
            this.level = 0;
        }
    }

    // Remove upgrade (rebuild)
    rebuild(): void {
        delete this.upgradeIndex;
        this.level = 0;
    }

    // Calculate income bonus from this temple
    getIncomeBonus(): number {
        if (this.hasUpgrade('WATER')) {
            const upgrade = this.getCurrentUpgrade();
            return upgrade?.level[this.level] || 0;
        }
        return 0;
    }

    // Calculate defense bonus from this temple
    getDefenseBonus(): number {
        if (this.hasUpgrade('EARTH')) {
            const upgrade = this.getCurrentUpgrade();
            return upgrade?.level[this.level] || 0;
        }
        return 0;
    }

    // Calculate attack bonus from this temple
    getAttackBonus(): number {
        if (this.hasUpgrade('FIRE')) {
            const upgrade = this.getCurrentUpgrade();
            return upgrade?.level[this.level] || 0;
        }
        return 0;
    }

    // Calculate air movement bonus (additional moves)
    getAirBonus(): number {
        if (this.hasUpgrade('AIR')) {
            const upgrade = this.getCurrentUpgrade();
            return upgrade?.level[this.level] || 0;
        }
        return 0;
    }

    // Serialize for storage/network
    serialize(): object {
        return {
            regionIndex: this.regionIndex,
            level: this.level,
            upgradeIndex: this.upgradeIndex
        };
    }

    // Create from serialized data
    static deserialize(data: any): Temple {
        return new Temple(data.regionIndex, data.level, data.upgradeIndex);
    }

    // Create a copy of this temple
    copy(): Temple {
        return new Temple(this.regionIndex, this.level, this.upgradeIndex);
    }
}
