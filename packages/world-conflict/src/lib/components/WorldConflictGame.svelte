<script lang="ts">
    import { onMount, onDestroy, tick } from 'svelte';
    import { LoadingState, SoundTestModal, AdBanner, GameInstructionsModal } from 'shared-ui';
    import Banner from './ui/Banner.svelte';
    import GameInfoPanel from './GameInfoPanel.svelte';
    import GameSummaryPanel from './GameSummaryPanel.svelte';
    import TempleUpgradePanel from './TempleUpgradePanel.svelte';
    import GameMap from './map/GameMap.svelte';
    import FloatingTextManager from './map/FloatingTextManager.svelte';
    import SoldierSelectionModal from './modals/SoldierSelectionModal.svelte';
    import { TUTORIAL_CARDS } from '$lib/game/constants/tutorialContent';
    import { createGameStateStore } from '$lib/client/stores/gameStateStore';
    import { GameController } from '$lib/client/gameController/GameController';
    import type { Player } from '$lib/game/state/GameState';
    import { BUILD } from '$lib/game/mechanics/moveConstants';
    import { logger } from 'multiplayer-framework/shared';
    import { audioSystem } from '$lib/client/audio/AudioSystem';
    import { SOUNDS, SOUND_ICONS } from '$lib/client/audio/sounds';

    export let gameId: string;
    export let playerId: string;
    export let playerSlotIndex: number;

    const gameStore = createGameStateStore(gameId, playerSlotIndex);
    const {
        gameState,
        regions,
        players,
        loading,
        error,
        currentPlayer,
        currentPlayerFromTurnManager,
        isMyTurn,
        shouldShowBanner,
        shouldHighlightRegions,
        completeBanner,
        eliminationBanners,
        completeEliminationBanner,
        shouldShowReplayBanner,
        replayPlayer,
        completeReplayBanner
    } = gameStore;

    const controller = new GameController(gameId, playerId, gameStore);
    const { modalState, moveState, isConnected, tutorialTips, battleInProgress } = controller.getStores();

    let mapContainer: HTMLElement;
    let floatingTextManager: FloatingTextManager;
    let showVictoryBanner = false;
    let showGameSummary = false;
    let gameWinner: Player | 'DRAWN_GAME' | null = null;
    let showSoundTestModal = false;

    // Ad configuration
    $: adUnitId = import.meta.env.VITE_ADSENSE_AD_UNIT_ID || '';
    $: showAds = adUnitId && !showGameSummary;

    // Convert SNAKE_CASE to Title Case for sound names
    function formatSoundName(key: string): string {
        return key
            .split('_')
            .map(word => word.charAt(0) + word.slice(1).toLowerCase())
            .join(' ');
    }

    // Generate sound list from SOUNDS constant
    $: soundList = Object.keys(SOUNDS).map(key => ({
        key,
        name: formatSoundName(key),
        icon: SOUND_ICONS[key as keyof typeof SOUND_ICONS] || '🔊'
    }));

    async function handlePlaySound(soundKey: string) {
        const soundType = SOUNDS[soundKey as keyof typeof SOUNDS];
        await audioSystem.playSound(soundType);
    }

    $: selectedRegion =
        $moveState.sourceRegion !== null ? $regions.find(r => r.index === $moveState.sourceRegion) || null : null;

    // Get valid target regions when a source is selected
    $: validTargetRegions =
        $moveState.sourceRegion !== null && gameStore.getMoveSystem()
            ? (gameStore.getMoveSystem()?.getValidTargetRegions() ?? [])
            : [];

    // Check for game end
    $: if ($gameState && $players.length > 0) {
        controller.checkGameEnd($gameState, $players);
    }

    // Show victory banner when game ends
    $: if ($gameState && $players.length > 0 && $modalState.showGameSummary && !showVictoryBanner && !showGameSummary) {
        // Game just ended, show victory banner
        showVictoryBanner = true;
        gameWinner = $modalState.winner;
    }

    $: moveMode = $moveState.mode;
    $: buildRegion = $moveState.buildRegion;
    $: inBuildMode = moveMode === BUILD && buildRegion !== null;
    // canUndo needs to react to gameState changes, so we reference $gameState to create the dependency
    $: canUndo = $gameState ? controller.canUndo() : false;

    onMount(async () => {
        logger.debug('WorldConflictGame mounted');
        // Initialize without waiting for map container - it will be set later
        await controller.initialize(undefined);
    });

    // Set map container when it becomes available
    $: if (mapContainer) {
        logger.debug('Map container available, setting in battle manager');
        controller.setMapContainer(mapContainer);
    }

    // Set floating text callback when both map container and floating text manager are available
    $: if (mapContainer && floatingTextManager) {
        const battleAnimationSystem = controller.getBattleAnimationSystem();
        if (battleAnimationSystem) {
            battleAnimationSystem.setFloatingTextCallback(
                (regionIdx: number, text: string, color: string) => {
                    floatingTextManager.showFloatingText(regionIdx, text, color);
                }
            );
        }
    }

    onDestroy(() => {
        controller.destroy();
    });

    function handlePlayAgain() {
        controller.destroy();
        window.location.href = '/';
    }

    function handleVictoryBannerComplete() {
        logger.debug('Victory banner completed, showing summary panel');
        showVictoryBanner = false;
        showGameSummary = true;
    }
</script>

