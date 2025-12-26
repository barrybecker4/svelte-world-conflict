import {
    type Player,
    GameState
} from "$lib/game/state/GameState.ts";

export interface CommandValidationResult {
    valid: boolean;
    errors: string[];
}

export abstract class Command {
    protected gameState: GameState;
    protected player: Player;
    protected timestamp: string;
    protected id: string;
    protected previousState?: GameState;
    public isSimulation: boolean = false; // Set to true when command is used in AI simulations

    constructor(gameState: GameState, player: Player) {
        this.gameState = gameState;
        this.player = player;
        this.timestamp = new Date().toISOString();
        this.id = this.generateId();
    }

    abstract validate(): CommandValidationResult;
    abstract execute(): GameState;
    abstract serialize(): any;

    protected generateId(): string {
        return `${this.gameState.id}-${this.player.slotIndex}-${Date.now()}`;
    }

    undo(): GameState {
        if (!this.previousState) {
            throw new Error("Cannot undo - no previous state stored");
        }
        return this.previousState;
    }
}
