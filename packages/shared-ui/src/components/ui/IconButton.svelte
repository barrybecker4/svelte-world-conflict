<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { HTMLButtonAttributes } from 'svelte/elements';

  interface Props extends HTMLButtonAttributes {
    disabled?: boolean;
    title?: string;
    size?: 'sm' | 'md' | 'lg';
    variant?: 'default' | 'primary' | 'danger';
    onclick?: (event: MouseEvent) => void;
    children?: Snippet;
  }

  let {
    disabled = false,
    title = '',
    size = 'md',
    variant = 'default',
    onclick,
    children,
    ...rest
  }: Props = $props();

  function handleClick(event: MouseEvent) {
    if (!disabled && onclick) {
      onclick(event);
    }
  }

  let classes = $derived([
    'icon-btn',
    `icon-btn-${size}`,
    `icon-btn-${variant}`,
    disabled && 'icon-btn-disabled'
  ].filter(Boolean).join(' '));
</script>

<button
  class={classes}
  {disabled}
  {title}
  onclick={handleClick}
  {...rest}
>
  {@render children?.()}
</button>

<style>
  .icon-btn {
    border: none;
    border-radius: 50%;
    cursor: pointer;
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: inherit;
  }

  .icon-btn:hover:not(.icon-btn-disabled) {
    transform: translateY(-1px);
  }

  .icon-btn-disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none !important;
  }

  /* Sizes */
  .icon-btn-sm {
    width: 32px;
    height: 32px;
    font-size: 1rem;
  }

  .icon-btn-md {
    width: 40px;
    height: 40px;
    font-size: 1.2rem;
  }

  .icon-btn-lg {
    width: 48px;
    height: 48px;
    font-size: 1.4rem;
  }

  /* Variants */
  .icon-btn-default {
    background: rgba(0, 0, 0, 0.3);
    color: white;
    border: 1px solid #4a5568;
  }

  .icon-btn-default:hover:not(.icon-btn-disabled) {
    background: rgba(96, 165, 250, 0.2);
    border-color: #60a5fa;
  }

  .icon-btn-primary {
    background: rgba(37, 99, 235, 0.3);
    color: white;
    border: 1px solid #2563eb;
  }

  .icon-btn-primary:hover:not(.icon-btn-disabled) {
    background: rgba(37, 99, 235, 0.5);
    border-color: #3b82f6;
  }

  .icon-btn-danger {
    background: rgba(239, 68, 68, 0.3);
    color: white;
    border: 1px solid #ef4444;
  }

  .icon-btn-danger:hover:not(.icon-btn-disabled) {
    background: rgba(239, 68, 68, 0.5);
    border-color: #f87171;
  }
</style>
