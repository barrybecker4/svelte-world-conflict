<script lang="ts">
import { Button, Modal } from 'shared-ui';
    
  interface Props {
    maxSoldiers: number;
    currentSelection: number;
    onConfirm: (count: number) => void;
    onCancel: () => void;
  }

  let { maxSoldiers, currentSelection, onConfirm, onCancel }: Props = $props();

  let selectedCount = $state(currentSelection);
  let isOpen = $state(true);

  // Clamp selection to valid range
  const clampedSelection = $derived(Math.max(1, Math.min(selectedCount, maxSoldiers)));

  function selectSoldiers(count: number) {
    selectedCount = Math.max(1, Math.min(count, maxSoldiers));
  }

  function handleConfirm() {
    onConfirm(clampedSelection);
    isOpen = false;
  }

  function handleCancel() {
    onCancel();
    isOpen = false;
  }

  function handleClose() {
    handleCancel();
  }
</script>

<Modal
  {isOpen}
  title="Select Soldiers to Move"
  on:close={handleClose}
>
  <div class="soldier-display">
    <!-- Native slider control -->
    <div class="slider-container">
      <input
        type="range"
        id="soldier-slider"
        bind:value={selectedCount}
        min="1"
        max={maxSoldiers}
        step="1"
        class="soldier-slider"
      />
      <div class="slider-labels">
        <span>1</span>
        <span>{maxSoldiers}</span>
      </div>
    </div>

    <!-- Visual soldier icons (read-only display) -->
    <div class="soldier-grid">
      {#each Array(maxSoldiers) as _, index}
        <div
          class="soldier-icon"
          class:selected={index < clampedSelection}
          class:available={index >= clampedSelection}
        >
          <div class="soldier-figure">
            <div class="helmet"></div>
            <div class="body"></div>
            <div class="legs"></div>
          </div>
        </div>
      {/each}
    </div>

    <div class="selection-info">
      <p>Moving <strong>{clampedSelection}</strong> of {maxSoldiers} soldiers</p>
      <small>Use the slider to select how many soldiers to move</small>
    </div>
  </div>

  <div slot="footer" class="modal-footer">
    <Button variant="secondary" on:click={handleCancel}>
      Cancel
    </Button>
    <Button variant="success" on:click={handleConfirm}>
      Move {clampedSelection} Soldier{clampedSelection === 1 ? '' : 's'}
    </Button>
  </div>
</Modal>

<style>
  .soldier-display {
    margin-bottom: 1.5rem;
  }

  .slider-container {
    margin-bottom: 1.5rem;
  }

  .soldier-slider {
    width: 100%;
    height: 8px;
    border-radius: 4px;
    background: linear-gradient(to right, #10b981, #059669);
    outline: none;
    -webkit-appearance: none;
    appearance: none;
    cursor: pointer;
  }

  .soldier-slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 24px;
    height: 24px;
    border-radius: 50%;
    background: #fff;
    border: 3px solid #10b981;
    cursor: pointer;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
    transition: all 0.2s ease;
  }

  .soldier-slider::-webkit-slider-thumb:hover {
    transform: scale(1.1);
    border-color: #34d399;
  }

  .soldier-slider::-moz-range-thumb {
    width: 24px;
    height: 24px;
    border-radius: 50%;
    background: #fff;
    border: 3px solid #10b981;
    cursor: pointer;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
    transition: all 0.2s ease;
  }

  .soldier-slider::-moz-range-thumb:hover {
    transform: scale(1.1);
    border-color: #34d399;
  }

  .slider-labels {
    display: flex;
    justify-content: space-between;
    margin-top: 0.5rem;
    color: #94a3b8;
    font-size: 0.85rem;
  }

  .soldier-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(40px, 1fr));
    gap: 8px;
    margin-bottom: 1rem;
    max-height: 200px;
    overflow-y: auto;
    padding: 0.5rem;
    background: rgba(0, 0, 0, 0.2);
    border-radius: 8px;
  }

  .soldier-icon {
    width: 40px;
    height: 40px;
    border-radius: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;
    border: 2px solid transparent;
    pointer-events: none;
  }

  .soldier-icon.selected {
    background: linear-gradient(145deg, #10b981, #059669);
    border-color: #34d399;
    transform: scale(1.05);
  }

  .soldier-icon.available {
    background: rgba(71, 85, 105, 0.3);
    border-color: #64748b;
  }

  .soldier-figure {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1px;
  }

  .helmet {
    width: 8px;
    height: 6px;
    background: #4a5568;
    border-radius: 50% 50% 0 0;
  }

  .soldier-icon.selected .helmet {
    background: #fbbf24;
  }

  .body {
    width: 6px;
    height: 8px;
    background: #64748b;
    border-radius: 2px;
  }

  .soldier-icon.selected .body {
    background: #f7fafc;
  }

  .legs {
    width: 8px;
    height: 4px;
    background: #4a5568;
    border-radius: 0 0 2px 2px;
  }

  .soldier-icon.selected .legs {
    background: #1f2937;
  }

  .selection-info {
    text-align: center;
    color: #cbd5e1;
  }

  .selection-info strong {
    color: #10b981;
    font-size: 1.1rem;
  }

  .selection-info small {
    display: block;
    margin-top: 0.25rem;
    color: #94a3b8;
    font-size: 0.8rem;
  }
</style>
