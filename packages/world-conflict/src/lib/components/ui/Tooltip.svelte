<script lang="ts">
  import { onMount } from 'svelte';
  
  export let id: string;
  export let x: number; // percentage (0-100)
  export let y: number; // percentage (0-100)
  export let text: string;
  export let width: number = 7; // percentage
  export let onDismiss: (id: string) => void;
  
  let visible = false;
  
  onMount(() => {
    // Fade in after mount
    setTimeout(() => {
      visible = true;
    }, 10);
  });
  
  function handleClick() {
    onDismiss(id);
  }
  
  // Calculate position
  $: left = x - (width + 1) * 0.5;
  $: bottom = 100 - y;
</script>

<div 
  class="tooltip"
  class:visible
  style="bottom: {bottom}%; left: {left}%; width: {width}%"
  on:click={handleClick}
  on:keydown={(e) => e.key === 'Enter' && handleClick()}
  role="button"
  tabindex="0"
  title="Click to dismiss"
>
  {text}
</div>

<style>
  .tooltip {
    position: absolute;
    background: rgba(0, 0, 0, 0.4);
    color: #f8fafc;
    padding: 0.75rem 1rem;
    border-radius: 8px;
    border: 2px solid #60a5fa;
    font-size: 0.875rem;
    line-height: 1.4;
    z-index: 100;
    pointer-events: auto;
    opacity: 0;
    transition: opacity 0.3s ease-in, transform 0.2s ease;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
    text-align: center;
    cursor: pointer;
  }
  
  .tooltip.visible {
    opacity: 1;
  }
  
  .tooltip:hover {
    transform: scale(1.05);
    border-color: #93c5fd;
  }
  
  .tooltip:active {
    transform: scale(0.95);
  }
  
  /* Arrow pointing down to the target */
  .tooltip::after {
    content: '';
    position: absolute;
    top: 100%;
    left: 50%;
    transform: translateX(-50%);
    width: 0;
    height: 0;
    border-left: 8px solid transparent;
    border-right: 8px solid transparent;
    border-top: 8px solid #60a5fa;
  }
</style>

