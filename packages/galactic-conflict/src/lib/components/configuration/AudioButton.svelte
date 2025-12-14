<script lang="ts">
    import { audioSystem, SOUNDS } from '$lib/client/audio';
    import { onMount } from 'svelte';

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

<button
    class="audio-btn"
    title={isEnabled ? 'Mute Audio' : 'Enable Audio'}
    on:click={toggleAudio}
    disabled={!isInitialized}
>
    {#if isEnabled}🔊{:else}🔇{/if}
</button>

<style>
    .audio-btn {
        width: 36px;
        height: 36px;
        padding: 0;
        border: 1px solid #4b5563;
        border-radius: 8px;
        background: rgba(255, 255, 255, 0.05);
        color: #e5e7eb;
        font-size: 1.1rem;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s;
    }

    .audio-btn:hover:not(:disabled) {
        background: rgba(255, 255, 255, 0.1);
        border-color: #6b7280;
    }

    .audio-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }
</style>

