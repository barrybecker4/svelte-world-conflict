<script lang="ts">
    import { audioSystem, SOUNDS, SOUND_ICONS } from '$lib/client/audio';
    import { logger } from 'multiplayer-framework/shared';

    export let isOpen = true;
    export let onClose: () => void = () => {};

    // Convert SNAKE_CASE to Title Case
    function formatSoundName(key: string): string {
        return key
            .split('_')
            .map(word => word.charAt(0) + word.slice(1).toLowerCase())
            .join(' ');
    }

    // Generate sound list from SOUNDS constant
    const soundList = Object.keys(SOUNDS).map(key => ({
        key,
        name: formatSoundName(key),
        icon: SOUND_ICONS[key] || '🔊'
    }));

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
            logger.error(`Failed to play sound ${soundKey}:`, error);
            playingSound = null;
        }
    }

    function handleClose() {
        onClose();
    }

    function handleKeydown(event: KeyboardEvent) {
        if (event.key === 'Escape') {
            handleClose();
        }
    }
</script>

{#if isOpen}
    <div 
        class="modal-overlay" 
        on:click={handleClose} 
        on:keydown={handleKeydown}
        role="button" 
        tabindex="-1"
    >
        <div 
            class="modal" 
            on:click|stopPropagation 
            on:keydown|stopPropagation
            role="dialog"
            aria-modal="true"
            aria-labelledby="sound-test-title"
        >
            <header>
                <h2 id="sound-test-title">🔊 Test Game Sounds</h2>
                <button class="close-btn" on:click={handleClose}>×</button>
            </header>

            <div class="content">
                <p class="description">
                    Click any button below to test a sound effect:
                </p>

                <div class="sound-grid">
                    {#each soundList as sound}
                        <button
                            class="sound-btn"
                            class:playing={playingSound === sound.key}
                            on:click={() => playSound(sound.key)}
                            disabled={playingSound !== null && playingSound !== sound.key}
                        >
                            <span class="sound-icon">{sound.icon}</span>
                            <span class="sound-name">{sound.name}</span>
                        </button>
                    {/each}
                </div>
            </div>

            <footer>
                <button class="primary-btn" on:click={handleClose}>
                    Close
                </button>
            </footer>
        </div>
    </div>
{/if}

<style>
    .modal-overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.8);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
        backdrop-filter: blur(4px);
    }

    .modal {
        background: linear-gradient(145deg, #1a1a2e, #16162a);
        border: 1px solid #4c1d95;
        border-radius: 16px;
        width: 90%;
        max-width: 600px;
        max-height: 80vh;
        overflow: hidden;
        display: flex;
        flex-direction: column;
        box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5);
    }

    header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 1rem 1.5rem;
        border-bottom: 1px solid #374151;
    }

    h2 {
        margin: 0;
        font-size: 1.25rem;
        color: #a78bfa;
    }

    .close-btn {
        background: none;
        border: none;
        color: #9ca3af;
        font-size: 1.5rem;
        cursor: pointer;
        padding: 0;
        line-height: 1;
        transition: color 0.2s;
    }

    .close-btn:hover {
        color: #e5e7eb;
    }

    .content {
        padding: 1.5rem;
        overflow-y: auto;
        flex: 1;
    }

    .description {
        color: #9ca3af;
        margin: 0 0 1.5rem 0;
        text-align: center;
    }

    .sound-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
        gap: 0.75rem;
    }

    .sound-btn {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 0.5rem;
        padding: 1rem;
        min-height: 80px;
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid #374151;
        border-radius: 8px;
        color: #e5e7eb;
        cursor: pointer;
        transition: all 0.2s;
    }

    .sound-btn:hover:not(:disabled) {
        background: rgba(168, 85, 247, 0.2);
        border-color: #7c3aed;
    }

    .sound-btn.playing {
        background: rgba(34, 197, 94, 0.2);
        border-color: #22c55e;
    }

    .sound-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }

    .sound-icon {
        font-size: 1.5rem;
    }

    .sound-name {
        font-size: 0.8rem;
        text-align: center;
        line-height: 1.2;
        color: #9ca3af;
    }

    footer {
        display: flex;
        justify-content: flex-end;
        padding: 1rem 1.5rem;
        border-top: 1px solid #374151;
    }

    .primary-btn {
        padding: 0.75rem 2rem;
        background: linear-gradient(135deg, #7c3aed, #a855f7);
        border: none;
        border-radius: 8px;
        color: white;
        font-weight: 600;
        font-size: 1rem;
        cursor: pointer;
        transition: all 0.2s;
    }

    .primary-btn:hover {
        background: linear-gradient(135deg, #6d28d9, #9333ea);
        transform: scale(1.02);
    }
</style>

