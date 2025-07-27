<script>
  import { onMount } from 'svelte';
  import GameMap from './GameMap.svelte';
  import { MapGenerator } from '$lib/game/data/map/MapGenerator';

  export let mapSize = 'Large'; // Allow parent to control map size
  export let playerCount = 4; // Allow parent to control player count for map generation

  // Internal state
  let previewRegions = [];
  let loadingPreview = false;
  let mapGenerator = new MapGenerator(800, 600);
  let error = null;
  let mapKey = 0; // Force re-render of GameMap component

  async function loadPreviewMap() {
    console.log('=== LOAD PREVIEW MAP STARTED ===');
    try {
      console.log('Setting loadingPreview = true');
      loadingPreview = true;
      error = null;
      console.log(`Generating map - size: ${mapSize}, playerCount: ${playerCount}`);

      // Force a visual update
      previewRegions = [];

      // Force a completely new MapGenerator instance to avoid any caching
      console.log('Creating completely new MapGenerator instance...');
      mapGenerator = new MapGenerator(800, 600);

      // Add some randomness to options to force different generation
      const randomSeed = Math.floor(Math.random() * 1000000);
      console.log('Using random seed:', randomSeed);

      // Generate preview regions with required options
      const generateOptions = {
        size: mapSize,
        playerCount: Math.max(playerCount, 2),
        seed: randomSeed, // Add randomness even if not used by generator
        timestamp: Date.now() // Another source of uniqueness
      };

      console.log('Calling mapGenerator.generateMap() with options:', generateOptions);

      const regions = mapGenerator.generateMap(generateOptions);

      console.log('Map generation completed. Regions received:', regions ? regions.length : 'null/undefined');
      console.log('First few regions:', regions ? regions.slice(0, 3) : 'none');

      // Force Svelte reactivity update with completely new array
      previewRegions = [...(regions || [])];

      // Increment map key to force GameMap re-render
      mapKey += 1;

      console.log(`=== MAP GENERATION SUCCESS ===`);
      console.log(`Final result: ${previewRegions.length} regions for ${mapSize} map with ${playerCount} players, mapKey: ${mapKey}`);

    } catch (err) {
      console.error('=== MAP GENERATION ERROR ===', err);
      error = `Failed to generate map: ${err.message}`;
      previewRegions = [];
    } finally {
      console.log('Setting loadingPreview = false');
      loadingPreview = false;
      console.log('=== LOAD PREVIEW MAP COMPLETED ===');
    }
  }

  // Reactive statement to regenerate map when size changes
  $: if (mapSize && typeof window !== 'undefined') {
    loadPreviewMap();
  }

  function handleRefreshClick() {
    refreshPreview();
  }

  // Expose the load function so parent can trigger it if needed
  export function refreshPreview() {
    loadPreviewMap();
  }

  // Load initial preview when component mounts
  onMount(() => {
    loadPreviewMap();
  });
</script>

<div class="preview-panel">
  <h3>Map Preview</h3>
  <div class="map-container">
    {#if loadingPreview}
      <div class="loading-overlay">
        <div class="loading-spinner"></div>
        <p>Generating map...</p>
      </div>
    {:else if error}
      <div class="error-overlay">
        <p class="error-text">{error}</p>
        <button class="retry-button" on:click={handleRefreshClick}>
          Try Again
        </button>
      </div>
    {:else if previewRegions.length === 0}
      <div class="empty-overlay">
        <p>No map generated</p>
        <button class="retry-button" on:click={handleRefreshClick}>
          Generate Map
        </button>
      </div>
    {:else}
      {#key mapKey}
        <GameMap
          regions={previewRegions}
          interactive={false}
        />
      {/key}
    {/if}
  </div>

  <div class="preview-info">
    <p class="map-info">
      {mapSize} map • {previewRegions.length} regions • {playerCount} players
    </p>
    <button
      class="refresh-button"
      disabled={loadingPreview}
      on:click={refreshPreview}
    >
      {loadingPreview ? 'Generating...' : 'New Map'}
    </button>
  </div>
</div>

<style>
  .preview-panel {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-width: 300px;
  }

  h3 {
    font-size: 20px;
    color: #f8fafc;
    margin-bottom: 12px;
  }

  .map-container {
    position: relative;
    flex: 1;
    background: #1f2937;
    border-radius: 8px;
    border: 2px solid #374151;
    overflow: hidden;
    min-height: 400px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .loading-overlay {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    color: #f8fafc;
    gap: 16px;
  }

  .error-overlay, .empty-overlay {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    color: #f8fafc;
    gap: 16px;
    text-align: center;
    padding: 20px;
  }

  .error-text {
    color: #ef4444;
    margin: 0;
  }

  .retry-button {
    padding: 8px 16px;
    background: #3b82f6;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    transition: background-color 0.2s ease;
  }

  .retry-button:hover {
    background: #2563eb;
  }

  .loading-spinner {
    width: 40px;
    height: 40px;
    border: 3px solid #374151;
    border-top: 3px solid #60a5fa;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }

  .preview-info {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: 12px;
    padding: 8px 0;
    pointer-events: auto;
    z-index: 5;
    position: relative;
  }

  .map-info {
    color: #94a3b8;
    font-size: 0.9rem;
    margin: 0;
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
  }

  .refresh-button:hover:not(:disabled) {
    background: #475569;
    border-color: #60a5fa;
  }

  .refresh-button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    pointer-events: none;
  }

  .refresh-button:active {
    transform: translateY(1px);
  }
</style>
