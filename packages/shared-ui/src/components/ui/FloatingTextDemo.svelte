<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import FloatingTextMessage from './FloatingTextMessage.svelte';

    interface Props {
        messages?: Array<{
            x: number;
            y: number;
            text: string;
            color: string;
            delay?: number;
        }>;
    }

    interface ActiveMessage {
        id: string;
        x: number;
        y: number;
        text: string;
        color: string;
    }

    let {
        messages = []
    }: Props = $props();

    let containerElement: HTMLDivElement;
    let activeMessages = $state<ActiveMessage[]>([]);
    let timeouts: ReturnType<typeof setTimeout>[] = [];
    let messageIdCounter = $state(0);
    let clickCount = $state(0);

    const messageTemplates = [
        { text: '+10 Reinforcements', color: '#4a90e2' },
        { text: 'Conquered!', color: '#ffee11' },
        { text: 'Defended!', color: '#00ff00' },
        { text: 'Player Eliminated!', color: '#ff6b6b' },
        { text: 'Retreat!', color: '#ff6b6b' },
        { text: 'Victory!', color: '#00ff88' },
        { text: 'Critical Hit!', color: '#ff4444' },
        { text: '+25 Resources', color: '#44ff44' },
    ];

    function addMessage(x: number, y: number, text: string, color: string) {
        const id = `msg-${messageIdCounter++}`;
        activeMessages = [...activeMessages, {
            id,
            x,
            y,
            text,
            color,
        }];
        // Force reactivity update
        activeMessages = activeMessages;
    }

    function handleInteraction(event: MouseEvent | KeyboardEvent) {
        if (event instanceof KeyboardEvent && event.key !== 'Enter' && event.key !== ' ') {
            return;
        }
        
        event.preventDefault();
        event.stopPropagation();
        
        let x: number, y: number;
        if (event instanceof MouseEvent) {
            x = event.clientX;
            y = event.clientY;
        } else {
            // For keyboard events, use center of grid area
            const gridArea = containerElement?.querySelector('.demo-grid') as HTMLElement;
            if (gridArea) {
                const rect = gridArea.getBoundingClientRect();
                x = rect.left + rect.width / 2;
                y = rect.top + rect.height / 2;
            } else {
                return;
            }
        }
        
        clickCount++;
        const template = messageTemplates[Math.floor(Math.random() * messageTemplates.length)];
        addMessage(x, y, template.text, template.color);
    }

    onMount(() => {
        // Show initial messages with their delays if provided
        if (messages.length > 0) {
            messages.forEach((message, index) => {
                const timeout = setTimeout(() => {
                    if (containerElement) {
                        const rect = containerElement.getBoundingClientRect();
                        addMessage(
                            rect.left + message.x,
                            rect.top + message.y,
                            message.text,
                            message.color
                        );
                    }
                }, message.delay || 0);
                timeouts.push(timeout);
            });
        } else {
            // Add a test message on mount to verify the component works
            setTimeout(() => {
                if (containerElement) {
                    const rect = containerElement.getBoundingClientRect();
                    const gridArea = containerElement.querySelector('.demo-grid') as HTMLElement;
                    if (gridArea) {
                        const gridRect = gridArea.getBoundingClientRect();
                        addMessage(
                            gridRect.left + gridRect.width / 2,
                            gridRect.top + gridRect.height / 2,
                            'Click to create messages!',
                            '#ffffff'
                        );
                    }
                }
            }, 500);
        }
    });

    onDestroy(() => {
        timeouts.forEach(timeout => clearTimeout(timeout));
    });
</script>

<div class="demo-container" bind:this={containerElement}>
    <div class="demo-content">
        <h3>Floating Text Messages Demo</h3>
        <p><strong>Click anywhere in the grid area below</strong> to trigger floating text messages!</p>
        <p>Messages will automatically fade out after 2.5 seconds.</p>
        
        <div 
            class="demo-grid" 
            role="button" 
            tabindex="0"
            onclick={handleInteraction}
            onkeydown={handleInteraction}
            aria-label="Click or press Enter to create floating text messages"
        >
            <div class="grid-overlay">
                <div class="click-hint">Click here to create floating text messages (Clicks: {clickCount})</div>
            </div>
        </div>
    </div>
    
    <!-- Floating messages rendered outside container for fixed positioning -->
    {#each activeMessages as message (message.id)}
        <FloatingTextMessage
            x={message.x}
            y={message.y}
            text={message.text}
            color={message.color}
            duration={5000}
        />
    {/each}
    
    <!-- Debug: Show message count -->
    <div class="debug-info" style="position: fixed; top: 10px; right: 10px; background: rgba(0,0,0,0.8); color: white; padding: 10px; z-index: 100000; font-size: 12px;">
        Messages: {activeMessages.length}<br/>
        Clicks: {clickCount}
    </div>
</div>

<style>
    .demo-container {
        position: relative;
        width: 100%;
        min-height: 600px;
        background: linear-gradient(135deg, #1e3c72 0%, #2a5298 100%);
        border-radius: 8px;
        padding: 2rem;
        overflow: hidden;
    }

    .demo-content {
        position: relative;
        z-index: 1;
        color: white;
    }

    .demo-content h3 {
        margin-top: 0;
        margin-bottom: 1rem;
    }

    .demo-content p {
        margin: 0.5rem 0;
    }

    .demo-grid {
        position: relative;
        width: 100%;
        height: 500px;
        margin-top: 2rem;
        border: 2px dashed rgba(255, 255, 255, 0.3);
        border-radius: 4px;
    }

    .grid-overlay {
        position: absolute;
        width: 100%;
        height: 100%;
    }

    .click-hint {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        color: rgba(255, 255, 255, 0.7);
        font-size: 18px;
        font-weight: 500;
        pointer-events: none;
        text-align: center;
        padding: 1rem;
        background: rgba(0, 0, 0, 0.3);
        border-radius: 8px;
        border: 2px dashed rgba(255, 255, 255, 0.4);
    }

    .demo-grid {
        cursor: crosshair;
    }
</style>

