import { TEMPLE_LEVELS } from "$lib/game/classes/Temple.ts";

export class Upgrade {
    index: number;
    name: string;
    description: string;
    cost: number[];
    level: number[];

    constructor(
        index: number,
        name: string,
        description: string,
        cost: number[],
        level: number[]
    ) {
        this.index = index;
        this.name = name;
        this.description = description;
        this.cost = cost;
        this.level = level;
    }

    // Get cost for a specific level
    getCostForLevel(level: number): number {
        return this.cost[level] || 0;
    }

    // Get effect value for a specific level
    getValueForLevel(level: number): number {
        return this.level[level] || 0;
    }

    // Check if level is valid
    isValidLevel(level: number): boolean {
        return level >= 0 && level < this.cost.length;
    }

    // Get maximum level for this upgrade
    getMaxLevel(): number {
        return this.cost.length - 1;
    }

    // Get formatted name for a specific level
    getFormattedName(level: number): string {
        const templateLevel = TEMPLE_LEVELS[level] || "Unknown";
        return this.name.replace('{level}', templateLevel);
    }

    // Get formatted description for a specific level
    getFormattedDescription(level: number): string {
        const value = this.getValueForLevel(level);
        return this.description.replace('{value}', value.toString());
    }

    // Check if this is a special upgrade type
    isSoldierUpgrade(): boolean {
        return this.name === 'SOLDIER';
    }

    isRebuildUpgrade(): boolean {
        return this.name === 'REBUILD';
    }

    isAirUpgrade(): boolean {
        return this.name === 'AIR';
    }

    isDefenseUpgrade(): boolean {
        return this.name === 'DEFENSE';
    }

    isIncomeUpgrade(): boolean {
        return this.name === 'INCOME';
    }

    // Serialize for storage/network
    serialize(): object {
        return {
            index: this.index,
            name: this.name,
            description: this.description,
            cost: this.cost,
            level: this.level
        };
    }

    // Create from serialized data
    static deserialize(data: any): Upgrade {
        return new Upgrade(
            data.index,
            data.name,
            data.description,
            data.cost,
            data.level
        );
    }

    // Create a copy of this upgrade
    copy(): Upgrade {
        return new Upgrade(
            this.index,
            this.name,
            this.description,
            [...this.cost],
            [...this.level]
        );
    }
}
