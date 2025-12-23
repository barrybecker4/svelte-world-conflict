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
    handlePointerDown: (planet: Planet, event: PointerEvent) => void;
    handleDoubleClick: (planet: Planet) => void;
}

// Detect if we're on a touch device (iPad Safari, etc.)
const isTouchDevice = typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0);

/**
 * Hook that provides drag and drop functionality for planets
 * Uses modern pointer events to handle mouse, touch, stylus, and other input devices
 * Supports double-click/tap detection
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
    let pointerDownX = 0;
    let pointerDownY = 0;
    let lastClickTime = 0;
    let lastClickPlanetId: number | null = null;
    let activePointerId: number | null = null;

    // Helper to get drag source planet from current planets array
    function getDragSourcePlanet(): Planet | null {
        if (dragSourcePlanetId === null) return null;
        return planets().find(p => p.id === dragSourcePlanetId) || null;
    }

    // Update drag position in SVG coordinates
    function updateDragPosition(event: PointerEvent) {
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
        
        // Release pointer capture from SVG element
        const svg = svgElement();
        if (svg && activePointerId !== null) {
            try {
                svg.releasePointerCapture(activePointerId);
            } catch (e) {
                // Ignore errors if pointer was already released
            }
        }
        
        dragSourcePlanetId = null;
        activePointerId = null;
        
        dragState.set({
            isDragging: false,
            sourcePlanet: null,
            currentX: 0,
            currentY: 0
        });

        document.removeEventListener('pointermove', handleDocumentPointerMove);
        document.removeEventListener('pointermove', handleDocumentPointerMoveCheck);
        document.removeEventListener('pointerup', handleDocumentPointerUp);
        document.removeEventListener('pointercancel', handleDocumentPointerUp);
    }

    // Pointer event handlers - works for mouse, touch, stylus, etc.
    function handlePointerDown(planet: Planet, event: PointerEvent) {
        // Check for double-click/tap BEFORE checking canDrag
        // This allows double-click to work on planets that can't be dragged
        const now = Date.now();
        const timeSinceLastClick = now - lastClickTime;
        
        if (lastClickPlanetId === planet.id && timeSinceLastClick < 300 && timeSinceLastClick > 0) {
            // Double-click/tap detected
            event.preventDefault();
            event.stopPropagation();
            lastClickTime = 0;
            lastClickPlanetId = null;
            cleanupDrag();
            if (onDoubleClick) {
                onDoubleClick(planet);
            }
            return;
        }
        
        lastClickTime = now;
        lastClickPlanetId = planet.id;

        if (!canDrag(planet.id)) {
            return;
        }

        // Prevent default to stop Safari touch gestures from interfering
        // This is critical for iPad Safari to allow drag to work
        event.preventDefault();
        event.stopPropagation();

        // On touch devices, capture pointer on the SVG element itself
        // SVG <g> elements don't reliably support pointer capture on Safari iOS
        const svg = svgElement();
        if (svg && 'setPointerCapture' in svg) {
            try {
                svg.setPointerCapture(event.pointerId);
            } catch (e) {
                // Some browsers may throw if pointer capture fails, ignore
            }
        }
        activePointerId = event.pointerId;

        // Clear any existing drag timeout
        if (dragStartTimeout) {
            clearTimeout(dragStartTimeout);
            dragStartTimeout = null;
        }

        // Store initial pointer position
        pointerDownX = event.clientX;
        pointerDownY = event.clientY;

        dragSourcePlanetId = planet.id;
        updateDragPosition(event);

        // On touch devices, start drag immediately (shorter delay) to feel more responsive
        // On desktop, use longer delay to allow double-click detection
        const dragDelay = isTouchDevice ? 100 : 200;

        // Delay drag start to allow double-click detection
        dragStartTimeout = setTimeout(() => {
            if (dragSourcePlanetId === planet.id && activePointerId === event.pointerId) {
                const sourcePlanet = getDragSourcePlanet();
                if (sourcePlanet) {
                    dragState.update(state => ({
                        ...state,
                        isDragging: true,
                        sourcePlanet
                    }));
                }
                updateDragPosition(event);
                document.addEventListener('pointermove', handleDocumentPointerMove);
                document.addEventListener('pointerup', handleDocumentPointerUp);
                document.addEventListener('pointercancel', handleDocumentPointerUp);
            }
        }, dragDelay);

        // Add listeners to detect actual drag
        document.addEventListener('pointermove', handleDocumentPointerMoveCheck);
        document.addEventListener('pointerup', handleDocumentPointerUp);
        document.addEventListener('pointercancel', handleDocumentPointerUp);
    }

    function handleDocumentPointerMoveCheck(event: PointerEvent) {
        // Only respond to the active pointer
        if (activePointerId !== null && event.pointerId !== activePointerId) {
            return;
        }

        const moveThreshold = 5;
        const dx = Math.abs(event.clientX - pointerDownX);
        const dy = Math.abs(event.clientY - pointerDownY);

        if (dx > moveThreshold || dy > moveThreshold) {
            // Pointer moved significantly - start drag immediately
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
                document.removeEventListener('pointermove', handleDocumentPointerMoveCheck);
                document.addEventListener('pointermove', handleDocumentPointerMove);
            }
        }
    }

    function handleDocumentPointerMove(event: PointerEvent) {
        // Only respond to the active pointer
        if (activePointerId !== null && event.pointerId !== activePointerId) {
            return;
        }
        updateDragPosition(event);
    }

    function handleDocumentPointerUp(event: PointerEvent) {
        // Only respond to the active pointer
        if (activePointerId !== null && event.pointerId !== activePointerId) {
            return;
        }

        // Clear the drag start timeout if pending
        if (dragStartTimeout) {
            clearTimeout(dragStartTimeout);
            dragStartTimeout = null;
        }

        // Remove the move check listener
        document.removeEventListener('pointermove', handleDocumentPointerMoveCheck);

        let currentDragState: DragState;
        const unsubscribe = dragState.subscribe(state => {
            currentDragState = state;
        });
        unsubscribe();

        if (!currentDragState!.isDragging || dragSourcePlanetId === null) {
            document.removeEventListener('pointermove', handleDocumentPointerMove);
            document.removeEventListener('pointerup', handleDocumentPointerUp);
            document.removeEventListener('pointercancel', handleDocumentPointerUp);

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
            handlePointerDown,
            handleDoubleClick
        }
    };
}

