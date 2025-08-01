<script>
  import { onMount } from 'svelte';
  import Map from './Map.svelte';
  import { MapGenerator } from '$lib/game/data/map/MapGenerator';

  export let mapSize = 'Large';
  export let playerCount = 4;
  export let playerSlots = []; // Accept player slots from parent

  // Internal state
  let previewRegions = [];
  let previewGameState = null;
  let loadingPreview = false;
  let mapGenerator = new MapGenerator(800, 600);
  let error = null;
  let mapKey = 0; // Force re-render of Map component

  // Reactive: regenerate preview when critical parameters change
  $: {
    if (mapSize || playerCount !== undefined) {
      loadPreviewMap();
    }
  }

  // Reactive: update game state when player slots change
  $: {
    if (previewRegions.length > 0 && playerSlots.length > 0) {
      updatePreviewGameState();
    }
  }

  async function loadPreviewMap() {
    console.log('=== LOAD PREVIEW MAP STARTED ===');
    try {
      loadingPreview = true;
      error = null;
      console.log(`Generating map - size: ${mapSize}, playerCount: ${playerCount}`);

      // Force a visual update
      previewRegions = [];
      previewGameState = null;

      // Create new MapGenerator instance
      mapGenerator = new MapGenerator(800, 600);

      const generateOptions = {
        size: mapSize,
        playerCount: Math.max(playerCount, 2),
        seed: Math.floor(Math.random() * 1000000),
        timestamp: Date.now()
      };

      console.log('Calling mapGenerator.generateMap() with options:', generateOptions);
      const regions = mapGenerator.generateMap(generateOptions);

      if (!regions || regions.length === 0) {
        throw new Error('Map generation returned no regions');
      }

      console.log('Map generation completed. Regions received:', regions.length);
      previewRegions = regions;

      // Create initial preview game state
      updatePreviewGameState();

      // Force map re-render
      mapKey++;

    } catch (err) {
      console.error('Failed to load preview map:', err);
      error = err.message || 'Map generation failed';
      previewRegions = [];
      previewGameState = null;
    } finally {
      loadingPreview = false;
    }
  }

  function updatePreviewGameState() {
    if (!previewRegions.length || !playerSlots.length) {
      previewGameState = null;
      return;
    }

    console.log('=== UPDATING PREVIEW GAME STATE ===');

    // Get active players (not "Off")
    const activePlayers = playerSlots
      .filter(slot => slot.type !== 'Off')
      .map((slot, index) => ({
        index: slot.index,
        name: slot.type === 'Set' ? slot.customName : slot.defaultName,
        type: slot.type
      }));

    console.log('Active players for preview:', activePlayers);

    // Find all temple regions
    const templeRegions = previewRegions.filter(region => region.hasTemple);
    console.log('Temple regions found:', templeRegions.length);

    // Create mock game state
    const mockGameState = {
      regions: previewRegions,
      players: activePlayers,
      owners: {}, // Region ownership by player index
      temples: {}, // Temple data by region index
      soldiersByRegion: {}, // Soldiers by region index
      currentPlayerIndex: 0,
      turn: 1
    };

    // Set up temples for all temple regions
    templeRegions.forEach(region => {
      mockGameState.temples[region.index] = {
        regionIndex: region.index,
        level: 0 // Base temple level
      };
      // Add some soldiers to temple regions
      mockGameState.soldiersByRegion[region.index] = [1, 2, 3]; // 3 soldiers
    });

    // Assign home bases to active players
    const assignedRegions = [];
    activePlayers.forEach((player, playerIndex) => {
      if (playerIndex < templeRegions.length) {
        let homeRegion = null;

        if (assignedRegions.length === 0) {
          // First player gets any temple region
          homeRegion = templeRegions[0];
        } else {
          // Subsequent players get temple regions furthest from already assigned ones
          let maxDistance = 0;
          let bestRegion = null;

          for (const candidateRegion of templeRegions) {
            if (assignedRegions.includes(candidateRegion.index)) continue;

            let minDistanceToAssigned = Infinity;
            for (const assignedIndex of assignedRegions) {
              const assignedRegion = previewRegions[assignedIndex];
              const distance = Math.sqrt(
                Math.pow(candidateRegion.x - assignedRegion.x, 2) +
                Math.pow(candidateRegion.y - assignedRegion.y, 2)
              );
              minDistanceToAssigned = Math.min(minDistanceToAssigned, distance);
            }

            if (minDistanceToAssigned > maxDistance) {
              maxDistance = minDistanceToAssigned;
              bestRegion = candidateRegion;
            }
          }

          homeRegion = bestRegion || templeRegions.find(r => !assignedRegions.includes(r.index));
        }

        if (homeRegion) {
          // Assign ownership
          mockGameState.owners[homeRegion.index] = player.index;
          assignedRegions.push(homeRegion.index);

          // Add extra soldiers to home base
          mockGameState.soldiersByRegion[homeRegion.index] = [1, 2, 3]; // soldiers for home base

          console.log(`Assigned home base ${homeRegion.index} to player ${player.index} (${player.name})`);
        }
      }
    });

    previewGameState = mockGameState;
    console.log('Preview game state updated:', previewGameState);

    // Force map re-render
    mapKey++;
  }

  // Public method for parent component to trigger refresh
  export function refreshPreview() {
    loadPreviewMap();
  }

  // Initialize on mount
  onMount(() => {
    loadPreviewMap();
  });
