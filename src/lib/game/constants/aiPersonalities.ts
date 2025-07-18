import { UPGRADES } from "$lib/game/constants/upgradeDefinitions.ts";
import type { AiPersonalityData } from "$lib/game/classes/AiPersonality.ts";

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
        upgradePreference: [UPGRADES.EARTH.index, UPGRADES.WATER.index, UPGRADES.FIRE.index],
        level: AI_LEVELS.NICE
    },
    {
        name: 'Economist',
        soldierEagerness: 0.3,
        upgradePreference: [UPGRADES.WATER.index, UPGRADES.AIR.index, UPGRADES.EARTH.index],
        level: AI_LEVELS.RUDE
    },
    {
        name: 'Aggressor',
        soldierEagerness: 0.8,
        upgradePreference: [UPGRADES.FIRE.index, UPGRADES.AIR.index, UPGRADES.WATER.index],
        level: AI_LEVELS.MEAN
    },
    {
        name: 'Berserker',
        soldierEagerness: 1.0,
        upgradePreference: [UPGRADES.FIRE.index, UPGRADES.FIRE.index, UPGRADES.AIR.index],
        level: AI_LEVELS.EVIL
    }
] as const;
