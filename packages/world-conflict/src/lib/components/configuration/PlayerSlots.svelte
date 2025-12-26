<script lang="ts">
    import { createEventDispatcher, onMount } from 'svelte';
    import PlayerConfiguration from './PlayerConfiguration.svelte';
    import { Section } from 'shared-ui';
    import { getPlayerConfig } from '$lib/game/constants/playerConfigs';
    import { GAME_CONSTANTS } from '$lib/game/constants/gameConstants';
    import type { PlayerSlot, PlayerSlotType } from '$lib/game/entities/PlayerSlot';

    const dispatch = createEventDispatcher();

    export let playerName: string;
    export let slots: PlayerSlot[] = [];

    // Track if we've initialized to avoid re-running
    let initialized = false;

    onMount(() => {
        // Initialize slots if not provided (run after props are received)
        if (slots.length === 0 && !initialized) {
            slots = createInitialSlots();
            initializeWithPlayer(playerName);
            initialized = true;
        }
    });

    // Reactive computations
    $: activeSlotCount = slots.filter(slot => slot.type !== 'Off').length;
    $: hasPlayerSet = slots.some(slot => slot.type === 'Set');

    // Dispatch updates when slots change
    $: dispatch('update', {
        slots,
        activeSlotCount,
        hasPlayerSet
    });

    function createSlotFromConfig(slotIndex: number, type: PlayerSlotType, customName: string = ''): PlayerSlot {
        const config = getPlayerConfig(slotIndex);
        return {
            ...config,
            slotIndex,
            type,
            customName,
            color: config.colorStart // Use colorStart as the primary color
        };
    }

    function createInitialSlots(): PlayerSlot[] {
        return [...Array(GAME_CONSTANTS.MAX_PLAYERS).keys()].map(slotIndex => createSlotFromConfig(slotIndex, 'Off'));
    }

    function initializeWithPlayer(name: string) {
        // Set the first slot to the current player
        slots[0] = createSlotFromConfig(0, 'Set', name);

        // Default to open slots for other human players to join
        // Users can change these to AI if they prefer playing against computer
        slots[1] = createSlotFromConfig(1, 'Open');
        slots[2] = createSlotFromConfig(2, 'Off');
        slots[3] = createSlotFromConfig(3, 'Off');
    }

    // Handle individual slot updates
    function handleSlotUpdated(event: CustomEvent) {
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

    function switchPlayerToSlot(targetIndex: number, targetSlot: PlayerSlot) {
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

    function handlePlayerNameChange(event: CustomEvent) {
        const { name } = event.detail;
        playerName = name;
        dispatch('nameChange', { name });
    }
</script>

<Section title="" padding="8px 12px" borderBottom={true}>
    {#each slots as slot, index}
        <PlayerConfiguration
            playerSlot={slot}
            {index}
            on:slotUpdated={handleSlotUpdated}
            on:nameChange={handlePlayerNameChange}
        />
    {/each}
</Section>