</script>

<div class="map-preview-panel">

  <div class="map-container">
    {#if loadingPreview}
      <div class="loading-state">
        <div class="spinner"></div>
        <p>Generating map...</p>
      </div>
    {:else if error}
      <div class="error-state">
        <p>❌ {error}</p>
        <button class="retry-button" on:click={loadPreviewMap}>
          Try Again
        </button>
      </div>
    {:else if previewRegions.length > 0}
      {#key mapKey}
        <Map
          regions={previewRegions}
          gameState={previewGameState}
          currentPlayer={null}
          onRegionClick={() => {}}
          selectedRegion={null}
        />
      {/key}
    {:else}
      <div class="empty-state">
        <p>No map generated</p>
      </div>
    {/if}
  </div>

  <button
    class="refresh-button"
    on:click={loadPreviewMap}
    disabled={loadingPreview}
    title="Generate new map"
  >
    {loadingPreview ? 'Generating...' : 'New Map'}
  </button>
</div>

<style>
  .map-preview-panel {
    flex: 1;
    background: rgba(30, 41, 59, 0.95);
    backdrop-filter: blur(10px);
    border: 1px solid #475569;
    border-radius: 12px;
    padding: 24px;
    display: flex;
    flex-direction: column;
    gap: 16px;
    min-height: 0;
  }

  .refresh-button {
    padding: 6px 12px;
    background: #374151;
    color: #f8fafc;
    border: 1px solid #475569;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.9rem;
    transition: all 0.2s ease;
    pointer-events: auto;
    z-index: 10;
    position: relative;
    width: 100px;
  }

  .refresh-button:hover:not(:disabled) {
    background: #64748b;
    border-color: #94a3b8;
  }

  .refresh-button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .refresh-button:disabled {
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }

  .map-container {
    flex: 1;
    position: relative;
    min-height: 400px;
    border-radius: 8px;
    overflow: hidden;
    background: #1e3a8a;
  }

  .loading-state, .error-state, .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: #94a3b8;
    gap: 12px;
  }

  .spinner {
    width: 32px;
    height: 32px;
    border: 3px solid #475569;
    border-top: 3px solid #60a5fa;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  .retry-button {
    padding: 8px 16px;
    background: #ef4444;
    color: white;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    transition: background 0.2s ease;
  }

  .retry-button:hover {
    background: #dc2626;
  }

  .map-legend {
    position: absolute;
    top: 12px;
    right: 12px;
    background: rgba(30, 41, 59, 0.9);
    backdrop-filter: blur(10px);
    border: 1px solid #475569;
    border-radius: 8px;
    padding: 12px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    font-size: 0.85rem;
    color: #f8fafc;
    min-width: 120px;
  }

  .legend-item {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .legend-symbol {
    width: 12px;
    height: 12px;
    border-radius: 2px;
    flex-shrink: 0;
  }

  .legend-symbol.temple {
    background: linear-gradient(135deg, #fbbf24, #f59e0b);
    border: 1px solid #d97706;
  }

  .legend-symbol.player-home {
    border: 2px solid #fff;
  }

  .map-info {
    background: #374151;
    border-radius: 8px;
    padding: 12px;
    display: flex;
    gap: 24px;
    flex-wrap: wrap;
  }

  .map-info p {
    margin: 0;
    color: #d1d5db;
    font-size: 0.9rem;
  }

  .map-info strong {
    color: #f8fafc;
  }

  /* Responsive design */
  @media (max-width: 768px) {
    .map-preview-panel {
      padding: 16px;
    }

    .map-info {
      flex-direction: column;
      gap: 8px;
    }

    .map-legend {
      position: static;
      margin-top: 12px;
    }
  }
</style>
