import { PLAYER_CONFIGS, PLAYER_TYPES, AI_LEVELS, AI_PERSONALITIES, type PlayerType, type AiLevel, type PlayerConfig }
    from '../constants/index.js';

export interface PlayerSetup {
    index: number;
    name?: string;
    type: PlayerType;
    aiLevel?: AiLevel;
    aiPersonalityIndex?: number;
}

export interface SetupPlayerData extends PlayerConfig {
    type: PlayerType;
    name?: string;
    aiLevel?: AiLevel;
    personality?: typeof AI_PERSONALITIES[number];
}

export class PlayerManager {
    private static instance: PlayerManager | null = null;

    private constructor() {}

    public static getInstance(): PlayerManager {
        if (!PlayerManager.instance) {
            PlayerManager.instance = new PlayerManager();
        }
        return PlayerManager.instance;
    }

    // ==================== PLAYER SETUP METHODS ====================

    /**
     * Create a complete player setup from configuration
     */
    public setupPlayers(playerConfigs: PlayerSetup[]): SetupPlayerData[] {
        const players: SetupPlayerData[] = [];

        for (let i = 0; i < 4; i++) { // Always create 4 player slots
            const config = playerConfigs.find(p => p.index === i);
            const baseConfig = PLAYER_CONFIGS[i];

            if (config && config.type !== PLAYER_TYPES.OFF) {
                players.push({
                    ...baseConfig,
                    //name: config.name || baseConfig.defaultName,
                    type: config.type,
                    aiLevel: config.aiLevel,
                    personality: config.type === PLAYER_TYPES.AI ?
                        this.getAiPersonality(config.aiPersonalityIndex || config.aiLevel || AI_LEVELS.NICE) :
                        undefined
                });
            } else {
                // Create "Off" player slot
                players.push({
                    ...baseConfig,
                    type: PLAYER_TYPES.OFF
                });
            }
        }

        return players;
    }

    /**
     * Get AI personality by index or level
     */
    public getAiPersonality(indexOrLevel: number): typeof AI_PERSONALITIES[number] {
        // If it's a valid personality index, use that
        if (indexOrLevel > 0 && indexOrLevel < AI_PERSONALITIES.length) {
            return AI_PERSONALITIES[indexOrLevel];
        }

        // Otherwise treat as difficulty level and pick appropriate personality
        const personalitiesByLevel = AI_PERSONALITIES.slice(1); // Skip index 0
        const levelIndex = Math.min(indexOrLevel, personalitiesByLevel.length - 1);
        return personalitiesByLevel[levelIndex];
    }

