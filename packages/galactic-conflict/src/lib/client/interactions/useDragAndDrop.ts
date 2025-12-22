import { writable, type Readable } from 'svelte/store';
import { onDestroy } from 'svelte';
import type { Planet } from '$lib/game/entities/gameTypes';
import { screenToSVGCoordinates, findPlanetAtPosition } from '$lib/client/utils/svgCoordinates';

export interface DragState {
    isDragging: boolean;
    sourcePlanet: Planet | null;
    currentX: number;
    currentY: number;
}

export interface DragAndDropOptions {
    svgElement: () => SVGSVGElement | null;
    planets: () => Planet[];
    canDrag: (planetId: number) => boolean;
    onDragComplete: (sourcePlanet: Planet, destinationPlanet: Planet) => void;
    onDoubleClick?: (planet: Planet) => void;
}

export interface DragAndDropHandlers {
    handleMouseDown: (planet: Planet, event: MouseEvent) => void;
    handleTouchStart: (planet: Planet, event: TouchEvent) => void;
    handleDoubleClick: (planet: Planet) => void;
}

/**
 * Hook that provides drag and drop functionality for planets
 * Handles both mouse and touch events, with support for double-click/tap detection
 */
export function useDragAndDrop(options: DragAndDropOptions): {
    dragState: Readable<DragState>;
    handlers: DragAndDropHandlers;
} {
    const { svgElement, planets, canDrag, onDragComplete, onDoubleClick } = options;

    // Internal state
    const dragState = writable<DragState>({
        isDragging: false,
        sourcePlanet: null,
        currentX: 0,
        currentY: 0
    });

    let dragSourcePlanetId: number | null = null;
    let dragStartTimeout: ReturnType<typeof setTimeout> | null = null;
    let mouseDownX = 0;
    let mouseDownY = 0;
    let lastTapTime = 0;
    let lastTapPlanetId: number | null = null;

    // Helper to get drag source planet from current planets array
    function getDragSourcePlanet(): Planet | null {
        if (dragSourcePlanetId === null) return null;
        return planets().find(p => p.id === dragSourcePlanetId) || null;
    }

    // Update drag position in SVG coordinates
    function updateDragPosition(event: MouseEvent | TouchEvent) {
        const svg = svgElement();
        if (!svg) return;

        const coords = screenToSVGCoordinates(event, svg);
        if (!coords) return;

        dragState.update(state => ({
            ...state,
            currentX: coords.x,
            currentY: coords.y
        }));
    }

    // Cleanup all drag state and listeners
    function cleanupDrag() {
        if (dragStartTimeout) {
            clearTimeout(dragStartTimeout);
            dragStartTimeout = null;
        }
        dragSourcePlanetId = null;
        
        dragState.set({
            isDragging: false,
            sourcePlanet: null,
            currentX: 0,
            currentY: 0
        });

        document.removeEventListener('mousemove', handleDocumentMouseMove);
        document.removeEventListener('mousemove', handleDocumentMouseMoveCheck);
        document.removeEventListener('mouseup', handleDocumentMouseUp);
        document.removeEventListener('touchmove', handleDocumentTouchMove as any);
        document.removeEventListener('touchmove', handleDocumentTouchMoveCheck as any);
        document.removeEventListener('touchend', handleDocumentTouchEnd);
        document.removeEventListener('touchcancel', handleDocumentTouchEnd);
    }

    // Mouse event handlers
    function handleMouseDown(planet: Planet, event: MouseEvent) {
        if (!canDrag(planet.id)) {
            return;
        }

        // Clear any existing drag timeout
        if (dragStartTimeout) {
            clearTimeout(dragStartTimeout);
            dragStartTimeout = null;
        }

        // Store initial mouse position
        mouseDownX = event.clientX;
        mouseDownY = event.clientY;

        dragSourcePlanetId = planet.id;
        updateDragPosition(event);

        // Delay drag start to allow double-click detection
        dragStartTimeout = setTimeout(() => {
            if (dragSourcePlanetId === planet.id) {
                const sourcePlanet = getDragSourcePlanet();
                if (sourcePlanet) {
                    dragState.update(state => ({
                        ...state,
                        isDragging: true,
                        sourcePlanet
                    }));
                }
                updateDragPosition(event);
                document.addEventListener('mousemove', handleDocumentMouseMove);
                document.addEventListener('mouseup', handleDocumentMouseUp);
            }
        }, 200);

        // Add listeners to detect actual drag
        document.addEventListener('mousemove', handleDocumentMouseMoveCheck);
        document.addEventListener('mouseup', handleDocumentMouseUp);
    }

    function handleDocumentMouseMoveCheck(event: MouseEvent) {
        const moveThreshold = 5;
        const dx = Math.abs(event.clientX - mouseDownX);
        const dy = Math.abs(event.clientY - mouseDownY);

        if (dx > moveThreshold || dy > moveThreshold) {
            // Mouse moved significantly - start drag immediately
            if (dragStartTimeout) {
                clearTimeout(dragStartTimeout);
                dragStartTimeout = null;
            }

            if (dragSourcePlanetId !== null) {
                const sourcePlanet = getDragSourcePlanet();
                if (sourcePlanet) {
                    dragState.update(state => ({
                        ...state,
                        isDragging: true,
                        sourcePlanet
                    }));
                }
                updateDragPosition(event);
                document.removeEventListener('mousemove', handleDocumentMouseMoveCheck);
                document.addEventListener('mousemove', handleDocumentMouseMove);
            }
        }
    }

    function handleDocumentMouseMove(event: MouseEvent) {
        updateDragPosition(event);
    }

    function handleDocumentMouseUp(event: MouseEvent) {
        // Clear the drag start timeout if pending
        if (dragStartTimeout) {
            clearTimeout(dragStartTimeout);
            dragStartTimeout = null;
        }

        // Remove the move check listener
        document.removeEventListener('mousemove', handleDocumentMouseMoveCheck);

        let currentDragState: DragState;
        const unsubscribe = dragState.subscribe(state => {
            currentDragState = state;
        });
        unsubscribe();

        if (!currentDragState!.isDragging || dragSourcePlanetId === null) {
            document.removeEventListener('mousemove', handleDocumentMouseMove);
            document.removeEventListener('mouseup', handleDocumentMouseUp);

            // Reset drag state after a brief delay to allow double-click
            setTimeout(() => {
                dragState.update(state => {
                    if (!state.isDragging) {
                        dragSourcePlanetId = null;
                    }
                    return state;
                });
            }, 50);
            return;
        }

        // Look up source planet from current state
        const sourcePlanet = getDragSourcePlanet();
        if (!sourcePlanet) {
            cleanupDrag();
            return;
        }

        // Find if we're over a planet
        const targetPlanet = findPlanetAtPosition(
            planets(),
            currentDragState!.currentX,
            currentDragState!.currentY
        );

        if (targetPlanet && targetPlanet.id !== sourcePlanet.id) {
            onDragComplete(sourcePlanet, targetPlanet);
        }

        cleanupDrag();
    }

    // Touch event handlers
    function handleTouchStart(planet: Planet, event: TouchEvent) {
        // Check for double-tap BEFORE checking canDrag
        // This allows double-tap to work on planets that can't be dragged (e.g., home world with 0 ships)
        const now = Date.now();
        const timeSinceLastTap = now - lastTapTime;
        
        if (lastTapPlanetId === planet.id && timeSinceLastTap < 300 && timeSinceLastTap > 0) {
            // Double-tap detected
            event.preventDefault();
            event.stopPropagation();
            lastTapTime = 0;
            lastTapPlanetId = null;
            cleanupDrag();
            if (onDoubleClick) {
                onDoubleClick(planet);
            }
            return;
        }
        
        lastTapTime = now;
        lastTapPlanetId = planet.id;

        // Check if planet can be dragged (requires ships)
        if (!canDrag(planet.id)) {
            return;
        }

        // Clear any existing drag timeout
        if (dragStartTimeout) {
            clearTimeout(dragStartTimeout);
            dragStartTimeout = null;
        }

        // Store initial touch position
        if (event.touches.length > 0) {
            mouseDownX = event.touches[0].clientX;
            mouseDownY = event.touches[0].clientY;
        }

        dragSourcePlanetId = planet.id;
        updateDragPosition(event);

        // Delay drag start to allow double-tap detection
        dragStartTimeout = setTimeout(() => {
            if (dragSourcePlanetId === planet.id) {
                const sourcePlanet = getDragSourcePlanet();
                if (sourcePlanet) {
                    dragState.update(state => ({
                        ...state,
                        isDragging: true,
                        sourcePlanet
                    }));
                }
                updateDragPosition(event);
                document.addEventListener('touchmove', handleDocumentTouchMove as any, { passive: false });
                document.addEventListener('touchend', handleDocumentTouchEnd);
                document.addEventListener('touchcancel', handleDocumentTouchEnd);
            }
        }, 200);

        // Add listeners to detect actual drag
        document.addEventListener('touchmove', handleDocumentTouchMoveCheck as any, { passive: false });
        document.addEventListener('touchend', handleDocumentTouchEnd);
        document.addEventListener('touchcancel', handleDocumentTouchEnd);
    }

    function handleDocumentTouchMoveCheck(event: TouchEvent) {
        if (event.touches.length === 0) return;

        const moveThreshold = 5;
        const dx = Math.abs(event.touches[0].clientX - mouseDownX);
        const dy = Math.abs(event.touches[0].clientY - mouseDownY);

        if (dx > moveThreshold || dy > moveThreshold) {
            // Touch moved significantly - start drag immediately
            if (dragStartTimeout) {
                clearTimeout(dragStartTimeout);
                dragStartTimeout = null;
            }

            if (dragSourcePlanetId !== null) {
                const sourcePlanet = getDragSourcePlanet();
                if (sourcePlanet) {
                    dragState.update(state => ({
                        ...state,
                        isDragging: true,
                        sourcePlanet
                    }));
                }
                event.preventDefault();
                updateDragPosition(event);
                document.removeEventListener('touchmove', handleDocumentTouchMoveCheck as any);
                document.addEventListener('touchmove', handleDocumentTouchMove as any, { passive: false });
            }
        }
    }

    function handleDocumentTouchMove(event: TouchEvent) {
        event.preventDefault();
        updateDragPosition(event);
    }

    function handleDocumentTouchEnd(event: TouchEvent) {
        // Clear the drag start timeout if pending
        if (dragStartTimeout) {
            clearTimeout(dragStartTimeout);
            dragStartTimeout = null;
        }

        // Remove the move check listener
        document.removeEventListener('touchmove', handleDocumentTouchMoveCheck as any);

        let currentDragState: DragState;
        const unsubscribe = dragState.subscribe(state => {
            currentDragState = state;
        });
        unsubscribe();

        if (!currentDragState!.isDragging || dragSourcePlanetId === null) {
            document.removeEventListener('touchmove', handleDocumentTouchMove as any);
            document.removeEventListener('touchend', handleDocumentTouchEnd);
            document.removeEventListener('touchcancel', handleDocumentTouchEnd);

            // Reset drag state after a brief delay to allow double-tap
            setTimeout(() => {
                dragState.update(state => {
                    if (!state.isDragging) {
                        dragSourcePlanetId = null;
                    }
                    return state;
                });
            }, 50);
            return;
        }

        // Look up source planet from current state
        const sourcePlanet = getDragSourcePlanet();
        if (!sourcePlanet) {
            cleanupDrag();
            return;
        }

        // Find if we're over a planet
        const targetPlanet = findPlanetAtPosition(
            planets(),
            currentDragState!.currentX,
            currentDragState!.currentY
        );

        if (targetPlanet && targetPlanet.id !== sourcePlanet.id) {
            onDragComplete(sourcePlanet, targetPlanet);
        }

        cleanupDrag();
    }

    function handleDoubleClick(planet: Planet) {
        // Cancel any pending drag start or active drag when double-clicking
        if (dragStartTimeout) {
            clearTimeout(dragStartTimeout);
            dragStartTimeout = null;
        }

        // Always cleanup drag state on double-click
        cleanupDrag();
        
        // Call the double-click callback if provided
        if (onDoubleClick) {
            onDoubleClick(planet);
        }
    }

    // Cleanup on destroy
    onDestroy(() => {
        cleanupDrag();
    });

    return {
        dragState: {
            subscribe: dragState.subscribe
        },
        handlers: {
            handleMouseDown,
            handleTouchStart,
            handleDoubleClick
        }
    };
}

