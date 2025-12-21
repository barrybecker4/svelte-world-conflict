<script lang="ts">
    export let errorMessage: string;
</script>

<div class="connection-error">
    <h2>Connection Failed</h2>
    <p>{errorMessage}</p>
    <div class="error-instructions">
        <p>To start the WebSocket worker, run in a separate terminal:</p>
        <code>npm run dev:websocket</code>
        <p>Then refresh this page.</p>
    </div>
    <button on:click={() => window.location.reload()}>Retry Connection</button>
</div>

<style>
    .connection-error {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        height: 100%;
        color: #e5e7eb;
        text-align: center;
        padding: 2rem;
    }

    h2 {
        color: #ef4444;
        font-size: 1.75rem;
        margin-bottom: 1rem;
    }

    p {
        color: #9ca3af;
        margin: 0.5rem 0;
    }

    .error-instructions {
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid #374151;
        border-radius: 8px;
        padding: 1.5rem;
        margin: 1.5rem 0;
    }

    code {
        display: block;
        background: #1f1f2e;
        padding: 0.75rem 1rem;
        border-radius: 4px;
        font-family: monospace;
        color: #a78bfa;
        margin: 0.75rem 0;
    }

    button {
        padding: 0.75rem 2rem;
        background: linear-gradient(135deg, #7c3aed, #a855f7);
        border: none;
        border-radius: 8px;
        color: white;
        font-weight: 600;
        cursor: pointer;
        margin-top: 1rem;
    }

    button:hover {
        background: linear-gradient(135deg, #6d28d9, #9333ea);
    }
</style>

