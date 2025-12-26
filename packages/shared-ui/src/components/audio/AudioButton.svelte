<script lang="ts">
  import { onMount } from 'svelte';
  import IconButton from '../ui/IconButton.svelte';

  interface Props {
    audioSystem: {
      isAudioEnabled: () => boolean;
      toggle: () => Promise<boolean>;
      playSound: (sound: string) => Promise<void>;
    };
    testSound?: string;
  }

  let { audioSystem, testSound }: Props = $props();

  let isEnabled = $state(false);
  let isInitialized = $state(false);

  onMount(async () => {
    isEnabled = audioSystem.isAudioEnabled();
    isInitialized = true;
  });

  async function toggleAudio() {
    try {
      isEnabled = await audioSystem.toggle();

      // Play a test sound when enabling
      if (isEnabled && testSound) {
        setTimeout(async () => {
          await audioSystem.playSound(testSound);
        }, 100);
      }
    } catch (error) {
      console.warn('Error toggling audio:', error);
    }
  }
</script>

<IconButton title="Toggle Audio" onclick={toggleAudio} disabled={!isInitialized}>
    {#if isEnabled}🔊{:else}🔇{/if}
</IconButton>
