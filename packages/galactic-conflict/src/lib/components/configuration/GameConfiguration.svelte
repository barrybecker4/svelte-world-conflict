<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    import type { PlayerSlot, GameSettings } from '$lib/game/entities/gameTypes';
    import { GALACTIC_CONSTANTS } from '$lib/game/constants/gameConstants';
    import { getPlayerDefaultName, getPlayerColor } from '$lib/game/constants/playerConfigs';
    import { loadPlayerName } from '$lib/client/stores/clientStorage';

    const dispatch = createEventDispatcher();

    // Game settings
    let planetCount = GALACTIC_CONSTANTS.DEFAULT_PLANET_COUNT;
    let gameDuration = GALACTIC_CONSTANTS.DEFAULT_GAME_DURATION_MINUTES;
    let armadaSpeed = GALACTIC_CONSTANTS.DEFAULT_ARMADA_SPEED;
    let neutralShipsMin = GALACTIC_CONSTANTS.NEUTRAL_SHIPS_MIN;
    let neutralShipsMultiplierMax = GALACTIC_CONSTANTS.NEUTRAL_SHIPS_MULTIPLIER_MAX;

    // Player slots (start with 2 players)
    let playerSlots: PlayerSlot[] = [];
    let playerCount = 4;

    // Initialize slots
    $: {
        const currentName = loadPlayerName() || 'Player';
        playerSlots = [];
        for (let i = 0; i < playerCount; i++) {
            if (i === 0) {
                // First slot is the human player (creator)
                playerSlots.push({
                    slotIndex: i,
                    type: 'Set',
                    name: currentName,
                });
            } else if (i === 1) {
                // Second slot is AI by default
                playerSlots.push({
                    slotIndex: i,
                    type: 'AI',
                    name: getPlayerDefaultName(i),
                });
            } else {
                // Additional slots are disabled by default
                playerSlots.push({
                    slotIndex: i,
                    type: 'Disabled',
                });
            }
        }
    }

    function cycleSlotType(index: number) {
        if (index === 0) return; // Can't change the creator's slot
        
        const slot = playerSlots[index];
        const types: PlayerSlot['type'][] = ['AI', 'Open', 'Disabled'];
        const currentIndex = types.indexOf(slot.type as any);
        const nextIndex = (currentIndex + 1) % types.length;
        
        slot.type = types[nextIndex];
        if (slot.type === 'AI') {
            slot.name = getPlayerDefaultName(index);
        } else {
            delete slot.name;
        }
        
        playerSlots = [...playerSlots];
    }

    function handleCreateGame() {
        const activeSlots = playerSlots.filter(s => s.type !== 'Disabled');
        
        if (activeSlots.length < 2) {
            alert('At least 2 players are required');
            return;
        }

        const settings: GameSettings = {
            planetCount,
            armadaSpeed,
            gameDuration,
            stateBroadcastInterval: GALACTIC_CONSTANTS.DEFAULT_STATE_BROADCAST_INTERVAL_MS,
            neutralShipsMin,
            neutralShipsMultiplierMax,
        };

        dispatch('gameCreated', {
            playerSlots,
            settings,
        });
    }

    function handleClose() {
        dispatch('close');
    }

    $: activePlayerCount = playerSlots.filter(s => s.type !== 'Disabled').length;
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
                    <label for="planet-count">
                        <span class="label-text">Number of Planets</span>
                        <span class="label-value">{planetCount}</span>
                    </label>
                    <input
                        type="range"
                        id="planet-count"
                        bind:value={planetCount}
                        min={GALACTIC_CONSTANTS.MIN_PLANETS}
                        max={GALACTIC_CONSTANTS.MAX_PLANETS}
                        step="5"
                    />
                </div>

                <div class="setting-row">
                    <label for="game-duration">
                        <span class="label-text">Game Duration</span>
                        <span class="label-value">{gameDuration} minutes</span>
                    </label>
                    <input
                        type="range"
                        id="game-duration"
                        bind:value={gameDuration}
                        min={GALACTIC_CONSTANTS.GAME_DURATION_MIN_MINUTES}
                        max={GALACTIC_CONSTANTS.GAME_DURATION_MAX_MINUTES}
                        step="1"
                    />
                </div>

                <div class="setting-row">
                    <label for="armada-speed">
                        <span class="label-text">Armada Speed</span>
                        <span class="label-value">{armadaSpeed} units/min</span>
                    </label>
                    <input
                        type="range"
                        id="armada-speed"
                        bind:value={armadaSpeed}
                        min={GALACTIC_CONSTANTS.ARMADA_SPEED_MIN}
                        max={GALACTIC_CONSTANTS.ARMADA_SPEED_MAX}
                        step="10"
                    />
                </div>

                <div class="setting-row">
                    <label for="neutral-ships-min">
                        <span class="label-text">Neutral Ships Min</span>
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
                </div>

                <div class="setting-row">
                    <label for="neutral-ships-multiplier">
                        <span class="label-text">Neutral Ships Multiplier Max</span>
                        <span class="label-value">{neutralShipsMultiplierMax}x</span>
                    </label>
                    <input
                        type="range"
                        id="neutral-ships-multiplier"
                        bind:value={neutralShipsMultiplierMax}
                        min={0}
                        max={10}
                        step="1"
                    />
                </div>
            </section>

            <!-- Player Slots -->
            <section class="players-section">
                <h2>Players ({activePlayerCount})</h2>
                
                <div class="player-count-selector">
                    <span>Player slots:</span>
                    <div class="count-buttons">
                        {#each [2, 4, 6, 8, 10, 20] as count}
                            <button
                                class:active={playerCount === count}
                                on:click={() => playerCount = count}
                            >
                                {count}
                            </button>
                        {/each}
                    </div>
                </div>

                <div class="player-grid">
                    {#each playerSlots as slot}
                        <button
                            class="player-slot"
                            class:human={slot.type === 'Set'}
                            class:ai={slot.type === 'AI'}
                            class:open={slot.type === 'Open'}
                            class:disabled={slot.type === 'Disabled'}
                            on:click={() => cycleSlotType(slot.slotIndex)}
                            disabled={slot.slotIndex === 0}
                        >
                            <div 
                                class="slot-color"
                                style="background-color: {slot.type !== 'Disabled' ? getPlayerColor(slot.slotIndex) : '#374151'}"
                            ></div>
                            <div class="slot-info">
                                <span class="slot-name">
                                    {#if slot.type === 'Set'}
                                        {slot.name || 'You'}
                                    {:else if slot.type === 'AI'}
                                        {slot.name || 'AI'}
                                    {:else if slot.type === 'Open'}
                                        Open
                                    {:else}
                                        —
                                    {/if}
                                </span>
                                <span class="slot-type">
                                    {slot.type === 'Set' ? '👤 Human' : 
                                     slot.type === 'AI' ? '🤖 AI' : 
                                     slot.type === 'Open' ? '🔓 Open' : 
                                     '⛔ Disabled'}
                                </span>
                            </div>
                        </button>
                    {/each}
                </div>

                <p class="hint">Click a slot to change its type (AI → Open → Disabled)</p>
            </section>
        </div>

        <footer>
            <button class="back-btn" on:click={handleClose}>
                Back
            </button>
            <button 
                class="create-btn" 
                on:click={handleCreateGame}
                disabled={activePlayerCount < 2}
            >
                Create Game 🚀
            </button>
        </footer>
    </div>
</div>

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
        margin-bottom: 2rem;
    }

    .setting-row {
        margin-bottom: 1.5rem;
    }

    .setting-row label {
        display: flex;
        justify-content: space-between;
        margin-bottom: 0.5rem;
    }

    .label-text {
        color: #e5e7eb;
    }

    .label-value {
        color: #a78bfa;
        font-weight: bold;
    }

    .setting-row input[type="range"] {
        width: 100%;
        accent-color: #a78bfa;
    }

    .players-section {
        margin-bottom: 1rem;
    }

    .player-count-selector {
        display: flex;
        align-items: center;
        gap: 1rem;
        margin-bottom: 1rem;
    }

    .count-buttons {
        display: flex;
        gap: 0.5rem;
    }

    .count-buttons button {
        padding: 0.5rem 0.75rem;
        background: #374151;
        border: none;
        border-radius: 4px;
        color: #e5e7eb;
        cursor: pointer;
    }

    .count-buttons button.active {
        background: #7c3aed;
    }

    .player-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
        gap: 0.75rem;
        margin-bottom: 1rem;
    }

    .player-slot {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.75rem;
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid #374151;
        border-radius: 8px;
        cursor: pointer;
        text-align: left;
        color: #e5e7eb;
        transition: all 0.2s;
    }

    .player-slot:not(:disabled):hover {
        border-color: #4c1d95;
    }

    .player-slot:disabled {
        cursor: default;
    }

    .player-slot.human {
        border-color: #22c55e;
        background: rgba(34, 197, 94, 0.1);
    }

    .player-slot.ai {
        border-color: #a855f7;
    }

    .player-slot.open {
        border-color: #3b82f6;
        border-style: dashed;
    }

    .player-slot.disabled {
        opacity: 0.4;
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
        display: block;
        font-weight: 500;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .slot-type {
        display: block;
        font-size: 0.75rem;
        color: #9ca3af;
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
</style>

