/**
 * Represents a human or AI player in the game
 */
import type { PlayerType } from '$lib/game/constants/playerTypes.ts';
import type { AiPersonality } from './AiPersonality.ts';

export interface PlayerData {
    index: number;
    name?: string;
    defaultName?: string;
    type?: PlayerType;
    colorStart?: string;
    colorEnd?: string;
    highlightStart?: string;
    highlightEnd?: string;
    personality?: AiPersonality;
}

export class Player {
    public readonly index: number;
    public name: string;
    public readonly defaultName: string;
    public type: PlayerType;
    public readonly colorStart: string;
    public readonly colorEnd: string;
    public readonly highlightStart: string;
    public readonly highlightEnd: string;
    public personality?: AiPersonality;

    constructor(data: PlayerData) {
        this.index = data.index;
        this.defaultName = data.defaultName || `Player ${data.index + 1}`;
        this.name = data.name || this.defaultName;
        this.type = data.type || 'Open';
        this.colorStart = data.colorStart || '#888';
        this.colorEnd = data.colorEnd || '#444';
        this.highlightStart = data.highlightStart || '#aaa';
        this.highlightEnd = data.highlightEnd || '#666';
        this.personality = data.personality;
    }

    isHuman(): boolean {
        return this.type === 'Set' || this.type === 'Open';
    }

    isAI(): boolean {
        return this.type === 'AI' && !!this.personality;
    }

    /**
     * Check if this player slot is available for joining
     */
    isOpen(): boolean {
        return this.type === 'Open';
    }

    isActive(): boolean {
        return this.type !== 'Off';
    }

    setAsHuman(name: string): void {
        this.name = name;
        this.type = 'Set';
        this.personality = undefined;
    }

    setAsAI(personality: AiPersonality): void {
        this.name = personality.name;
        this.type = 'AI';
        this.personality = personality;
    }

    /**
     * Set player slot as open for joining
     */
    setAsOpen(): void {
        this.name = this.defaultName;
        this.type = 'Open';
        this.personality = undefined;
    }

    /**
     * Disable this player slot
     */
    setAsOff(): void {
        this.name = this.defaultName;
        this.type = 'Off';
        this.personality = undefined;
    }

    getPrimaryColor(): string {
        return this.colorStart;
    }

    getSecondaryColor(): string {
        return this.colorEnd;
    }

    /**
     * Get CSS gradient string for this player
     */
    getGradient(): string {
        return `linear-gradient(135deg, ${this.colorStart}, ${this.colorEnd})`;
    }

    getHighlightGradient(): string {
        return `linear-gradient(135deg, ${this.highlightStart}, ${this.highlightEnd})`;
    }

    copy(): Player {
        return new Player({
            index: this.index,
            name: this.name,
            defaultName: this.defaultName,
            type: this.type,
            colorStart: this.colorStart,
            colorEnd: this.colorEnd,
            highlightStart: this.highlightStart,
            highlightEnd: this.highlightEnd,
            personality: this.personality
        });
    }

    /**
     * Serialize player to plain object
     */
    toJSON(): PlayerData {
        return {
            index: this.index,
            name: this.name,
            defaultName: this.defaultName,
            type: this.type,
            colorStart: this.colorStart,
            colorEnd: this.colorEnd,
            highlightStart: this.highlightStart,
            highlightEnd: this.highlightEnd,
            personality: this.personality
        };
    }

    static fromJSON(data: PlayerData): Player {
        return new Player(data);
    }

    getDisplayName(): string {
        if (this.type === 'Off') return 'Off';
        if (this.type === 'Open') return 'Open';
        return this.name;
    }

    getStatusDescription(): string {
        switch (this.type) {
            case 'Off': return 'Disabled';
            case 'Open': return 'Waiting for player';
            case 'Set': return `Human: ${this.name}`;
            case 'AI': return `AI: ${this.name}`;
            default: return 'Unknown';
        }
    }

    equals(other: Player): boolean {
        return this.index === other.index &&
            this.name === other.name &&
            this.type === other.type;
    }
}
