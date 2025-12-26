export interface TempleColorScheme {
    base: string;
    dark: string;
    light: string;
    disc: string;
}

export interface TempleUpgradeDefinition {
    index: number;
    name: string;
    displayName: string; // For UI display
    description: string;
    cost: number[];
    level: number[];
    bgColor: string;
    templeColors?: TempleColorScheme; // Visual colors for the temple on map
    // Behavioral flags
    isSoldierUpgrade?: boolean;
    isRebuildUpgrade?: boolean;
    grantsImmediateEffect?: boolean; // For Air upgrade
}

const SOLDIER_COSTS = calcSoldierCosts(8, 30);

function calcSoldierCosts(initial: number, n: number): number[] {
    return Array(n).fill(0).map((x, i) => initial + i);
}

export const TEMPLE_UPGRADE_DEFINITIONS: Record<string, TempleUpgradeDefinition> = {
    NONE: {
        index: 0,
        name: 'NONE',
        displayName: 'None',
        description: 'No upgrade',
        cost: [0],
        level: [0],
        bgColor: '#ccc',
        templeColors: {
            base: '#9ca3af',    // Gray
            dark: '#6b7280',
            light: '#d1d5db',
            disc: '#9ca3af'
        }
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
        description: 'Income: {value}% more each turn.',
        cost: [15, 25],
        level: [20, 40],
        bgColor: '#8df',
        templeColors: {
            base: '#3b82f6',    // Blue
            dark: '#1e40af',
            light: '#60a5fa',
            disc: '#3b82f6'
        }
    },
    FIRE: {
        index: 3,
        name: 'FIRE',
        displayName: '{level} of Fire',
        description: 'Attack: Always kill {value} defender(s).',
        cost: [20, 30],
        level: [1, 2],
        bgColor: '#f88',
        templeColors: {
            base: '#ef4444',    // Red
            dark: '#b91c1c',
            light: '#f87171',
            disc: '#ef4444'
        }
    },
    AIR: {
        index: 4,
        name: 'AIR',
        displayName: '{level} of Air',
        description: 'Move: {value} extra move(s) per turn.',
        cost: [25, 35],
        level: [1, 2],
        bgColor: '#ffa',
        grantsImmediateEffect: true,
        templeColors: {
            base: '#fde047',    // Light yellow
            dark: '#facc15',
            light: '#fef08a',
            disc: '#fde047'
        }
    },
    EARTH: {
        index: 5,
        name: 'EARTH',
        displayName: '{level} of Earth',
        description: 'Defense: Always kill {value} invader(s).',
        cost: [30, 45],
        level: [1, 2],
        bgColor: '#696',
        templeColors: {
            base: '#22c55e',    // Dark green
            dark: '#15803d',
            light: '#4ade80',
            disc: '#22c55e'
        }
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
export const TEMPLE_UPGRADES: TempleUpgradeDefinition[] = Object.values(TEMPLE_UPGRADE_DEFINITIONS);

// Export lookup maps for convenience
export const TEMPLE_UPGRADES_BY_NAME = TEMPLE_UPGRADE_DEFINITIONS;

// Default color scheme for temples without upgrades
export const DEFAULT_TEMPLE_COLORS: TempleColorScheme = TEMPLE_UPGRADE_DEFINITIONS.NONE.templeColors!;
