<script lang="ts">
    import { Button, Panel, Section } from 'shared-ui';
    import type { GameStateData, Player } from '$lib/game/state/GameState';
    import { getPlayerConfig } from '$lib/game/constants/playerConfigs';
    import { SYMBOLS } from '$lib/game/constants/symbols';
    import { PlayerStatisticsCalculator } from '$lib/game/mechanics/PlayerStatisticsCalculator';
    import { GAME_CONSTANTS } from '$lib/game/constants/gameConstants';

    export let gameState: GameStateData;
    export let players: Player[];
    export let winner: Player | 'DRAWN_GAME' | null = null;
    export let onPlayAgain: () => void = () => {};

    let statisticsCalculator: PlayerStatisticsCalculator;

    $: {
        if (gameState) {
            statisticsCalculator = new PlayerStatisticsCalculator(gameState);
        }
    }

    $: playerStats = statisticsCalculator ? statisticsCalculator.calculatePlayerStats(players) : [];
    $: faithByPlayer = gameState?.faithByPlayer ?? {};

    function getPlayerColorStart(index: number): string {
        return getPlayerConfig(index).colorStart;
    }

    function getPlayerColorEnd(index: number): string {
        return getPlayerConfig(index).colorEnd;
    }

    function getRegionCount(slotIndex: number): number {
        if (!gameState?.ownersByRegion) return 0;
        return Object.values(gameState.ownersByRegion).filter(owner => owner === slotIndex).length;
    }

    function getGameEndReason(): string {
        if (winner === 'DRAWN_GAME') {
            return 'Game ended in a draw!';
        }

        // Check if game ended due to turn limit
        const maxTurns = gameState.maxTurns;
        const currentTurn = gameState.turnNumber + 1;

        if (maxTurns && currentTurn >= maxTurns) {
            return `Turn limit reached (${maxTurns} turns)`;
        }

        // Check if all but one player eliminated
        if (statisticsCalculator) {
            const activePlayers = statisticsCalculator.getActivePlayers(players);
            if (activePlayers.length <= 1) {
                return winner ? 'All other players eliminated' : 'All players eliminated';
            }
        }

        return 'Game completed';
    }

    $: gameEndReason = getGameEndReason();
</script>

<div
    style="--side-panel-width: {GAME_CONSTANTS.SIDE_PANEL_WIDTH}px; --player-name-max-width: {GAME_CONSTANTS.PLAYER_NAME_MAX_WIDTH}px;"
>
    <Panel variant="glass" padding={false} customClass="game-summary-panel">
        <!-- Game Over Header -->
        <Section title="" customClass="summary-header-section">
            <div class="game-over-header">
                <div class="game-over-title">Game Over</div>
            </div>
        </Section>

        <!-- Winner Info -->
        <Section title="" customClass="winner-section">
            <div class="winner-box">
                {#if winner === 'DRAWN_GAME'}
                    <div class="winner-label draw">Draw</div>
                    <div class="winner-message">Game ended in a tie</div>
                {:else if winner}
                    <div class="winner-label">
                        🏆 Winner: <span class="winner-name-inline">{winner.name}</span>
                    </div>
                {/if}
                <div class="end-reason">{gameEndReason}</div>
            </div>
        </Section>

        <!-- Final Rankings -->
        <Section
            title="Final Rankings"
            padding="12px"
            flex={true}
            flexDirection="column"
            gap="8px"
            customClass="flex-1 rankings-section"
        >
            {#each playerStats as stat}
                {@const isWinner =
                    winner !== 'DRAWN_GAME' && winner !== null && stat.player.slotIndex === winner.slotIndex}
                {@const isEliminated = stat.regionCount === 0}
                {@const regionCount = getRegionCount(stat.player.slotIndex)}
                {@const faithCount = faithByPlayer[stat.player.slotIndex]}

                <div class="ranking-box" class:winner={isWinner} class:eliminated={isEliminated}>
                    <div class="ranking-player-info">
                        <div class="rank-badge">
                            {#if isWinner}
                                {@html SYMBOLS.VICTORY}
                            {:else}
                                #{stat.rank}
                            {/if}
                        </div>

                        <div
                            class="ranking-player-color"
                            style="background: linear-gradient(135deg, {getPlayerColorStart(
                                stat.player.slotIndex
                            )}, {getPlayerColorEnd(stat.player.slotIndex)});"
                        ></div>

                        <div class="ranking-player-details">
                            <div class="ranking-player-name">{stat.player.name}</div>
                        </div>
                    </div>

                    <div class="ranking-stats">
                        <div class="ranking-stat" data-tooltip="Regions controlled">
                            <span class="stat-value">{regionCount}</span>
                            <span class="stat-symbol">{@html SYMBOLS.REGION}</span>
                        </div>
                        <div class="ranking-stat" data-tooltip="Soldiers in army">
                            <span class="stat-value">{stat.soldierCount}</span>
                            <span class="stat-symbol">{@html SYMBOLS.SOLDIER}</span>
                        </div>
                        <div class="ranking-stat" data-tooltip="Faith accumulated">
                            <span class="stat-value">{faithCount}</span>
                            <span class="stat-symbol">{@html SYMBOLS.FAITH}</span>
                        </div>
                    </div>
                </div>
            {/each}
        </Section>

        <!-- Play Again Button -->
        <Section title="" borderBottom={false}>
            <Button variant="primary" size="lg" onclick={onPlayAgain} data-testid="play-again-btn">Play Again</Button>
        </Section>
    </Panel>
