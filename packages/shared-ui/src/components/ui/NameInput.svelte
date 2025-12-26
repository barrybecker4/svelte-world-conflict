<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    import { Button } from 'shared-ui';

    interface Props {
        initialName?: string;
        value?: string;
        error?: string | null;
        loading?: boolean;
        autofocus?: boolean;
        placeholder?: string;
        maxlength?: number;
        title?: string;
        buttonText?: string;
    }

    let {
        initialName = '',
        value = $bindable(),
        error = null,
        loading = false,
        autofocus = false,
        placeholder = 'Your name',
        maxlength = 20,
        title = 'Enter Your Name',
        buttonText = 'Continue'
    }: Props = $props();

    const dispatch = createEventDispatcher<{
        submit: { name: string };
    }>();

    // Use value if provided (two-way binding), otherwise use initialName
    let playerName = $state(value || initialName);

    // Sync with value prop if using two-way binding
    $effect(() => {
        if (value !== undefined) {
            playerName = value;
        }
    });

    $effect(() => {
        if (value !== undefined) {
            value = playerName;
        }
    });

    function handleSubmit() {
        if (!playerName.trim()) return;

        const trimmedName = playerName.trim();
        if (value !== undefined) {
            value = trimmedName;
        }
        dispatch('submit', { name: trimmedName });
    }

    function handleKeydown(event: KeyboardEvent) {
        if (event.key === 'Enter') {
            handleSubmit();
        }
    }
</script>

<div class="name-input-container">
    {#if title}
        <h2>{title}</h2>
    {/if}
    
    <input
        type="text"
        bind:value={playerName}
        {placeholder}
        {maxlength}
        {autofocus}
        on:keydown={handleKeydown}
        disabled={loading}
        class="name-input"
        data-testid="player-name-input"
    />
    
    <Button
        variant="primary"
        size="lg"
        disabled={!playerName.trim() || loading}
        {loading}
        onclick={handleSubmit}
        data-testid="player-name-submit"
        customClass="submit-button"
    >
        {buttonText}
    </Button>
    
    {#if error}
        <p class="error">{error}</p>
    {/if}
</div>

<style>
    .name-input-container {
        text-align: center;
        max-width: 400px;
        margin: 0 auto;
    }

    h2 {
        font-size: 24px;
        color: #f8fafc;
        margin: 0 0 16px;
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
        text-align: center;
    }

    .name-input:focus {
        border-color: #60a5fa;
        outline: none;
    }

    .name-input:disabled {
        opacity: 0.6;
        cursor: not-allowed;
    }

    .submit-button {
        width: 100%;
        font-size: 16px;
        margin-top: 10px;
    }

    .error {
        color: #ef4444;
        margin-top: 10px;
        text-align: center;
        font-size: 14px;
    }
</style>

