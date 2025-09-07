import { UPGRADES_BY_NAME } from "$lib/game/constants/upgradeDefinitions";
import type { AiPersonalityData } from "$lib/game/entities/AiPersonality";

export type AiLevel = typeof AI_LEVELS[keyof typeof AI_LEVELS];

export const AI_LEVELS = {
    NICE: 0,
    RUDE: 1,
    MEAN: 2,
    EVIL: 3
} as const;

export const AI_PERSONALITIES: AiPersonalityData[] = [
    {
        name: 'Defender',
        soldierEagerness: 0.5,
        upgradePreference: [UPGRADES_BY_NAME.EARTH.index, UPGRADES_BY_NAME.WATER.index, UPGRADES_BY_NAME.FIRE.index],
        level: AI_LEVELS.NICE
    },
    {
        name: 'Economist',
        soldierEagerness: 0.3,
        upgradePreference: [UPGRADES_BY_NAME.WATER.index, UPGRADES_BY_NAME.AIR.index, UPGRADES_BY_NAME.EARTH.index],
        level: AI_LEVELS.RUDE
    },
    {
        name: 'Aggressor',
        soldierEagerness: 0.8,
        upgradePreference: [UPGRADES_BY_NAME.FIRE.index, UPGRADES_BY_NAME.AIR.index, UPGRADES_BY_NAME.WATER.index],
        level: AI_LEVELS.MEAN
    },
    {
        name: 'Berserker',
        soldierEagerness: 1.0,
        upgradePreference: [UPGRADES_BY_NAME.FIRE.index, UPGRADES_BY_NAME.FIRE.index, UPGRADES_BY_NAME.AIR.index],
        level: AI_LEVELS.EVIL
    }
] as const;