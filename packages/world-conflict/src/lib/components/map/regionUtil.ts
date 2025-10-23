import type { Region, Player, GameStateData } from '$lib/game/entities/gameTypes';
import { getPlayerMapColor } from '$lib/game/constants/playerConfigs';

/**
 * utility functions for GameMap component grouped into a single object
 */
const regionUtil = {

  /**
   * Convert border points to SVG path
   */
  pointsToPath(points: Array<{x: number, y: number}>): string {
    if (!points || points.length < 3) return '';

    let path = `M ${points[0].x},${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      path += ` L ${points[i].x},${points[i].y}`;
    }
    path += ' Z';

    return path;
  },

  createFallbackCircle(region: Region): string {
    const radius = 35;
    return `M ${region.x + radius},${region.y} A ${radius},${radius} 0 1,1 ${region.x + radius - 0.1},${region.y} Z`;
  },

  /**
   * Generate active player gradients SVG
   */
  generateActivePlayerGradients(gameState: GameStateData | null, showTurnHighlights: boolean): string {
    if (!gameState || !showTurnHighlights) return '';

    return Array.from({length: 6}, (_, i) => {
      const color = getPlayerMapColor(i);
      return `
        <radialGradient id="activePlayerGradient${i}" cx="50%" cy="50%" r="50%">
          <stop offset="0%" style="stop-color:${color};stop-opacity:0.9"/>
          <stop offset="70%" style="stop-color:${color};stop-opacity:0.7"/>
          <stop offset="100%" style="stop-color:${color};stop-opacity:0.6"/>
        </radialGradient>
      `;
    }).join('');
  }
};

export default regionUtil;
