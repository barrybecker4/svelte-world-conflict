<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import PlayerConfiguration from './PlayerConfiguration.svelte';
  import Section from '$lib/components/ui/Section.svelte';
  import { getPlayerConfig } from '$lib/game/constants/playerConfigs';
  import { GAME_CONSTANTS } from '$lib/game/constants/gameConstants';

  const dispatch = createEventDispatcher();

  export let playerName: string;
  export let slots: any[] = [];

  // Initialize slots if not provided
  if (slots.length === 0) {
    slots = createInitialSlots();
    initializeWithPlayer(playerName);
  }

  // Reactive computations
  $: activeSlotCount = slots.filter(slot => slot.type !== 'Off').length;
  $: hasPlayerSet = slots.some(slot => slot.type === 'Set');

  // Dispatch updates when slots change
  $: dispatch('update', {
    slots,
    activeSlotCount,
    hasPlayerSet
  });

  function createInitialSlots() {
      return [...Array(GAME_CONSTANTS.MAX_PLAYERS).keys()].map(slotIndex => ({
        ...getPlayerConfig(slotIndex),
        slotIndex,
        type: 'Off',
        customName: ''
      }));
  }

  function initializeWithPlayer(playerName: string) {
    // Set the first slot to the current player
    slots[0] = {
      ...getPlayerConfig(0),
      type: 'Set',
      customName: playerName
    };

    // Add some default AI opponents
    slots[1] = { ...getPlayerConfig(1), type: 'AI', customName: '' };
    slots[2] = { ...getPlayerConfig(2), type: 'AI', customName: '' };
    slots[3] = { ...getPlayerConfig(3), type: 'Off', customName: '' };
  }

  // Handle individual slot updates
  function handleSlotUpdated(event) {
    const { index, slot } = event.detail;

    // Handle player switching - only one slot can be "Set"
    if (slot.type === 'Set') {
      switchPlayerToSlot(index, slot);
    } else {
      // For other types, just update normally
      slots[index] = { ...slot };
    }

    // Trigger reactivity
    slots = [...slots];
  }

  function switchPlayerToSlot(targetIndex: number, targetSlot: any) {
    // Find current "Set" slot and turn it off
    const currentSetIndex = slots.findIndex(s => s.type === 'Set');
    if (currentSetIndex !== -1 && currentSetIndex !== targetIndex) {
      slots[currentSetIndex] = {
        ...slots[currentSetIndex],
        type: 'Off',
        customName: ''
      };
    }

    // Set the target slot to the current player
    slots[targetIndex] = {
      ...targetSlot,
      type: 'Set',
      customName: playerName
    };
  }

  // Reactively update player name in "Set" slots when prop changes
  $: if (playerName) {
    updatePlayerNameInSlots(playerName);
  }

  function updatePlayerNameInSlots(newPlayerName: string) {
    const setSlotIndex = slots.findIndex(slot => slot.type === 'Set');
    if (setSlotIndex !== -1 && slots[setSlotIndex].customName !== newPlayerName) {
      slots[setSlotIndex] = {
        ...slots[setSlotIndex],
        customName: newPlayerName
      };
      slots = [...slots];
    }
  }
</script>

<Section title="Players">
  {#each slots as slot, index}
    <PlayerConfiguration
      playerSlot={slot}
      {index}
      on:slotUpdated={handleSlotUpdated}
    />
  {/each}
</Section>
