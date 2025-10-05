export interface MultiplayerState {
    isConnected: boolean;
    gameId: string | null;
    connectionStatus: 'disconnected' | 'connecting' | 'connected' | 'error';
    lastError: string | null;
    playersOnline: number;
}

export interface GameUpdateEvent {
    type: 'gameUpdate' | 'playerJoined' | 'playerLeft' | 'gameStarted';
    gameId: string;
    data: any;
    timestamp: number;
}

/**
 * Initial state for multiplayer store
 */
export const initialState: MultiplayerState = {
    isConnected: false,
    gameId: null,
    connectionStatus: 'disconnected',
    lastError: null,
    playersOnline: 0
};
