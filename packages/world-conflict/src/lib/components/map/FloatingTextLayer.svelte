<script lang="ts">
  import { onDestroy } from 'svelte';
  import type { FloatingText } from '$lib/game/entities/gameTypes';

  export let floatingTexts: FloatingText[] = [];

  interface AnimatedFloatingText extends FloatingText {
    id: string;
    timestamp: number;
  }

  let activeTexts: AnimatedFloatingText[] = [];
  let animationTick = 0;
  let animationFrame: number | null = null;
  let isAnimating = false;

  // Track which texts we've already displayed - cleared when floatingTexts array is emptied
  let displayedTexts = new Set<string>();
  let lastTextArrayLength = 0;

  // When new floating texts arrive, add them to our active list
  $: {
    if (floatingTexts && floatingTexts.length > 0) {
      const now = Date.now();
      
      // Only process if the array has changed (new items added)
      if (floatingTexts.length > lastTextArrayLength) {
        floatingTexts.forEach((text, index) => {
          // Create a stable unique ID based on position and text content
          const textKey = `${text.x.toFixed(2)}-${text.y.toFixed(2)}-${text.text}`;
          
          // Only add if we've never displayed this text in the current batch
          if (!displayedTexts.has(textKey)) {
            const textId = `${textKey}-${now}`;
            displayedTexts.add(textKey);
            
            activeTexts = [
              ...activeTexts,
              {
                ...text,
                id: textId,
                timestamp: now
              }
            ];
            
            // Remove text after its duration
            setTimeout(() => {
              activeTexts = activeTexts.filter(t => t.id !== textId);
            }, text.duration);
          }
        });
        lastTextArrayLength = floatingTexts.length;
      }
    } else {
      // Reset when array is empty - allows same region to show text again in future turns
      if (lastTextArrayLength > 0) {
        displayedTexts.clear();
        lastTextArrayLength = 0;
      }
    }
  }

  function startAnimationLoop() {
    if (isAnimating) return;

    isAnimating = true;
    function tick() {
      animationTick = Date.now();
      if (activeTexts.length > 0) {
        animationFrame = requestAnimationFrame(tick);
      } else {
        isAnimating = false;
        animationFrame = null;
      }
    }
    tick();
  }

  // Start/stop animation loop based on active texts
  $: if (activeTexts.length > 0 && !isAnimating) {
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

<!-- Floating text layer (top-most) - rendered above everything -->
<g class="floating-text-layer">
{#each activeTexts as text (text.id)}
  {@const age = animationTick - text.timestamp}
  {@const progress = Math.min(age / text.duration, 1)}
  {@const opacity = Math.max(0, 1.0 - progress)}
  {@const currentY = text.y - (progress * 80)} <!-- Float upward -->
  {@const scale = 1 + (progress * 0.5)} <!-- Grow slightly -->

  <!-- Shadow/outline for better visibility -->
  <text
    class="floating-text-shadow"
    x={text.x}
    y={currentY}
    text-anchor="middle"
    dominant-baseline="middle"
    style="font-size: {16 * scale}px; font-weight: bold; fill: #000; opacity: {opacity * 0.8}; stroke: #000; stroke-width: 3px; paint-order: stroke;"
  >
    {text.text}
  </text>

  <!-- Main text -->
  <text
    class="floating-text-main"
    x={text.x}
    y={currentY}
    text-anchor="middle"
    dominant-baseline="middle"
    style="font-size: {16 * scale}px; font-weight: bold; fill: {text.color}; opacity: {opacity};"
  >
    {text.text}
  </text>
{/each}
</g>

<style>
  .floating-text-layer {
    pointer-events: none;
  }

  .floating-text-shadow,
  .floating-text-main {
    font-family: 'Arial', sans-serif;
    letter-spacing: 0.5px;
  }
  
  .floating-text-shadow {
    filter: blur(1px);
  }
</style>

