<script>
  import { createEventDispatcher } from 'svelte';

  const dispatch = createEventDispatcher();

  // Fixed player configurations matching GAS version
  const PLAYER_CONFIGS = [
    {
      index: 0,
      defaultName: 'Red Baron',
      colorStart: '#dc2626',
      colorEnd: '#991b1b'
    },
    {
      index: 1,
      defaultName: 'Blue Thunder',
      colorStart: '#2563eb',
      colorEnd: '#1d4ed8'
    },
    {
      index: 2,
      defaultName: 'Green Dragon',
      colorStart: '#059669',
      colorEnd: '#047857'
    },
    {
      index: 3,
      defaultName: 'Yellow Storm',
      colorStart: '#d97706',
      colorEnd: '#b45309'
    }
  ];

  // Player slot states
  let playerSlots = [
    { ...PLAYER_CONFIGS[0], type: 'Set' },   // Human player (you)
    { ...PLAYER_CONFIGS[1], type: 'Open' },  // Available for joining
    { ...PLAYER_CONFIGS[2], type: 'Open' },  // Available for joining
    { ...PLAYER_CONFIGS[3], type: 'Off' }    // Disabled
  ];

  const slotTypes = ['Off', 'Set', 'Open', 'AI'];

  // Game state
  let creating = false;
  let error = null;

  function changeSlotType(slotIndex, newType) {
    // Only one "Set" player allowed
    if (newType === 'Set') {
      // Clear any existing "Set" players
      playerSlots = playerSlots.map((slot, i) =>
        i === slotIndex
          ? { ...slot, type: 'Set' }
          : slot.type === 'Set'
            ? { ...slot, type: 'Open' }
            : slot
      );
    } else {
      playerSlots[slotIndex] = { ...playerSlots[slotIndex], type: newType };
    }

    // Trigger reactivity
    playerSlots = [...playerSlots];
  }

  function getSlotStatusText(slot) {
    switch (slot.type) {
      case 'Off': return 'Disabled';
      case 'Set': return 'You';
      case 'Open': return 'Waiting for player';
      case 'AI': return `AI: ${slot.defaultName}`;
      default: return 'Unknown';
    }
  }

  function getActivePlayerCount() {
    return playerSlots.filter(slot => slot.type !== 'Off').length;
  }

  function getOpenSlotCount() {
    return playerSlots.filter(slot => slot.type === 'Open').length;
  }

  function canStartGame() {
    const activeCount = getActivePlayerCount();
    const hasSetPlayer = playerSlots.some(slot => slot.type === 'Set');
    return activeCount >= 2 && hasSetPlayer && !creating;
  }

  async function startGame() {
    if (!canStartGame()) return;

    creating = true;
    error = null;

    try {
      // Convert open slots to AI for immediate start
      const finalSlots = playerSlots.map(slot =>
        slot.type === 'Open' ? { ...slot, type: 'AI' } : slot
      );

      // Create the game with configured players
      const activePlayers = finalSlots
        .filter(slot => slot.type !== 'Off')
        .map(slot => ({
          name: slot.defaultName,
          type: slot.type,
          index: slot.index
        }));

      const response = await fetch('/api/games/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          players: activePlayers,
          gameType: getOpenSlotCount() > 0 ? 'MULTIPLAYER' : 'AI'
        })
      });

      if (response.ok) {
        const result = await response.json();

        // Store player info
        const humanPlayer = activePlayers.find(p => p.type === 'Set');
        localStorage.setItem(`wc_game_${result.gameId}`, JSON.stringify({
          playerId: result.playerId,
          playerIndex: humanPlayer.index,
          playerName: humanPlayer.name
        }));

        // Navigate to game
        window.location.href = `/game/${result.gameId}`;
      } else {
        const errorData = await response.json();
        error = errorData.error || 'Failed to create game';
      }
    } catch (err) {
      error = 'Network error: ' + err.message;
    } finally {
      creating = false;
    }
  }

  function cancel() {
    dispatch('close');
  }
</script>

