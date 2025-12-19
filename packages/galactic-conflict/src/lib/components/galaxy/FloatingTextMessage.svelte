<script lang="ts">
    import { onMount } from 'svelte';

    export let x: number;
    export let y: number;
    export let text: string;
    export let color: string = '#ffffff';
    export let duration: number = 2500;

    let element: HTMLElement;
    let isVisible = true;

    onMount(() => {
        // Auto-remove after duration
        const timer = setTimeout(() => {
            isVisible = false;
            // Wait for fade animation to complete
            setTimeout(() => {
                if (element && element.parentNode) {
                    element.parentNode.removeChild(element);
                }
            }, 500);
        }, duration);

        return () => {
            clearTimeout(timer);
        };
    });
</script>

{#if isVisible}
    <div
        bind:this={element}
        class="floating-text"
        style="left: {x}px; top: {y}px; color: {color};"
    >
        {text}
    </div>
{/if}

<style>
    .floating-text {
        position: fixed;
        transform: translate(-50%, -50%);
        font-family: 'Arial', sans-serif;
        font-weight: bold;
        font-size: 18px;
        white-space: nowrap;
        pointer-events: none;
        z-index: 1000;
        text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.9);
        animation: floatUp 2.5s ease-out forwards;
    }

    @keyframes floatUp {
        0% {
            opacity: 1;
            transform: translate(-50%, -50%) scale(1);
        }
        50% {
            opacity: 1;
            transform: translate(-50%, -80%) scale(1.2);
        }
        100% {
            opacity: 0;
            transform: translate(-50%, -120%) scale(0.8);
        }
    }
</style>

