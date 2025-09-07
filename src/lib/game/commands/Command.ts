import { AttackSequenceGenerator, type AttackEvent } from '$lib/game/classes/AttackSequenceGenerator';
import {
    type Player,
    type Soldier,
    GameState
} from "$lib/game/state/GameState.ts";


export interface ValidationResult {
    valid: boolean;
    errors: string[];
}

export abstract class Command {
    protected gameState: GameState;
    protected player: Player;
    protected timestamp: string;
    protected id: string;
    protected previousState?: GameState;

    constructor(gameState: GameState, player: Player) {
        this.gameState = gameState;
        this.player = player;
        this.timestamp = new Date().toISOString();
        this.id = this.generateId();
    }

    abstract validate(): ValidationResult;
    abstract execute(): GameState;
    abstract serialize(): any;

    protected generateId(): string {
        return `${this.gameState.id}-${this.player.index}-${Date.now()}`;
    }

    undo(): GameState {
        if (!this.previousState) {
            throw new Error("Cannot undo - no previous state stored");
        }
        return this.previousState;
    }
}

