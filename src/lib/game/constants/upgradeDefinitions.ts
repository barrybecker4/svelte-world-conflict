export interface UpgradeDefinition {
    index: number;
    name: string;
    displayName: string; // For UI display
    description: string;
    cost: number[];
    level: number[];
    bgColor: string;
    // Behavioral flags
    isSoldierUpgrade?: boolean;
    isRebuildUpgrade?: boolean;
    grantsImmediateEffect?: boolean; // For Air upgrade
}

const SOLDIER_COSTS = calcSoldierCosts(8, 16);

function calcSoldierCosts(initial, n) {
    return Array(n).fill().map((x, i) => initial + i)
}

export const UPGRADE_DEFINITIONS: Record<string, UpgradeDefinition> = {
    NONE: {
        index: 0,
        name: 'NONE',
        displayName: 'None',
        description: 'No upgrade',
        cost: [0],
        level: [0],
        bgColor: '#ccc'
    },
    SOLDIER: {
        index: 1,
        name: 'SOLDIER',
        displayName: 'Recruit Soldier',
        description: 'Recruit additional soldiers',
        cost: SOLDIER_COSTS,
        level: [],
        bgColor: '#8df',
        isSoldierUpgrade: true
    },
    WATER: {
        index: 2,
        name: 'WATER',
        displayName: '{level} of Water',
        description: 'Income: {value} extra faith per turn.',
        cost: [15, 25],
        level: [20, 40],
        bgColor: '#8df'
    },
    FIRE: {
        index: 3,
        name: 'FIRE',
        displayName: '{level} of Fire',
        description: 'Attack: Always kill {value} defender(s).',
        cost: [20, 30],
        level: [1, 2],
        bgColor: '#f88'
    },
    AIR: {
        index: 4,
        name: 'AIR',
        displayName: '{level} of Air',
        description: 'Move: {value} extra move(s) per turn.',
        cost: [25, 35],
        level: [1, 2],
        bgColor: '#ffa',
        grantsImmediateEffect: true
    },
    EARTH: {
        index: 5,
        name: 'EARTH',
        displayName: '{level} of Earth',
        description: 'Defense: Always kill {value} invader(s).',
        cost: [30, 45],
        level: [1, 2],
        bgColor: '#696'
    },
    REBUILD: {
        index: 6,
        name: 'REBUILD',
        displayName: 'Rebuild temple',
        description: 'Switch to a different upgrade.',
        cost: [0],
        level: [],
        bgColor: '#666',
        isRebuildUpgrade: true
    }
};

// Export as array for index-based access
export const UPGRADES: UpgradeDefinition[] = Object.values(UPGRADE_DEFINITIONS);

// Export lookup maps for convenience
export const UPGRADES_BY_NAME = UPGRADE_DEFINITIONS;
