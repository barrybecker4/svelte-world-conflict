import type { Planet } from '$lib/game/entities/gameTypes';

/**
 * Extract client coordinates from mouse or touch events
 */
export function getEventCoordinates(event: MouseEvent | TouchEvent): { clientX: number; clientY: number } {
    if ('touches' in event && event.touches.length > 0) {
        return {
            clientX: event.touches[0].clientX,
            clientY: event.touches[0].clientY
        };
    }
    return {
        clientX: (event as MouseEvent).clientX,
        clientY: (event as MouseEvent).clientY
    };
}

/**
 * Convert screen coordinates to SVG coordinates
 * Uses SVG's built-in coordinate transformation to handle viewBox and preserveAspectRatio correctly
 */
export function screenToSVGCoordinates(
    event: MouseEvent | TouchEvent,
    svgElement: SVGSVGElement
): { x: number; y: number } | null {
    const coords = getEventCoordinates(event);
    
    // Use SVG's built-in coordinate transformation
    const point = svgElement.createSVGPoint();
    point.x = coords.clientX;
    point.y = coords.clientY;
    
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

