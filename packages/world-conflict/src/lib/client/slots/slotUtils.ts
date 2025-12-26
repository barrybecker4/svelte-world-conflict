/**
 * Shared utilities for game slot management
 * Used by both Lobby and WaitingRoom components
 */

export interface BaseSlotInfo {
    type: 'open' | 'creator' | 'taken' | 'ai' | 'disabled';
    name: string;
    canJoin?: boolean;
    color?: string;
    isCurrentPlayer?: boolean;
}

export interface SlotInfoOptions {
    currentPlayerId?: number | null;
    getPlayerColor?: (slotIndex: number) => string;
    maxPlayers?: number;
}

/**
 * Gets slot info from a game object - shared logic used by both Lobby and WaitingRoom
 */
export function getSlotInfoFromGame(game: any, slotIndex: number, options: SlotInfoOptions = {}): BaseSlotInfo {
    const { currentPlayerId, getPlayerColor, maxPlayers = 4 } = options;

    if (game?.pendingConfiguration?.playerSlots) {
        const slot = game.pendingConfiguration.playerSlots[slotIndex];

        if (!slot || slot.type === 'Off') {
            return {
                type: 'disabled',
                name: 'Disabled',
                canJoin: false,
                color: '#6b7280'
            };
        }

        if (slot.type === 'Set') {
            return {
                type: 'creator',
                name: slot.name || slot.defaultName,
                canJoin: false,
                color: '#3b82f6'
            };
        }

        if (slot.type === 'AI') {
            return {
                type: 'ai',
                name: slot.name || slot.defaultName,
                canJoin: false,
                color: '#8b5cf6'
            };
        }

        if (slot.type === 'Open') {
            const player = game.players?.find((p: any) => p.slotIndex === slotIndex);
            if (player) {
                return {
                    type: 'taken',
                    name: player.name,
                    canJoin: false,
                    color: getPlayerColor?.(slotIndex) || '#94a3b8',
                    isCurrentPlayer: currentPlayerId === slotIndex
                };
            }
            return {
                type: 'open',
                name: 'Open',
                canJoin: true,
                color: '#10b981'
            };
        }
    }

    // Fallback for games without pendingConfiguration
    const player = game?.players?.find((p: any) => p.slotIndex === slotIndex);
    if (player) {
        return {
            type: 'taken',
            name: player.name,
            canJoin: false,
            color: getPlayerColor?.(slotIndex) || '#94a3b8',
            isCurrentPlayer: currentPlayerId === slotIndex
        };
    }
    return {
        type: 'open',
        name: 'Open',
        canJoin: slotIndex < maxPlayers,
        color: '#10b981'
    };
}

/**
 * Determines if a slot is joinable in the lobby context
 */
export function isSlotJoinable(slotInfo: BaseSlotInfo): boolean {
    return slotInfo.type === 'open' && slotInfo.canJoin === true;
}

/**
 * Gets the appropriate button variant for a slot
 */
export function getSlotButtonVariant(slotInfo: BaseSlotInfo): string {
    switch (slotInfo.type) {
        case 'open':
            return 'success';
        case 'creator':
            return 'primary';
        case 'taken':
            return 'secondary';
        case 'ai':
            return 'ghost';
        case 'disabled':
            return 'ghost';
        default:
            return 'secondary';
    }
}

/**
 * Formats time ago from timestamp
 */
export function formatTimeAgo(timestamp: number): string {
    const now = Date.now();
    const diff = now - timestamp;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);

    if (seconds < 5) return 'Just now';
    if (seconds < 15) return '10 seconds ago';
    if (seconds < 40) return '30 seconds ago';
    if (seconds < 90) return `1 minute ago`;
    if (minutes < 60) return `${minutes} minutes ago`;

    const hours = Math.floor(minutes / 60);
    if (hours === 1) return '1 hour ago';
    return `${hours} hours ago`;
}

/**
 * Gets default player name for a slot
 */
export function getDefaultPlayerName(slotIndex: number): string {
    const defaultNames = ['Crimson', 'Azure', 'Emerald', 'Golden'];
    return defaultNames[slotIndex] || `Player${slotIndex + 1}`;
}

/**
 * Counts open slots in a game
 */
export function countOpenSlots(game: any): number {
    if (!game?.pendingConfiguration?.playerSlots) return 0;

    return game.pendingConfiguration.playerSlots.filter((slot, slotIndex) => {
        if (!slot || slot.type !== 'Open') return false;
        return !game.players?.some(p => p.slotIndex === slotIndex);
    }).length;
}

/**
 * Counts active players in a game
 */
export function countActivePlayers(game: any): number {
    return game?.players?.length || 0;
}

/**
 * Counts total active slots (non-Off slots)
 */
export function countTotalActiveSlots(game: any): number {
    return game?.pendingConfiguration?.playerSlots?.filter(s => s && s.type !== 'Off').length || 4;
}
