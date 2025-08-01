<script lang="ts">
  import Button from '$lib/components/ui/Button.svelte';
  import IconButton from '$lib/components/ui/IconButton.svelte';
  import Modal from '$lib/components/ui/Modal.svelte';

  export let maxSoldiers: number;
  export let currentSelection: number;
  export let onConfirm: (count: number) => void;
  export let onCancel: () => void;

  let selectedCount = currentSelection;
  let isOpen = true;

  $: selectedCount = Math.max(1, Math.min(selectedCount, maxSoldiers));

  function handleConfirm() {
    onConfirm(selectedCount);
    isOpen = false;
  }

  function handleCancel() {
    onCancel();
    isOpen = false;
  }

  function handleClose() {
    handleCancel();
  }

  function adjustCount(delta: number) {
    selectedCount = Math.max(1, Math.min(selectedCount + delta, maxSoldiers));
  }
</script>

<Modal
  {isOpen}
  title="Select Soldiers to Move"
  on:close={handleClose}
>
  <div class="soldier-display">
    <div class="soldier-grid">
      {#each Array(maxSoldiers) as _, index}
        <div
          class="soldier-icon"
          class:selected={index < selectedCount}
          class:available={index >= selectedCount}
          on:click={() => selectedCount = index + 1}
          role="button"
          tabindex="0"
          aria-label="Select {index + 1} soldiers"
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
      <p>Moving <strong>{selectedCount}</strong> of {maxSoldiers} soldiers</p>
      <small>Click soldiers above or use buttons below</small>
    </div>
  </div>

  <div class="controls">
    <div class="count-controls">
      <IconButton
        variant="default"
        size="md"
        disabled={selectedCount <= 1}
        title="Decrease count"
        on:click={() => adjustCount(-1)}
      >
        −
      </IconButton>

      <input
        type="number"
        min="1"
        max={maxSoldiers}
        bind:value={selectedCount}
        class="count-input"
        aria-label="Number of soldiers"
      />

      <IconButton
        variant="default"
        size="md"
        disabled={selectedCount >= maxSoldiers}
        title="Increase count"
        on:click={() => adjustCount(1)}
      >
        +
      </IconButton>
    </div>

    <div class="quick-select-wrapper">
      <Button
        variant={selectedCount === 1 ? 'primary' : 'ghost'}
        size="sm"
        on:click={() => selectedCount = 1}
      >
        1
      </Button>
      <Button
        variant={selectedCount === Math.floor(maxSoldiers / 2) ? 'primary' : 'ghost'}
        size="sm"
        on:click={() => selectedCount = Math.floor(maxSoldiers / 2)}
      >
        Half
      </Button>
      <Button
        variant={selectedCount === maxSoldiers ? 'primary' : 'ghost'}
        size="sm"
        on:click={() => selectedCount = maxSoldiers}
      >
        All
      </Button>
    </div>
  </div>

  <div slot="footer" class="modal-footer">
    <Button variant="secondary" on:click={handleCancel}>
      Cancel
    </Button>
    <Button variant="success" on:click={handleConfirm}>
      Move {selectedCount} Soldier{selectedCount === 1 ? '' : 's'}
    </Button>
  </div>
</Modal>

<style>
  .soldier-display {
    margin-bottom: 1.5rem;
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
    cursor: pointer;
    transition: all 0.2s ease;
    border: 2px solid transparent;
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

  .soldier-icon:hover {
    transform: scale(1.1);
    border-color: #fbbf24;
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

  .controls {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .count-controls {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
  }

  .count-input {
    width: 60px;
    height: 40px;
    text-align: center;
    border: 2px solid #4a5568;
    border-radius: 6px;
    background: #1a202c;
    color: white;
    font-size: 1rem;
    font-weight: bold;
  }

  .count-input:focus {
    outline: none;
    border-color: #60a5fa;
  }

  .quick-select-wrapper {
    display: flex;
    justify-content: center;
    gap: 0.5rem;
  }
</style>
