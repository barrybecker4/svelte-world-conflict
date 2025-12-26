/**
 * Player slot configuration for game setup
 * Used during game creation to configure player positions
 */

export type PlayerSlotType = 'Off' | 'Set' | 'Open' | 'AI';

export interface PlayerSlot {
    slotIndex: number;
    type: PlayerSlotType;
    name?: string;
    defaultName: string;
    customName?: string;

    // Visual styling (from PlayerConfig)
    color: string;
    colorStart: string;
    colorEnd: string;
    highlightStart: string;
    highlightEnd: string;
}
