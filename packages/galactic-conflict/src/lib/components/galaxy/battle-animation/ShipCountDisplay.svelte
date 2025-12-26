<script lang="ts">
    export let shipCount: number;
    export let casualties: number | undefined;
</script>

<g>
    <text x="50" y="35" text-anchor="middle" fill="white" font-size="20" font-weight="bold" class="ship-count">
        {shipCount}
    </text>
    
    <!-- Casualties to the right of ship count -->
    {#if casualties !== undefined && casualties > 0}
        <text x="64" y="35" text-anchor="start" fill="#ef4444" font-size="14" font-weight="bold" class="casualty-text">
            -{casualties} 💥
        </text>
    {/if}
</g>

<style>
    .ship-count {
        text-shadow: 0 2px 4px rgba(0, 0, 0, 0.8);
    }
    
    .casualty-text {
        animation: shake-casualty 0.4s ease-out;
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
</style>