<!-- Full screen game configuration -->
<div class="config-overlay">
  <div class="config-container">
    <div class="config-header">
      <h1>Configure Game
        <br/>
        <span class="title-subheader">
          Set up players for your World Conflict battle
        </span>
      </h1>
    </div>

    <div class="config-content">
      <!-- Left panel: Player configuration -->
      <div class="player-panel">
        <h3>Players ({getActivePlayerCount()}/4)</h3>

        {#if error}
          <div class="error-message">
            ⚠️ {error}
          </div>
        {/if}

        <div class="player-slots">
          {#each playerSlots as slot, index}
            <div class="player-slot" class:active={slot.type !== 'Off'}>
              <div class="player-info">
                <div
                  class="player-color"
                  style="background: linear-gradient(135deg, {slot.colorStart}, {slot.colorEnd})"
                ></div>
                <div class="player-details">
                  <div class="player-name">{slot.defaultName}</div>
                  <div class="player-status">{getSlotStatusText(slot)}</div>
                </div>
              </div>

              <select
                bind:value={slot.type}
                on:change={(e) => changeSlotType(index, e.target.value)}
                class="slot-selector"
              >
                {#each slotTypes as type}
                  <option value={type}>{type}</option>
                {/each}
              </select>
            </div>
          {/each}
        </div>

        <div class="game-info">
          <div class="info-item">
            <strong>Active Players:</strong> {getActivePlayerCount()}
          </div>
          <div class="info-item">
            <strong>Open Slots:</strong> {getOpenSlotCount()}
          </div>
          {#if getOpenSlotCount() > 0}
            <div class="info-note">
              Open slots will become AI if no one joins
            </div>
          {/if}
        </div>
      </div>

      <!-- Right panel: Map preview -->
      <div class="map-panel">
        <h3>World Map</h3>
        <div class="map-preview">
          <!-- Simplified map representation -->
          <svg viewBox="0 0 300 250" class="world-map">
            <!-- Regions as circles for now -->
            <circle cx="50" cy="40" r="15" fill="#4ade80" stroke="#22c55e" stroke-width="2"/>
            <circle cx="120" cy="60" r="15" fill="#60a5fa" stroke="#3b82f6" stroke-width="2"/>
            <circle cx="180" cy="160" r="15" fill="#fbbf24" stroke="#f59e0b" stroke-width="2"/>
            <circle cx="40" cy="120" r="15" fill="#f87171" stroke="#ef4444" stroke-width="2"/>
            <circle cx="150" cy="120" r="15" fill="#a78bfa" stroke="#8b5cf6" stroke-width="2"/>
            <circle cx="250" cy="140" r="15" fill="#34d399" stroke="#10b981" stroke-width="2"/>
            <circle cx="80" cy="200" r="15" fill="#fb923c" stroke="#f97316" stroke-width="2"/>
            <circle cx="150" cy="200" r="15" fill="#fde047" stroke="#facc15" stroke-width="2"/>
            <circle cx="220" cy="220" r="15" fill="#c084fc" stroke="#a855f7" stroke-width="2"/>

            <!-- Connections between regions -->
            <line x1="50" y1="40" x2="120" y2="60" stroke="#6b7280" stroke-width="1"/>
            <line x1="120" y1="60" x2="180" y2="160" stroke="#6b7280" stroke-width="1"/>
            <line x1="40" y1="120" x2="150" y2="120" stroke="#6b7280" stroke-width="1"/>
            <!-- Add more connections as needed -->

            <text x="150" y="30" text-anchor="middle" fill="#f8fafc" font-size="12">
              9 Regions • Strategic Combat
            </text>
          </svg>

          <div class="map-legend">
            <div class="legend-item">🏛️ Temple Sites</div>
            <div class="legend-item">⚔️ Combat Zones</div>
            <div class="legend-item">💰 Resource Areas</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Bottom actions -->
    <div class="config-actions">
      <button
        class="start-button"
        class:disabled={!canStartGame()}
        disabled={!canStartGame()}
        on:click={startGame}
      >
        {#if creating}
          Creating Game...
        {:else if getOpenSlotCount() > 0}
          Start Game (Open → AI)
        {:else}
          Start Game
        {/if}
      </button>

      <button class="cancel-button" on:click={cancel}>
        Back
      </button>
    </div>
  </div>
</div>

<style>
  .config-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: linear-gradient(135deg, #1e293b 0%, #334155 100%);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    color: white;
    font-family: system-ui, sans-serif;
  }

  .config-container {
    max-width: 1200px;
    width: 95%;
    max-height: 90vh;
    display: flex;
    flex-direction: column;
  }

  .config-header {
    text-align: center;
    margin-bottom: 1.5rem;
  }

  .config-header h1 {
    font-size: 2.5rem;
    font-weight: bold;
    background: linear-gradient(135deg, #60a5fa, #a855f7, #ec4899);
    background-clip: text;
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    margin-bottom: 0.5rem;
  }

  .title-subheader {
    font-size: 1.1rem;
    color: #94a3b8;
    font-weight: normal;
  }

  .config-content {
    display: grid;
    grid-template-columns: 1fr 1.5fr;
    gap: 2rem;
    background: rgba(15, 23, 42, 0.8);
    border: 2px solid #475569;
    border-radius: 12px;
    padding: 2rem;
    backdrop-filter: blur(10px);
    flex: 1;
    overflow-y: auto;
  }

  .player-panel h3,
  .map-panel h3 {
    margin-bottom: 1rem;
    color: #f8fafc;
    font-size: 1.2rem;
    border-bottom: 1px solid #475569;
    padding-bottom: 0.5rem;
  }

  .error-message {
    background: rgba(239, 68, 68, 0.2);
    border: 1px solid #ef4444;
    border-radius: 6px;
    padding: 0.75rem;
    margin-bottom: 1rem;
    text-align: center;
    color: #fecaca;
    font-size: 0.9rem;
  }

  .player-slots {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    margin-bottom: 1.5rem;
  }

  .player-slot {
    display: flex;
    align-items: center;
    justify-content: space-between;
    background: rgba(30, 41, 59, 0.6);
    border: 1px solid #475569;
    border-radius: 8px;
    padding: 0.75rem;
    transition: all 0.2s;
  }

  .player-slot.active {
    border-color: #60a5fa;
    background: rgba(30, 41, 59, 0.8);
  }

  .player-info {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex: 1;
  }

  .player-color {
    width: 20px;
    height: 20px;
    border-radius: 50%;
    border: 2px solid rgba(255, 255, 255, 0.3);
  }

  .player-details {
    flex: 1;
  }

  .player-name {
    font-weight: 600;
    color: #f8fafc;
    font-size: 0.95rem;
  }

  .player-status {
    font-size: 0.8rem;
    color: #94a3b8;
  }

  .slot-selector {
    background: #374151;
    color: white;
    border: 1px solid #6b7280;
    border-radius: 4px;
    padding: 0.25rem 0.5rem;
    font-size: 0.85rem;
    cursor: pointer;
  }

  .slot-selector:focus {
    border-color: #60a5fa;
    outline: none;
  }

  .game-info {
    background: rgba(59, 130, 246, 0.1);
    border: 1px solid #3b82f6;
    border-radius: 6px;
    padding: 1rem;
  }

  .info-item {
    margin-bottom: 0.5rem;
    font-size: 0.9rem;
  }

  .info-note {
    margin-top: 0.75rem;
    font-size: 0.8rem;
    color: #fbbf24;
    font-style: italic;
  }

  .map-panel {
    display: flex;
    flex-direction: column;
  }

  .map-preview {
    flex: 1;
    display: flex;
    flex-direction: column;
  }

  .world-map {
    flex: 1;
    min-height: 250px;
    background: rgba(0, 0, 0, 0.3);
    border-radius: 8px;
    padding: 1rem;
  }

  .map-legend {
    margin-top: 1rem;
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: 0.5rem;
  }

  .legend-item {
    font-size: 0.85rem;
    color: #d1d5db;
    padding: 0.25rem;
  }

  .config-actions {
    display: flex;
    justify-content: center;
    gap: 1rem;
    margin-top: 1.5rem;
  }

  .start-button {
    background: linear-gradient(135deg, #10b981, #059669);
    color: white;
    border: none;
    padding: 1rem 2rem;
    border-radius: 8px;
    font-weight: 600;
    font-size: 1.1rem;
    cursor: pointer;
    transition: all 0.2s;
  }

  .start-button:hover:not(.disabled) {
    background: linear-gradient(135deg, #059669, #047857);
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(16, 185, 129, 0.4);
  }

  .start-button.disabled {
    background: #6b7280;
    cursor: not-allowed;
    transform: none;
    box-shadow: none;
  }

  .cancel-button {
    background: transparent;
    color: #94a3b8;
    border: 1px solid #475569;
    padding: 1rem 2rem;
    border-radius: 8px;
    font-weight: 600;
    font-size: 1.1rem;
    cursor: pointer;
    transition: all 0.2s;
  }

  .cancel-button:hover {
    color: white;
    border-color: #60a5fa;
  }

  /* Mobile responsiveness */
  @media (max-width: 768px) {
    .config-content {
      grid-template-columns: 1fr;
      gap: 1.5rem;
    }

    .config-header h1 {
      font-size: 1.8rem;
    }

    .config-actions {
      flex-direction: column;
    }

    .start-button,
    .cancel-button {
      width: 100%;
    }
  }
</style>
