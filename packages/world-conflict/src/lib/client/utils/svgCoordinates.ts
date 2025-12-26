import type { Region } from '$lib/game/entities/gameTypes';

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
 * Find a region at the given SVG coordinates
 * Uses point-in-polygon algorithm for accurate hit detection
 */
export function findRegionAtPosition(regions: Region[], x: number, y: number): Region | undefined {
    // Check regions in reverse order (top to bottom) for better UX
    for (let i = regions.length - 1; i >= 0; i--) {
        const region = regions[i];
        if (isPointInRegion(x, y, region)) {
            return region;
        }
    }
    return undefined;
}

/**
 * Check if a point is inside a region using ray casting algorithm
 */
function isPointInRegion(x: number, y: number, region: Region): boolean {
    if (!region.points || region.points.length === 0) {
        // Fallback to circular hit detection
        const dx = region.x - x;
        const dy = region.y - y;
        return Math.sqrt(dx * dx + dy * dy) < 30;
    }

    // Ray casting algorithm for point-in-polygon test
    let inside = false;
    const points = region.points;

    for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
        const xi = points[i].x;
        const yi = points[i].y;
        const xj = points[j].x;
        const yj = points[j].y;

        const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;

        if (intersect) {
            inside = !inside;
        }
    }

    return inside;
}
