<script lang="ts">
    import { onMount } from 'svelte';
    import FloatingTextMessage from './FloatingTextMessage.svelte';

    interface Props {
        x?: number;
        y?: number;
        text?: string;
        color?: string;
        duration?: number;
    }

    let {
        x = 400,
        y = 300,
        text = '+5 Reinforcements',
        color = '#ffffff',
        duration = 10000 // Long duration for stories
    }: Props = $props();

    let wrapperElement: HTMLDivElement;
    // Initialize with default values - will be updated when element is ready
    let absoluteX = $state(400);
    let absoluteY = $state(300);

    function updatePosition() {
        if (wrapperElement) {
            const rect = wrapperElement.getBoundingClientRect();
            // Only update if we get valid coordinates
            if (rect.width > 0 && rect.height > 0) {
                absoluteX = rect.left + x;
                absoluteY = rect.top + y;
            } else {
                // Fallback: use window center if calculation fails
                absoluteX = window.innerWidth / 2;
                absoluteY = window.innerHeight / 2;
            }
        }
    }

    $effect(() => {
        // Update position when x or y changes or element becomes available
        if (wrapperElement) {
            updatePosition();
        }
    });

    onMount(() => {
        // Multiple attempts to ensure position is calculated correctly
        const update = () => {
            if (wrapperElement) {
                updatePosition();
            }
        };
        
        // Try immediately
        update();
        
        // Try after next frame
        requestAnimationFrame(() => {
            update();
            // Try again after another frame
            requestAnimationFrame(update);
        });
        
        // Try after delays for Storybook's rendering
        setTimeout(update, 50);
        setTimeout(update, 200);
        setTimeout(update, 500);
        setTimeout(update, 1000);
        
        // Use ResizeObserver to update when element size changes
        let observer: ResizeObserver | null = null;
        if (typeof ResizeObserver !== 'undefined' && wrapperElement) {
            observer = new ResizeObserver(() => {
                update();
            });
            observer.observe(wrapperElement);
        }
        
        return () => {
            if (observer) {
                observer.disconnect();
            }
        };
    });
</script>

<div class="wrapper" bind:this={wrapperElement}>
    <div class="info">
        <p>Floating text at position ({x}, {y})</p>
        <p>Text: "{text}"</p>
        <p>Color: {color}</p>
        <p>Absolute: ({Math.round(absoluteX)}, {Math.round(absoluteY)})</p>
    </div>
    <div class="marker" style="left: {x}px; top: {y}px;"></div>
    <!-- Always render - use fallback if position is invalid -->
    {#if true}
        {@const finalX = absoluteX > 0 ? absoluteX : 400}
        {@const finalY = absoluteY > 0 ? absoluteY : 300}
        <!-- Debug output -->
        <div style="position: absolute; bottom: 10px; left: 10px; color: white; font-size: 10px; z-index: 1000; background: rgba(0,0,0,0.7); padding: 5px;">
            Rendering FloatingTextMessage at ({finalX}, {finalY})<br/>
            Text: "{text}"<br/>
            Color: {color}
        </div>
        <FloatingTextMessage 
            x={finalX} 
            y={finalY} 
            {text} 
            {color} 
            {duration} 
        />
    {/if}
</div>

<style>
    .wrapper {
        position: relative;
        width: 100%;
        height: 600px;
        background: linear-gradient(135deg, #1e3c72 0%, #2a5298 100%);
        border-radius: 8px;
        overflow: hidden;
    }

    .info {
        position: absolute;
        top: 20px;
        left: 20px;
        color: white;
        background: rgba(0, 0, 0, 0.5);
        padding: 1rem;
        border-radius: 4px;
        z-index: 10;
        font-size: 14px;
    }

    .info p {
        margin: 0.25rem 0;
    }

    .marker {
        position: absolute;
        width: 4px;
        height: 4px;
        background: rgba(255, 255, 255, 0.8);
        border-radius: 50%;
        transform: translate(-50%, -50%);
        pointer-events: none;
    }
</style>

