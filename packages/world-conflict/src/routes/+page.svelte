<script lang="ts">
    import { onMount } from 'svelte';
    import { goto } from '$app/navigation';
    import { AdBanner, GameInstructionsModal } from 'shared-ui';
    import GameConfiguration from '$lib/components/configuration/GameConfiguration.svelte';
    import Lobby from '$lib/components/lobby/Lobby.svelte';
    import { useAudio } from '$lib/client/audio/useAudio';
    import { audioSystem } from '$lib/client/audio/AudioSystem';
    import { SOUNDS } from '$lib/client/audio/sounds';
    import { saveGameCreator, loadPlayerName } from '$lib/client/stores/clientStorage';
    import { GameApiClient } from '$lib/client/gameController/GameApiClient';
    import { TUTORIAL_CARDS } from '$lib/game/constants/tutorialContent';
    import { VERSION } from '$lib/version';

    let showInstructions = $state(true); // Auto-show on load
    let showLobby = $state(false);
    let showConfiguration = $state(false);
    let userName = $state('');

    // Ad configuration - use environment variable or default
    const adUnitId = import.meta.env.VITE_ADSENSE_AD_UNIT_ID || '';
    const showAds = $derived(adUnitId && (showLobby || showConfiguration));

    const { initializeAudio } = useAudio();

    onMount(async () => {
        await initializeAudio();
        userName = loadPlayerName();
    });

    function handleInstructionsComplete() {
        showInstructions = false;
        showLobby = true;
    }

    async function handleGameCreated(event: CustomEvent) {
        const gameConfig = event.detail;
        const humanPlayer = extractHumanPlayer(gameConfig);

        const result = await GameApiClient.createGame({
            playerName: humanPlayer.name,
            gameType: 'MULTIPLAYER',
            mapSize: gameConfig.settings.mapSize,
            aiDifficulty: gameConfig.settings.aiDifficulty,
            maxTurns: gameConfig.settings.maxTurns,
            timeLimit: gameConfig.settings.timeLimit,
            playerSlots: gameConfig.playerSlots,
            selectedMapRegions: gameConfig.selectedMapRegions,
            selectedMapState: gameConfig.selectedMapState,
            settings: gameConfig.settings
        });

        const player = result.player || { slotIndex: 0, name: humanPlayer.name };

        await audioSystem.playSound(SOUNDS.GAME_CREATED);

        saveGameCreator(result.gameId, {
            playerId: player.slotIndex.toString(),
            playerSlotIndex: player.slotIndex,
            playerName: player.name
        });

        // Navigate to game - will show WaitingRoom for PENDING games, WorldConflictGame for ACTIVE games
        await goto(`/game/${result.gameId}`);
    }

    function extractHumanPlayer(gameConfig: any) {
        const humanPlayer = gameConfig.playerSlots.find((slot: any) => slot.type === 'Set');
        if (!humanPlayer) {
            throw new Error('No human player found in game configuration');
        }
        return humanPlayer;
    }

    function handleLobbyClose() {
        showLobby = false;
        showConfiguration = true; // Go to game configuration when "New Game" is clicked
    }

    function handleConfigurationClose() {
        showConfiguration = false;
        showLobby = true; // Go back to lobby instead of instructions
    }
</script>

{#if showInstructions}
    <GameInstructionsModal
        tutorialCards={TUTORIAL_CARDS}
        gameTitle="World Conflict"
        {userName}
        version={VERSION}
        creditsLink="https://github.com/barrybecker4/svelte-world-conflict/wiki/World-Conflict-History-and-Credits"
        oncomplete={handleInstructionsComplete}
    />
{/if}

<div class="page-container">
    <div class="main-content">
        {#if showLobby}
            <Lobby on:close={handleLobbyClose} />
        {/if}

        {#if showConfiguration}
            <GameConfiguration on:close={handleConfigurationClose} on:gameCreated={handleGameCreated} />
        {/if}
    </div>

    {#if showAds}
        <aside class="ad-sidebar">
            <AdBanner {adUnitId} adFormat="rectangle" className="desktop-ad" />
        </aside>
        <div class="ad-banner-mobile">
            <AdBanner {adUnitId} adFormat="horizontal" className="mobile-ad" />
        </div>
    {/if}
</div>

<style>
    .page-container {
        position: relative;
        min-height: 100vh;
    }

    .main-content {
        width: 100%;
    }

    .ad-sidebar {
        position: fixed;
        right: 1rem;
        top: 50%;
        transform: translateY(-50%);
        z-index: 100;
        display: none;
    }

    .ad-banner-mobile {
        position: fixed;
        bottom: 0;
        left: 0;
        right: 0;
        z-index: 100;
        display: none;
        background: rgba(0, 0, 0, 0.8);
        padding: 0.5rem;
        text-align: center;
    }

    @media (min-width: 1024px) {
        .ad-sidebar {
            display: block;
        }
    }

    @media (max-width: 1023px) {
        .ad-banner-mobile {
            display: block;
        }
    }
</style>
