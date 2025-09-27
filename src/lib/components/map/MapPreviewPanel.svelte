<script lang="ts">
  import { onMount } from 'svelte';
  import { MapGenerator } from '$lib/game/map/MapGenerator';
  import { GameStateInitializer } from '$lib/game/state/GameStateInitializer';
  import GameMap from '$lib/components/map/GameMap.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import LoadingState from '$lib/components/ui/LoadingState.svelte';
  import type { Region } from '$lib/game/entities/Region';
  import type { GameStateData, Player, PlayerSlot } from '$lib/game/entities/gameTypes';

  export let mapSize: 'Small' | 'Medium' | 'Large' = 'Medium';
  export let playerCount = 4;
  export let playerSlots: PlayerSlot[] = [];

  let previewRegions: Region[] = [];
  let previewGameState: GameStateData | null = null;
  let loadingPreview = false;
  let error = '';
  let mapKey = 0; // Force re-render when map changes

  const mapGenerator = new MapGenerator();
  const gameStateInitializer = new GameStateInitializer();

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

      // Create preview game state using GameStateInitializer
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
        slotIndex: index,  // ✅ Correct property name
        name: slot.type === 'Human' ? slot.name : `AI ${index + 1}`,
        color: slot.color,
        isAI: slot.type === 'AI'
      }));

    if (activePlayers.length === 0) {
      previewGameState = null;
      return;
    }

    try {
      // Use GameStateInitializer to create properly initialized preview state
      previewGameState = gameStateInitializer.createPreviewStateData(activePlayers, previewRegions);

      console.log('Preview state created using GameStateInitializer');
    } catch (err) {
      console.error('Failed to create preview state:', err);
      previewGameState = null;
    }
  }

  export function refreshPreview() {
    loadPreviewMap();
  }

  export function getCurrentPreviewRegions(): Region[] {
    return previewRegions;
  }

  export function getCurrentPreviewState(): GameStateData | null {
    return previewGameState;
  }

  export function hasValidPreview(): boolean {
    return previewRegions.length > 0 && !loadingPreview && !error;
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
          <GameMap
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