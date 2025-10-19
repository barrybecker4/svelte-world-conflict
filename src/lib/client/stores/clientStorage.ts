const PLAYER_NAME_KEY = 'wc_player_name';
const GAME_PREFIX = 'game_';
const GAME_CONFIG_KEY = 'wc_game_config';

export interface GameCreatorInfo {
  playerId: string;
  playerSlotIndex: number;
  playerName: string;
}

export interface GameConfiguration {
  aiDifficulty: string;
  maxTurns: number;
  timeLimit: number;
  mapSize: string;
  playerSlots: PlayerSlotConfig[];
}

export interface PlayerSlotConfig {
  slotIndex: number;
  type: string;
  customName: string;
}

export function loadPlayerName(): string {
    return localStorage.getItem(PLAYER_NAME_KEY) ?? '';
}

export function savePlayerName(name: string): void {
    localStorage.setItem(PLAYER_NAME_KEY, name.trim());
}

export function saveGameCreator(gameId: string, creatorInfo: GameCreatorInfo): void {
  localStorage.setItem(gameKey(gameId), JSON.stringify(creatorInfo));
}

export function loadGameCreator(gameId: string): GameCreatorInfo | null {
  const item = localStorage.getItem(gameKey(gameId));
  return item ? JSON.parse(item) : null;
}

export function removeGameCreator(gameId: string): void {
  localStorage.removeItem(gameKey(gameId));
}

function gameKey(gameId: string): string {
  return GAME_PREFIX + gameId;
}

export function saveGameConfiguration(config: GameConfiguration): void {
  try {
    localStorage.setItem(GAME_CONFIG_KEY, JSON.stringify(config));
  } catch (e) {
    console.error('Error saving game configuration:', e);
  }
}

export function loadGameConfiguration(): GameConfiguration | null {
  try {
    const stored = localStorage.getItem(GAME_CONFIG_KEY);
    if (!stored) {
      return null;
    }
    
    const config = JSON.parse(stored) as GameConfiguration;
    
    // Validate the configuration
    if (!isValidConfiguration(config)) {
      console.warn('Invalid stored configuration, ignoring');
      return null;
    }
    
    return config;
  } catch (e) {
    console.error('Error loading game configuration:', e);
    return null;
  }
}

function isValidConfiguration(config: any): config is GameConfiguration {
  if (!config || typeof config !== 'object') {
    return false;
  }
  
  // Check required fields exist
  if (
    typeof config.aiDifficulty !== 'string' ||
    typeof config.maxTurns !== 'number' ||
    typeof config.timeLimit !== 'number' ||
    typeof config.mapSize !== 'string' ||
    !Array.isArray(config.playerSlots)
  ) {
    return false;
  }
  
  // Validate player slots
  if (!config.playerSlots.every((slot: any) => 
    typeof slot === 'object' &&
    typeof slot.slotIndex === 'number' &&
    typeof slot.type === 'string' &&
    typeof slot.customName === 'string'
  )) {
    return false;
  }
  
  return true;
}
