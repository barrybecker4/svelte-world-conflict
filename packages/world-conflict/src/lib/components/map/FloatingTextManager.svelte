<script lang="ts">
    import { FloatingTextMessage } from 'shared-ui';
    import type { Region } from '$lib/game/entities/gameTypes';

    export let mapContainer: HTMLElement | null = null;
    export let regions: Region[] = [];

    interface FloatingText {
        id: string;
        x: number;
        y: number;
        text: string;
        color: string;
    }

    let floatingTexts: FloatingText[] = [];
    let nextId = 0;

    function getScreenCoords(region: Region): { x: number; y: number } {
        if (!mapContainer) return { x: 0, y: 0 };
        
        const svgElement = mapContainer.querySelector('svg');
        if (!svgElement) return { x: 0, y: 0 };
        
        const svgRect = svgElement.getBoundingClientRect();
        const svgViewBox = svgElement.viewBox.baseVal;
        const scaleX = svgRect.width / svgViewBox.width;
        const scaleY = svgRect.height / svgViewBox.height;
        
        return {
            x: svgRect.left + region.x * scaleX,
            y: svgRect.top + region.y * scaleY,
        };
    }

    export function showFloatingText(regionIdx: number, text: string, color: string): void {
        const region = regions.find(r => r.index === regionIdx);
        if (!region) return;
        
        const coords = getScreenCoords(region);
        const id = `floating-text-${nextId++}`;
        
        floatingTexts = [...floatingTexts, {
            id,
            x: coords.x,
            y: coords.y,
            text,
            color,
        }];
        
        // Remove after animation completes (3 seconds)
        setTimeout(() => {
            floatingTexts = floatingTexts.filter(ft => ft.id !== id);
        }, 3000);
    }
</script>

<!-- Floating Text Messages (outside SVG for fixed positioning) -->
{#each floatingTexts as floatingText (floatingText.id)}
    <FloatingTextMessage
        x={floatingText.x}
        y={floatingText.y}
        text={floatingText.text}
        color={floatingText.color}
    />
{/each}

