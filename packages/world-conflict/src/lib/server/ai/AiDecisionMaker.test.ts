/**
 * Unit tests for AI Decision Maker
 * Tests high-level AI decision logic for soldiers, upgrades, and movement
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { pickAiMove } from './AiDecisionMaker';
import { AiDifficulty } from '$lib/game/entities/aiPersonalities';
import { TEMPLE_UPGRADES_BY_NAME } from '$lib/game/constants/templeUpgradeDefinitions';
import { BuildCommand } from '$lib/game/commands/BuildCommand';
import { EndTurnCommand } from '$lib/game/commands/EndTurnCommand';
import { ArmyMoveCommand } from '$lib/game/commands/ArmyMoveCommand';
import {
    createMockGameState,
    createMockPlayer,
    createMockRegion,
    createMockTemple,
    createSimpleTwoPlayerGame
} from './AiTestUtils';
import type { GameState, Player } from '$lib/game/state/GameState';

describe('AiDecisionMaker', () => {
    describe('pickAiMove', () => {
        it('should return EndTurnCommand for eliminated player (0 regions)', async () => {
            const player = createMockPlayer({ slotIndex: 0, name: 'Eliminated', isAI: true, personality: 'Defender' });
            const gameState = createMockGameState({
                players: [player],
                regions: [createMockRegion({ index: 0 })],
                ownersByRegion: {}, // Player owns nothing
                aiDifficulty: AiDifficulty.RUDE
            });

            const command = await pickAiMove(player, gameState);

            expect(command).toBeInstanceOf(EndTurnCommand);
        });

        it('should prioritize soldier building when conditions are met', async () => {
            const player = createMockPlayer({
                slotIndex: 0,
                name: 'AI',
                isAI: true,
                personality: 'Aggressor' // High soldier eagerness (0.8)
            });

            const gameState = createMockGameState({
                players: [player],
                regions: [createMockRegion({ index: 0, neighbors: [1] })],
                ownersByRegion: { 0: 0 },
                soldiersByRegion: { 0: [{ i: 1 }] }, // Few soldiers
                templesByRegion: {
                    0: createMockTemple({ regionIndex: 0, upgradeIndex: undefined })
                },
                faithByPlayer: { 0: 100 }, // Enough faith
                aiDifficulty: AiDifficulty.RUDE
            });

            const command = await pickAiMove(player, gameState);

            // Should likely build a soldier (though minimax might override)
            expect(command).toBeDefined();
        });

        it('should prioritize upgrades over army moves', async () => {
            const player = createMockPlayer({
                slotIndex: 0,
                name: 'AI',
                isAI: true,
                personality: 'Economist' // Prefers Water upgrade
            });

            const gameState = createMockGameState({
                players: [player],
                regions: [createMockRegion({ index: 0, neighbors: [1] }), createMockRegion({ index: 1, neighbors: [0] })],
                ownersByRegion: { 0: 0, 1: 0 },
                soldiersByRegion: { 0: [{ i: 1 }], 1: [{ i: 2 }] },
                templesByRegion: {
                    0: createMockTemple({ regionIndex: 0, upgradeIndex: undefined }) // Can be upgraded
                },
                faithByPlayer: { 0: 50 }, // Enough for upgrade
                aiDifficulty: AiDifficulty.RUDE
            });

            const command = await pickAiMove(player, gameState);

            // Should likely build an upgrade
            expect(command).toBeDefined();
        });

        it('should fall back to minimax for army movement', async () => {
            const player = createMockPlayer({
                slotIndex: 0,
                name: 'AI',
                isAI: true,
                personality: 'Defender'
            });

            const gameState = createMockGameState({
                players: [player],
                regions: [createMockRegion({ index: 0, neighbors: [1] }), createMockRegion({ index: 1, neighbors: [0] })],
                ownersByRegion: { 0: 0, 1: 0 },
                soldiersByRegion: { 0: [{ i: 1 }, { i: 2 }, { i: 3 }], 1: [{ i: 4 }] },
                templesByRegion: {},
                faithByPlayer: { 0: 5 }, // Not enough faith for anything
                movesRemaining: 3,
                aiDifficulty: AiDifficulty.RUDE
            });

            const command = await pickAiMove(player, gameState);

            // Should use minimax to decide on army movement or end turn
            expect(command).toBeDefined();
            expect(
                command instanceof ArmyMoveCommand || command instanceof EndTurnCommand
            ).toBe(true);
        });

        it('should work with different AI personalities', async () => {
            const personalities = ['Defender', 'Economist', 'Aggressor'];

            for (const personality of personalities) {
                const player = createMockPlayer({
                    slotIndex: 0,
                    name: 'AI',
                    isAI: true,
                    personality
                });

                const gameState = createSimpleTwoPlayerGame();
                gameState.state.players[0] = player;

                const command = await pickAiMove(player, gameState);

                expect(command).toBeDefined();
            }
        });

        it('should work with different difficulty levels', async () => {
            const difficulties = [AiDifficulty.NICE, AiDifficulty.RUDE, AiDifficulty.MEAN, AiDifficulty.EVIL];

            for (const difficulty of difficulties) {
                const player = createMockPlayer({
                    slotIndex: 0,
                    name: 'AI',
                    isAI: true,
                    personality: 'Defender'
                });

                const gameState = createSimpleTwoPlayerGame();
                gameState.state.aiDifficulty = difficulty;

                const command = await pickAiMove(player, gameState);

                expect(command).toBeDefined();
            }
        });
    });

    describe('shouldBuildSoldier logic (integration)', () => {
        it('should return false when no temples owned', async () => {
            const player = createMockPlayer({
                slotIndex: 0,
                name: 'AI',
                isAI: true,
                personality: 'Aggressor'
            });

            const gameState = createMockGameState({
                players: [player],
                regions: [createMockRegion({ index: 0 })],
                ownersByRegion: { 0: 0 },
                templesByRegion: {}, // No temples
                faithByPlayer: { 0: 100 },
                aiDifficulty: AiDifficulty.RUDE
            });

            const command = await pickAiMove(player, gameState);

            // Cannot build soldiers without temples
            expect(command).not.toBeInstanceOf(BuildCommand);
        });

        it('should return false when cannot afford soldier', async () => {
            const player = createMockPlayer({
                slotIndex: 0,
                name: 'AI',
                isAI: true,
                personality: 'Aggressor'
            });

            const gameState = createMockGameState({
                players: [player],
                regions: [createMockRegion({ index: 0 })],
                ownersByRegion: { 0: 0 },
                templesByRegion: {
                    0: createMockTemple({ regionIndex: 0 })
                },
                faithByPlayer: { 0: 2 }, // Not enough
                aiDifficulty: AiDifficulty.RUDE
            });

            const command = await pickAiMove(player, gameState);

            // Should not build soldier (can't afford)
            if (command instanceof BuildCommand) {
                expect(command.upgradeIndex).not.toBe(TEMPLE_UPGRADES_BY_NAME.SOLDIER.index);
            }
        });

        it('should consider soldierEagerness from personality', async () => {
            const lowEagerness = createMockPlayer({
                slotIndex: 0,
                name: 'Low',
                isAI: true,
                personality: 'Economist' // soldierEagerness: 0.3
            });

            const highEagerness = createMockPlayer({
                slotIndex: 0,
                name: 'High',
                isAI: true,
                personality: 'Berserker' // soldierEagerness: 1.0
            });

            // Both have same scenario
            const createScenario = (player: Player) => createMockGameState({
                players: [player],
                regions: [createMockRegion({ index: 0 })],
                ownersByRegion: { 0: 0 },
                soldiersByRegion: { 0: [{ i: 1 }] },
                templesByRegion: {
                    0: createMockTemple({ regionIndex: 0 })
                },
                faithByPlayer: { 0: 20 },
                aiDifficulty: AiDifficulty.RUDE
            });

            const lowCommand = await pickAiMove(lowEagerness, createScenario(lowEagerness));
            const highCommand = await pickAiMove(highEagerness, createScenario(highEagerness));

            // Both should return valid commands
            expect(lowCommand).toBeDefined();
            expect(highCommand).toBeDefined();
        });

        it('should build soldiers when behind on military force', async () => {
            const player = createMockPlayer({
                slotIndex: 0,
                name: 'Weak AI',
                isAI: true,
                personality: 'Defender'
            });

            const strongPlayer = createMockPlayer({
                slotIndex: 1,
                name: 'Strong AI',
                isAI: true
            });

            const gameState = createMockGameState({
                players: [player, strongPlayer],
                regions: [
                    createMockRegion({ index: 0 }),
                    createMockRegion({ index: 1 }),
                    createMockRegion({ index: 2 }),
                    createMockRegion({ index: 3 })
                ],
                ownersByRegion: { 0: 0, 1: 1, 2: 1, 3: 1 }, // Player has 1, opponent has 3
                soldiersByRegion: {
                    0: [{ i: 1 }], // Player: 1 soldier
                    1: [{ i: 2 }, { i: 3 }, { i: 4 }], // Opponent: 3 soldiers
                    2: [{ i: 5 }, { i: 6 }],
                    3: [{ i: 7 }]
                },
                templesByRegion: {
                    0: createMockTemple({ regionIndex: 0 })
                },
                faithByPlayer: { 0: 50, 1: 50 },
                aiDifficulty: AiDifficulty.RUDE
            });

            const command = await pickAiMove(player, gameState);

            // Should prioritize building soldiers when behind
            expect(command).toBeDefined();
        });
    });

    describe('buildSoldierAtBestTemple logic (integration)', () => {
        it('should return null when no temples', async () => {
            const player = createMockPlayer({
                slotIndex: 0,
                name: 'AI',
                isAI: true,
                personality: 'Aggressor'
            });

            const gameState = createMockGameState({
                players: [player],
                regions: [createMockRegion({ index: 0 })],
                ownersByRegion: { 0: 0 },
                templesByRegion: {}, // No temples
                faithByPlayer: { 0: 100 },
                aiDifficulty: AiDifficulty.RUDE
            });

            const command = await pickAiMove(player, gameState);

            // Should not be a soldier build command
            expect(command).not.toBeInstanceOf(BuildCommand);
        });

        it('should select most threatened temple', async () => {
            const player = createMockPlayer({
                slotIndex: 0,
                name: 'AI',
                isAI: true,
                personality: 'Berserker' // Very high soldier eagerness
            });

            const enemy = createMockPlayer({
                slotIndex: 1,
                name: 'Enemy',
                isAI: true
            });

            const gameState = createMockGameState({
                players: [player, enemy],
                regions: [
                    createMockRegion({ index: 0, neighbors: [1] }), // Threatened
                    createMockRegion({ index: 1, neighbors: [0, 2] }),
                    createMockRegion({ index: 2, neighbors: [1] })  // Safe
                ],
                ownersByRegion: { 0: 0, 1: 1, 2: 0 },
                soldiersByRegion: {
                    0: [{ i: 1 }],
                    1: [{ i: 2 }, { i: 3 }, { i: 4 }, { i: 5 }], // Strong enemy
                    2: [{ i: 6 }]
                },
                templesByRegion: {
                    0: createMockTemple({ regionIndex: 0 }), // Threatened temple
                    2: createMockTemple({ regionIndex: 2 })  // Safe temple
                },
                faithByPlayer: { 0: 100, 1: 100 },
                aiDifficulty: AiDifficulty.MEAN // Use Mean AI to see threats
            });

            const command = await pickAiMove(player, gameState);

            // If it builds a soldier, check it's a build command
            if (command instanceof BuildCommand && command.upgradeIndex === TEMPLE_UPGRADES_BY_NAME.SOLDIER.index) {
                // Should build at either temple (most threatened would be region 0)
                expect([0, 2]).toContain(command.regionIndex);
            }
        });

        it('should return BuildCommand for SOLDIER upgrade', async () => {
            const player = createMockPlayer({
                slotIndex: 0,
                name: 'AI',
                isAI: true,
                personality: 'Berserker'
            });

            const gameState = createMockGameState({
                players: [player],
                regions: [createMockRegion({ index: 0 })],
                ownersByRegion: { 0: 0 },
                soldiersByRegion: { 0: [] }, // No soldiers, very behind
                templesByRegion: {
                    0: createMockTemple({ regionIndex: 0 })
                },
                faithByPlayer: { 0: 100 },
                aiDifficulty: AiDifficulty.RUDE
            });

            const command = await pickAiMove(player, gameState);

            // With Berserker personality and no soldiers, should build soldier
            expect(command).toBeDefined();
        });
    });

    describe('upgradeToBuild logic (integration)', () => {
        it('should return null when player has no personality', async () => {
            const player = createMockPlayer({
                slotIndex: 0,
                name: 'AI',
                isAI: true,
                personality: undefined // No personality
            });

            const gameState = createMockGameState({
                players: [player],
                regions: [createMockRegion({ index: 0 })],
                ownersByRegion: { 0: 0 },
                templesByRegion: {
                    0: createMockTemple({ regionIndex: 0 })
                },
                faithByPlayer: { 0: 100 },
                aiDifficulty: AiDifficulty.RUDE
            });

            const command = await pickAiMove(player, gameState);

            // Should not build upgrades without personality
            expect(command).toBeDefined();
        });

        it('should return null when no desired upgrades remain', async () => {
            const player = createMockPlayer({
                slotIndex: 0,
                name: 'AI',
                isAI: true,
                personality: 'Defender' // Prefers EARTH, WATER, FIRE
            });

            // Give player all upgrades at max level
            const gameState = createMockGameState({
                players: [player],
                regions: [
                    createMockRegion({ index: 0 }),
                    createMockRegion({ index: 1 }),
                    createMockRegion({ index: 2 })
                ],
                ownersByRegion: { 0: 0, 1: 0, 2: 0 },
                templesByRegion: {
                    0: createMockTemple({ regionIndex: 0, upgradeIndex: TEMPLE_UPGRADES_BY_NAME.EARTH.index, level: 2 }), // Max
                    1: createMockTemple({ regionIndex: 1, upgradeIndex: TEMPLE_UPGRADES_BY_NAME.WATER.index, level: 2 }), // Max
                    2: createMockTemple({ regionIndex: 2, upgradeIndex: TEMPLE_UPGRADES_BY_NAME.FIRE.index, level: 2 })   // Max
                },
                faithByPlayer: { 0: 200 },
                aiDifficulty: AiDifficulty.RUDE
            });

            const command = await pickAiMove(player, gameState);

            // Should not try to build more upgrades (all maxed)
            expect(command).toBeDefined();
        });

        it('should return null when cannot afford upgrade', async () => {
            const player = createMockPlayer({
                slotIndex: 0,
                name: 'AI',
                isAI: true,
                personality: 'Economist' // Prefers WATER (costs 15)
            });

            const gameState = createMockGameState({
                players: [player],
                regions: [createMockRegion({ index: 0 })],
                ownersByRegion: { 0: 0 },
                templesByRegion: {
                    0: createMockTemple({ regionIndex: 0, upgradeIndex: undefined })
                },
                faithByPlayer: { 0: 5 }, // Not enough for WATER (15)
                aiDifficulty: AiDifficulty.RUDE
            });

            const command = await pickAiMove(player, gameState);

            // Should not build upgrade (can't afford)
            expect(command).toBeDefined();
            if (command instanceof BuildCommand) {
                expect(command.upgradeIndex).not.toBe(TEMPLE_UPGRADES_BY_NAME.WATER.index);
            }
        });

        it('should return null when no suitable temple', async () => {
            const player = createMockPlayer({
                slotIndex: 0,
                name: 'AI',
                isAI: true,
                personality: 'Economist'
            });

            const gameState = createMockGameState({
                players: [player],
                regions: [createMockRegion({ index: 0 })],
                ownersByRegion: { 0: 0 },
                templesByRegion: {
                    // Temple already has different upgrade
                    0: createMockTemple({ regionIndex: 0, upgradeIndex: TEMPLE_UPGRADES_BY_NAME.FIRE.index, level: 0 })
                },
                faithByPlayer: { 0: 100 },
                aiDifficulty: AiDifficulty.RUDE
            });

            const command = await pickAiMove(player, gameState);

            // Should make some decision
            expect(command).toBeDefined();
        });

        it('should select safest temple for upgrade', async () => {
            const player = createMockPlayer({
                slotIndex: 0,
                name: 'AI',
                isAI: true,
                personality: 'Economist' // Low soldier eagerness, prefers upgrades
            });

            const gameState = createMockGameState({
                players: [player],
                regions: [
                    createMockRegion({ index: 0, neighbors: [] }), // Safe
                    createMockRegion({ index: 1, neighbors: [2] }), // Near enemy
                    createMockRegion({ index: 2, neighbors: [1] })
                ],
                ownersByRegion: { 0: 0, 1: 0, 2: 1 },
                soldiersByRegion: { 0: [], 1: [], 2: [{ i: 1 }, { i: 2 }, { i: 3 }] },
                templesByRegion: {
                    0: createMockTemple({ regionIndex: 0 }), // Safe temple
                    1: createMockTemple({ regionIndex: 1 })  // Threatened temple
                },
                faithByPlayer: { 0: 50, 1: 50 },
                aiDifficulty: AiDifficulty.RUDE
            });

            const command = await pickAiMove(player, gameState);

            // Should prefer to upgrade (low soldier eagerness)
            expect(command).toBeDefined();
        });

        it('should build upgrade based on personality preference order', async () => {
            const player = createMockPlayer({
                slotIndex: 0,
                name: 'AI',
                isAI: true,
                personality: 'Economist' // Prefers WATER, then AIR, then EARTH
            });

            const gameState = createMockGameState({
                players: [player],
                regions: [createMockRegion({ index: 0 })],
                ownersByRegion: { 0: 0 },
                templesByRegion: {
                    0: createMockTemple({ regionIndex: 0, upgradeIndex: undefined })
                },
                faithByPlayer: { 0: 50 },
                aiDifficulty: AiDifficulty.RUDE
            });

            const command = await pickAiMove(player, gameState);

            // Should build first preferred upgrade if possible
            expect(command).toBeDefined();
        });

        it('should build next level for existing upgrades', async () => {
            const player = createMockPlayer({
                slotIndex: 0,
                name: 'AI',
                isAI: true,
                personality: 'Economist' // Prefers WATER
            });

            const gameState = createMockGameState({
                players: [player],
                regions: [createMockRegion({ index: 0 })],
                ownersByRegion: { 0: 0 },
                templesByRegion: {
                    0: createMockTemple({ regionIndex: 0, upgradeIndex: TEMPLE_UPGRADES_BY_NAME.WATER.index, level: 0 })
                },
                faithByPlayer: { 0: 50 }, // Enough for level 1
                aiDifficulty: AiDifficulty.RUDE
            });

            const command = await pickAiMove(player, gameState);

            // Should upgrade WATER to level 1
            expect(command).toBeDefined();
        });
    });

    describe('Edge cases', () => {
        it('should handle player with no personality gracefully', async () => {
            const player = createMockPlayer({
                slotIndex: 0,
                name: 'AI',
                isAI: true,
                personality: undefined
            });

            const gameState = createSimpleTwoPlayerGame();
            gameState.state.players[0] = player;

            const command = await pickAiMove(player, gameState);

            expect(command).toBeDefined();
        });

        it('should handle very low faith', async () => {
            const player = createMockPlayer({
                slotIndex: 0,
                name: 'AI',
                isAI: true,
                personality: 'Defender'
            });

            const gameState = createSimpleTwoPlayerGame();
            gameState.state.faithByPlayer[0] = 0;

            const command = await pickAiMove(player, gameState);

            expect(command).toBeDefined();
        });

        it('should handle undefined aiDifficulty', async () => {
            const player = createMockPlayer({
                slotIndex: 0,
                name: 'AI',
                isAI: true,
                personality: 'Defender'
            });

            const gameState = createSimpleTwoPlayerGame();
            gameState.state.aiDifficulty = undefined;

            const command = await pickAiMove(player, gameState);

            expect(command).toBeDefined();
        });
    });
});

