<script lang="ts">
    import { Button, Modal } from 'shared-ui';

    interface Props {
        maxSoldiers: number;
        currentSelection: number;
        onConfirm: (count: number) => void;
        onCancel: () => void;
    }

    let { maxSoldiers, currentSelection, onConfirm, onCancel }: Props = $props();

    let selectedCount = $state(currentSelection);
    let isOpen = $state(true);

    // Clamp selection to valid range
    const clampedSelection = $derived(Math.max(1, Math.min(selectedCount, maxSoldiers)));

    function handleConfirm() {
        onConfirm(clampedSelection);
        isOpen = false;
    }

    function handleCancel() {
        onCancel();
        isOpen = false;
    }

    function handleClose() {
        handleCancel();
    }
</script>

<Modal {isOpen} title="Select Soldiers to Move" onclose={handleClose}>
    <div class="soldier-display">
        <!-- Native slider control -->
        <div class="slider-container">
            <input
                type="range"
                id="soldier-slider"
                bind:value={selectedCount}
                min="1"
                max={maxSoldiers}
                step="1"
                class="soldier-slider"
                style="--value: {selectedCount}; --min: 1; --max: {maxSoldiers};"
            />
            <div class="slider-labels">
                <span>1</span>
                <span>{maxSoldiers}</span>
            </div>
        </div>

        <div class="selection-info">
            <p>Moving <strong>{clampedSelection}</strong> of {maxSoldiers} soldiers</p>
            <small>Use the slider to select how many soldiers to move</small>
        </div>
    </div>

    {#snippet footer()}
        <Button variant="secondary" onclick={handleCancel}>Cancel</Button>
        <Button variant="success" onclick={handleConfirm}>
            Move {clampedSelection} Soldier{clampedSelection === 1 ? '' : 's'}
        </Button>
    {/snippet}
</Modal>

<style>
    .soldier-display {
        margin-bottom: 1.5rem;
    }

    .slider-container {
        margin-bottom: 1.5rem;
    }

    .soldier-slider {
        width: 100%;
        height: 8px;
        border-radius: 4px;
        outline: none;
        -webkit-appearance: none;
        appearance: none;
        cursor: pointer;
        background: transparent;
    }

    /* WebKit (Chrome, Safari, Edge) */
    .soldier-slider::-webkit-slider-runnable-track {
        width: 100%;
        height: 8px;
        border-radius: 4px;
        background: linear-gradient(
            to right,
            #10b981 0%,
            #059669 calc((var(--value) - var(--min)) / (var(--max) - var(--min)) * 100%),
            transparent calc((var(--value) - var(--min)) / (var(--max) - var(--min)) * 100%)
        );
        border: 2px solid #475569;
    }

    .soldier-slider::-webkit-slider-thumb {
        -webkit-appearance: none;
        appearance: none;
        width: 24px;
        height: 24px;
        border-radius: 50%;
        background: #fff;
        border: 3px solid #10b981;
        cursor: pointer;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
        transition: all 0.2s ease;
        margin-top: -10px;
    }

    .soldier-slider::-webkit-slider-thumb:hover {
        transform: scale(1.1);
        border-color: #34d399;
    }

    /* Firefox */
    .soldier-slider::-moz-range-track {
        width: 100%;
        height: 8px;
        border-radius: 4px;
        background: transparent;
        border: 2px solid #475569;
    }

    .soldier-slider::-moz-range-progress {
        height: 8px;
        border-radius: 4px 0 0 4px;
        background: linear-gradient(to right, #10b981, #059669);
    }

    .soldier-slider::-moz-range-thumb {
        width: 24px;
        height: 24px;
        border-radius: 50%;
        background: #fff;
        border: 3px solid #10b981;
        cursor: pointer;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
        transition: all 0.2s ease;
    }

    .soldier-slider::-moz-range-thumb:hover {
        transform: scale(1.1);
        border-color: #34d399;
    }

    .slider-labels {
        display: flex;
        justify-content: space-between;
        margin-top: 0.5rem;
        color: #94a3b8;
        font-size: 0.85rem;
    }

    .selection-info {
        text-align: center;
        color: #cbd5e1;
    }

    .selection-info strong {
        color: #10b981;
        font-size: 1.1rem;
    }

    .selection-info small {
        display: block;
        margin-top: 0.25rem;
        color: #94a3b8;
        font-size: 0.8rem;
    }
</style>
