<script lang="ts">
  import type { WorldConflictGameStateData, Player } from '$lib/game/WorldConflictGameState';

  export let gameState: WorldConflictGameStateData | null = null;
  export let players: Player[] = [];
  export let visible: boolean = true;

  // Reactive values
  $: currentPlayerIndex = gameState?.playerIndex ?? 0;
  $: currentPlayer = players[currentPlayerIndex];
  $: turnNumber = gameState?.turnIndex ?? 1;
  $: movesRemaining = gameState?.movesRemaining ?? 3;

  // Debug faith values
  $: faithValues = players.map(player => ({
    playerIndex: player.index,
    playerName: player.name,
    faith: gameState?.cash?.[player.index] ?? 0,
    regions: getRegionCount(player.index),
    soldiers: getTotalSoldiers(player.index)
  }));

  // Debug soldier counts per region
  $: soldiersByRegion = gameState?.soldiersByRegion ?? {};
  $: regionSoldierCounts = Object.entries(soldiersByRegion).map(([regionIndex, soldiers]) => ({
    regionIndex: parseInt(regionIndex),
    soldierCount: soldiers?.length ?? 0,
    owner: gameState?.owners?.[parseInt(regionIndex)] ?? -1
  }));

  function getRegionCount(playerIndex: number): number {
    if (!gameState?.owners) return 0;
    return Object.values(gameState.owners).filter(owner => owner === playerIndex).length;
  }

  function getTotalSoldiers(playerIndex: number): number {
    if (!gameState?.soldiersByRegion || !gameState?.owners) return 0;

    let total = 0;
    for (const [regionIndex, soldiers] of Object.entries(gameState.soldiersByRegion)) {
      const regionIdx = parseInt(regionIndex);
      if (gameState.owners[regionIdx] === playerIndex) {
        total += soldiers?.length ?? 0;
      }
    }
    return total;
  }

  function toggleVisibility() {
    visible = !visible;
  }

  // Log changes for debugging
  $: if (gameState) {
    console.log("🎯 DEBUG - Game State Updated:", {
      turnIndex: gameState.turnIndex,
      currentPlayer: currentPlayerIndex,
      movesRemaining: gameState.movesRemaining,
      faithValues,
      soldiersByRegion: Object.keys(soldiersByRegion).length,
      totalSoldiers: Object.values(soldiersByRegion).reduce((sum, soldiers) => sum + (soldiers?.length ?? 0), 0)
    });
  }
</script>

<!-- Debug toggle button -->
<button class="debug-toggle" on:click={toggleVisibility}>
  {visible ? '🙈' : '🔍'} Debug
</button>

{#if visible}
  <div class="debug-panel">
    <div class="debug-header">
      <h3>🔍 Debug Game State</h3>
      <button class="close-btn" on:click={() => visible = false}>×</button>
    </div>

    <div class="debug-section">
      <h4>Turn Info</h4>
      <p>Turn: {turnNumber} | Current Player: {currentPlayerIndex} ({currentPlayer?.name}) | Moves: {movesRemaining}</p>
    </div>

    <div class="debug-section">
      <h4>Player Stats</h4>
      {#each faithValues as player}
        <div class="player-debug">
          <strong>Player {player.playerIndex} ({player.playerName}):</strong>
          <span>Faith: {player.faith} | Regions: {player.regions} | Total Soldiers: {player.soldiers}</span>
        </div>
      {/each}
    </div>

    <div class="debug-section">
      <h4>Soldiers by Region</h4>
      <div class="region-grid">
        {#each regionSoldierCounts.filter(r => r.soldierCount > 0) as region}
          <div class="region-debug">
            Region {region.regionIndex}: {region.soldierCount} soldiers (Owner: {region.owner})
          </div>
        {/each}
      </div>
    </div>

    <div class="debug-section">
      <h4>Raw Data Check</h4>
      <details>
        <summary>Click to see raw cash values</summary>
        <pre>{JSON.stringify(gameState?.cash ?? {}, null, 2)}</pre>
      </details>

      <details>
        <summary>Click to see raw soldier data</summary>
        <pre>{JSON.stringify(
          Object.fromEntries(
            Object.entries(soldiersByRegion).map(([k, v]) => [k, v?.length ?? 0])
          ),
          null,
          2
        )}</pre>
      </details>
    </div>
  </div>
{/if}

<style>
  .debug-toggle {
    position: fixed;
    top: 10px;
    right: 10px;
    z-index: 1001;
    background: #4ade80;
    color: black;
    border: none;
    padding: 8px 12px;
    border-radius: 4px;
    font-size: 12px;
    cursor: pointer;
    font-weight: bold;
  }

  .debug-toggle:hover {
    background: #22c55e;
  }

  .debug-panel {
    position: fixed;
    top: 50px;
    right: 10px;
    width: 400px;
    max-height: 80vh;
    overflow-y: auto;
    background: rgba(0, 0, 0, 0.95);
    color: white;
    padding: 16px;
    border-radius: 8px;
    font-family: monospace;
    font-size: 12px;
    z-index: 1000;
    border: 2px solid #4ade80;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
  }

  .debug-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
  }

  .debug-header h3 {
    margin: 0;
    color: #4ade80;
  }

  .close-btn {
    background: #ef4444;
    color: white;
    border: none;
    width: 24px;
    height: 24px;
    border-radius: 50%;
    cursor: pointer;
    font-size: 16px;
    line-height: 1;
  }

  .close-btn:hover {
    background: #dc2626;
  }

  .debug-section {
    margin-bottom: 16px;
    padding-bottom: 12px;
    border-bottom: 1px solid #374151;
  }

  .debug-section h4 {
    margin: 0 0 8px 0;
    color: #4ade80;
  }

  .player-debug {
    margin: 4px 0;
    padding: 4px;
    background: rgba(75, 85, 99, 0.3);
    border-radius: 4px;
  }

  .region-debug {
    display: inline-block;
    margin: 2px;
    padding: 2px 6px;
    background: rgba(59, 130, 246, 0.3);
    border-radius: 3px;
    font-size: 10px;
  }

  .region-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }

  details {
    margin: 8px 0;
  }

  summary {
    cursor: pointer;
    color: #60a5fa;
  }

  summary:hover {
    color: #93c5fd;
  }

  pre {
    background: rgba(31, 41, 55, 0.8);
    padding: 8px;
    border-radius: 4px;
    font-size: 10px;
    overflow-x: auto;
    margin: 4px 0;
  }
</style>
