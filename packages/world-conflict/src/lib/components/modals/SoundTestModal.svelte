<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import Modal from '$lib/components/ui/Modal.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import { audioSystem } from '$lib/client/audio/AudioSystem';
  import { SOUNDS } from '$lib/client/audio/sounds';

  const dispatch = createEventDispatcher();

  export let isOpen = true;

  // Define all available sounds with friendly names
  const soundList = [
    { key: 'GAME_CREATED', name: 'Game Created', icon: '🎮' },
    { key: 'GAME_STARTED', name: 'Game Started', icon: '🚀' },
    { key: 'GAME_WON', name: 'Victory', icon: '🏆' },
    { key: 'GAME_LOST', name: 'Defeat', icon: '💀' },
    { key: 'SOLDIERS_MOVE', name: 'Soldiers Move', icon: '👣' },
    { key: 'SOLDIERS_RECRUITED', name: 'Soldiers Recruited', icon: '🪖' },
    { key: 'ATTACK', name: 'Attack', icon: '⚔️' },
    { key: 'COMBAT', name: 'Combat', icon: '⚡' },
    { key: 'REGION_CONQUERED', name: 'Region Conquered', icon: '🏴' },
    { key: 'TEMPLE_UPGRADED', name: 'Temple Upgraded', icon: '✨' },
    { key: 'INCOME', name: 'Income', icon: '💰' },
    { key: 'OUT_OF_TIME', name: 'Out of Time', icon: '⏰' },
    { key: 'ALMOST_OUT_OF_TIME', name: 'Almost Out of Time', icon: '⏱️' },
    { key: 'CLICK', name: 'Click', icon: '👆' },
    { key: 'HOVER', name: 'Hover', icon: '🔘' },
    { key: 'ERROR', name: 'Error', icon: '❌' },
  ];

  let playingSound: string | null = null;

  async function playSound(soundKey: string) {
    try {
      playingSound = soundKey;
      const soundType = SOUNDS[soundKey as keyof typeof SOUNDS];
      await audioSystem.playSound(soundType);
      // Clear the playing state after a brief delay
      setTimeout(() => {
        if (playingSound === soundKey) {
          playingSound = null;
        }
      }, 500);
    } catch (error) {
      console.error(`Failed to play sound ${soundKey}:`, error);
      playingSound = null;
    }
  }

  function handleClose() {
    dispatch('close');
    isOpen = false;
  }
</script>

<Modal
  {isOpen}
  title="Test Game Sounds"
  width="600px"
  on:close={handleClose}
>
  <div class="sound-test-container">
    <p class="description">
      Click any button below to test a sound effect:
    </p>

    <div class="sound-grid">
      {#each soundList as sound}
        <Button
          variant={playingSound === sound.key ? 'success' : 'secondary'}
          size="md"
          on:click={() => playSound(sound.key)}
          disabled={playingSound !== null && playingSound !== sound.key}
        >
          <span class="sound-icon">{sound.icon}</span>
          <span class="sound-name">{sound.name}</span>
        </Button>
      {/each}
    </div>
  </div>

  <svelte:fragment slot="footer">
    <Button variant="primary" on:click={handleClose}>
      Close
    </Button>
  </svelte:fragment>
</Modal>

<style>
  .sound-test-container {
    padding: 0.5rem 0;
  }

  .description {
    color: #cbd5e1;
    margin-bottom: 1.5rem;
    text-align: center;
  }

  .sound-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
    gap: 0.75rem;
    max-height: 60vh;
    overflow-y: auto;
    padding: 0.5rem;
  }

  .sound-grid :global(button) {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 1rem;
    min-height: 80px;
  }

  .sound-icon {
    font-size: 1.5rem;
  }

  .sound-name {
    font-size: 0.875rem;
    text-align: center;
    line-height: 1.2;
  }

  /* Scrollbar styling */
  .sound-grid::-webkit-scrollbar {
    width: 8px;
  }

  .sound-grid::-webkit-scrollbar-track {
    background: rgba(15, 23, 42, 0.5);
    border-radius: 4px;
  }

  .sound-grid::-webkit-scrollbar-thumb {
    background: #475569;
    border-radius: 4px;
  }

  .sound-grid::-webkit-scrollbar-thumb:hover {
    background: #64748b;
  }
</style>

