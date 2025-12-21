<script lang="ts">
    import { createEventDispatcher } from 'svelte';

    const dispatch = createEventDispatcher();

    function handleConfirm() {
        dispatch('confirm');
    }

    function handleCancel() {
        dispatch('cancel');
    }

    function handleKeydown(e: KeyboardEvent) {
        if (e.key === 'Escape') {
            handleCancel();
        }
    }
</script>

<div
    class="modal-overlay"
    on:click={handleCancel}
    on:keydown={handleKeydown}
    role="button"
    tabindex="0"
>
    <div
        class="resign-modal"
        on:click|stopPropagation
        on:keydown|stopPropagation
        role="dialog"
        aria-modal="true"
        aria-labelledby="resign-modal-title"
        tabindex="-1"
    >
        <h2 id="resign-modal-title">Resign from Game?</h2>
        <p>Are you sure you want to resign? Your planets will become neutral and your fleets will be disbanded.</p>
        <p class="spectate-note">You'll still be able to watch the rest of the game.</p>
        <div class="modal-buttons">
            <button class="cancel-btn" on:click={handleCancel}>
                Cancel
            </button>
            <button class="confirm-resign-btn" on:click={handleConfirm}>
                Resign
            </button>
        </div>
    </div>
</div>

<style>
    .modal-overlay {
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.7);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
        backdrop-filter: blur(4px);
    }

    .resign-modal {
        background: linear-gradient(145deg, #1a1a2e, #16162a);
        border: 1px solid #374151;
        border-radius: 16px;
        padding: 2rem;
        max-width: 400px;
        width: 90%;
        box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5);
    }

    h2 {
        color: #f87171;
        font-size: 1.5rem;
        margin: 0 0 1rem 0;
        text-align: center;
    }

    p {
        color: #e5e7eb;
        margin: 0 0 0.75rem 0;
        text-align: center;
        line-height: 1.5;
    }

    .spectate-note {
        color: #9ca3af;
        font-size: 0.9rem;
        font-style: italic;
    }

    .modal-buttons {
        display: flex;
        gap: 1rem;
        margin-top: 1.5rem;
        justify-content: center;
    }

    .cancel-btn {
        padding: 0.75rem 1.5rem;
        background: transparent;
        border: 1px solid #4b5563;
        border-radius: 8px;
        color: #9ca3af;
        font-weight: 600;
        font-size: 1rem;
        cursor: pointer;
        transition: all 0.2s;
    }

    .cancel-btn:hover {
        background: rgba(255, 255, 255, 0.05);
        border-color: #6b7280;
        color: #e5e7eb;
    }

    .confirm-resign-btn {
        padding: 0.75rem 1.5rem;
        background: linear-gradient(135deg, #dc2626, #b91c1c);
        border: none;
        border-radius: 8px;
        color: white;
        font-weight: 600;
        font-size: 1rem;
        cursor: pointer;
        transition: all 0.2s;
    }

    .confirm-resign-btn:hover {
        background: linear-gradient(135deg, #ef4444, #dc2626);
        transform: scale(1.05);
    }
</style>

