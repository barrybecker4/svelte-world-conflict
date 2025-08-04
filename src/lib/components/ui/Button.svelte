<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  const dispatch = createEventDispatcher();

  export let variant = 'primary'; // primary, secondary, danger, success, ghost
  export let size = 'md'; // sm, md, lg
  export let disabled = false;
  export let loading = false;
  export let type = 'button';
  export let title = '';
  export let uppercase = false;

  function handleClick(event) {
    if (!disabled && !loading) {
      dispatch('click', event);
    }
  }

  $: classes = [
    'btn-base',
    `btn-${variant}`,
    `btn-${size}`,
    uppercase && 'btn-uppercase',
    disabled && 'btn-disabled',
    loading && 'btn-loading'
  ].filter(Boolean).join(' ');
</script>

<button
  class={classes}
  {disabled}
  {type}
  {title}
  on:click={handleClick}
>
  {#if loading}
    <div class="btn-spinner"></div>
  {/if}
  <slot />
</button>

<style>
  .btn-base {
    border: none;
    border-radius: 6px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    font-family: inherit;
  }

  .btn-base:hover:not(.btn-disabled):not(.btn-loading) {
    transform: translateY(-1px);
  }

  .btn-base:disabled,
  .btn-disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none !important;
  }

  .btn-loading {
    cursor: wait;
  }

  /* Sizes */
  .btn-sm {
    padding: 6px 12px;
    font-size: 0.8rem;
  }

  .btn-md {
    padding: 12px 16px;
    font-size: 0.9rem;
  }

  .btn-lg {
    padding: 14px 20px;
    font-size: 1rem;
  }

  /* Variants */
  .btn-primary {
    background: linear-gradient(135deg, #2563eb, #1d4ed8);
    color: white;
    border: 2px solid #1e40af;
  }

  .btn-primary:hover:not(.btn-disabled):not(.btn-loading) {
    background: linear-gradient(135deg, #1d4ed8, #1e40af);
    box-shadow: 0 4px 12px rgba(37, 99, 235, 0.4);
  }

  .btn-secondary {
    background: linear-gradient(135deg, #6b7280, #4b5563);
    color: white;
    border: 2px solid #374151;
  }

  .btn-secondary:hover:not(.btn-disabled):not(.btn-loading) {
    background: linear-gradient(135deg, #4b5563, #374151);
  }

  .btn-danger {
    background: linear-gradient(135deg, #ef4444, #dc2626);
    color: white;
    border: 2px solid #b91c1c;
  }

  .btn-danger:hover:not(.btn-disabled):not(.btn-loading) {
    background: linear-gradient(135deg, #dc2626, #b91c1c);
    box-shadow: 0 4px 8px rgba(220, 38, 38, 0.4);
  }

  .btn-success {
    background: linear-gradient(135deg, #10b981, #059669);
    color: white;
    border: 2px solid #047857;
  }

  .btn-success:hover:not(.btn-disabled):not(.btn-loading) {
    background: linear-gradient(135deg, #059669, #047857);
    box-shadow: 0 4px 12px rgba(16, 185, 129, 0.4);
  }

  .btn-ghost {
    background: transparent;
    color: #94a3b8;
    border: 1px solid #475569;
  }

  .btn-ghost:hover:not(.btn-disabled):not(.btn-loading) {
    color: white;
    border-color: #60a5fa;
  }

  .btn-uppercase {
    text-transform: uppercase;
  }

  .btn-spinner {
    width: 14px;
    height: 14px;
    border: 2px solid transparent;
    border-top: 2px solid currentColor;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
</style>
