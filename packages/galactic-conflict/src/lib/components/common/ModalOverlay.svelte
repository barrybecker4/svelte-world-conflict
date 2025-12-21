<script lang="ts">
    import { createEventDispatcher } from 'svelte';

    const dispatch = createEventDispatcher();

    export let onClose: (() => void) | null = null;
    export let maxWidth: string = '500px';
    export let maxHeight: string = '80vh';

    function handleOverlayClick() {
        if (onClose) {
            onClose();
        } else {
            dispatch('close');
        }
    }

    function handleKeydown(e: KeyboardEvent) {
        if (e.key === 'Escape') {
            handleOverlayClick();
        }
    }
</script>

<div
    class="modal-overlay"
    on:click={handleOverlayClick}
    on:keydown={handleKeydown}
    role="button"
    tabindex="-1"
>
    <div
        class="modal"
        style="max-width: {maxWidth}; max-height: {maxHeight};"
        on:click|stopPropagation
        role="dialog"
        aria-modal="true"
    >
        <slot />
    </div>
</div>

<style>
    .modal-overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.8);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
        backdrop-filter: blur(4px);
    }

    .modal {
        background: linear-gradient(145deg, #1e1e2e, #2a2a3e);
        border: 1px solid #4c1d95;
        border-radius: 12px;
        width: 90%;
        overflow-y: auto;
        color: #e5e7eb;
    }
</style>

