import { describe, it, expect, beforeEach } from 'vitest';
import gameMapUtil from './gameMapUtil';
import type { Region, Player, GameStateData } from '$lib/game/entities/gameTypes';

describe('GameMap Utilities', () => {
  let mockRegion: Region;
  let mockGameState: GameStateData;
  let mockPlayers: Player[];

  beforeEach(() => {
    // Initialize mock players first
    mockPlayers = [
      { index: 0, name: 'Player 1', color: '#ff0000', isAI: false },
      { index: 1, name: 'Player 2', color: '#00ff00', isAI: true }
    ] as Player[];

    mockRegion = {
      index: 0,
      x: 100,
      y: 150,
      points: [
        { x: 80, y: 130 },
        { x: 120, y: 130 },
        { x: 130, y: 170 },
        { x: 70, y: 170 }
      ]
    } as Region;

    mockGameState = {
      gameId: 'test-game',
      playerIndex: 0,
      currentPlayerIndex: 0,
      players: mockPlayers,
      movesRemaining: 3,
      ownersByRegion: { 0: 0, 1: 1 },
      soldiersByRegion: { 
        0: [{ id: '1' }, { id: '2' }], 
        1: [{ id: '3' }] 
      },
      templesByRegion: { 0: { level: 1 } },
      conqueredRegions: []
    } as GameStateData;
  });

  describe('SVG Path Utilities', () => {
    describe('pointsToPath', () => {
      it('should convert points to SVG path', () => {
        const points = [
          { x: 10, y: 20 },
          { x: 30, y: 40 },
          { x: 50, y: 60 }
        ];
        
        const result = gameMapUtil.pointsToPath(points);
        expect(result).toBe('M 10,20 L 30,40 L 50,60 Z');
      });

      it('should return empty string for insufficient points', () => {
        expect(gameMapUtil.pointsToPath([])).toBe('');
        expect(gameMapUtil.pointsToPath([{ x: 10, y: 20 }])).toBe('');
        expect(gameMapUtil.pointsToPath([{ x: 10, y: 20 }, { x: 30, y: 40 }])).toBe('');
      });

      it('should handle null/undefined points', () => {
        expect(gameMapUtil.pointsToPath(null as any)).toBe('');
        expect(gameMapUtil.pointsToPath(undefined as any)).toBe('');
      });
    });

    describe('createFallbackCircle', () => {
      it('should create circular SVG path for region', () => {
        const result = gameMapUtil.createFallbackCircle(mockRegion);
        expect(result).toContain('M 135,150');
        expect(result).toContain('A 35,35');
        expect(result).toContain('Z');
      });
    });
  });

});
