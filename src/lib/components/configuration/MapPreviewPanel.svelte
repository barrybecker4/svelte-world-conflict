<script lang="ts">
  import { onMount } from 'svelte';
  import { MapGenerator } from '$lib/game/map/MapGenerator';
  import Map from './Map.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import LoadingState from '$lib/components/ui/LoadingState.svelte';
  import type { Region } from '$lib/game/classes/Region';
  import type { WorldConflictGameStateData, Player, PlayerSlot } from '$lib/game/gameTypes';
  import { assignHomeBaseRegions, createOwnerAssignments } from '$lib/game/map/homeBasePlacement';

  export let mapSize: 'Small' | 'Medium' | 'Large' = 'Medium';
  export let playerCount = 4;
  export let playerSlots: PlayerSlot[] = [];

  let previewRegions: Region[] = [];
  let previewGameState: WorldConflictGameStateData | null = null;
  let loadingPreview = false;
  let error = '';
  let mapKey = 0; // Force re-render when map changes

  const mapGenerator = new MapGenerator();

  onMount(() => {
    loadPreviewMap();
  });

  $: {
    // Regenerate preview when settings change
    if (mapSize || playerCount) {
      loadPreviewMap();
    }
  }

  async function loadPreviewMap(): Promise<void> {
    loadingPreview = true;
    error = '';
    mapKey++; // Force re-render

    try {
      console.log(`Generating ${mapSize} map for ${playerCount} players...`);

      // Generate new regions
      previewRegions = mapGenerator.generateMap({
        size: mapSize,
        playerCount: playerCount
      });

      console.log(`Generated ${previewRegions.length} regions, ${previewRegions.filter(r => r.hasTemple).length} with temples`);

      // Create preview game state with proper home base placement
      createPreviewGameState();

    } catch (err) {
      console.error('Error generating preview map:', err);
      error = err instanceof Error ? err.message : 'Failed to generate map';
      previewGameState = null;
    } finally {
      loadingPreview = false;
    }
  }

  function createPreviewGameState(): void {
    if (previewRegions.length === 0) {
      previewGameState = null;
      return;
    }

    // Create players from slots
    const activePlayers: Player[] = playerSlots
      .filter(slot => slot.type !== 'Empty')
      .slice(0, playerCount)
      .map((slot, index) => ({
        index,
        name: slot.type === 'Human' ? slot.name : `AI ${index + 1}`,
        color: slot.color,
        isAI: slot.type === 'AI'
      }));

    if (activePlayers.length === 0) {
      previewGameState = null;
      return;
    }

    // Use distance-based home base assignment
    const homeBaseAssignments = assignHomeBaseRegions(activePlayers, previewRegions);
    const owners = createOwnerAssignments(homeBaseAssignments);

    // Create minimal game state for preview
    previewGameState = {
      id: 0,
      gameId: 'preview',
      turnIndex: 1,
      playerIndex: 0,
      movesRemaining: 3,
      owners,
      temples: {},
      soldiersByRegion: {},
      cash: {},
      players: activePlayers,
      regions: previewRegions
    };

    // Set up temples and soldiers for assigned home bases
    homeBaseAssignments.forEach(assignment => {
      const regionIndex = assignment.regionIndex;

      // Add temple structure
      previewGameState!.temples[regionIndex] = {
        regionIndex,
        level: 1
      };

      // Add soldiers for visual interest
      previewGameState!.soldiersByRegion[regionIndex] = [
        { i: assignment.playerIndex * 10 + 1 },
        { i: assignment.playerIndex * 10 + 2 },
        { i: assignment.playerIndex * 10 + 3 }
      ];
    });

    // Add temples to remaining temple regions (neutral)
    previewRegions.forEach(region => {
      if (region.hasTemple && !previewGameState!.temples[region.index]) {
        previewGameState!.temples[region.index] = {
          regionIndex: region.index,
          level: 0
        };

        // Add some neutral soldiers
        previewGameState!.soldiersByRegion[region.index] = [
          { i: region.index * 10 + 1 },
          { i: region.index * 10 + 2 }
        ];
      }
    });

    // Initialize player cash
    activePlayers.forEach(player => {
      previewGameState!.cash[player.index] = 100;
    });

    console.log('Preview game state created with distance-based home bases:', previewGameState);
    console.log('Home base assignments:', homeBaseAssignments.map(a => `Player ${a.playerIndex} -> Region ${a.regionIndex}`));
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
