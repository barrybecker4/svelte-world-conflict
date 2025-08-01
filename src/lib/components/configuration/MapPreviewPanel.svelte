<script>
  import Map from './Map.svelte';
  import { MapGenerator } from '$lib/game/data/map/MapGenerator';
  import Button from '$lib/components/ui/Button.svelte';
  import LoadingState from '$lib/components/ui/LoadingState.svelte';

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
        name: slot.type === 'Set' ? slot.name : `AI ${index + 1}`,
        color: slot.color,
        isAI: slot.type === 'AI'
      }));

    if (activePlayers.length === 0) {
      previewGameState = null;
      return;
    }

    // Create minimal game state for preview
    previewGameState = {
      id: 0,
      gameId: 'preview',
      turnIndex: 1,
      playerIndex: 0,
      movesRemaining: 3,
      owners: {},
      temples: {},
      soldiersByRegion: {},
      cash: {},
      players: activePlayers,
      regions: previewRegions
    };

    // Assign some regions to players for preview
    previewRegions.forEach((region, index) => {
      const playerIndex = index % activePlayers.length;
      previewGameState.owners[region.index] = playerIndex;

      // Add some soldiers for visual interest
      previewGameState.soldiersByRegion[region.index] = [
        { i: index * 10 + 1 },
        { i: index * 10 + 2 }
      ];

      // Add temples occasionally
      if (region.hasTemple) {
        previewGameState.temples[region.index] = {
          regionIndex: region.index,
          level: 1
        };
      }
    });

    // Initialize player cash
    activePlayers.forEach(player => {
      previewGameState.cash[player.index] = 10;
    });

    console.log('Preview game state created:', previewGameState);
  }

  export function refreshPreview() {
    loadPreviewMap();
  }
</script>

<div class="map-preview-panel">
  <div class="map-container">
    <LoadingState
      loading={loadingPreview}
      {error}
      loadingText="Generating map..."
      containerClass=""
      showRetry={true}
      on:retry={loadPreviewMap}
    >
      {#if previewRegions.length > 0}
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
    </LoadingState>
  </div>

  <Button
    variant="secondary"
    size="sm"
    loading={loadingPreview}
    title="Generate new map"
    on:click={loadPreviewMap}
  >
    New Map
  </Button>
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

  .map-container {
    flex: 1;
    position: relative;
    min-height: 400px;
    border-radius: 8px;
    overflow: hidden;
    background: #1e3a8a;
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: #94a3b8;
    gap: 12px;
  }

  .map-preview-panel :global(.btn-sm) {
    width: 100px;
    position: relative;
    z-index: 10;
    pointer-events: auto;
  }
</style>
