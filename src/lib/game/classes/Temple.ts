import {Upgrade} from "$lib/game/classes/Upgrade.ts";

export const TEMPLE_LEVELS = ['Basic', 'Advanced', 'Elite', 'Master'];

// Maximum temple level
export const MAX_TEMPLE_LEVEL = 3;


// Upgrade definitions (matching original game data)
export const UPGRADES: Upgrade[] = [
    // Index 0 - Placeholder/None
    new Upgrade(0, 'NONE', 'No upgrade', [0], [0]),

    // Index 1 - Soldier recruitment
    new Upgrade(
        1,
        'SOLDIER',
        'Recruit additional soldiers',
        [10, 15, 20, 30, 45, 70, 100, 150, 225, 350], // Increasing costs
        [1, 1, 1, 1, 1, 1, 1, 1, 1, 1] // Each purchase gives 1 soldier
    ),

    // Index 2 - Air upgrade (extra moves)
    new Upgrade(
        2,
        'AIR',
        '{level} Air Magic: +{value} move per turn',
        [25, 50, 100], // Cost for levels 0, 1, 2
        [1, 2, 3] // Extra moves granted
    ),

    // Index 3 - Defense upgrade
    new Upgrade(
        3,
        'DEFENSE',
        '{level} Defense Magic: +{value} defense in combat',
        [20, 40, 80],
        [1, 2, 3] // Defense bonus
    ),

    // Index 4 - Income upgrade
    new Upgrade(
        4,
        'INCOME',
        '{level} Economic Magic: +{value} faith per turn',
        [30, 60, 120],
        [5, 10, 20] // Additional faith per turn
    ),

    // Index 5 - Rebuild (remove current upgrade)
    new Upgrade(
        5,
        'REBUILD',
        'Remove current upgrade and start fresh',
        [10, 20, 40], // Cost scales with current temple level
        [0, 0, 0] // No direct benefit, just allows rebuilding
    )
];

export class Temple {
    regionIndex: number;
    level: number;
    upgradeIndex?: number;

    constructor(regionIndex: number, level: number = 0, upgradeIndex?: number) {
        this.regionIndex = regionIndex;
        this.level = level;
        this.upgradeIndex = upgradeIndex;
    }

    // Get the current upgrade type applied to this temple
    getCurrentUpgrade(): Upgrade | null {
        if (this.upgradeIndex === undefined) {
            return null;
        }
        return UPGRADES[this.upgradeIndex] || null;
    }

    // Check if temple has a specific upgrade
    hasUpgrade(upgradeName: string): boolean {
        const currentUpgrade = this.getCurrentUpgrade();
        return currentUpgrade?.name === upgradeName;
    }

    // Get the effective level for a specific upgrade type
    getUpgradeLevel(upgradeName: string): number {
        if (this.hasUpgrade(upgradeName)) {
            return this.level;
        }
        return 0;
    }

    // Get temple display information
    getDisplayInfo(): { name: string; description: string } {
        if (!this.upgradeIndex) {
            return {
                name: "Basic Temple",
                description: "No upgrades"
            };
        }

        const upgrade = this.getCurrentUpgrade();
        if (!upgrade) {
            return {
                name: "Basic Temple",
                description: "Unknown upgrade"
            };
        }

        const levelName = TEMPLE_LEVELS[this.level] || "Unknown";
        const name = upgrade.name.replace('{level}', levelName);
        const description = upgrade.description.replace('{value}', upgrade.level[this.level]?.toString() || '0');

        return { name, description };
    }

    // Check if temple can be upgraded to next level
    canUpgrade(): boolean {
        return this.level < MAX_TEMPLE_LEVEL;
    }

    // Get cost to upgrade to next level
    getUpgradeCost(): number {
        const upgrade = this.getCurrentUpgrade();
        if (!upgrade || !this.canUpgrade()) {
            return 0;
        }
        return upgrade.cost[this.level + 1] || 0;
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
        if (this.hasUpgrade('INCOME')) {
            const upgrade = this.getCurrentUpgrade();
            return upgrade?.level[this.level] || 0;
        }
        return 0;
    }

    // Calculate defense bonus from this temple
    getDefenseBonus(): number {
        if (this.hasUpgrade('DEFENSE')) {
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