</div>

<style>
    /* Header Section */
    :global(.summary-header-section) {
        background: transparent;
        border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    }

    .game-over-header {
        text-align: center;
        padding: var(--space-3, 12px);
        background: rgba(30, 30, 30, 0.8);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: var(--radius-sm, 4px);
    }

    .game-over-title {
        font-size: var(--text-xl, 1.5rem);
        font-weight: var(--font-bold, bold);
        color: #facc15;
        text-shadow: 0 0 10px rgba(250, 204, 21, 0.5);
    }

    /* Winner Section */
    :global(.winner-section) {
        border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    }

    .winner-box {
        text-align: center;
        padding: var(--space-3, 12px);
        background: rgba(15, 23, 42, 0.4);
        border-radius: var(--radius-md, 6px);
    }

    .winner-label {
        font-size: var(--text-lg, 1.125rem);
        font-weight: 700;
        color: #facc15;
        margin-bottom: 6px;
    }

    .winner-label.draw {
        color: #94a3b8;
        font-size: var(--text-sm, 0.875rem);
        letter-spacing: 0.1em;
        text-transform: uppercase;
    }

    .winner-name-inline {
        font-weight: var(--font-bold, bold);
        color: var(--text-primary, #f7fafc);
        max-width: var(--player-name-max-width);
        text-overflow: ellipsis;
        overflow: hidden;
        white-space: nowrap;
    }

    .winner-message {
        font-size: var(--text-base, 1rem);
        color: var(--text-secondary, #cbd5e1);
        margin-bottom: 8px;
    }

    .end-reason {
        font-size: var(--text-xs, 0.75rem);
        color: var(--color-gray-400, #9ca3af);
        background: rgba(15, 23, 42, 0.6);
        padding: 0.4rem 0.8rem;
        border-radius: 12px;
        border: 1px solid var(--border-light, #374151);
        display: inline-block;
        margin-top: 8px;
    }

    /* Rankings Section */
    :global(.rankings-section) {
        flex: 1;
        overflow-y: auto;
        overflow-x: hidden;
    }

    .ranking-box {
        display: flex;
        flex-direction: row;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        padding: 10px 8px 10px 12px;
        border-radius: var(--radius-md, 6px);
        background: rgba(15, 23, 42, 0.4);
        border: 1px solid transparent;
        transition: all 0.2s ease;
        min-width: 0;
    }

    .ranking-box:hover {
        background: rgba(30, 41, 59, 0.6);
        border-color: var(--border-accent, #60a5fa);
    }

    .ranking-box.winner {
        border-color: #facc15;
        background: rgba(251, 191, 36, 0.1);
        box-shadow: 0 0 10px rgba(251, 191, 36, 0.2);
    }

    .ranking-box.eliminated {
        opacity: 0.6;
    }

    .rank-badge {
        font-size: var(--text-base, 1rem);
        font-weight: 900;
        color: #facc15;
        min-width: 28px;
        text-align: center;
        flex-shrink: 0;
    }

    .ranking-player-info {
        display: flex;
        align-items: center;
        gap: 8px;
        flex: 1;
        min-width: 0;
    }

    .ranking-player-color {
        width: 24px;
        height: 24px;
        border-radius: 50%;
        border: 2px solid var(--border-medium, #374151);
        flex-shrink: 0;
    }

    .ranking-player-details {
        flex: 0 1 auto;
        min-width: 0;
    }

    .ranking-player-name {
        font-weight: var(--font-semibold, 600);
        color: var(--text-primary, #f7fafc);
        font-size: var(--text-sm, 0.875rem);
        text-overflow: ellipsis;
        overflow: hidden;
        white-space: nowrap;
        line-height: 1.2;
        max-width: var(--player-name-max-width);
    }

    .ranking-stats {
        display: flex;
        gap: 6px;
        flex-shrink: 0;
    }

    .ranking-stat {
        display: flex;
        align-items: center;
        gap: 2px;
        background: rgba(15, 23, 42, 0.6);
        padding: 0.35rem 0.5rem;
        border-radius: 4px;
        border: 1px solid var(--border-light, #374151);
    }

    .stat-value {
        font-weight: 600;
        color: var(--color-gray-200, #e5e7eb);
        font-size: var(--text-xs, 0.75rem);
    }

    .stat-symbol {
        color: var(--color-gray-400, #9ca3af);
        font-size: 0.7rem;
    }
</style>
