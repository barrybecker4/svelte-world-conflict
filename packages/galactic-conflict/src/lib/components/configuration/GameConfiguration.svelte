<script lang="ts">
    import { createEventDispatcher, onMount } from 'svelte';
    import type { PlayerSlot, GameSettings, AiDifficulty } from '$lib/game/entities/gameTypes';
    import { GALACTIC_CONSTANTS } from '$lib/game/constants/gameConstants';
    import { getPlayerDefaultName } from '$lib/game/constants/playerConfigs';
    import { loadPlayerName } from '$lib/client/stores/clientStorage';
    import { AudioButton, SoundTestModal } from 'shared-ui';
    import { audioSystem, SOUNDS, SOUND_ICONS } from '$lib/client/audio';
    import GalaxySettingsPanel from './GalaxySettingsPanel.svelte';
    import PlayerSlotsManager from './PlayerSlotsManager.svelte';

    const dispatch = createEventDispatcher();

    let showSoundTestModal = false;

    // Convert SNAKE_CASE to Title Case
    function formatSoundName(key: string): string {
        return key
            .split('_')
            .map(word => word.charAt(0) + word.slice(1).toLowerCase())
            .join(' ');
    }

    // Generate sound list from SOUNDS constant
    $: soundList = Object.keys(SOUNDS).map(key => ({
        key,
        name: formatSoundName(key),
        icon: SOUND_ICONS[key] || '🔊'
    }));

    async function handlePlaySound(soundKey: string) {
        const soundType = SOUNDS[soundKey as keyof typeof SOUNDS];
        await audioSystem.playSound(soundType);
    }

    // Game settings
    let neutralPlanetCount = GALACTIC_CONSTANTS.DEFAULT_NEUTRAL_PLANET_COUNT;
    let gameDuration = GALACTIC_CONSTANTS.DEFAULT_GAME_DURATION_MINUTES;
    let armadaSpeed = GALACTIC_CONSTANTS.DEFAULT_ARMADA_SPEED;
    let neutralShipsMin = GALACTIC_CONSTANTS.NEUTRAL_SHIPS_MIN;
    let neutralShipsMultiplierMax = GALACTIC_CONSTANTS.NEUTRAL_SHIPS_MULTIPLIER_MAX;
    let productionRate = GALACTIC_CONSTANTS.DEFAULT_PRODUCTION_RATE;

    // Dynamic player slots - start with creator and one AI player
    let playerSlots: PlayerSlot[] = [];
    let nextSlotIndex = 0; // Tracks the next available slot index for color assignment

    // Initialize slots on mount
    onMount(() => {
        const currentName = loadPlayerName() || 'Player';
        
        // Creator slot (index 0) and default AI opponent
        playerSlots = [
            {
                slotIndex: 0,
                type: 'Set',
                name: currentName,
            },
            {
                slotIndex: 1,
                type: 'AI',
                name: getPlayerDefaultName(1),
                difficulty: 'easy',
            }
        ];
        nextSlotIndex = 2;
    });

    // Get the next available slot index
    function getNextSlotIndex(): number {
        const index = nextSlotIndex;
        nextSlotIndex++;
        return index;
    }

    // Add a new open slot for human players to join
    function addOpenSlot() {
        if (playerSlots.length >= GALACTIC_CONSTANTS.MAX_PLAYERS) {
            return; // Max players reached
        }
        
        const slotIndex = getNextSlotIndex();
        playerSlots = [...playerSlots, {
            slotIndex,
            type: 'Open',
        }];
    }

    // Add a new AI player with space-themed name
    function addAIPlayer() {
        if (playerSlots.length >= GALACTIC_CONSTANTS.MAX_PLAYERS) {
            return; // Max players reached
        }
        
        const slotIndex = getNextSlotIndex();
        playerSlots = [...playerSlots, {
            slotIndex,
            type: 'AI',
            name: getPlayerDefaultName(slotIndex),
            difficulty: 'easy', // Default difficulty
        }];
    }

    // Update difficulty for an AI slot
    function updateDifficulty(slotIndex: number, difficulty: AiDifficulty) {
        playerSlots = playerSlots.map(slot => 
            slot.slotIndex === slotIndex 
                ? { ...slot, difficulty }
                : slot
        );
    }

    // Remove a player slot (cannot remove creator at index 0)
    function removeSlot(slotIndex: number) {
        const slotToRemove = playerSlots.find(s => s.slotIndex === slotIndex);
        if (!slotToRemove || slotToRemove.slotIndex === 0) {
            return; // Cannot remove creator slot
        }
        
        playerSlots = playerSlots.filter(s => s.slotIndex !== slotIndex);
    }

    function handleCreateGame() {
        if (playerSlots.length < 2) {
            alert('At least 2 players are required');
            return;
        }

        const settings: GameSettings = {
            neutralPlanetCount,
            armadaSpeed,
            gameDuration,
            stateBroadcastInterval: GALACTIC_CONSTANTS.DEFAULT_STATE_BROADCAST_INTERVAL_MS,
            neutralShipsMin,
            neutralShipsMultiplierMax,
            productionRate,
        };

        dispatch('gameCreated', {
            playerSlots,
            settings,
        });
    }

    function handleClose() {
        dispatch('close');
    }

    $: canAddMorePlayers = playerSlots.length < GALACTIC_CONSTANTS.MAX_PLAYERS;
