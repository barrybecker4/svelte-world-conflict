<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    variant?: 'default' | 'dark' | 'glass' | 'error' | 'success';
    size?: 'sm' | 'md' | 'lg';
    padding?: boolean;
    border?: boolean;
    blur?: boolean;
    customClass?: string;
    children?: Snippet;
  }

  let {
    variant = 'default',
    size = 'md',
    padding = true,
    border = true,
    blur = false,
    customClass = '',
    children
  }: Props = $props();

  let classes = $derived([
    'panel-base',
    `panel-${variant}`,
    `panel-${size}`,
    !padding && 'panel-no-padding',
    !border && 'panel-no-border',
    blur && 'panel-blur',
    customClass
  ].filter(Boolean).join(' '));
</script>

<div class={classes}>
  {@render children?.()}
</div>

<style>
  /* Base Panel Styles */
  .panel-base {
    border-radius: 8px;
    transition: all 0.2s ease;
  }

  /* Padding variants */
  .panel-sm {
    padding: 0.75rem;
  }

  .panel-md {
    padding: 1rem;
  }

  .panel-lg {
    padding: 1.5rem;
  }

  .panel-no-padding {
    padding: 0;
  }

  /* Visual variants */
  .panel-default {
    background: rgba(30, 41, 59, 0.6);
    border: 1px solid #475569;
  }

  .panel-dark {
    background: rgba(15, 23, 42, 0.8);
    border: 2px solid #475569;
  }

  .panel-glass {
    background: rgba(31, 41, 55, 0.9);
    border: 1px solid #374151;
    backdrop-filter: blur(4px);
  }

  .panel-error {
    background: rgba(239, 68, 68, 0.2);
    border: 1px solid #ef4444;
  }

  .panel-success {
    background: rgba(34, 197, 94, 0.2);
    border: 1px solid #22c55e;
  }

  .panel-no-border {
    border: none;
  }

  .panel-blur {
    backdrop-filter: blur(10px);
  }

  /* Hover effects for interactive panels */
  .panel-base:hover {
    border-color: #60a5fa;
  }

  /* Large panel specific styles */
  .panel-lg.panel-dark {
    border-radius: 12px;
    min-height: 300px;
    max-height: 400px;
    overflow-y: auto;
  }
</style>
