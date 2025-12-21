<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import type { BattleAnimationState } from '$lib/client/stores/battleAnimationStore';
    import type { Planet } from '$lib/game/entities/gameTypes';
    import { removeBattleAnimation } from '$lib/client/stores/battleAnimationStore';
    import DiceDisplay from './DiceDisplay.svelte';
    import ShipCountDisplay from './ShipCountDisplay.svelte';

    export let animationState: BattleAnimationState;
    export let planet: Planet;

    function handleClose() {
        removeBattleAnimation(animationState.replay.id);
    }

    // Get info from replay
    $: replay = animationState.replay;
    $: attackerColor = replay.attackerColor;
    $: defenderColor = replay.defenderColor;
    $: attackerName = replay.attackerName;
    $: defenderName = replay.defenderName;

    // Dice display
    $: attackerDice = animationState.currentDiceRolls?.attacker ?? [];
    $: defenderDice = animationState.currentDiceRolls?.defender ?? [];

    // Position offset from planet center - handle edge cases
    const overlayWidth = 260;
    const overlayHeight = 130;
    
    // Adjust position so overlay stays on-screen
    $: rawOverlayX = planet.position.x - overlayWidth / 2;
    $: rawOverlayY = planet.position.y - overlayHeight - 30;
    
    // Clamp to stay within bounds (galaxy is 1200x800)
    $: overlayX = Math.max(10, Math.min(rawOverlayX, 1200 - overlayWidth - 10));
    $: overlayY = rawOverlayY < 10 ? planet.position.y + 50 : rawOverlayY;
    $: overlayBelow = rawOverlayY < 10;

    // Keep animations updating
    let animationFrame: number;
    let tick = 0;
    
    function updateTick() {
        tick++;
        animationFrame = requestAnimationFrame(updateTick);
    }
    
    onMount(() => {
        updateTick();
    });
    
    onDestroy(() => {
        if (animationFrame) {
            cancelAnimationFrame(animationFrame);
        }
    });

    // Determine outcome colors
    $: outcomeIsAttackerWin = replay.winnerId === replay.attackerPlayerId;
    
    // Casualties from last round result
    $: attackerCasualties = animationState.lastRoundResult?.attackerLost;
    $: defenderCasualties = animationState.lastRoundResult?.defenderLost;
</script>

<!-- Battle Animation Overlay -->
<g class="battle-overlay" transform="translate({overlayX}, {overlayY})">
    <!-- Background panel -->
    <rect
        x="0"
        y="0"
        width={overlayWidth}
        height={overlayHeight}
        rx="10"
        fill="rgba(5, 5, 15, 0.5)"
        stroke="#ef4444ee"
        stroke-width="1"
        class="panel-bg"
    />
    
    <!-- Battle header -->
    <text
        x={overlayWidth / 2}
        y="22"
        text-anchor="middle"
        fill="#ef4444"
        font-size="12"
        font-weight="bold"
        class="battle-title"
    >
        Battle at {replay.planetName}
    </text>

    <!-- Close button -->
    <g class="close-button" role="button" tabindex="0" on:click={handleClose} on:keydown={(e) => e.key === 'Enter' && handleClose()}>
        <circle cx={overlayWidth - 15} cy="15" r="10" fill="rgba(0, 0, 0, 0.5)" stroke="#ef4444" stroke-width="1" />
        <line x1={overlayWidth - 20} y1="10" x2={overlayWidth - 10} y2="20" stroke="#ef4444" stroke-width="2" />
        <line x1={overlayWidth - 10} y1="10" x2={overlayWidth - 20} y2="20" stroke="#ef4444" stroke-width="2" />
    </g>
    
    <!-- Attacker side (left) -->
    <g transform="translate(15, 38)">
        <text x="55" y="12" text-anchor="middle" fill={attackerColor} font-size="11" font-weight="bold">
            {attackerName}
        </text>
        
        <!-- Ship count and casualties -->
        <ShipCountDisplay 
            shipCount={animationState.displayedAttackerShips}
            casualties={attackerCasualties}
        />
        
        <!-- Dice display -->
        <DiceDisplay dice={attackerDice} color={attackerColor} offsetX={5} innerOffset={15} />
    </g>
    
    <!-- VS divider -->
    <line x1={overlayWidth / 2} y1="45" x2={overlayWidth / 2} y2="100" stroke="#374151" stroke-width="2" stroke-dasharray="6 3" />
    <text x={overlayWidth / 2} y="72" text-anchor="middle" fill="#6b7280" font-size="12" font-weight="bold">VS</text>
    
    <!-- Defender side (right) -->
    <g transform="translate({overlayWidth / 2 + 15}, 38)">
        <text x="55" y="12" text-anchor="middle" fill={defenderColor} font-size="11" font-weight="bold">
            {defenderName}
        </text>
        
        <!-- Ship count and casualties -->
        <ShipCountDisplay 
            shipCount={animationState.displayedDefenderShips}
            casualties={defenderCasualties}
        />
        
        <!-- Dice display -->
        <DiceDisplay dice={defenderDice} color={defenderColor} offsetX={20} innerOffset={0} />
    </g>
    
    <!-- Outcome message -->
    {#if animationState.outcomeMessage}
        <g class="outcome-message">
            <rect
                x="15"
                y={overlayHeight - 32}
                width={overlayWidth - 30}
                height="24"
                rx="6"
                fill={outcomeIsAttackerWin ? attackerColor : defenderColor}
                opacity=0.7
            />
            <text
                x={overlayWidth / 2}
                y={overlayHeight - 14}
                text-anchor="middle"
                fill="white"
                font-size="12"
                font-weight="bold"
            >
                {animationState.outcomeMessage}
            </text>
        </g>
    {/if}
</g>

<!-- Connecting line from overlay to planet -->
<line
    x1={planet.position.x}
    y1={overlayBelow ? overlayY : overlayY + overlayHeight}
    x2={planet.position.x}
    y2={overlayBelow ? planet.position.y + 25 : planet.position.y - 20}
    stroke="#ef4444"
    stroke-width="2"
    stroke-dasharray="6 3"
    opacity="0.7"
/>

<!-- Battle indicator on planet -->
<g transform="translate({planet.position.x}, {planet.position.y})">
    <circle r="35" fill="none" stroke="#ef4444" stroke-width="3" class="battle-ring" />
</g>

<style>
    .battle-overlay {
        pointer-events: all;
    }
    
    .close-button {
        cursor: pointer;
    }
    
    .close-button:hover circle {
        fill: rgba(0, 0, 0, 0.7);
    }
    
    .panel-bg {
        animation: pulse-border 1.8s ease-in-out infinite;
    }
    
    .battle-title {
        animation: flash-title 2.0s ease-in-out infinite alternate;
    }
    
    .outcome-message {
        animation: slide-up 0.5s ease-out;
    }
    
    .battle-ring {
        animation: battle-pulse 0.4s ease-in-out infinite;
    }
    
    @keyframes pulse-border {
        0%, 100% {
            stroke-opacity: 1;
        }
        50% {
            stroke-opacity: 0.4;
        }
    }
    
    @keyframes flash-title {
        0% {
            fill: #ef4444;
        }
        100% {
            fill: #fca5a5;
        }
    }
    
    @keyframes slide-up {
        0% {
            transform: translateY(15px);
            opacity: 0;
        }
        100% {
            transform: translateY(0);
            opacity: 1;
        }
    }
    
    @keyframes battle-pulse {
        0%, 100% {
            stroke-opacity: 1;
            r: 35;
        }
        50% {
            stroke-opacity: 0.3;
            r: 40;
        }
    }
</style>

