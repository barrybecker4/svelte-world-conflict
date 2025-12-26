import { writable, type Readable } from 'svelte/store';
import { onMount, onDestroy } from 'svelte';

/**
 * Hook that provides a reactive current time value that updates via requestAnimationFrame
 * The animation can be conditionally enabled/disabled
 * 
 * @param shouldAnimate - Function that returns whether animation should continue
 * @returns Readable store containing current timestamp
 */
export function useAnimationTime(shouldAnimate: () => boolean): Readable<number> {
    const currentTime = writable(Date.now());
    let animationFrame: number | null = null;

    function updateTime() {
        if (shouldAnimate()) {
            currentTime.set(Date.now());
            animationFrame = requestAnimationFrame(updateTime);
        }
    }

    onMount(() => {
        updateTime();
    });

    onDestroy(() => {
        if (animationFrame !== null) {
            cancelAnimationFrame(animationFrame);
        }
    });

    return {
        subscribe: currentTime.subscribe
    };
}
