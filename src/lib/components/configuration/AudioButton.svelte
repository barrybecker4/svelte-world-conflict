<script lang="ts">
  import { audioSystem } from '$lib/client/audio/AudioSystem';
  import { onMount, onDestroy } from 'svelte';
  import IconButton from '$lib/components/ui/IconButton.svelte';

  let isEnabled = false;
  let volume = 0.5;
  let isInitialized = false;

  onMount(async () => {
    isEnabled = audioSystem.isAudioEnabled();
    volume = audioSystem.getVolume();
    isInitialized = true;
  });

  async function toggleAudio() {
    try {
      isEnabled = await audioSystem.toggle();

      // Play a test sound when enabling
      if (isEnabled) {
        setTimeout(async () => {
          await audioSystem.playSound(SOUNDS.CLICK);
        }, 100);
      }
    } catch (error) {
      console.warn('Error toggling audio:', error);
    }
  }

  function handleVolumeChange(event: Event) {
    const target = event.target as HTMLInputElement;
    volume = parseFloat(target.value);
    audioSystem.setVolume(volume);
  }

  async function testSound() {
    if (isEnabled) {
      await audioSystem.playSound(SOUNDS.CLICK);
    }
  }
</script>

<IconButton title="Toggle Audio" on:click={toggleAudio} disabled={!isInitialized}>
    {#if isEnabled}🔊{:else}🔇{/if}
</IconButton>
