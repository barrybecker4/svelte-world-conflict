<script lang="ts">
  import { onDestroy } from 'svelte';
  import { getPlayerColor } from '$lib/game/constants/playerConfigs';
  import type { Player } from '$lib/game/state/GameState';
  import { GAME_CONSTANTS } from '$lib/game/constants/gameConstants';

  export let player: Player | null = null;
  export let isVisible: boolean = true;
  export let onComplete: () => void = () => {};
  export let type: 'turn' | 'elimination' | 'victory' = 'turn';
  export let duration: number | undefined = undefined; // Optional override for banner duration
  export let winner: Player | 'DRAWN_GAME' | null = null; // For victory banners

  let bannerElement: HTMLElement;
  let animationComplete = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let animating = false;
  let fadingOut = false;

  // Use custom duration if provided, otherwise use default from constants
  $: bannerDuration = duration !== undefined ? duration : GAME_CONSTANTS.BANNER_TIME;

  // Reset animation state when player or type changes
  $: if (player || type || winner) {
    console.log(`🎭 Banner component rendering:`, {
      playerName: player?.name,
      playerSlotIndex: player?.slotIndex,
      type,
      winner,
      isVisible
    });
    animationComplete = false;
    animating = false;
    fadingOut = false;
    
    // Trigger animation
    setTimeout(() => {
      animating = true;
    }, 10);
    
    if (timer) {
      clearTimeout(timer);
    }
    
    // Trigger fade-out 500ms before banner completes
    timer = setTimeout(() => {
      fadingOut = true;
      // Complete after fade-out finishes
      setTimeout(() => {
        animationComplete = true;
        onComplete();
      }, 500);
    }, bannerDuration - 500);
  }

  onDestroy(() => {
    if (timer) {
      clearTimeout(timer);
    }
  });

  $: playerColor = player ? getPlayerColor(player.slotIndex) : (winner && winner !== 'DRAWN_GAME' ? getPlayerColor(winner.slotIndex) : '#60a5fa');
  $: isElimination = type === 'elimination';
  $: isVictory = type === 'victory';

  // Generate banner text
  $: bannerText = (() => {
    if (isVictory) {
      if (winner === 'DRAWN_GAME') {
        return 'Game Draw!';
      } else if (winner) {
        return `${winner.name} Won!`;
      } else {
        return 'Game Over';
      }
    } else if (isElimination && player) {
      return `${player.name} has been eliminated!`;
    } else if (player) {
      return `${player.name}'s turn`;
    }
    return '';
  })();

  function skipBanner() {
    if (timer) {
      clearTimeout(timer);
    }
    animationComplete = true;
    onComplete();
  }
</script>

{#if isVisible && !animationComplete}
  <div class="banner-container"
       on:click={skipBanner}
       on:keydown={(e) => e.key === 'Enter' && skipBanner()}
       role="button"
       tabindex="0">
    <div class="banner"
         class:animating
         class:fading-out={fadingOut}
         class:elimination={isElimination}
         class:victory={isVictory}
         bind:this={bannerElement}
         style="background: {playerColor};">
      {bannerText}
    </div>
  </div>
{/if}

<style>
  .banner-container {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 1000;
    pointer-events: none;
    cursor: pointer;
  }

  .banner {
    position: absolute;
    top: 40%;
    left: -2.5%;
    height: 10.8%;
    width: 105%;
    text-align: center;
    padding-top: 1%;
    padding-right: 10%;
    border: 2px solid black;
    color: white;
    z-index: 100;
    font-size: 3.2em;
    box-shadow: 0 10px 10px 5px rgba(0, 0, 0, 0.7), inset 0 20px 2px rgba(255, 255, 255, 0.05);
    text-shadow: 2px 2px #000;
    transition: opacity 0.8s ease-in-out, transform 0.8s ease-in-out;
    pointer-events: auto;
    
    /* Initial state */
    opacity: 0;
    transform: translate3d(10px, -20px, 0);
  }

  .banner.animating {
    /* Animated state */
    opacity: 1;
    transform: translate3d(10px, 20px, 0);
  }

  .banner.fading-out {
    /* Fade out state */
    opacity: 0;
    transition: opacity 0.5s ease-in-out;
  }

  .banner.elimination {
    background: #222 !important;
  }

  .banner.victory {
    background: linear-gradient(135deg, #facc15, #f59e0b) !important;
    color: #1f2937;
    text-shadow: 2px 2px rgba(255, 255, 255, 0.3);
  }

  @media (max-width: 640px) {
    .banner {
      font-size: 2rem;
      height: 8%;
    }
  }
</style>
