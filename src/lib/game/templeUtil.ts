
// Calculate soldier purchase cost based on number already bought
import {Temple, UPGRADES} from "$lib/game/classes/Temple.ts";
import {Upgrade} from "$lib/game/classes/Upgrade.ts";

// Helper function to get upgrade by name
export function getUpgradeByName(name: string): Upgrade | null {
    return UPGRADES.find(upgrade => upgrade.name === name) || null;
}

// Helper function to get upgrade by index
export function getUpgradeByIndex(index: number): Upgrade | null {
    return UPGRADES[index] || null;
}

export function calculateSoldierCost(numBoughtSoldiers: number): number {
    const soldierUpgrade = getUpgradeByName('SOLDIER');
    return soldierUpgrade?.getCostForLevel(numBoughtSoldiers) || 0;
}

// Get all available upgrades for a temple (excluding special cases)
export function getAvailableUpgrades(temple: Temple, playerUpgradeLevels: Map<string, number>): Upgrade[] {
    const available: Upgrade[] = [];

    for (const upgrade of UPGRADES.slice(1)) { // Skip index 0 (NONE)
        // Skip soldier upgrade - handled separately
        if (upgrade.isSoldierUpgrade()) {
            available.push(upgrade);
            continue;
        }

        // Skip rebuild if temple has no upgrade
        if (upgrade.isRebuildUpgrade() && !temple.upgradeIndex) {
            continue;
        }

        // Skip if temple is at max level for this upgrade
        if (temple.upgradeIndex === upgrade.index && temple.level >= upgrade.getMaxLevel()) {
            continue;
        }

        // Skip if player already has this upgrade at a higher level elsewhere
        const currentLevel = temple.getUpgradeLevel(upgrade.name);
        const playerMaxLevel = playerUpgradeLevels.get(upgrade.name) || 0;
        if (currentLevel < playerMaxLevel) {
            continue;
        }

        // Skip if temple has different upgrade (except soldier and rebuild)
        const currentUpgrade = temple.getCurrentUpgrade();
        if (currentUpgrade &&
            currentUpgrade.name !== upgrade.name &&
            !upgrade.isSoldierUpgrade() &&
            !upgrade.isRebuildUpgrade()) {
            continue;
        }

        available.push(upgrade);
    }

    return available;
}

// Calculate total upgrade effects for a player
export function calculatePlayerUpgradeEffects(temples: Temple[]): {
    totalIncomeBonus: number;
    totalAirBonus: number;
    maxDefenseBonus: number;
} {
    let totalIncomeBonus = 0;
    let totalAirBonus = 0;
    let maxDefenseBonus = 0;

    for (const temple of temples) {
        totalIncomeBonus += temple.getIncomeBonus();
        totalAirBonus += temple.getAirBonus();
        maxDefenseBonus = Math.max(maxDefenseBonus, temple.getDefenseBonus());
    }

    return {
        totalIncomeBonus,
        totalAirBonus,
        maxDefenseBonus
    };
}
