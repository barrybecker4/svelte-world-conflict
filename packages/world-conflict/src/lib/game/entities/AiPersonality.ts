/**
 * AI Personality class for World Conflict
 * Defines how AI players behave in the game
 */
import { TEMPLE_UPGRADES } from '$lib/game/constants/templeUpgradeDefinitions';
import { type AiLevel } from './aiPersonalities';
import type { RandomNumberGenerator } from 'multiplayer-framework/shared';

export interface AiPersonalityData {
    name: string;
    soldierEagerness: number;
    upgradePreference: number[];
    level: AiLevel;
}

export class AiPersonality {
    public readonly name: string;
    public readonly soldierEagerness: number; // 0.0 to 1.0 - how eagerly AI buys soldiers
    public readonly upgradePreference: number[]; // Array of upgrade indices in order of preference
    public readonly level: AiLevel; // Difficulty level

    constructor(data: AiPersonalityData) {
        this.name = data.name;
        this.soldierEagerness = Math.max(0, Math.min(1, data.soldierEagerness));
        this.upgradePreference = [...data.upgradePreference];
        this.level = data.level;
    }

    /**
     * Get the AI's preferred upgrade at the given preference index
     */
    getPreferredUpgrade(preferenceIndex: number): number {
        if (preferenceIndex < 0 || preferenceIndex >= this.upgradePreference.length) {
            return 2; // Default fallback to WATER (index 2)
        }
        return this.upgradePreference[preferenceIndex];
    }

    /**
     * Get all preferred upgrades in order
     */
    getAllPreferredUpgrades(): number[] {
        return [...this.upgradePreference];
    }

    /**
     * Check if this AI prefers a specific upgrade type
     */
    prefersUpgrade(upgradeIndex: number): boolean {
        return this.upgradePreference.includes(upgradeIndex);
    }

    /**
     * Get the priority rank of an upgrade (0 = highest priority)
     */
    getUpgradePriority(upgradeIndex: number): number {
        const index = this.upgradePreference.indexOf(upgradeIndex);
        return index === -1 ? 999 : index; // 999 = not preferred
    }

    /**
     * Determine if AI should buy soldiers based on current faith and eagerness
     */
    shouldBuySoldiers(currentFaith: number, soldierCost: number, rng: RandomNumberGenerator): boolean {
        if (currentFaith < soldierCost) return false;

        // Higher eagerness = more likely to buy soldiers
        // Also consider if we have enough faith for multiple purchases
        const canAffordMultiple = currentFaith >= soldierCost * 2;
        const baseChance = this.soldierEagerness;
        const extraChance = canAffordMultiple ? 0.2 : 0;

        return rng.chance(baseChance + extraChance);
    }

    /**
     * Calculate aggression factor for combat decisions
     */
    getAggressionFactor(): number {
        // Higher level = more aggressive
        switch (this.level) {
            case 0: return 0.6; // Nice - defensive
            case 1: return 0.75; // Rude - balanced
            case 2: return 0.9; // Mean - aggressive
            case 3: return 1.1; // Evil - very aggressive
            default: return 0.75;
        }
    }

    /**
     * Calculate patience factor for strategic decisions
     */
    getPatienceFactor(): number {
        // Lower level = more patient (builds up before attacking)
        switch (this.level) {
            case 0: return 1.2; // Nice - patient
            case 1: return 1.0; // Rude - normal
            case 2: return 0.8; // Mean - impatient
            case 3: return 0.6; // Evil - very impatient
            default: return 1.0;
        }
    }

    /**
     * Get difficulty description
     */
    getDifficultyDescription(): string {
        switch (this.level) {
            case 0: return 'Nice';
            case 1: return 'Rude';
            case 2: return 'Mean';
            case 3: return 'Evil';
            default: return 'Unknown';
        }
    }

    /**
     * Get personality description
     */
    getDescription(): string {
        const diff = this.getDifficultyDescription();
        const style = this.soldierEagerness > 0.7 ? 'Aggressive' :
            this.soldierEagerness < 0.4 ? 'Defensive' : 'Balanced';
        return `${diff} - ${style}`;
    }

    /**
     * Create a copy of this personality
     */
    copy(): AiPersonality {
        return new AiPersonality({
            name: this.name,
            soldierEagerness: this.soldierEagerness,
            upgradePreference: [...this.upgradePreference],
            level: this.level
        });
    }

    /**
     * Serialize to plain object
     */
    toJSON(): AiPersonalityData {
        return {
            name: this.name,
            soldierEagerness: this.soldierEagerness,
            upgradePreference: [...this.upgradePreference],
            level: this.level
        };
    }

    /**
     * Create from plain object
     */
    static fromJSON(data: AiPersonalityData): AiPersonality {
        return new AiPersonality(data);
    }

    /**
     * Check if two personalities are equal
     */
    equals(other: AiPersonality): boolean {
        return this.name === other.name &&
            this.level === other.level &&
            this.soldierEagerness === other.soldierEagerness &&
            JSON.stringify(this.upgradePreference) === JSON.stringify(other.upgradePreference);
    }
}
