<!-- src/lib/components/configuration/PlayerConfiguration.svelte -->
<script>
  import { createEventDispatcher } from 'svelte';

  const dispatch = createEventDispatcher();

  export let playerSlot;
  export let index;

  const slotTypes = ['Off', 'Set', 'Open', 'AI'];

  function handleSlotTypeChange(event) {
    const newType = event.target.value;

    const updatedSlot = {
      ...playerSlot,
      type: newType,
      // Clear custom name when switching away from 'Set' type
      customName: newType === 'Set' ? playerSlot.customName : ''
    };

    dispatch('slotUpdated', { index, slot: updatedSlot });
  }

  function handleCustomNameChange(event) {
    const updatedSlot = {
      ...playerSlot,
      customName: event.target.value
    };

    dispatch('slotUpdated', { index, slot: updatedSlot });
  }
</script>

<div class="player-slot">
  <div class="player-color" style="background: {playerSlot.colorStart}"></div>

  <div class="player-info">
    <span class="player-name">
      {#if playerSlot.type === 'Set'}
        {playerSlot.customName || playerSlot.defaultName}
      {:else if playerSlot.type === 'Open'}
        &lt;open&gt;
      {:else if playerSlot.type === 'AI'}
        {playerSlot.defaultName} (AI)
      {:else}
        {playerSlot.defaultName}
      {/if}
    </span>
  </div>

  <select
    value={playerSlot.type}
    on:change={handleSlotTypeChange}
    class="slot-type-select"
  >
    {#each slotTypes as type}
      <option value={type}>{type}</option>
    {/each}
  </select>

  <!-- Remove the custom name input for Set slots since player can change name at top -->
</div>

<style>
  .player-slot {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 10px;
    padding: 8px;
    background: #374151;
    border-radius: 6px;
  }

  .player-color {
    width: 20px;
    height: 20px;
    border-radius: 50%;
  }

  .player-info {
    flex: 1;
    min-width: 0;
  }

  .player-name {
    color: #f8fafc;
    font-weight: 500;
  }

  .slot-type-select {
    padding: 6px 10px;
    border: 1px solid #475569;
    border-radius: 4px;
    background: #475569;
    color: white;
    font-size: 0.9rem;
    min-width: 80px;
    transition: all 0.2s ease;
  }

  .slot-type-select:focus {
    border-color: #60a5fa;
    outline: none;
    box-shadow: 0 0 0 2px rgba(96, 165, 250, 0.2);
  }

  .slot-type-select option {
    background: #475569;
    color: white;
    padding: 8px;
  }

  .slot-type-select option:hover {
    background: #60a5fa;
    color: white;
  }

  .slot-type-select option:checked {
    background: #60a5fa;
    color: white;
  }

  .custom-name-input {
    padding: 4px 8px;
    border: 1px solid #475569;
    border-radius: 4px;
    background: #1f2937;
    color: white;
    font-size: 0.9rem;
    width: 120px;
  }

  .custom-name-input:focus {
    border-color: #60a5fa;
    outline: none;
  }
</style>
