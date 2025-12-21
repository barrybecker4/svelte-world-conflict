<script lang="ts">
    import { onMount } from 'svelte';
    import type {
        GalacticGameStateData,
        Planet,
        ReinforcementEvent,
        ConquestEvent,
        PlayerEliminationEvent
    } from '$lib/game/entities/gameTypes';
    import FloatingTextMessage from './FloatingTextMessage.svelte';
    import { filterUnprocessedEvents, hasConquestEventAtPlanet } from '$lib/client/utils/eventProcessing';

    export let gameState: GalacticGameStateData;
    export let svgElement: SVGSVGElement | null;
    export let battleAnimations: Map<string, any>;
    export let pendingEliminationTexts: Map<number, PlayerEliminationEvent>;

    interface FloatingText {
        id: string;
        x: number;
        y: number;
        text: string;
        color: string;
    }

    let floatingTexts: FloatingText[] = [];
    const processedEventIds = new Set<string>();

    function getScreenCoords(planet: Planet): { x: number; y: number } {
        if (!svgElement) return { x: 0, y: 0 };
        
        const svgRect = svgElement.getBoundingClientRect();
        const viewBox = svgElement.viewBox.baseVal;
        const scaleX = svgRect.width / viewBox.width;
        const scaleY = svgRect.height / viewBox.height;
        
        return {
            x: svgRect.left + (planet.position.x * scaleX),
            y: svgRect.top + (planet.position.y * scaleY),
        };
    }

    function showFloatingText(event: ReinforcementEvent | ConquestEvent, text: string, color: string): void {
        const planet = gameState.planets.find(p => p.id === event.planetId);
        if (!planet) return;
        
        const coords = getScreenCoords(planet);
        floatingTexts = [...floatingTexts, {
            id: event.id,
            x: coords.x,
            y: coords.y,
            text,
            color,
        }];
        
        // Remove after animation completes
        setTimeout(() => {
            floatingTexts = floatingTexts.filter(ft => ft.id !== event.id);
        }, 3000);
    }
    
    export function showEliminationText(event: PlayerEliminationEvent, planet: Planet): void {
        const coords = getScreenCoords(planet);
        floatingTexts = [...floatingTexts, {
            id: event.id,
            x: coords.x,
            y: coords.y - 30, // Offset slightly above planet
            text: `${event.playerName} has been eliminated!`,
            color: event.playerColor,
        }];
        
        // Remove after animation completes
        setTimeout(() => {
            floatingTexts = floatingTexts.filter(ft => ft.id !== event.id);
        }, 3000);
    }

    // Process reinforcement events
    $: {
        const reinforcementEvents = gameState.recentReinforcementEvents ?? [];
        for (const event of reinforcementEvents) {
            if (!processedEventIds.has(event.id)) {
                processedEventIds.add(event.id);
                showFloatingText(
                    event,
                    `+${event.ships} Reinforcements`,
                    event.playerColor
                );
            }
        }
    }

    // Process conquest events
    $: {
        const conquestEvents = gameState.recentConquestEvents ?? [];
        for (const event of conquestEvents) {
            if (!processedEventIds.has(event.id)) {
                processedEventIds.add(event.id);
                showFloatingText(
                    event,
                    'Conquered!',
                    event.attackerColor
                );
                
                // Check if there's an elimination event for this planet (no battle case)
                const eliminationEvent = gameState.recentPlayerEliminationEvents?.find(
                    e => e.planetId === event.planetId
                );
                if (eliminationEvent && !processedEventIds.has(eliminationEvent.id)) {
                    processedEventIds.add(eliminationEvent.id);
                    const planet = gameState.planets.find(p => p.id === event.planetId);
                    if (planet) {
                        setTimeout(() => {
                            showEliminationText(eliminationEvent, planet);
                        }, 1500);
                    }
                }
            }
        }
    }

    // Process elimination events (for battles - will be shown after battle dialog closes)
    $: {
        const eliminationEvents = gameState.recentPlayerEliminationEvents ?? [];
        for (const event of eliminationEvents) {
            if (!processedEventIds.has(event.id)) {
                const hasActiveBattle = [...battleAnimations.values()].some(
                    a => a.replay.planetId === event.planetId
                );
                const hasBattleReplay = gameState.recentBattleReplays?.some(
                    r => r.planetId === event.planetId
                );
                
                if (hasActiveBattle || hasBattleReplay) {
                    // Battle exists - queue for after battle
                    pendingEliminationTexts.set(event.planetId, event);
                    processedEventIds.add(event.id);
                } else {
                    // No battle - check if there's a conquest event
                    const hasConquestEvent = hasConquestEventAtPlanet(
                        gameState.recentConquestEvents,
                        event.planetId
                    );
                    if (!hasConquestEvent) {
                        processedEventIds.add(event.id);
                        const planet = gameState.planets.find(p => p.id === event.planetId);
                        if (planet) {
                            showEliminationText(event, planet);
                        }
                    }
                }
            }
        }
    }

    // Watch for battle animations closing - show elimination text if pending
    $: {
        const activeAnimations = [...battleAnimations.values()];
        const activePlanetIds = new Set(activeAnimations.map(a => a.replay.planetId));
        
        for (const [planetId, event] of pendingEliminationTexts.entries()) {
            if (!activePlanetIds.has(planetId)) {
                const planet = gameState.planets.find(p => p.id === planetId);
                if (planet) {
                    showEliminationText(event, planet);
                    pendingEliminationTexts.delete(planetId);
                }
            }
        }
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

