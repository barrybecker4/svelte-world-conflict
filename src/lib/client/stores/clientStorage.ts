const PLAYER_NAME_KEY = 'wc_player_name';
const GAME_PREFIX = 'game_';

export interface GameCreatorInfo {
  playerId: string;
  playerSlotIndex: number;
  playerName: string;
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
