<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { fade, scale } from 'svelte/transition';
  import { getPlayerColor } from '$lib/game/constants/playerConfigs';
  import type { Player } from '$lib/game/state/GameState';
  import { GAME_CONSTANTS } from '$lib/game/constants/gameConstants';

  export let player: Player;
  export let isVisible: boolean = true;
  export let onComplete: () => void = () => {};
  export let type: 'turn' | 'elimination' = 'turn';

  let bannerElement: HTMLElement;
  let animationComplete = false;
  let timer: ReturnType<typeof setTimeout> | null = null;

  // Reset animation state when player or type changes
  $: if (player || type) {
    animationComplete = false;
    if (timer) {
      clearTimeout(timer);
    }
    timer = setTimeout(() => {
      animationComplete = true;
      onComplete();
    }, GAME_CONSTANTS.BANNER_TIME);
  }

  onDestroy(() => {
    if (timer) {
      clearTimeout(timer);
    }
  });

  $: playerColor = getPlayerColor(player.slotIndex);
  $: isAI = player.isAI;
  $: isElimination = type === 'elimination';

  function skipBanner() {
    if (timer) {
      clearTimeout(timer);
    }
    animationComplete = true;
    onComplete();
  }
</script>

{#if isVisible && !animationComplete}
  <div class="turn-banner-overlay"
       transition:fade={{ duration: 300 }}
       bind:this={bannerElement}
       on:click={skipBanner}
       on:keydown={(e) => e.key === 'Enter' && skipBanner()}
       role="button"
       tabindex="0">
    <div class="turn-banner"
         class:elimination={isElimination}
         transition:scale={{ duration: 600, start: 0.3 }}
         style="--player-color: {playerColor}">
      <div class="banner-content">
        <div class="turn-label">
          {#if isElimination}
            ELIMINATED
          {:else}
            {isAI ? 'AI' : 'PLAYER'} TURN
          {/if}
        </div>
        <div class="player-name" class:eliminated={isElimination}>
          {player.name}
        </div>
        <div class="player-indicator" 
             class:eliminated={isElimination}
             style="background-color: {playerColor}; {isElimination ? 'opacity: 0.5;' : ''}"></div>
        <div class="banner-subtitle">
          {#if isElimination}
            Conquered by opponents
          {:else}
            {isAI ? 'AI is thinking...' : 'Your move!'}
          {/if}
        </div>
        <div class="skip-hint">
          Click to continue
        </div>
      </div>
      <div class="banner-effects">
        <div class="energy-pulse" class:fade-pulse={isElimination}></div>
        <div class="corner-frame top-left"></div>
        <div class="corner-frame top-right"></div>
        <div class="corner-frame bottom-left"></div>
        <div class="corner-frame bottom-right"></div>
      </div>
    </div>
  </div>
{/if}

<style>
  .turn-banner-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.3); /* Not too opaque */
    backdrop-filter: blur(1px); /* Not too much blurring */
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    cursor: pointer;
  }

  .turn-banner {
    position: relative;
    background: linear-gradient(135deg,
                rgba(15, 23, 42, 0.95),
                rgba(30, 41, 59, 0.95));
    border: 3px solid var(--player-color);
    border-radius: 16px;
    padding: 2rem 3rem;
    min-width: 400px;
    text-align: center;
    box-shadow:
      0 20px 40px rgba(0, 0, 0, 0.5),
      0 0 50px rgba(var(--player-color), 0.3),
      inset 0 1px 0 rgba(255, 255, 255, 0.1);
    overflow: hidden;
  }

  .turn-banner.elimination {
    background: linear-gradient(135deg,
                rgba(20, 20, 20, 0.95),
                rgba(40, 30, 30, 0.95));
    /* Keep player color for border - don't override with red */
    box-shadow:
      0 20px 40px rgba(0, 0, 0, 0.7),
      0 0 50px var(--player-color),
      inset 0 1px 0 rgba(255, 255, 255, 0.1);
  }

  .banner-content {
    position: relative;
    z-index: 2;
  }

  .turn-label {
    font-size: 0.9rem;
    font-weight: 700;
    letter-spacing: 0.2em;
    color: var(--player-color);
    text-transform: uppercase;
    margin-bottom: 0.5rem;
    text-shadow: 0 0 10px currentColor;
  }

  .turn-banner.elimination .turn-label {
    color: var(--player-color);
    text-shadow: 0 0 10px var(--player-color);
  }

  .player-name {
    font-size: 2.5rem;
    font-weight: 900;
    color: white;
    margin-bottom: 1rem;
    text-shadow:
      2px 2px 4px rgba(0, 0, 0, 0.8),
      0 0 20px var(--player-color);
    animation: nameGlow 2s ease-in-out infinite alternate;
  }

  .player-name.eliminated {
    text-decoration: line-through;
    text-decoration-color: #dc2626;
    text-decoration-thickness: 3px;
  }

  .player-indicator {
    width: 60px;
    height: 60px;
    border-radius: 50%;
    margin: 1rem auto;
    border: 4px solid rgba(255, 255, 255, 0.3);
    box-shadow:
      0 0 20px currentColor,
      inset 0 0 20px rgba(255, 255, 255, 0.1);
    animation: pulse 2s ease-in-out infinite;
  }

  .player-indicator.eliminated {
    border-color: rgba(220, 38, 38, 0.5);
    box-shadow:
      0 0 20px rgba(220, 38, 38, 0.5),
      inset 0 0 20px rgba(0, 0, 0, 0.5);
    animation: fadeOut 2s ease-in-out infinite;
  }

  .banner-subtitle {
    font-size: 1.1rem;
    color: #94a3b8;
    font-weight: 500;
    letter-spacing: 0.05em;
    margin-bottom: 1rem;
  }

  .skip-hint {
    font-size: 0.8rem;
    color: #64748b;
    font-weight: 400;
    margin-top: 0.5rem;
    opacity: 0.8;
  }

  .banner-effects {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    pointer-events: none;
  }

  .energy-pulse {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 300px;
    height: 300px;
    background: radial-gradient(circle,
                var(--player-color) 0%,
                transparent 70%);
    opacity: 0.1;
    border-radius: 50%;
    animation: energyPulse 3s ease-in-out infinite;
  }

  .energy-pulse.fade-pulse {
    width: 200%;
    height: 200%;
    /* Use player color instead of hardcoded red */
    background: radial-gradient(circle, var(--player-color) 0%, transparent 70%);
    opacity: 0.05;
    animation: fadeOut 2s ease-in-out infinite;
  }

  .corner-frame {
    position: absolute;
    width: 40px;
    height: 40px;
    border: 2px solid var(--player-color);
    opacity: 0.6;
  }

  .corner-frame.top-left {
    top: 10px;
    left: 10px;
    border-right: none;
    border-bottom: none;
    border-top-left-radius: 8px;
  }

  .corner-frame.top-right {
    top: 10px;
    right: 10px;
    border-left: none;
    border-bottom: none;
    border-top-right-radius: 8px;
  }

  .corner-frame.bottom-left {
    bottom: 10px;
    left: 10px;
    border-right: none;
    border-top: none;
    border-bottom-left-radius: 8px;
  }

  .corner-frame.bottom-right {
    bottom: 10px;
    right: 10px;
    border-left: none;
    border-top: none;
    border-bottom-right-radius: 8px;
  }

  @keyframes nameGlow {
    0% { text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.8), 0 0 20px var(--player-color); }
    100% { text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.8), 0 0 30px var(--player-color); }
  }

  @keyframes pulse {
    0% {
      transform: scale(1);
      box-shadow: 0 0 20px var(--player-color), inset 0 0 20px rgba(255, 255, 255, 0.1);
    }
    50% {
      transform: scale(1.05);
      box-shadow: 0 0 30px var(--player-color), inset 0 0 30px rgba(255, 255, 255, 0.2);
    }
    100% {
      transform: scale(1);
      box-shadow: 0 0 20px var(--player-color), inset 0 0 20px rgba(255, 255, 255, 0.1);
    }
  }

  @keyframes energyPulse {
    0% {
      transform: translate(-50%, -50%) scale(0.8);
      opacity: 0.1;
    }
    50% {
      transform: translate(-50%, -50%) scale(1.2);
      opacity: 0.2;
    }
    100% {
      transform: translate(-50%, -50%) scale(0.8);
      opacity: 0.1;
    }
  }

  @keyframes fadeOut {
    0%, 100% {
      opacity: 0.3;
    }
    50% {
      opacity: 0.6;
    }
  }

  @media (max-width: 640px) {
    .turn-banner {
      min-width: 300px;
      padding: 1.5rem 2rem;
    }

    .player-name {
      font-size: 2rem;
    }

    .player-indicator {
      width: 50px;
      height: 50px;
    }
  }
</style>
