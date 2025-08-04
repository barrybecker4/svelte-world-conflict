<script lang="ts">
  import { onMount } from 'svelte';
  import Map from './Map.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import LoadingState from '$lib/components/ui/LoadingState.svelte';
  import type { PlayerSlot } from '$lib/game/types/PlayerSlot';
  import type { WorldConflictGameStateData } from '$lib/game/WorldConflictGameState';
  import type { Region } from '$lib/game/WorldConflictGameState';
  import { MapGenerator } from '$lib/game/data/map/MapGenerator';

  export let mapSize: string = 'Medium';
  export let playerCount: number = 2;
  export let playerSlots: PlayerSlot[] = [];

  let previewRegions: Region[] = [];
  let previewGameState: WorldConflictGameStateData | null = null;
  let loadingPreview = false;
  let mapGenerator = new MapGenerator(800, 600);
  let error: string | null = null;
  let mapKey = 0; // Force re-render when map changes

  $: {
    // Regenerate map when parameters change
    if (mapSize || playerCount) {
      loadPreviewMap();
    }
  }

  onMount(() => {
    loadPreviewMap();
  });

  async function loadPreviewMap() {
    if (loadingPreview) return;

    loadingPreview = true;
    error = null;

    try {
      console.log(`Generating preview map: ${mapSize}, ${playerCount} players`);

      // Generate new regions
      mapGenerator = new MapGenerator(800, 600);

      const generateOptions = {
        size: mapSize,
        playerCount: Math.max(playerCount, 2),
        seed: Math.floor(Math.random() * 1000000),
        timestamp: Date.now()
      };
      previewRegions = mapGenerator.generateMap(generateOptions);

      if (!previewRegions || previewRegions.length === 0) {
        throw new Error('Failed to generate regions');
      }

      console.log(`Generated ${previewRegions.length} regions for preview`);
      assignSomeRegionsToPlayers();

      // Force component re-render
      mapKey++;

    } catch (err) {
      console.error('Failed to load preview map:', err);
      error = err instanceof Error ? err.message : 'Failed to generate map';
      previewRegions = [];
      previewGameState = null;
    } finally {
      loadingPreview = false;
    }
  }

  function assignSomeRegionsToPlayers() {
    // Get active players from slots
    const activePlayers = playerSlots
      .filter(slot => slot.type !== 'Empty')
      .slice(0, playerCount)
      .map((slot, index) => ({
        index,
        name: slot.name || slot.type === 'Human' ?
          slot.name : `AI ${index + 1}`,
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

    // Find temple regions (home bases)
    const templeRegions = previewRegions.filter(region => region.hasTemple);

    // ONLY assign temple regions to players as home bases
    // Leave all other regions unowned (neutral/gray)
    activePlayers.forEach((player, playerIndex) => {
      if (playerIndex < templeRegions.length) {
        const homeRegion = templeRegions[playerIndex];

        // Assign ownership to this player's home base only
        previewGameState.owners[homeRegion.index] = playerIndex;

        // Add some soldiers to the home base
        previewGameState.soldiersByRegion[homeRegion.index] = [
          { i: playerIndex * 10 + 1 },
          { i: playerIndex * 10 + 2 },
          { i: playerIndex * 10 + 3 }
        ];

        // Add temple to the home base
        previewGameState.temples[homeRegion.index] = {
          regionIndex: homeRegion.index,
          level: 1
        };
      }
    });

    // Initialize player cash
    activePlayers.forEach(player => {
      previewGameState.cash[player.index] = 100;
    });

    console.log('Preview game state created:', previewGameState);
    console.log('Temple regions assigned as home bases:', templeRegions.length);
    console.log('Owned regions:', Object.keys(previewGameState.owners));
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
    background: #7fb2e3;
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
