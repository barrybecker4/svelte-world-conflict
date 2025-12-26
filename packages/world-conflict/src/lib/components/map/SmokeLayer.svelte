<script lang="ts">
    import { onDestroy } from 'svelte';
    import { smokeStore } from '$lib/client/stores/smokeStore';
    import { GAME_CONSTANTS } from '$lib/game/constants/gameConstants';

    let animationTick = 0;
    let animationFrame: number | null = null;
    let isAnimating = false;

    function startAnimationLoop() {
        if (isAnimating) return; // Already running

        isAnimating = true;
        function tick() {
            animationTick = Date.now();
            if ($smokeStore.length > 0) {
                animationFrame = requestAnimationFrame(tick);
            } else {
                // No more particles, stop the loop
                isAnimating = false;
                animationFrame = null;
            }
        }
        tick();
    }

    // Start/stop animation loop based on smoke particles
    $: if ($smokeStore.length > 0 && !isAnimating) {
        startAnimationLoop();
    }

    onDestroy(() => {
        if (animationFrame !== null) {
            cancelAnimationFrame(animationFrame);
            animationFrame = null;
            isAnimating = false;
        }
    });
</script>

<!-- Smoke layer (top-most) - rendered above everything -->
<g class="smoke-layer">
    {#each $smokeStore as particle (particle.id)}
        {@const age = animationTick - particle.timestamp}
        {@const progress = Math.min(age / GAME_CONSTANTS.SMOKE_DURATION_MS, 1)}
        {@const opacity = Math.max(0, 0.4 * (1.0 - progress))}
        {@const currentY = particle.y - (progress * 25 + particle.driftY)}
        {@const currentR = 2 + progress * 6}

        <!-- Outer glow (blurred) -->
        <circle
            class="smoke-particle-glow"
            cx={particle.x + particle.driftX * progress}
            cy={currentY}
            r={currentR * 1.5}
            fill="#222"
            fill-opacity={opacity * 0.25}
        />

        <!-- Main particle -->
        <circle
            class="smoke-particle"
            cx={particle.x}
            cy={currentY}
            r={currentR}
            fill="#111"
            fill-opacity={opacity * 0.35}
        />
    {/each}
</g>

<style>
    /* Smoke particle styling - matches old GAS version with box-shadow glow effect */
    :global(.smoke-particle),
    :global(.smoke-particle-glow) {
        pointer-events: none;
    }

    :global(.smoke-particle-glow) {
        filter: blur(2px);
    }
</style>
