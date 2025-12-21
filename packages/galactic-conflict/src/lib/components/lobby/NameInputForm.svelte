<script lang="ts">
    import { createEventDispatcher } from 'svelte';

    const dispatch = createEventDispatcher();

    export let playerName: string = '';

    function handleSubmit() {
        if (playerName.trim()) {
            dispatch('submit', { playerName: playerName.trim() });
        }
    }
</script>

<div class="name-input-container">
    <h2>Enter Your Name</h2>
    <form on:submit|preventDefault={handleSubmit}>
        <input
            type="text"
            bind:value={playerName}
            placeholder="Commander name..."
            maxlength="20"
            autofocus
        />
        <button type="submit" disabled={!playerName.trim()}>
            Continue
        </button>
    </form>
</div>

<style>
    .name-input-container {
        background: linear-gradient(145deg, #1e1e2e, #2a2a3e);
        border: 2px solid #4c1d95;
        border-radius: 16px;
        padding: 2rem;
        text-align: center;
        color: #e5e7eb;
    }

    h2 {
        margin: 0 0 1.5rem;
        color: #a78bfa;
    }

    form {
        display: flex;
        flex-direction: column;
        gap: 1rem;
    }

    input {
        padding: 0.75rem 1rem;
        font-size: 1.1rem;
        background: #1f1f2e;
        border: 1px solid #374151;
        border-radius: 8px;
        color: #e5e7eb;
        text-align: center;
    }

    button {
        padding: 0.75rem 2rem;
        background: linear-gradient(135deg, #7c3aed, #a855f7);
        border: none;
        border-radius: 8px;
        color: white;
        font-weight: 600;
        cursor: pointer;
    }

    button:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }
</style>

