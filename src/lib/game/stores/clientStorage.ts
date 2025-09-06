const PLAYER_NAME_KEY = 'wc_player_name';
const GAME_PREFIX = 'game_';

export function loadPlayerName(): string {
    return localStorage.getItem(PLAYER_NAME_KEY) ?? '';
}

export function savePlayerName(name) {
    localStorage.setItem(PLAYER_NAME_KEY, name.trim());
}

export function saveGameCreator(gameId, creatorInfo) {
  localStorage.setItem(gameKey(gameId), JSON.stringify(creatorInfo));
}

export function loadGameCreator(gameId) {
  const item = localStorage.getItem(gameKey(gameId));
  return item ? JSON.parse(item) : null;
}

export function removeGameCreator(gameId) {
  localStorage.removeItem(gameKey(gameId));
}

function gameKey(gameId) {
  return GAME_PREFIX + gameId;
}
