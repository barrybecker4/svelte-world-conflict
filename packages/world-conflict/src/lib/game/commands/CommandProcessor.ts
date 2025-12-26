import { Command } from './Command';
import type { GameState } from '$lib/game/state/GameState';

export interface CommandResult {
    success: boolean;
    error?: string;
    newState?: GameState;
    attackSequence?: any[]; // Attack sequence for battle replay
}

export class CommandProcessor {
    public isSimulation: boolean = false;

    process(command: Command): CommandResult {
        try {
            const validation = command.validate();
            if (!validation.valid) {
                return {
                    success: false,
                    error: validation.errors.join(', ')
                };
            }

            // Pass simulation flag to command
            (command as any).isSimulation = this.isSimulation;

            const newState = command.execute();

            // Include attack sequence for battle replay (if available)
            const attackSequence = (command as any).attackSequence;

            return {
                success: true,
                newState,
                attackSequence: attackSequence || undefined
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }
}
