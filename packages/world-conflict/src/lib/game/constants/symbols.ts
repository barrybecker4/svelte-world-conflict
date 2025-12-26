/**
 * UI Symbols used throughout the game interface
 * Centralized to avoid duplication across components
 */
export const SYMBOLS = {
    FAITH: '☯', // Yin-yang symbol for faith/currency
    DEAD: '☠', // Skull and crossbones for eliminated players
    VICTORY: '♛', // Crown for winner
    REGION: '★', // Star for regions
    MOVES: '➊', // Number for moves remaining
    SOLDIER: '♟', // Chess pawn for soldiers
    CROWN: '👑', // Crown emoji
    TEMPLE: '🏛️', // Temple building
    COMBAT: '⚔️' // Crossed swords for combat
} as const;

/**
 * Type for symbol keys to ensure type safety
 */
export type SymbolKey = keyof typeof SYMBOLS;

export function getSymbol(key: SymbolKey): string {
    return SYMBOLS[key];
}
