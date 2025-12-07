<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import type { BattleAnimationState } from '$lib/client/stores/battleAnimationStore';
    import type { Planet } from '$lib/game/entities/gameTypes';

    export let animationState: BattleAnimationState;
    export let planet: Planet;

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
    const overlayHeight = 180;
    
    // Adjust position so overlay stays on-screen
    $: rawOverlayX = planet.position.x - overlayWidth / 2;
    $: rawOverlayY = planet.position.y - overlayHeight - 40;
    
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

    // Helper to get dice face symbol (using dots pattern)
    function getDiceDots(value: number): { cx: number; cy: number }[] {
        const dots: { cx: number; cy: number }[][] = [
            [], // 0 (unused)
            [{ cx: 10, cy: 10 }], // 1
            [{ cx: 5, cy: 5 }, { cx: 15, cy: 15 }], // 2
            [{ cx: 5, cy: 5 }, { cx: 10, cy: 10 }, { cx: 15, cy: 15 }], // 3
            [{ cx: 5, cy: 5 }, { cx: 15, cy: 5 }, { cx: 5, cy: 15 }, { cx: 15, cy: 15 }], // 4
            [{ cx: 5, cy: 5 }, { cx: 15, cy: 5 }, { cx: 10, cy: 10 }, { cx: 5, cy: 15 }, { cx: 15, cy: 15 }], // 5
            [{ cx: 5, cy: 4 }, { cx: 15, cy: 4 }, { cx: 5, cy: 10 }, { cx: 15, cy: 10 }, { cx: 5, cy: 16 }, { cx: 15, cy: 16 }], // 6
        ];
        return dots[value] || [];
    }

    // Determine outcome colors
    $: outcomeIsAttackerWin = replay.winnerId === replay.attackerPlayerId;
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
        fill="rgba(5, 5, 15, 0.97)"
        stroke="#ef4444"
        stroke-width="3"
        class="panel-bg"
    />
    
    <!-- Battle header -->
    <text
        x={overlayWidth / 2}
        y="22"
        text-anchor="middle"
        fill="#ef4444"
        font-size="14"
        font-weight="bold"
        class="battle-title"
    >
        ⚔️ BATTLE AT {replay.planetName.toUpperCase()} ⚔️
    </text>

    <!-- Round indicator -->
    {#if animationState.phase === 'round'}
        <text
            x={overlayWidth / 2}
            y="38"
            text-anchor="middle"
            fill="#9ca3af"
            font-size="10"
        >
            Round {animationState.currentRoundIndex + 1} of {replay.rounds.length}
        </text>
    {/if}
    
    <!-- Attacker side (left) -->
    <g transform="translate(15, 48)">
        <text x="55" y="12" text-anchor="middle" fill={attackerColor} font-size="11" font-weight="bold">
            {attackerName}
        </text>
        
        <!-- Ship icon and count -->
        <g transform="translate(40, 18)">
            <polygon
                points="15,0 30,22 0,22"
                fill={attackerColor}
                class="ship-icon"
            />
            <text x="15" y="45" text-anchor="middle" fill="white" font-size="20" font-weight="bold" class="ship-count">
                {animationState.displayedAttackerShips}
            </text>
        </g>
        
        <!-- Dice display -->
        {#if attackerDice.length > 0}
            <g transform="translate(5, 72)">
                {#each attackerDice as die, i}
                    <g transform="translate({i * 28 + 15}, 0)" class="die">
                        <rect
                            x="0" y="0"
                            width="24" height="24"
                            rx="4"
                            fill={attackerColor}
                            stroke="white"
                            stroke-width="1.5"
                        />
                        {#each getDiceDots(die) as dot}
                            <circle cx={dot.cx + 2} cy={dot.cy + 2} r="2.5" fill="white" />
                        {/each}
                    </g>
                {/each}
            </g>
        {/if}
        
        <!-- Casualties -->
        {#if animationState.lastRoundResult && animationState.lastRoundResult.attackerLost > 0}
            <text x="55" y="115" text-anchor="middle" fill="#ef4444" font-size="14" font-weight="bold" class="casualty-text">
                -{animationState.lastRoundResult.attackerLost} 💥
            </text>
        {/if}
    </g>
    
    <!-- VS divider -->
    <line x1={overlayWidth / 2} y1="55" x2={overlayWidth / 2} y2="150" stroke="#374151" stroke-width="2" stroke-dasharray="6 3" />
    <text x={overlayWidth / 2} y="105" text-anchor="middle" fill="#6b7280" font-size="12" font-weight="bold">VS</text>
    
    <!-- Defender side (right) -->
    <g transform="translate({overlayWidth / 2 + 15}, 48)">
        <text x="55" y="12" text-anchor="middle" fill={defenderColor} font-size="11" font-weight="bold">
            {defenderName}
        </text>
        
        <!-- Ship icon and count -->
        <g transform="translate(40, 18)">
            <polygon
                points="15,0 30,22 0,22"
                fill={defenderColor}
                class="ship-icon"
            />
            <text x="15" y="45" text-anchor="middle" fill="white" font-size="20" font-weight="bold" class="ship-count">
                {animationState.displayedDefenderShips}
            </text>
        </g>
        
        <!-- Dice display -->
        {#if defenderDice.length > 0}
            <g transform="translate(20, 72)">
                {#each defenderDice as die, i}
                    <g transform="translate({i * 28}, 0)" class="die">
                        <rect
                            x="0" y="0"
                            width="24" height="24"
                            rx="4"
                            fill={defenderColor}
                            stroke="white"
                            stroke-width="1.5"
                        />
                        {#each getDiceDots(die) as dot}
                            <circle cx={dot.cx + 2} cy={dot.cy + 2} r="2.5" fill="white" />
                        {/each}
                    </g>
                {/each}
            </g>
        {/if}
        
        <!-- Casualties -->
        {#if animationState.lastRoundResult && animationState.lastRoundResult.defenderLost > 0}
            <text x="55" y="115" text-anchor="middle" fill="#ef4444" font-size="14" font-weight="bold" class="casualty-text">
                -{animationState.lastRoundResult.defenderLost} 💥
            </text>
        {/if}
    </g>
    
    <!-- Outcome message -->
    {#if animationState.outcomeMessage}
        <g class="outcome-message">
            <rect
                x="15"
                y={overlayHeight - 35}
                width={overlayWidth - 30}
                height="26"
                rx="6"
                fill={outcomeIsAttackerWin ? attackerColor : defenderColor}
            />
            <text
                x={overlayWidth / 2}
                y={overlayHeight - 16}
                text-anchor="middle"
                fill="white"
                font-size="13"
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
        pointer-events: none;
    }
    
    .panel-bg {
        animation: pulse-border 0.8s ease-in-out infinite;
    }
    
    .battle-title {
        animation: flash-title 0.6s ease-in-out infinite alternate;
    }
    
    .die {
        animation: roll-in 0.3s ease-out;
    }
    
    .ship-icon {
        filter: drop-shadow(0 2px 4px rgba(0,0,0,0.5));
    }
    
    .ship-count {
        text-shadow: 0 2px 4px rgba(0, 0, 0, 0.8);
    }
    
    .casualty-text {
        animation: shake-casualty 0.4s ease-out;
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
    
    @keyframes roll-in {
        0% {
            transform: scale(0) rotate(-180deg);
            opacity: 0;
        }
        100% {
            transform: scale(1) rotate(0deg);
            opacity: 1;
        }
    }
    
    @keyframes shake-casualty {
        0%, 100% {
            transform: translateX(0);
        }
        15% {
            transform: translateX(-4px);
        }
        30% {
            transform: translateX(4px);
        }
        45% {
            transform: translateX(-3px);
        }
        60% {
            transform: translateX(3px);
        }
        75% {
            transform: translateX(-2px);
        }
        90% {
            transform: translateX(2px);
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
