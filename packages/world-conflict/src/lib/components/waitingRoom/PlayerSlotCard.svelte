<script lang="ts">
    import type { WaitingRoomSlotInfo } from './WaitingRoomManager';

    export let slotIndex: number;
    export let slotInfo: WaitingRoomSlotInfo;
</script>

<div class="player-slot {slotInfo.type}" class:current-player={slotInfo.isCurrentPlayer}>
    <div class="slot-header">
        <span class="slot-label">Player {slotIndex + 1}</span>
        {#if slotInfo.isCurrentPlayer}
            <span class="current-indicator">You</span>
        {/if}
    </div>

    <div class="slot-content" style="border-left-color: {slotInfo.color};">
        <span class="player-name">{slotInfo.name}</span>
        {#if slotInfo.type === 'open'}
            <div class="waiting-dots">
                <span>.</span><span>.</span><span>.</span>
            </div>
        {/if}
    </div>
</div>

<style>
    .player-slot {
        background: rgba(30, 41, 59, 0.6);
        border: 1px solid #475569;
        border-radius: 8px;
        padding: 1rem;
        transition: all 0.3s;
    }

    .player-slot.current-player {
        border-color: #3b82f6;
        background: rgba(59, 130, 246, 0.1);
    }

    .slot-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 0.5rem;
    }

    .slot-label {
        font-size: 0.8rem;
        color: #94a3b8;
        font-weight: 600;
    }

    .current-indicator {
        background: #3b82f6;
        color: white;
        padding: 0.2rem 0.6rem;
        border-radius: 12px;
        font-size: 0.7rem;
        font-weight: 600;
    }

    .slot-content {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding-left: 0.75rem;
        border-left: 4px solid;
    }

    .player-name {
        font-weight: 600;
        font-size: 1rem;
    }

    .player-slot.disabled .player-name {
        opacity: 0.5;
        font-style: italic;
    }

    .player-slot.ai .player-name {
        opacity: 0.8;
        font-style: italic;
    }

    .waiting-dots {
        display: flex;
        gap: 0.2rem;
    }

    .waiting-dots span {
        animation: blink 1.5s ease-in-out infinite;
        font-size: 1.2rem;
        color: #10b981;
    }

    .waiting-dots span:nth-child(1) {
        animation-delay: 0s;
    }
    .waiting-dots span:nth-child(2) {
        animation-delay: 0.3s;
    }
    .waiting-dots span:nth-child(3) {
        animation-delay: 0.6s;
    }

    @keyframes blink {
        0%,
        70%,
        100% {
            opacity: 0.3;
        }
        35% {
            opacity: 1;
        }
    }
</style>
