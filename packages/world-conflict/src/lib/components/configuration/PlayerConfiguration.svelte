<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { PlayerSlot } from '$lib/game/entities/PlayerSlot';

  const dispatch = createEventDispatcher();

  export let playerSlot: PlayerSlot;
  export let index: number;

  const slotTypes = ['Off', 'Set', 'Open', 'AI'];
  
  let editingName = false;
  let nameInput: HTMLInputElement;
  
  $: isSetSlot = playerSlot.type === 'Set';

  function handleSlotTypeChange(event: Event) {
    const newType = (event.target as HTMLSelectElement).value;

    const updatedSlot = {
      ...playerSlot,
      type: newType,
      // Clear custom name when switching away from 'Set' type
      customName: newType === 'Set' ? playerSlot.customName : ''
    };

    dispatch('slotUpdated', { index, slot: updatedSlot });
  }

  function handleCustomNameChange(event: Event) {
    const updatedSlot = {
      ...playerSlot,
      customName: (event.target as HTMLInputElement).value
    };

    dispatch('slotUpdated', { index, slot: updatedSlot });
  }

  function startEditingName() {
    if (isSetSlot) {
      editingName = true;
      setTimeout(() => {
        nameInput?.focus();
        nameInput?.select();
      }, 0);
    }
  }

  function handleNameBlur() {
    editingName = false;
  }

  function handleNameKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      editingName = false;
      nameInput?.blur();
    } else if (event.key === 'Escape') {
      editingName = false;
    }
  }

  function handleNameInput(event: Event) {
    const target = event.target as HTMLInputElement;
    const newName = target.value;
    
    // Update the slot with the new name
    const updatedSlot = {
      ...playerSlot,
      customName: newName
    };
    dispatch('slotUpdated', { index, slot: updatedSlot });
    
    // Notify parent about name change
    dispatch('nameChange', { name: newName });
  }
</script>

<div class="player-slot">
  <div class="player-color" style="background: {playerSlot.colorStart}"></div>

  <div class="player-info">
    {#if isSetSlot && editingName}
      <input
        bind:this={nameInput}
        type="text"
        value={playerSlot.customName || playerSlot.defaultName}
        on:input={handleNameInput}
        on:blur={handleNameBlur}
        on:keydown={handleNameKeydown}
        class="name-edit-input"
      />
    {:else}
      <button 
        class="player-name" 
        class:editable={isSetSlot}
        on:click={startEditingName}
        type="button"
      >
        {#if playerSlot.type === 'Set'}
          {playerSlot.customName || playerSlot.defaultName}
        {:else if playerSlot.type === 'Open'}
          &lt;open&gt;
        {:else if playerSlot.type === 'AI'}
          {playerSlot.defaultName} (AI)
        {:else}
          {playerSlot.defaultName}
        {/if}
      </button>
    {/if}
  </div>

  <select
    value={playerSlot.type}
    on:change={handleSlotTypeChange}
    class="slot-type-select"
    data-testid="player-slot-{index}-type"
    data-slot-type={playerSlot.type}
  >
    {#each slotTypes as type}
      <option value={type} data-testid="player-slot-{index}-option-{type.toLowerCase()}">{type}</option>
    {/each}
  </select>
</div>

<style>
  .player-slot {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 4px;
    padding: 4px 6px;
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
    background: none;
    border: none;
    padding: 0;
    text-align: left;
    cursor: default;
    font-size: inherit;
    font-family: inherit;
  }

  .player-name.editable {
    cursor: pointer;
    text-decoration: underline;
    text-decoration-style: dotted;
    text-underline-offset: 2px;
  }

  .player-name.editable:hover {
    color: #60a5fa;
  }

  .name-edit-input {
    width: 100%;
    padding: 4px 8px;
    border: 1px solid #60a5fa;
    border-radius: 4px;
    background: #1f2937;
    color: #f8fafc;
    font-size: inherit;
    font-weight: 500;
    font-family: inherit;
    box-shadow: 0 0 0 2px rgba(96, 165, 250, 0.2);
  }

  .name-edit-input:focus {
    outline: none;
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
</style>
