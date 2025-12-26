<script lang="ts">
    import { onMount } from 'svelte';

    interface Props {
        x: number;
        y: number;
        text: string;
        color?: string;
        duration?: number;
    }

    let {
        x,
        y,
        text,
        color = '#ffffff',
        duration = 2500
    }: Props = $props();

    // Log after props are destructured
    console.log('FloatingTextMessage props:', { x, y, text, color, duration });

    let isVisible = $state(true);

    onMount(() => {

        // Auto-hide after duration (Svelte will handle DOM removal)
        const timer = setTimeout(() => {
            isVisible = false;
        }, duration);

        return () => {
            clearTimeout(timer);
        };
    });
</script>

<!-- Always render - no conditional to ensure it shows up -->
<div
    class="floating-text"
    style="left: {x}px; top: {y}px; color: {color};"
>
    {text}
</div>

<style>
    .floating-text {
        position: fixed;
        transform: translate(-50%, -50%);
        font-family: 'Arial', sans-serif;
        font-weight: bold;
        font-size: 24px;
        white-space: nowrap;
        pointer-events: none;
        z-index: 99999;
        text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.9), 0 0 8px rgba(0, 0, 0, 0.5);
        animation: floatUp 2.5s ease-out forwards;
        opacity: 1;
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

