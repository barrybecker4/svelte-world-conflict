<script lang="ts">
  import { onMount } from 'svelte';
  import { MapGenerator } from '$lib/game/map/MapGenerator';
  import { GameStateInitializer } from '$lib/game/state/GameStateInitializer';
  import GameMap from '$lib/components/map/GameMap.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import LoadingState from '$lib/components/ui/LoadingState.svelte';
  import type { Region } from '$lib/game/entities/Region';
  import type { GameStateData, Player, PlayerSlot } from '$lib/game/entities/gameTypes';
  import { logger } from '$lib/client/utils/logger';

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

  $: {
    // Update preview when player slots change (without regenerating the map)
    if (playerSlots && previewRegions.length > 0) {
      createPreviewGameState();
      mapKey++; // Force re-render
    }
  }

  async function loadPreviewMap(): Promise<void> {
    loadingPreview = true;
    error = '';
    mapKey++; // Force re-render

    try {
      logger.debug(`Generating ${mapSize} map for ${playerCount} players...`);

      // Generate new regions
      previewRegions = mapGenerator.generateMap({
        size: mapSize,
        playerCount: playerCount
      });

      // Create preview game state using GameStateInitializer
      createPreviewGameState();

    } catch (err) {
      logger.error('Error generating preview map:', err);
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
      .filter(slot => slot.type !== 'Off')
      .slice(0, playerCount)
      .map((slot) => ({
        slotIndex: slot.slotIndex,  // Use the actual slot index, not sequential index
        name: (slot.type === 'Set' || slot.type === 'Open') ? (slot.name || `Player ${slot.slotIndex + 1}`) : `AI ${slot.slotIndex + 1}`,
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

      logger.debug('Preview state created using GameStateInitializer');
    } catch (err) {
      logger.error('Failed to create preview state:', err);
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
    background: #5b9fd8;
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