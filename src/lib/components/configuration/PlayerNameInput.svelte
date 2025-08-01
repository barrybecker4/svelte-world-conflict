<script>
  import { createEventDispatcher } from 'svelte';
  import Button from '$lib/components/ui/Button.svelte';

  export let initialName = '';
  export let error = '';
  export let loading = false;

  let playerName = initialName;
  const dispatch = createEventDispatcher();

  function handleProceed() {
    if (!playerName.trim()) return;

    dispatch('nameSubmitted', {
      name: playerName.trim()
    });
  }

  function handleKeydown(event) {
    if (event.key === 'Enter') {
      handleProceed();
    }
  }
</script>

<div class="name-input-section">
  <h2>Enter Your Name</h2>
  <input
    type="text"
    bind:value={playerName}
    placeholder="Your name"
    class="name-input"
    maxlength="20"
    on:keydown={handleKeydown}
    disabled={loading}
  />
  <Button
    variant="primary"
    size="lg"
    disabled={!playerName.trim()}
    loading={loading}
    on:click={handleProceed}
  >
    Continue
  </Button>
  {#if error}
    <p class="error">{error}</p>
  {/if}
</div>

<style>
  .name-input-section {
    text-align: center;
    max-width: 400px;
    margin: 0 auto;
  }

  .name-input-section h2 {
    font-size: 24px;
    color: #f8fafc;
    margin-bottom: 16px;
  }

  .name-input-section :global(.btn-lg) {
    width: 100%;
    font-size: 16px;
  }

  .name-input {
    width: 100%;
    padding: 12px;
    margin: 10px 0;
    border: 2px solid #374151;
    border-radius: 6px;
    font-size: 16px;
    background: #374151;
    color: white;
    box-sizing: border-box;
  }

  .name-input:focus {
    border-color: #60a5fa;
    outline: none;
  }

  .name-input:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .error {
    color: #ef4444;
    margin-top: 10px;
    text-align: center;
  }
</style>