</script>

<div class="config-overlay">
    <div class="config-container">
        <header>
            <h1>🌌 New Game</h1>
            <p class="subtitle">Configure your galactic conquest</p>
        </header>

        <div class="content">
            <!-- Galaxy Settings -->
            <GalaxySettingsPanel
                bind:neutralPlanetCount
                bind:gameDuration
                bind:armadaSpeed
                bind:productionRate
                bind:neutralShipsMin
                bind:neutralShipsMultiplierMax
                playerCount={playerSlots.length}
            />

            <!-- Player Slots -->
            <PlayerSlotsManager
                bind:playerSlots
                {canAddMorePlayers}
                onAddOpenSlot={addOpenSlot}
                onAddAIPlayer={addAIPlayer}
                onRemoveSlot={removeSlot}
                onUpdateDifficulty={updateDifficulty}
            />

            <!-- Audio Settings -->
            <section class="audio-section">
                <h2>Audio</h2>
                <div class="audio-controls">
                    <AudioButton {audioSystem} testSound={SOUNDS.CLICK} />
                    {#if import.meta.env.DEV}
                        <button 
                            class="test-sounds-btn" 
                            on:click={() => showSoundTestModal = true}
                            title="Test all game sounds"
                        >
                            🎵 Test Sounds
                        </button>
                    {/if}
                </div>
            </section>
        </div>

        <footer>
            <button class="back-btn" on:click={handleClose}>
                Back
            </button>
            <button 
                class="create-btn" 
                on:click={handleCreateGame}
                disabled={playerSlots.length < 2}
            >
                Create Game 🚀
            </button>
        </footer>
    </div>
</div>

{#if import.meta.env.DEV && showSoundTestModal}
    <SoundTestModal 
        isOpen={showSoundTestModal} 
        onclose={() => showSoundTestModal = false}
        {soundList}
        onPlaySound={handlePlaySound}
    />
{/if}

<style>
    .config-overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: linear-gradient(135deg, #0f0f1a 0%, #1a1a2e 100%);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
        padding: 1rem;
    }

    .config-container {
        background: linear-gradient(145deg, #1e1e2e, #2a2a3e);
        border: 2px solid #4c1d95;
        border-radius: 16px;
        width: 100%;
        max-width: 700px;
        max-height: 90vh;
        overflow-y: auto;
        color: #e5e7eb;
    }

    header {
        text-align: center;
        padding: 1.5rem;
        border-bottom: 1px solid #374151;
    }

    h1 {
        margin: 0;
        font-size: 1.75rem;
        color: #a78bfa;
    }

    h2 {
        margin: 0 0 1rem;
        font-size: 1rem;
        color: #9ca3af;
        text-transform: uppercase;
        letter-spacing: 0.05em;
    }

    .subtitle {
        margin: 0.5rem 0 0;
        color: #9ca3af;
    }

    .content {
        padding: 1.5rem;
    }


    footer {
        display: flex;
        justify-content: space-between;
        padding: 1.5rem;
        border-top: 1px solid #374151;
    }

    .back-btn {
        padding: 0.75rem 2rem;
        background: #374151;
        border: none;
        border-radius: 8px;
        color: #e5e7eb;
        cursor: pointer;
    }

    .back-btn:hover {
        background: #4b5563;
    }

    .create-btn {
        padding: 0.75rem 2rem;
        background: linear-gradient(135deg, #7c3aed, #a855f7);
        border: none;
        border-radius: 8px;
        color: white;
        font-weight: 600;
        font-size: 1rem;
        cursor: pointer;
    }

    .create-btn:hover:not(:disabled) {
        background: linear-gradient(135deg, #6d28d9, #9333ea);
    }

    .create-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }


    /* Audio section */
    .audio-section {
        margin-top: 1rem;
        padding-top: 1rem;
        border-top: 1px solid #374151;
    }

    .audio-controls {
        display: flex;
        align-items: center;
        gap: 0.75rem;
    }

    .test-sounds-btn {
        padding: 0.5rem 1rem;
        background: rgba(168, 85, 247, 0.15);
        border: 1px solid #7c3aed;
        border-radius: 8px;
        color: #c4b5fd;
        font-size: 0.9rem;
        cursor: pointer;
        transition: all 0.2s;
    }

    .test-sounds-btn:hover {
        background: rgba(168, 85, 247, 0.25);
        border-color: #a855f7;
        color: #e9d5ff;
    }
</style>
