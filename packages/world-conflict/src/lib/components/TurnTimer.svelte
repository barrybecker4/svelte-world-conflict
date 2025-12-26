<script lang="ts">
    import { turnTimerStore } from '$lib/client/stores/turnTimerStore';
    import { GAME_CONSTANTS } from '$lib/game/constants/gameConstants';

    $: timeRemaining = $turnTimerStore.timeRemaining;
    $: isRunning = $turnTimerStore.isRunning;
    $: shouldGlow = $turnTimerStore.shouldGlow;
    $: isWarning = timeRemaining <= GAME_CONSTANTS.TIMER_WARNING_SECONDS && timeRemaining > 0;
</script>

{#if isRunning}
    <div class="turn-timer">
        <span class="timer-text">Make your move in </span>
        <span class="timer-value" class:glow={shouldGlow} class:warning={isWarning}>
            {timeRemaining}
        </span>
        <span class="timer-text"> seconds</span>
    </div>
{:else}
    <!-- Debug: Show when timer should be visible but isn't -->
    <!-- <div style="color: red; padding: 10px;">Timer not running: {JSON.stringify($turnTimerStore)}</div> -->
{/if}

<style>
    .turn-timer {
        text-align: center;
        padding: var(--space-3, 12px);
        margin: 0 var(--space-4, 16px);
        background: rgba(15, 23, 42, 0.4);
        border-radius: var(--radius-md, 6px);
        font-size: var(--text-sm, 0.9rem);
        color: var(--text-secondary, #cbd5e1);
        border-top: 1px solid rgba(255, 255, 255, 0.1);
        border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    }

    .timer-text {
        color: var(--text-secondary, #cbd5e1);
    }

    .timer-value {
        font-size: 1.5rem;
        font-weight: bold;
        color: var(--text-primary, #f7fafc);
        display: inline-block;
        min-width: 2.5rem;
        text-align: center;
        transition: text-shadow 0.3s ease-out;
    }

    .timer-value.warning {
        color: #ffee11;
    }

    .timer-value.glow {
        animation: glow-pulse 0.3s ease-out;
    }

    @keyframes glow-pulse {
        0%,
        100% {
            text-shadow: none;
        }
        50% {
            text-shadow:
                0 0 8px #ffee11,
                0 0 12px #ffee11;
        }
    }
</style>