{#if $loading}
    <LoadingState loading={true} loadingText="Loading game..." />
{:else if $error}
    <div class="error-container">
        <h2>Error Loading Game</h2>
        <p>{$error}</p>
    </div>
{:else}
    <div class="game-container" data-testid="game-interface">
        <!-- Game Info Panel, Temple Upgrade Panel, or Game Summary Panel -->
        {#if showGameSummary && $gameState}
            <GameSummaryPanel
                gameState={$gameState}
                players={$players}
                winner={gameWinner}
                onPlayAgain={handlePlayAgain}
            />
        {:else if inBuildMode && buildRegion !== null}
            <TempleUpgradePanel
                regionIndex={buildRegion}
                gameState={$gameState}
                currentPlayer={$currentPlayer}
                onPurchase={upgradeIndex => controller.purchaseUpgrade(buildRegion, upgradeIndex)}
                onDone={() => controller.closeTempleUpgradePanel()}
            />
        {:else}
            <GameInfoPanel
                gameState={$gameState}
                players={$players}
                {playerSlotIndex}
                {moveMode}
                onEndTurn={() => controller.endTurn()}
                onUndo={() => controller.undo()}
                {canUndo}
                battleInProgress={$battleInProgress}
                onShowInstructions={() => controller.showInstructions()}
                onResign={() => controller.resign()}
                onOpenSoundTest={() => (showSoundTestModal = true)}
            />
        {/if}

        <!-- Game Map -->
        <div class="map-wrapper" bind:this={mapContainer} data-testid="game-map">
            <GameMap
                regions={$regions}
                currentPlayer={$currentPlayer ?? null}
                {selectedRegion}
                {validTargetRegions}
                gameState={$gameState}
                showTurnHighlights={($shouldHighlightRegions ?? true) && !$gameState?.endResult}
                tutorialTips={$tutorialTips}
                battleInProgress={$battleInProgress}
                onRegionClick={region => {
                    logger.debug('GameMap click received in component:', {
                        region,
                        isMyTurn: $isMyTurn
                    });
                    controller.handleRegionClick(region, $isMyTurn ?? false);
                }}
                onTempleClick={regionIndex => {
                    logger.debug('Temple click received in component:', {
                        regionIndex,
                        isMyTurn: $isMyTurn
                    });
                    controller.handleTempleClick(regionIndex, $isMyTurn ?? false);
                }}
                onDismissTooltip={tooltipId => controller.dismissTooltip(tooltipId)}
            />
            <FloatingTextManager bind:this={floatingTextManager} mapContainer={mapContainer} regions={$regions} />
        </div>

        <!-- Replay Banner - shows before replaying other players' moves -->
        {#if $shouldShowReplayBanner && $replayPlayer}
            <Banner player={$replayPlayer} onComplete={completeReplayBanner} />
        {/if}

        <!-- Turn Banner - shows when it's the local player's turn -->
        {#if $shouldShowBanner && $currentPlayerFromTurnManager}
            <Banner player={$currentPlayerFromTurnManager} onComplete={completeBanner} />
        {/if}

        <!-- Elimination Banners -->
        {#each $eliminationBanners as eliminatedPlayerSlot (eliminatedPlayerSlot)}
            {@const eliminatedPlayer = $players.find(p => p.slotIndex === eliminatedPlayerSlot)}
            {#if eliminatedPlayer}
                <Banner
                    player={eliminatedPlayer}
                    type="elimination"
                    duration={2000}
                    onComplete={() => completeEliminationBanner(eliminatedPlayerSlot)}
                />
            {/if}
        {/each}

        <!-- Victory Banner -->
        {#if showVictoryBanner}
            <Banner
                player={null}
                type="victory"
                winner={gameWinner}
                duration={3000}
                onComplete={handleVictoryBannerComplete}
            />
        {/if}

        <!-- Modals -->
        {#if $modalState.showSoldierSelection && $modalState.soldierSelectionData}
            <SoldierSelectionModal
                maxSoldiers={$modalState.soldierSelectionData.maxSoldiers}
                currentSelection={$modalState.soldierSelectionData.currentSelection}
                onConfirm={count => controller.confirmSoldierSelection(count)}
                onCancel={() => controller.cancelSoldierSelection()}
            />
        {/if}

        {#if $modalState.showInstructions}
            <GameInstructionsModal
                tutorialCards={TUTORIAL_CARDS}
                gameTitle="World Conflict"
                onclose={() => controller.closeInstructions()}
            />
        {/if}

        {#if import.meta.env.DEV}
            <div class="debug-info">
                WS: {$isConnected ? 'Connected' : 'Disconnected'} | Mode: {$moveState.mode}
            </div>
        {/if}

        {#if showSoundTestModal}
            <SoundTestModal
                isOpen={showSoundTestModal}
                onclose={() => (showSoundTestModal = false)}
                {soundList}
                onPlaySound={handlePlaySound}
            />
        {/if}

        {#if showAds}
            <aside class="ad-sidebar">
                <AdBanner {adUnitId} adFormat="rectangle" className="desktop-ad" />
            </aside>
            <div class="ad-banner-mobile">
                <AdBanner {adUnitId} adFormat="horizontal" className="mobile-ad" />
            </div>
        {/if}
    </div>
{/if}

<style>
    .game-container {
        display: flex;
        height: 100vh;
        background: var(--bg-page);
    }

    .map-wrapper {
        flex: 1;
        position: relative;
        overflow: hidden;
    }

    .error-container {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        height: 100vh;
        padding: var(--space-6);
        text-align: center;
    }

    .debug-info {
        position: fixed;
        bottom: 8px;
        left: 8px;
        padding: 8px;
        background: rgba(0, 0, 0, 0.7);
        color: #cbd5e1;
        font-size: 0.75rem;
        border-radius: 6px;
        z-index: 1001;
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
