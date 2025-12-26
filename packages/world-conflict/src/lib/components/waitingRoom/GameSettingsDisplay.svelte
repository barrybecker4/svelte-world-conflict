<script lang="ts">
    import { GAME_CONSTANTS } from '$lib/game/constants/gameConstants';
    import { AiDifficulty } from '$lib/game/entities/aiPersonalities';
    import type { PendingGameData } from '$lib/game/entities/gameTypes';

    export let game: PendingGameData;

    function formatTimeLimit(timeLimit: number): string {
        if (timeLimit === GAME_CONSTANTS.UNLIMITED_TIME) {
            return 'Unlimited';
        }
        return `${timeLimit}s`;
    }

    function formatTurnLimit(maxTurns: number | undefined): string {
        if (!maxTurns || maxTurns === GAME_CONSTANTS.UNLIMITED_TURNS) {
            return 'Endless';
        }
        return `${maxTurns} turns`;
    }
</script>

<div class="game-settings-section">
    <h3>Game Settings</h3>
    <div class="settings-grid">
        <div class="setting-item">
            <span class="setting-label">Map Size:</span>
            <span class="setting-value">{game.pendingConfiguration?.settings?.mapSize || 'Medium'}</span>
        </div>
        <div class="setting-item">
            <span class="setting-label">AI Difficulty:</span>
            <span class="setting-value">{game.pendingConfiguration?.settings?.aiDifficulty || AiDifficulty.RUDE}</span>
        </div>
        <div class="setting-item">
            <span class="setting-label">Turn Limit:</span>
            <span class="setting-value">{formatTurnLimit(game.pendingConfiguration?.settings?.maxTurns)}</span>
        </div>
        <div class="setting-item">
            <span class="setting-label">Time Limit:</span>
            <span class="setting-value"
                >{formatTimeLimit(
                    game.pendingConfiguration?.settings?.timeLimit ?? GAME_CONSTANTS.STANDARD_HUMAN_TIME_LIMIT
                )}</span
            >
        </div>
    </div>
</div>

<style>
    .game-settings-section {
        margin-bottom: 2rem;
        padding: 1rem;
        background: rgba(30, 41, 59, 0.4);
        border-radius: 8px;
    }

    .game-settings-section h3 {
        margin: 0 0 1rem 0;
        color: #f1f5f9;
        font-size: 1.1rem;
    }

    .settings-grid {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 0.75rem;
    }

    .setting-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
    }

    .setting-label {
        color: #94a3b8;
        font-size: 0.9rem;
    }

    .setting-value {
        color: #f1f5f9;
        font-weight: 600;
        font-size: 0.9rem;
    }

    @media (max-width: 640px) {
        .settings-grid {
            grid-template-columns: 1fr;
        }
    }
</style>
