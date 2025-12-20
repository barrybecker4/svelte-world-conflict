<script lang="ts">
    import { createEventDispatcher, onMount } from 'svelte';
    import type { PlayerSlot, GameSettings, AiDifficulty } from '$lib/game/entities/gameTypes';
    import { GALACTIC_CONSTANTS } from '$lib/game/constants/gameConstants';
    import { getPlayerDefaultName, getPlayerColor } from '$lib/game/constants/playerConfigs';
    import { loadPlayerName } from '$lib/client/stores/clientStorage';
    import AudioButton from './AudioButton.svelte';
    import SoundTestModal from '../modals/SoundTestModal.svelte';

    const dispatch = createEventDispatcher();

    let showSoundTestModal = false;

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
            <section class="settings-section">
                <h2>Galaxy Settings</h2>
                
                <div class="setting-row">
                    <label for="neutral-planet-count">
                        <span class="label-text">Neutral Planets</span>
                        <span class="label-value">{neutralPlanetCount}</span>
                    </label>
                    <input
                        type="range"
                        id="neutral-planet-count"
                        bind:value={neutralPlanetCount}
                        min={0}
                        max={GALACTIC_CONSTANTS.MAX_PLANETS - playerSlots.length}
                        step="1"
                    />
                    <span class="tooltip">Number of neutral planets to conquer. Total planets = players ({playerSlots.length}) + neutral planets ({neutralPlanetCount}).</span>
                </div>

                <div class="setting-row">
                    <label for="game-duration">
                        <span class="label-text">Duration</span>
                        <span class="label-value">{gameDuration} min</span>
                    </label>
                    <input
                        type="range"
                        id="game-duration"
                        bind:value={gameDuration}
                        min={GALACTIC_CONSTANTS.GAME_DURATION_MIN_MINUTES}
                        max={GALACTIC_CONSTANTS.GAME_DURATION_MAX_MINUTES}
                        step="1"
                    />
                    <span class="tooltip">How long the game lasts. Player with most ships when time expires wins.</span>
                </div>

                <div class="setting-row">
                    <label for="armada-speed">
                        <span class="label-text">Armada Speed</span>
                        <span class="label-value">{armadaSpeed}</span>
                    </label>
                    <input
                        type="range"
                        id="armada-speed"
                        bind:value={armadaSpeed}
                        min={GALACTIC_CONSTANTS.ARMADA_SPEED_MIN}
                        max={GALACTIC_CONSTANTS.ARMADA_SPEED_MAX}
                        step="10"
                    />
                    <span class="tooltip">Fleet travel speed (units/min). Higher = faster reinforcements and attacks.</span>
                </div>

                <div class="setting-row">
                    <label for="production-rate">
                        <span class="label-text">Production</span>
                        <span class="label-value">{productionRate}x</span>
                    </label>
                    <input
                        type="range"
                        id="production-rate"
                        bind:value={productionRate}
                        min={GALACTIC_CONSTANTS.PRODUCTION_RATE_MIN}
                        max={GALACTIC_CONSTANTS.PRODUCTION_RATE_MAX}
                        step="0.5"
                    />
                    <span class="tooltip">Resources per planet volume per minute. Higher = faster ship production.</span>
                </div>

                <div class="setting-row">
                    <label for="neutral-ships-min">
                        <span class="label-text">Neutral Min</span>
                        <span class="label-value">{neutralShipsMin}</span>
                    </label>
                    <input
                        type="range"
                        id="neutral-ships-min"
                        bind:value={neutralShipsMin}
                        min={0}
                        max={50}
                        step="1"
                    />
                    <span class="tooltip">Minimum defenders on neutral planets. Higher = harder early expansion.</span>
                </div>

                <div class="setting-row">
                    <label for="neutral-ships-multiplier">
                        <span class="label-text">Neutral Max</span>
                        <span class="label-value">{neutralShipsMultiplierMax}x</span>
                    </label>
                    <input
                        type="range"
                        id="neutral-ships-multiplier"
                        bind:value={neutralShipsMultiplierMax}
                        min={0}
                        max={5}
                        step="0.5"
                    />
                    <span class="tooltip">Max defender scaling by planet size. Higher = bigger planets have more defenders.</span>
                </div>
            </section>

            <!-- Player Slots -->
            <section class="players-section">
                <h2>Players ({playerSlots.length})</h2>
                
                <div class="add-player-buttons">
                    <button
                        class="add-btn add-open"
                        on:click={addOpenSlot}
                        disabled={!canAddMorePlayers}
                    >
                        <span class="add-icon">+</span>
                        Add Open Slot
                    </button>
                    <button
                        class="add-btn add-ai"
                        on:click={addAIPlayer}
                        disabled={!canAddMorePlayers}
                    >
                        <span class="add-icon">+</span>
                        Add AI Player
                    </button>
                </div>

                <div class="player-grid">
                    {#each playerSlots as slot (slot.slotIndex)}
                        <div
                            class="player-slot"
                            class:human={slot.type === 'Set'}
                            class:ai={slot.type === 'AI'}
                            class:open={slot.type === 'Open'}
                        >
                            <div 
                                class="slot-color"
                                style="background-color: {getPlayerColor(slot.slotIndex)}"
                            ></div>
                            <div class="slot-info">
                                <span class="slot-name">
                                    <span class="slot-icon">
                                        {slot.type === 'Set' ? '👤' : 
                                         slot.type === 'AI' ? '🤖' : 
                                         '🔓'}
                                    </span>
                                    {#if slot.type === 'Set'}
                                        {slot.name || 'You'}
                                    {:else if slot.type === 'AI'}
                                        {slot.name || 'AI'}
                                    {:else if slot.type === 'Open'}
                                        &lt;Open&gt;
                                    {/if}
                                </span>
                                {#if slot.type === 'AI'}
                                    <select
                                        class="difficulty-select"
                                        value={slot.difficulty || 'easy'}
                                        on:change={(e) => updateDifficulty(slot.slotIndex, e.target.value)}
                                        on:click|stopPropagation
                                    >
                                        <option value="easy">Easy</option>
                                        <option value="medium">Medium</option>
                                        <option value="hard">Hard</option>
                                    </select>
                                {/if}
                            </div>
                            {#if slot.slotIndex !== 0}
                                <button
                                    class="remove-btn"
                                    on:click={() => removeSlot(slot.slotIndex)}
                                    title="Remove player"
                                >
                                    ×
                                </button>
                            {/if}
                        </div>
                    {/each}
                </div>

                {#if !canAddMorePlayers}
                    <p class="hint">Maximum {GALACTIC_CONSTANTS.MAX_PLAYERS} players reached</p>
                {/if}
            </section>

            <!-- Audio Settings -->
            <section class="audio-section">
                <h2>Audio</h2>
                <div class="audio-controls">
                    <AudioButton />
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
        onClose={() => showSoundTestModal = false} 
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

    .settings-section {
        margin-bottom: 1.5rem;
    }

    .setting-row {
        display: flex;
        align-items: center;
        gap: 1rem;
        margin-bottom: 0.75rem;
        position: relative;
    }

    .setting-row label {
        display: flex;
        justify-content: space-between;
        align-items: center;
        width: 160px;
        flex-shrink: 0;
        gap: 0.5rem;
    }

    .label-text {
        color: #e5e7eb;
        font-size: 0.9rem;
    }

    .label-value {
        color: #a78bfa;
        font-weight: bold;
        font-size: 0.85rem;
        min-width: 50px;
        text-align: right;
    }

    .setting-row input[type="range"] {
        flex: 1;
        accent-color: #a78bfa;
        height: 6px;
    }

    /* Custom tooltip on hover */
    .setting-row .tooltip {
        position: absolute;
        left: 0;
        top: 100%;
        margin-top: 4px;
        background: #1f2937;
        color: #d1d5db;
        padding: 0.5rem 0.75rem;
        border-radius: 6px;
        font-size: 0.75rem;
        white-space: normal;
        max-width: 300px;
        z-index: 100;
        opacity: 0;
        visibility: hidden;
        transition: opacity 0.2s, visibility 0.2s;
        border: 1px solid #374151;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        line-height: 1.4;
        pointer-events: none;
    }

    .setting-row:hover .tooltip {
        opacity: 1;
        visibility: visible;
    }

    .players-section {
        margin-bottom: 1rem;
    }

    .add-player-buttons {
        display: flex;
        gap: 0.75rem;
        margin-bottom: 1rem;
    }

    .add-btn {
        flex: 1;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 0.5rem;
        padding: 0.75rem 1rem;
        background: rgba(255, 255, 255, 0.03);
        border: 2px dashed #4b5563;
        border-radius: 8px;
        color: #9ca3af;
        font-size: 0.9rem;
        cursor: pointer;
        transition: all 0.2s;
    }

    .add-btn:hover:not(:disabled) {
        background: rgba(255, 255, 255, 0.08);
        color: #e5e7eb;
    }

    .add-btn:disabled {
        opacity: 0.4;
        cursor: not-allowed;
    }

    .add-btn.add-open:hover:not(:disabled) {
        border-color: #3b82f6;
        color: #60a5fa;
    }

    .add-btn.add-ai:hover:not(:disabled) {
        border-color: #a855f7;
        color: #c084fc;
    }

    .add-icon {
        font-size: 1.25rem;
        font-weight: bold;
        line-height: 1;
    }

    .player-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
        gap: 0.75rem;
        margin-bottom: 1rem;
    }

    .player-slot {
        position: relative;
        display: flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.75rem;
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid #374151;
        border-radius: 8px;
        text-align: left;
        color: #e5e7eb;
        transition: all 0.2s;
    }

    .player-slot.human {
        border-color: #22c55e;
        background: rgba(34, 197, 94, 0.1);
    }

    .player-slot.ai {
        border-color: #a855f7;
        background: rgba(168, 85, 247, 0.1);
    }

    .player-slot.open {
        border-color: #3b82f6;
        border-style: dashed;
        background: rgba(59, 130, 246, 0.05);
    }

    .slot-color {
        width: 24px;
        height: 24px;
        border-radius: 50%;
        flex-shrink: 0;
    }

    .slot-info {
        flex: 1;
        min-width: 0;
    }

    .slot-name {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        font-weight: 500;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .slot-icon {
        font-size: 1rem;
        flex-shrink: 0;
    }

    .difficulty-select {
        margin-top: 0.5rem;
        padding: 0.25rem 0.5rem;
        background: rgba(0, 0, 0, 0.3);
        border: 1px solid #4b5563;
        border-radius: 4px;
        color: #e5e7eb;
        font-size: 0.75rem;
        cursor: pointer;
        width: 100%;
    }

    .difficulty-select:hover {
        border-color: #6b7280;
    }

    .difficulty-select:focus {
        outline: none;
        border-color: #a855f7;
    }

    .remove-btn {
        position: absolute;
        top: -6px;
        right: -6px;
        width: 20px;
        height: 20px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: #374151;
        border: 1px solid #4b5563;
        border-radius: 50%;
        color: #9ca3af;
        font-size: 1rem;
        line-height: 1;
        cursor: pointer;
        transition: all 0.2s;
        opacity: 0;
    }

    .player-slot:hover .remove-btn {
        opacity: 1;
    }

    .remove-btn:hover {
        background: #ef4444;
        border-color: #ef4444;
        color: white;
    }

    .hint {
        font-size: 0.85rem;
        color: #9ca3af;
        text-align: center;
        margin: 0;
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

    @media (max-width: 640px) {
        .player-grid {
            grid-template-columns: repeat(2, 1fr);
        }
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

