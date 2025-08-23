<script lang="ts">
  import { onMount } from 'svelte';
  import { fade, scale } from 'svelte/transition';
  import { getPlayerColor } from '$lib/game/constants/playerConfigs';
  import type { Player } from '$lib/game/GameState';

  export let player: Player;
  export let isVisible: boolean = true;
  export let onComplete: () => void = () => {};

  let bannerElement: HTMLElement;
  let animationComplete = false;

  onMount(() => {
    // Auto-dismiss after animation completes
    const timer = setTimeout(() => {
      animationComplete = true;
      onComplete();
    }, 3000); // Show for 3 seconds

    return () => clearTimeout(timer);
  });

  $: playerColor = getPlayerColor(player.index);
  $: isAI = player.type === 'AI';
</script>

{#if isVisible && !animationComplete}
  <div class="turn-banner-overlay"
       transition:fade={{ duration: 300 }}
       bind:this={bannerElement}
       on:click={() => { animationComplete = true; onComplete(); }}>
    <div class="turn-banner"
         transition:scale={{ duration: 600, start: 0.3 }}
         style="--player-color: {playerColor}">
      <div class="banner-content">
        <div class="turn-label">
          {isAI ? 'AI' : 'PLAYER'} TURN
        </div>
        <div class="player-name">
          {player.name}
        </div>
        <div class="player-indicator" style="background-color: {playerColor}"></div>
        <div class="banner-subtitle">
          {isAI ? 'AI is thinking...' : 'Your turn to move!'}
        </div>
      </div>
      <div class="banner-effects">
        <div class="energy-pulse"></div>
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
    background: rgba(0, 0, 0, 0.7);
    backdrop-filter: blur(4px);
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

  .banner-subtitle {
    font-size: 1.1rem;
    color: #94a3b8;
    font-weight: 500;
    letter-spacing: 0.05em;
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