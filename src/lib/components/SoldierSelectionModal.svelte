<script lang="ts">
  export let maxSoldiers: number;
  export let currentSelection: number;
  export let onConfirm: (count: number) => void;
  export let onCancel: () => void;

  let selectedCount = currentSelection;

  $: selectedCount = Math.max(1, Math.min(selectedCount, maxSoldiers));

  function handleConfirm() {
    onConfirm(selectedCount);
  }

  function handleCancel() {
    onCancel();
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      handleCancel();
    } else if (event.key === 'Enter') {
      handleConfirm();
    }
  }

  function adjustCount(delta: number) {
    selectedCount = Math.max(1, Math.min(selectedCount + delta, maxSoldiers));
  }
</script>

<svelte:window on:keydown={handleKeydown} />

<div class="modal-backdrop" on:click={handleCancel} role="presentation">
  <div class="modal-container" on:click|stopPropagation role="dialog" aria-labelledby="modal-title">
    <div class="modal-header">
      <h2 id="modal-title">Select Soldiers to Move</h2>
      <button class="close-button" on:click={handleCancel} aria-label="Close">
        ✕
      </button>
    </div>

    <div class="modal-content">
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
          <button
            class="count-btn"
            on:click={() => adjustCount(-1)}
            disabled={selectedCount <= 1}
            aria-label="Decrease count"
          >
            −
          </button>

          <input
            type="number"
            min="1"
            max={maxSoldiers}
            bind:value={selectedCount}
            class="count-input"
            aria-label="Number of soldiers"
          />

          <button
            class="count-btn"
            on:click={() => adjustCount(1)}
            disabled={selectedCount >= maxSoldiers}
            aria-label="Increase count"
          >
            +
          </button>
        </div>

        <div class="quick-select">
          <button
            class="quick-btn"
            on:click={() => selectedCount = 1}
            class:active={selectedCount === 1}
          >
            1
          </button>
          <button
            class="quick-btn"
            on:click={() => selectedCount = Math.floor(maxSoldiers / 2)}
            class:active={selectedCount === Math.floor(maxSoldiers / 2)}
          >
            Half
          </button>
          <button
            class="quick-btn"
            on:click={() => selectedCount = maxSoldiers}
            class:active={selectedCount === maxSoldiers}
          >
            All
          </button>
        </div>
      </div>
    </div>

    <div class="modal-footer">
      <button class="cancel-btn" on:click={handleCancel}>
        Cancel
      </button>
      <button class="confirm-btn" on:click={handleConfirm}>
        Move {selectedCount} Soldier{selectedCount === 1 ? '' : 's'}
      </button>
    </div>
  </div>
</div>

<style>
  .modal-backdrop {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.7);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    backdrop-filter: blur(4px);
  }

  .modal-container {
    background: linear-gradient(145deg, #2d3748, #1a202c);
    border-radius: 12px;
    border: 1px solid #4a5568;
    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.4);
    width: 90%;
    max-width: 400px;
    max-height: 90vh;
    overflow: hidden;
    color: white;
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1.5rem;
    border-bottom: 1px solid #4a5568;
    background: rgba(0, 0, 0, 0.2);
  }

  .modal-header h2 {
    margin: 0;
    font-size: 1.2rem;
    color: #f7fafc;
  }

  .close-button {
    background: none;
    border: none;
    color: #a0aec0;
    font-size: 1.5rem;
    cursor: pointer;
    padding: 0.25rem;
    border-radius: 4px;
    transition: all 0.2s;
  }

  .close-button:hover {
    background: rgba(255, 255, 255, 0.1);
    color: white;
  }

  .modal-content {
    padding: 1.5rem;
  }

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

  .count-btn {
    width: 40px;
    height: 40px;
    border: none;
    background: #4a5568;
    color: white;
    border-radius: 50%;
    font-size: 1.2rem;
    font-weight: bold;
    cursor: pointer;
    transition: all 0.2s;
  }

  .count-btn:hover:not(:disabled) {
    background: #64748b;
    transform: scale(1.1);
  }

  .count-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
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
    border-color: #10b981;
  }

  .quick-select {
    display: flex;
    gap: 0.5rem;
    justify-content: center;
  }

  .quick-btn {
    padding: 0.5rem 1rem;
    border: 1px solid #4a5568;
    background: rgba(71, 85, 105, 0.3);
    color: #cbd5e1;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.2s;
    font-size: 0.85rem;
  }

  .quick-btn:hover {
    background: #4a5568;
    color: white;
  }

  .quick-btn.active {
    background: #10b981;
    border-color: #10b981;
    color: white;
  }

  .modal-footer {
    display: flex;
    justify-content: space-between;
    padding: 1rem 1.5rem;
    border-top: 1px solid #4a5568;
    background: rgba(0, 0, 0, 0.2);
    gap: 1rem;
  }

  .cancel-btn, .confirm-btn {
    flex: 1;
    padding: 0.75rem 1rem;
    border: none;
    border-radius: 6px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
  }

  .cancel-btn {
    background: #64748b;
    color: white;
  }

  .cancel-btn:hover {
    background: #4a5568;
  }

  .confirm-btn {
    background: #10b981;
    color: white;
  }

  .confirm-btn:hover {
    background: #059669;
    transform: translateY(-1px);
  }

  /* Mobile responsive */
  @media (max-width: 480px) {
    .modal-container {
      width: 95%;
      margin: 1rem;
    }

    .soldier-grid {
      grid-template-columns: repeat(auto-fit, minmax(35px, 1fr));
    }

    .soldier-icon {
      width: 35px;
      height: 35px;
    }

    .count-controls {
      flex-wrap: wrap;
    }

    .modal-footer {
      flex-direction: column;
    }
  }
</style>
