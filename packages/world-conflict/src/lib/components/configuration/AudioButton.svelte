<script lang="ts">
  import { audioSystem } from '$lib/client/audio/AudioSystem';
  import { SOUNDS } from '$lib/client/audio/sounds';
  import { onMount } from 'svelte';
  import IconButton from '$lib/components/ui/IconButton.svelte';

  let isEnabled = false;
  let isInitialized = false;

  onMount(async () => {
    isEnabled = audioSystem.isAudioEnabled();
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
</script>

<IconButton title="Toggle Audio" on:click={toggleAudio} disabled={!isInitialized}>
    {#if isEnabled}🔊{:else}🔇{/if}
</IconButton>