    /**
     * Validate player setup
     */
    public validatePlayerSetup(players: PlayerSetup[]): { valid: boolean; errors: string[] } {
        const errors: string[] = [];

        // Check for active players
        const activePlayers = players.filter(p => p.type !== PLAYER_TYPES.OFF);
        if (activePlayers.length < 2) {
            errors.push('At least 2 players must be active');
        }

        if (activePlayers.length > 4) {
            errors.push('Maximum 4 players allowed');
        }

        // Check for duplicate names among active players
        const activeNames = activePlayers
            .filter(p => p.name && p.name.trim())
            .map(p => p.name!.trim().toLowerCase());

        const duplicateNames = activeNames.filter((name, index) =>
            activeNames.indexOf(name) !== index
        );

        if (duplicateNames.length > 0) {
            errors.push('Player names must be unique');
        }

        // Validate AI levels
        for (const player of players) {
            if (player.type === PLAYER_TYPES.AI) {
                if (player.aiLevel !== undefined &&
                    (player.aiLevel < AI_LEVELS.NICE || player.aiLevel > AI_LEVELS.EVIL)) {
                    errors.push(`Invalid AI level for player ${player.index}`);
                }
            }
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }

    // ==================== PLAYER CONFIGURATION METHODS ====================

    /**
     * Get default player configuration
     */
    public getDefaultPlayerConfig(index: number): PlayerConfig | null {
        return PLAYER_CONFIGS[index] || null;
    }

    /**
     * Create a human player setup
     */
    public createHumanPlayer(index: number, name?: string, isOpen: boolean = false): PlayerSetup {
        const baseConfig = this.getDefaultPlayerConfig(index);
        return {
            index,
            name: name || baseConfig?.defaultName || `Player ${index + 1}`,
            type: isOpen ? PLAYER_TYPES.HUMAN_OPEN : PLAYER_TYPES.HUMAN_SET
        };
    }

    /**
     * Create an AI player setup
     */
    public createAiPlayer(index: number, aiLevel: AiLevel = AI_LEVELS.NICE, name?: string): PlayerSetup {
        const baseConfig = this.getDefaultPlayerConfig(index);
        return {
            index,
            name: name || baseConfig?.defaultName || `AI ${index + 1}`,
            type: PLAYER_TYPES.AI,
            aiLevel,
            aiPersonalityIndex: aiLevel + 1 // Map to personality array (skip index 0)
        };
    }

    /**
     * Create an empty/off player slot
     */
    public createOffPlayer(index: number): PlayerSetup {
        return {
            index,
            type: PLAYER_TYPES.OFF
        };
    }

    // ==================== GAME SETUP HELPERS ====================

    /**
     * Create a quick setup for common scenarios
     */
    public createQuickSetup(scenario: 'tutorial' | 'pvp' | 'ai_practice' | 'ai_battle'): PlayerSetup[] {
        switch (scenario) {
            case 'tutorial':
                return [
                    this.createHumanPlayer(0, 'You'),
                    this.createAiPlayer(1, AI_LEVELS.NICE, 'Tutorial AI'),
                    this.createOffPlayer(2),
                    this.createOffPlayer(3)
                ];

            case 'pvp':
                return [
                    this.createHumanPlayer(0, undefined, true), // Open slot
                    this.createHumanPlayer(1, undefined, true), // Open slot
                    this.createOffPlayer(2),
                    this.createOffPlayer(3)
                ];

            case 'ai_practice':
                return [
                    this.createHumanPlayer(0, 'You'),
                    this.createAiPlayer(1, AI_LEVELS.RUDE),
                    this.createAiPlayer(2, AI_LEVELS.MEAN),
                    this.createOffPlayer(3)
                ];

            case 'ai_battle':
                return [
                    this.createAiPlayer(0, AI_LEVELS.NICE),
                    this.createAiPlayer(1, AI_LEVELS.RUDE),
                    this.createAiPlayer(2, AI_LEVELS.MEAN),
                    this.createAiPlayer(3, AI_LEVELS.EVIL)
                ];

            default:
                return [
                    this.createHumanPlayer(0),
                    this.createOffPlayer(1),
                    this.createOffPlayer(2),
                    this.createOffPlayer(3)
                ];
        }
    }

    /**
     * Get human-readable player type description
     */
    public getPlayerTypeDescription(type: PlayerType): string {
        switch (type) {
            case PLAYER_TYPES.HUMAN_SET:
                return 'Human Player';
            case PLAYER_TYPES.HUMAN_OPEN:
                return 'Open Slot';
            case PLAYER_TYPES.AI:
                return 'AI Player';
            case PLAYER_TYPES.OFF:
                return 'Disabled';
            default:
                return 'Unknown';
        }
    }

    /**
     * Get AI difficulty description
     */
    public getAiDifficultyDescription(level: AiLevel): string {
        switch (level) {
            case AI_LEVELS.NICE:
                return 'Easy - Plays defensively, makes suboptimal moves';
            case AI_LEVELS.RUDE:
                return 'Normal - Balanced strategy, occasional mistakes';
            case AI_LEVELS.MEAN:
                return 'Hard - Aggressive play, good tactical decisions';
            case AI_LEVELS.EVIL:
                return 'Expert - Ruthless optimization, minimal mistakes';
            default:
                return 'Unknown difficulty';
        }
    }

    // ==================== SERIALIZATION ====================

    /**
     * Serialize player setup for storage/network
     */
    public serializePlayerSetup(players: SetupPlayerData[]): object {
        return {
            players: players.map(player => ({
                index: player.index,
                name: player.name,
                type: player.type,
                aiLevel: player.aiLevel,
                defaultName: player.defaultName,
                colorStart: player.colorStart,
                colorEnd: player.colorEnd,
                highlightStart: player.highlightStart,
                highlightEnd: player.highlightEnd
            }))
        };
    }

    /**
     * Deserialize player setup from storage/network
     */
    public deserializePlayerSetup(data: any): SetupPlayerData[] {
        if (!data.players || !Array.isArray(data.players)) {
            throw new Error('Invalid player setup data');
        }

        return data.players.map((playerData: any) => ({
            index: playerData.index,
            name: playerData.name,
            type: playerData.type,
            aiLevel: playerData.aiLevel,
            defaultName: playerData.defaultName,
            colorStart: playerData.colorStart,
            colorEnd: playerData.colorEnd,
            highlightStart: playerData.highlightStart,
            highlightEnd: playerData.highlightEnd,
            personality: playerData.type === PLAYER_TYPES.AI ?
                this.getAiPersonality(playerData.aiLevel || AI_LEVELS.NICE) :
                undefined
        }));
    }
}

// Export singleton instance
export const playerManager = PlayerManager.getInstance();
