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
    handlePointerDown: (region: Region, event: PointerEvent) => void;
    handleDoubleClick: (region: Region) => void;
}

/**
 * Hook that provides drag and drop functionality for regions
 * Uses modern pointer events to handle mouse, touch, stylus, and other input devices
 * Supports double-click/tap detection
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
    let pointerDownX = 0;
    let pointerDownY = 0;
    let lastClickTime = 0;
    let lastClickRegionIndex: number | null = null;
    let activePointerId: number | null = null;

    // Helper to get drag source region from current regions array
    function getDragSourceRegion(): Region | null {
        if (dragSourceRegionIndex === null) return null;
        return regions().find(r => r.index === dragSourceRegionIndex) || null;
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
        dragSourceRegionIndex = null;
        activePointerId = null;
        
        dragState.set({
            isDragging: false,
            sourceRegion: null,
            currentX: 0,
            currentY: 0
        });

        document.removeEventListener('pointermove', handleDocumentPointerMove);
        document.removeEventListener('pointermove', handleDocumentPointerMoveCheck);
        document.removeEventListener('pointerup', handleDocumentPointerUp);
        document.removeEventListener('pointercancel', handleDocumentPointerUp);
    }

    // Pointer event handlers - works for mouse, touch, stylus, etc.
    function handlePointerDown(region: Region, event: PointerEvent) {
        // Check for double-click/tap BEFORE checking canDrag
        const now = Date.now();
        const timeSinceLastClick = now - lastClickTime;
        
        if (lastClickRegionIndex === region.index && timeSinceLastClick < 300 && timeSinceLastClick > 0) {
            // Double-click/tap detected
            event.preventDefault();
            event.stopPropagation();
            lastClickTime = 0;
            lastClickRegionIndex = null;
            cleanupDrag();
            onDoubleClick(region);
            return;
        }
        
        lastClickTime = now;
        lastClickRegionIndex = region.index;

        if (!canDrag(region.index)) {
            return;
        }

        // Capture this pointer for consistent event delivery
        const target = event.currentTarget as Element;
        if (target && 'setPointerCapture' in target) {
            target.setPointerCapture(event.pointerId);
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

        dragSourceRegionIndex = region.index;
        updateDragPosition(event);

        // Delay drag start to allow double-click detection
        dragStartTimeout = setTimeout(() => {
            if (dragSourceRegionIndex === region.index && activePointerId === event.pointerId) {
                const sourceRegion = getDragSourceRegion();
                if (sourceRegion) {
                    dragState.update(state => ({
                        ...state,
                        isDragging: true,
                        sourceRegion
                    }));
                }
                updateDragPosition(event);
                document.addEventListener('pointermove', handleDocumentPointerMove);
                document.addEventListener('pointerup', handleDocumentPointerUp);
                document.addEventListener('pointercancel', handleDocumentPointerUp);
            }
        }, 200);

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

        if (!currentDragState!.isDragging || dragSourceRegionIndex === null) {
            document.removeEventListener('pointermove', handleDocumentPointerMove);
            document.removeEventListener('pointerup', handleDocumentPointerUp);
            document.removeEventListener('pointercancel', handleDocumentPointerUp);

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

    function handleDoubleClick(region: Region) {
        // Cancel any pending drag start or active drag when double-clicking
        if (dragStartTimeout) {
            clearTimeout(dragStartTimeout);
            dragStartTimeout = null;
        }

        // Always cleanup drag state on double-click
        cleanupDrag();
        
        // Call the double-click callback
        onDoubleClick(region);
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

