<script lang="ts">
    export let dice: number[] = [];
    export let color: string;
    export let offsetX: number = 0;
    export let innerOffset: number = 0; // Additional offset for first die

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
</script>

{#if dice.length > 0}
    <g transform="translate({offsetX}, 50)">
        {#each dice as die, i}
            <g transform="translate({i * 28 + innerOffset}, 0)" class="die">
                <rect
                    x="0" y="0"
                    width="24" height="24"
                    rx="4"
                    fill={color}
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

<style>
    .die {
        animation: roll-in 0.3s ease-out;
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
</style>
