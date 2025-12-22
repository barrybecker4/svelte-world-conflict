import { writable, type Readable } from 'svelte/store';
import { onDestroy } from 'svelte';
import type { Region } from '$lib/game/entities/gameTypes';
import { screenToSVGCoordinates, findRegionAtPosition } from '$lib/client/utils/svgCoordinates';

export interface DragState {
    isDragging: boolean;
    sourceRegion: Region | null;
    currentX: number;
    currentY: number;
}

export interface DragAndDropOptions {
    svgElement: () => SVGSVGElement | null;
    regions: () => Region[];
    canDrag: (regionIndex: number) => boolean;
    onDragComplete: (sourceRegion: Region, destinationRegion: Region) => void;
    onDoubleClick: (region: Region) => void;
}

export interface DragAndDropHandlers {
    handleMouseDown: (region: Region, event: MouseEvent) => void;
    handleTouchStart: (region: Region, event: TouchEvent) => void;
}

/**
 * Hook that provides drag and drop functionality for regions
 * Handles both mouse and touch events, with support for double-click/tap detection
 */
export function useDragAndDrop(options: DragAndDropOptions): {
    dragState: Readable<DragState>;
    handlers: DragAndDropHandlers;
} {
    const { svgElement, regions, canDrag, onDragComplete, onDoubleClick } = options;

    // Internal state
    const dragState = writable<DragState>({
        isDragging: false,
        sourceRegion: null,
        currentX: 0,
        currentY: 0
    });

    let dragSourceRegionIndex: number | null = null;
    let dragStartTimeout: ReturnType<typeof setTimeout> | null = null;
    let mouseDownX = 0;
    let mouseDownY = 0;
    let lastClickTime = 0;
    let lastClickRegionIndex: number | null = null;

    // Helper to get drag source region from current regions array
    function getDragSourceRegion(): Region | null {
        if (dragSourceRegionIndex === null) return null;
        return regions().find(r => r.index === dragSourceRegionIndex) || null;
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
        dragSourceRegionIndex = null;
        
        dragState.set({
            isDragging: false,
            sourceRegion: null,
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
    function handleMouseDown(region: Region, event: MouseEvent) {
        if (!canDrag(region.index)) {
            return;
        }

        // Check for double-click
        const now = Date.now();
        if (lastClickRegionIndex === region.index && now - lastClickTime < 300) {
            // Double-click detected
            lastClickTime = 0;
            lastClickRegionIndex = null;
            cleanupDrag();
            onDoubleClick(region);
            return;
        }
        lastClickTime = now;
        lastClickRegionIndex = region.index;

        // Clear any existing drag timeout
        if (dragStartTimeout) {
            clearTimeout(dragStartTimeout);
            dragStartTimeout = null;
        }

        // Store initial mouse position
        mouseDownX = event.clientX;
        mouseDownY = event.clientY;

        dragSourceRegionIndex = region.index;
        updateDragPosition(event);

        // Delay drag start to allow double-click detection
        dragStartTimeout = setTimeout(() => {
            if (dragSourceRegionIndex === region.index) {
                const sourceRegion = getDragSourceRegion();
                if (sourceRegion) {
                    dragState.update(state => ({
                        ...state,
                        isDragging: true,
                        sourceRegion
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

            if (dragSourceRegionIndex !== null) {
                const sourceRegion = getDragSourceRegion();
                if (sourceRegion) {
                    dragState.update(state => ({
                        ...state,
                        isDragging: true,
                        sourceRegion
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

        if (!currentDragState!.isDragging || dragSourceRegionIndex === null) {
            document.removeEventListener('mousemove', handleDocumentMouseMove);
            document.removeEventListener('mouseup', handleDocumentMouseUp);

            // Reset drag state after a brief delay to allow double-click
            setTimeout(() => {
                dragState.update(state => {
                    if (!state.isDragging) {
                        dragSourceRegionIndex = null;
                    }
                    return state;
                });
            }, 50);
            return;
        }

        // Look up source region from current state
        const sourceRegion = getDragSourceRegion();
        if (!sourceRegion) {
            cleanupDrag();
            return;
        }

        // Find if we're over a region
        const targetRegion = findRegionAtPosition(
            regions(),
            currentDragState!.currentX,
            currentDragState!.currentY
        );

        if (targetRegion && targetRegion.index !== sourceRegion.index) {
            onDragComplete(sourceRegion, targetRegion);
        }

        cleanupDrag();
    }

    // Touch event handlers
    function handleTouchStart(region: Region, event: TouchEvent) {
        if (!canDrag(region.index)) {
            return;
        }

        // Check for double-tap
        const now = Date.now();
        if (lastClickRegionIndex === region.index && now - lastClickTime < 300) {
            // Double-tap detected
            lastClickTime = 0;
            lastClickRegionIndex = null;
            cleanupDrag();
            onDoubleClick(region);
            event.preventDefault();
            return;
        }
        lastClickTime = now;
        lastClickRegionIndex = region.index;

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

        dragSourceRegionIndex = region.index;
        updateDragPosition(event);

        // Delay drag start to allow double-tap detection
        dragStartTimeout = setTimeout(() => {
            if (dragSourceRegionIndex === region.index) {
                const sourceRegion = getDragSourceRegion();
                if (sourceRegion) {
                    dragState.update(state => ({
                        ...state,
                        isDragging: true,
                        sourceRegion
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

            if (dragSourceRegionIndex !== null) {
                const sourceRegion = getDragSourceRegion();
                if (sourceRegion) {
                    dragState.update(state => ({
                        ...state,
                        isDragging: true,
                        sourceRegion
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

        if (!currentDragState!.isDragging || dragSourceRegionIndex === null) {
            document.removeEventListener('touchmove', handleDocumentTouchMove as any);
            document.removeEventListener('touchend', handleDocumentTouchEnd);
            document.removeEventListener('touchcancel', handleDocumentTouchEnd);

            // Reset drag state after a brief delay to allow double-tap
            setTimeout(() => {
                dragState.update(state => {
                    if (!state.isDragging) {
                        dragSourceRegionIndex = null;
                    }
                    return state;
                });
            }, 50);
            return;
        }

        // Look up source region from current state
        const sourceRegion = getDragSourceRegion();
        if (!sourceRegion) {
            cleanupDrag();
            return;
        }

        // Find if we're over a region
        const targetRegion = findRegionAtPosition(
            regions(),
            currentDragState!.currentX,
            currentDragState!.currentY
        );

        if (targetRegion && targetRegion.index !== sourceRegion.index) {
            onDragComplete(sourceRegion, targetRegion);
        }

        cleanupDrag();
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
            handleTouchStart
        }
    };
}

