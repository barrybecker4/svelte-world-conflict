import { Command } from "./Command";
import type { GameState } from "$lib/game/state/GameState";

export interface CommandResult {
    success: boolean;
    error?: string;
    newState?: GameState;
}

export class CommandProcessor {
    process(command: Command): CommandResult {
        try {
            // Validate command
            const validation = command.validate();
            if (!validation.valid) {
                return {
                    success: false,
                    error: validation.errors.join(', ')
                };
            }

            const newState = command.execute();
            return {
                success: true,
                newState
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }
}
