export interface UpgradeDefinition {
    index: number;
    name: string;
    desc: string;
    cost: number[];
    level: number[];
    bgColor: string;
}

export const UPGRADES: Record<string, UpgradeDefinition> = {
    NONE: {
        index: 0,
        name: 'None',
        desc: 'No upgrade',
        cost: [0],
        level: [0],
        bgColor: '#ccc'
    },
    SOLDIER: {
        index: 1,
        name: 'Recruit Soldier',
        desc: 'Recruit additional soldiers',
        cost: [10, 15, 20, 30, 45, 70, 100, 150, 225, 350],
        level: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
        bgColor: '#8df'
    },
    WATER: {
        index: 2,
        name: '{level} of Water',
        desc: 'Income: {value} extra faith per turn.',
        cost: [20, 30],
        level: [5, 10],
        bgColor: '#8df'
    },
    FIRE: {
        index: 3,
        name: '{level} of Fire',
        desc: 'Attack: Always kill {value} defender(s).',
        cost: [20, 30],
        level: [1, 2],
        bgColor: '#f88'
    },
    AIR: {
        index: 4,
        name: '{level} of Air',
        desc: 'Move: {value} extra move(s) per turn.',
        cost: [25, 35],
        level: [1, 2],
        bgColor: '#ffa'
    },
    EARTH: {
        index: 5,
        name: '{level} of Earth',
        desc: 'Defense: Always kill {value} invader(s).',
        cost: [30, 45],
        level: [1, 2],
        bgColor: '#696'
    },
    REBUILD: {
        index: 6,
        name: 'Rebuild temple',
        desc: 'Switch to a different upgrade.',
        cost: [0],
        level: [],
        bgColor: '#666'
    }
} as const;
