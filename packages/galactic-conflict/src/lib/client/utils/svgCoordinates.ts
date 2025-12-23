import type { Planet } from '$lib/game/entities/gameTypes';

/**
 * Convert screen coordinates to SVG coordinates
 * Uses SVG's built-in coordinate transformation to handle viewBox and preserveAspectRatio correctly
 * Works with any pointer event (mouse, touch, stylus, etc.)
 */
export function screenToSVGCoordinates(
    event: PointerEvent,
    svgElement: SVGSVGElement
): { x: number; y: number } | null {
    // Use SVG's built-in coordinate transformation
    const point = svgElement.createSVGPoint();
    point.x = event.clientX;
    point.y = event.clientY;
    
    // Transform from screen coordinates to SVG coordinates
    const screenCTM = svgElement.getScreenCTM();
    if (!screenCTM) return null;
    
    const svgPoint = point.matrixTransform(screenCTM.inverse());
    
    return {
        x: svgPoint.x,
        y: svgPoint.y
    };
}

/**
 * Find a planet at the given SVG coordinates
 */
export function findPlanetAtPosition(
    planets: Planet[],
    x: number,
    y: number,
    clickRadius: number = 30
): Planet | undefined {
    return planets.find(planet => {
        const dx = planet.position.x - x;
        const dy = planet.position.y - y;
        return Math.sqrt(dx * dx + dy * dy) < clickRadius;
    });
}

