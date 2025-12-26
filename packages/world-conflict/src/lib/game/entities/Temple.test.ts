/**
 * Unit tests for Temple entity
 * Tests temple upgrades, bonuses, and serialization
 */

import { describe, it, expect } from 'vitest';
import { Temple } from './Temple';
import { TEMPLE_UPGRADES_BY_NAME } from '$lib/game/constants/templeUpgradeDefinitions';

describe('Temple', () => {
    describe('constructor', () => {
        it('should create a basic temple with default values', () => {
            const temple = new Temple(0);

            expect(temple.regionIndex).toBe(0);
            expect(temple.level).toBe(0);
            expect(temple.upgradeIndex).toBeUndefined();
        });

        it('should create a temple with specified level', () => {
            const temple = new Temple(5, 2);

            expect(temple.regionIndex).toBe(5);
            expect(temple.level).toBe(2);
        });

        it('should create a temple with specified upgrade', () => {
            const temple = new Temple(3, 1, TEMPLE_UPGRADES_BY_NAME.WATER.index);

            expect(temple.regionIndex).toBe(3);
            expect(temple.level).toBe(1);
            expect(temple.upgradeIndex).toBe(TEMPLE_UPGRADES_BY_NAME.WATER.index);
        });
    });

    describe('getCurrentUpgrade', () => {
        it('should return null for temple without upgrade', () => {
            const temple = new Temple(0);

            expect(temple.getCurrentUpgrade()).toBeNull();
        });

        it('should return upgrade definition for upgraded temple', () => {
            const temple = new Temple(0, 1, TEMPLE_UPGRADES_BY_NAME.FIRE.index);

            const upgrade = temple.getCurrentUpgrade();
            expect(upgrade).not.toBeNull();
            expect(upgrade!.name).toBe('FIRE');
        });
    });

    describe('hasUpgrade', () => {
        it('should return false when temple has no upgrade', () => {
            const temple = new Temple(0);

            expect(temple.hasUpgrade('WATER')).toBe(false);
            expect(temple.hasUpgrade('FIRE')).toBe(false);
        });

        it('should return true for matching upgrade', () => {
            const temple = new Temple(0, 1, TEMPLE_UPGRADES_BY_NAME.WATER.index);

            expect(temple.hasUpgrade('WATER')).toBe(true);
        });

        it('should return false for non-matching upgrade', () => {
            const temple = new Temple(0, 1, TEMPLE_UPGRADES_BY_NAME.WATER.index);

            expect(temple.hasUpgrade('FIRE')).toBe(false);
            expect(temple.hasUpgrade('EARTH')).toBe(false);
        });
    });

    describe('canUpgrade', () => {
        it('should return false for temple without upgrade type', () => {
            const temple = new Temple(0);

            expect(temple.canUpgrade()).toBe(false);
        });

        it('should return true for temple at level 0 with valid upgrade', () => {
            const temple = new Temple(0, 0, TEMPLE_UPGRADES_BY_NAME.WATER.index);

            expect(temple.canUpgrade()).toBe(true);
        });

        it('should return true for temple at level 1 with upgrade that has level 2', () => {
            // Water has levels [0, 1] -> costs [15, 25]
            const temple = new Temple(0, 0, TEMPLE_UPGRADES_BY_NAME.WATER.index);

            expect(temple.canUpgrade()).toBe(true);
        });

        it('should return false for temple at max level', () => {
            // Water upgrade has levels 0, 1 (costs at indices 0, 1)
            // At level 1, next would be level 2, but no cost defined
            const temple = new Temple(0, 1, TEMPLE_UPGRADES_BY_NAME.WATER.index);

            expect(temple.canUpgrade()).toBe(false);
        });
    });

    describe('getUpgradeCost', () => {
        it('should return 0 for temple without upgrade', () => {
            const temple = new Temple(0);

            expect(temple.getUpgradeCost()).toBe(0);
        });

        it('should return correct cost for level 0 -> 1 upgrade', () => {
            // Water upgrade: cost[1] = 25 (upgrading from level 0 to level 1)
            const temple = new Temple(0, 0, TEMPLE_UPGRADES_BY_NAME.WATER.index);

            expect(temple.getUpgradeCost()).toBe(25);
        });

        it('should return 0 when at max level', () => {
            const temple = new Temple(0, 1, TEMPLE_UPGRADES_BY_NAME.WATER.index);

            expect(temple.getUpgradeCost()).toBe(0);
        });
    });

    describe('applyUpgrade', () => {
        it('should set upgrade type on basic temple', () => {
            const temple = new Temple(0);
            temple.applyUpgrade(TEMPLE_UPGRADES_BY_NAME.FIRE.index);

            expect(temple.upgradeIndex).toBe(TEMPLE_UPGRADES_BY_NAME.FIRE.index);
            expect(temple.level).toBe(0);
        });

        it('should increase level when applying same upgrade', () => {
            const temple = new Temple(0, 0, TEMPLE_UPGRADES_BY_NAME.WATER.index);
            temple.applyUpgrade(TEMPLE_UPGRADES_BY_NAME.WATER.index);

            expect(temple.upgradeIndex).toBe(TEMPLE_UPGRADES_BY_NAME.WATER.index);
            expect(temple.level).toBe(1);
        });

        it('should reset level when applying different upgrade', () => {
            const temple = new Temple(0, 2, TEMPLE_UPGRADES_BY_NAME.FIRE.index);
            temple.applyUpgrade(TEMPLE_UPGRADES_BY_NAME.WATER.index);

            expect(temple.upgradeIndex).toBe(TEMPLE_UPGRADES_BY_NAME.WATER.index);
            expect(temple.level).toBe(0);
        });

        it('should not increase level beyond what canUpgrade allows', () => {
            // Set temple to max level for Water (level 1)
            const temple = new Temple(0, 1, TEMPLE_UPGRADES_BY_NAME.WATER.index);
            temple.applyUpgrade(TEMPLE_UPGRADES_BY_NAME.WATER.index);

            // Level should stay at 1 (can't upgrade further)
            expect(temple.level).toBe(1);
        });
    });

    describe('rebuild', () => {
        it('should reset upgrade and level', () => {
            const temple = new Temple(0, 2, TEMPLE_UPGRADES_BY_NAME.EARTH.index);
            temple.rebuild();

            expect(temple.upgradeIndex).toBeUndefined();
            expect(temple.level).toBe(0);
        });

        it('should work on basic temple', () => {
            const temple = new Temple(0);
            temple.rebuild();

            expect(temple.upgradeIndex).toBeUndefined();
            expect(temple.level).toBe(0);
        });
    });

    describe('getIncomeBonus', () => {
        it('should return 0 for temple without upgrade', () => {
            const temple = new Temple(0);

            expect(temple.getIncomeBonus()).toBe(0);
        });

        it('should return 0 for non-Water temple', () => {
            const temple = new Temple(0, 1, TEMPLE_UPGRADES_BY_NAME.FIRE.index);

            expect(temple.getIncomeBonus()).toBe(0);
        });

        it('should return correct bonus for Water temple level 0', () => {
            // Water level[0] = 20
            const temple = new Temple(0, 0, TEMPLE_UPGRADES_BY_NAME.WATER.index);

            expect(temple.getIncomeBonus()).toBe(20);
        });

        it('should return correct bonus for Water temple level 1', () => {
            // Water level[1] = 40
            const temple = new Temple(0, 1, TEMPLE_UPGRADES_BY_NAME.WATER.index);

            expect(temple.getIncomeBonus()).toBe(40);
        });
    });

    describe('getDefenseBonus', () => {
        it('should return 0 for temple without upgrade', () => {
            const temple = new Temple(0);

            expect(temple.getDefenseBonus()).toBe(0);
        });

        it('should return 0 for non-Earth temple', () => {
            const temple = new Temple(0, 1, TEMPLE_UPGRADES_BY_NAME.WATER.index);

            expect(temple.getDefenseBonus()).toBe(0);
        });

        it('should return correct bonus for Earth temple level 0', () => {
            // Earth level[0] = 1
            const temple = new Temple(0, 0, TEMPLE_UPGRADES_BY_NAME.EARTH.index);

            expect(temple.getDefenseBonus()).toBe(1);
        });

        it('should return correct bonus for Earth temple level 1', () => {
            // Earth level[1] = 2
            const temple = new Temple(0, 1, TEMPLE_UPGRADES_BY_NAME.EARTH.index);

            expect(temple.getDefenseBonus()).toBe(2);
        });
    });

    describe('getAttackBonus', () => {
        it('should return 0 for temple without upgrade', () => {
            const temple = new Temple(0);

            expect(temple.getAttackBonus()).toBe(0);
        });

        it('should return 0 for non-Fire temple', () => {
            const temple = new Temple(0, 1, TEMPLE_UPGRADES_BY_NAME.EARTH.index);

            expect(temple.getAttackBonus()).toBe(0);
        });

        it('should return correct bonus for Fire temple level 0', () => {
            // Fire level[0] = 1
            const temple = new Temple(0, 0, TEMPLE_UPGRADES_BY_NAME.FIRE.index);

            expect(temple.getAttackBonus()).toBe(1);
        });

        it('should return correct bonus for Fire temple level 1', () => {
            // Fire level[1] = 2
            const temple = new Temple(0, 1, TEMPLE_UPGRADES_BY_NAME.FIRE.index);

            expect(temple.getAttackBonus()).toBe(2);
        });
    });

    describe('getAirBonus', () => {
        it('should return 0 for temple without upgrade', () => {
            const temple = new Temple(0);

            expect(temple.getAirBonus()).toBe(0);
        });

        it('should return 0 for non-Air temple', () => {
            const temple = new Temple(0, 1, TEMPLE_UPGRADES_BY_NAME.FIRE.index);

            expect(temple.getAirBonus()).toBe(0);
        });

        it('should return correct bonus for Air temple level 0', () => {
            // Air level[0] = 1
            const temple = new Temple(0, 0, TEMPLE_UPGRADES_BY_NAME.AIR.index);

            expect(temple.getAirBonus()).toBe(1);
        });

        it('should return correct bonus for Air temple level 1', () => {
            // Air level[1] = 2
            const temple = new Temple(0, 1, TEMPLE_UPGRADES_BY_NAME.AIR.index);

            expect(temple.getAirBonus()).toBe(2);
        });
    });

    describe('serialize and deserialize', () => {
        it('should serialize basic temple correctly', () => {
            const temple = new Temple(5);
            const serialized = temple.serialize();

            expect(serialized).toEqual({
                regionIndex: 5,
                level: 0,
                upgradeIndex: undefined
            });
        });

        it('should serialize upgraded temple correctly', () => {
            const temple = new Temple(3, 2, TEMPLE_UPGRADES_BY_NAME.FIRE.index);
            const serialized = temple.serialize();

            expect(serialized).toEqual({
                regionIndex: 3,
                level: 2,
                upgradeIndex: TEMPLE_UPGRADES_BY_NAME.FIRE.index
            });
        });

        it('should deserialize temple correctly', () => {
            const data = {
                regionIndex: 7,
                level: 1,
                upgradeIndex: TEMPLE_UPGRADES_BY_NAME.EARTH.index
            };

            const temple = Temple.deserialize(data);

            expect(temple.regionIndex).toBe(7);
            expect(temple.level).toBe(1);
            expect(temple.upgradeIndex).toBe(TEMPLE_UPGRADES_BY_NAME.EARTH.index);
        });

        it('should round-trip serialize/deserialize correctly', () => {
            const original = new Temple(10, 1, TEMPLE_UPGRADES_BY_NAME.WATER.index);
            const serialized = original.serialize();
            const restored = Temple.deserialize(serialized);

            expect(restored.regionIndex).toBe(original.regionIndex);
            expect(restored.level).toBe(original.level);
            expect(restored.upgradeIndex).toBe(original.upgradeIndex);
            expect(restored.getIncomeBonus()).toBe(original.getIncomeBonus());
        });
    });

    describe('copy', () => {
        it('should create independent copy', () => {
            const original = new Temple(5, 1, TEMPLE_UPGRADES_BY_NAME.FIRE.index);
            const copy = original.copy();

            // Verify copy has same values
            expect(copy.regionIndex).toBe(original.regionIndex);
            expect(copy.level).toBe(original.level);
            expect(copy.upgradeIndex).toBe(original.upgradeIndex);

            // Modify copy and verify original unchanged
            copy.level = 2;
            copy.upgradeIndex = TEMPLE_UPGRADES_BY_NAME.WATER.index;

            expect(original.level).toBe(1);
            expect(original.upgradeIndex).toBe(TEMPLE_UPGRADES_BY_NAME.FIRE.index);
        });
    });

    describe('getDisplayInfo', () => {
        it('should return basic temple info when no upgrade', () => {
            const temple = new Temple(0);
            const info = temple.getDisplayInfo();

            expect(info.name).toBe('Basic Temple');
            expect(info.description).toBe('No upgrades');
        });

        it('should return formatted name for Water temple', () => {
            const temple = new Temple(0, 0, TEMPLE_UPGRADES_BY_NAME.WATER.index);
            const info = temple.getDisplayInfo();

            expect(info.name).toContain('Water');
            expect(info.description).toContain('20%'); // Level 0 Water bonus
        });

        it('should return formatted name for Fire temple at level 1', () => {
            const temple = new Temple(0, 1, TEMPLE_UPGRADES_BY_NAME.FIRE.index);
            const info = temple.getDisplayInfo();

            expect(info.name).toContain('Fire');
            expect(info.description).toContain('2'); // Level 1 Fire damage
        });
    });

    describe('getUpgradeByIndex', () => {
        it('should return upgrade definition for valid index', () => {
            const temple = new Temple(0);

            const waterUpgrade = temple.getUpgradeByIndex(TEMPLE_UPGRADES_BY_NAME.WATER.index);
            expect(waterUpgrade).not.toBeNull();
            expect(waterUpgrade!.name).toBe('WATER');

            const fireUpgrade = temple.getUpgradeByIndex(TEMPLE_UPGRADES_BY_NAME.FIRE.index);
            expect(fireUpgrade).not.toBeNull();
            expect(fireUpgrade!.name).toBe('FIRE');
        });

        it('should return null for invalid index', () => {
            const temple = new Temple(0);

            expect(temple.getUpgradeByIndex(999)).toBeNull();
            expect(temple.getUpgradeByIndex(-1)).toBeNull();
        });
    });
});
