<script lang="ts">
    export let myPlanets: number;
    export let totalShips: number;
    export let totalResources: number;
    export let armadaCount: number;
</script>

<div class="my-stats">
    <h3>Your Empire</h3>
    <div class="stat-grid">
        <div class="stat">
            <span class="stat-label">Planets</span>
            <span class="stat-value">{myPlanets}</span>
        </div>
        <div class="stat">
            <span class="stat-label">Ships</span>
            <span class="stat-value">{totalShips}</span>
        </div>
        <div class="stat">
            <span class="stat-label">Resources</span>
            <span class="stat-value">{Math.floor(totalResources)}</span>
        </div>
        <div class="stat">
            <span class="stat-label">Armadas</span>
            <span class="stat-value">{armadaCount}</span>
        </div>
    </div>
</div>

<style>
    .my-stats {
        background: rgba(168, 85, 247, 0.1);
        border: 1px solid rgba(168, 85, 247, 0.3);
        border-radius: 8px;
        padding: 1rem;
        margin-bottom: 1.5rem;
    }

    h3 {
        font-size: 0.9rem;
        color: #9ca3af;
        margin: 0 0 0.5rem 0;
        text-transform: uppercase;
        letter-spacing: 0.05em;
    }

    .stat-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 0.75rem;
    }

    .stat {
        text-align: center;
    }

    .stat-label {
        display: block;
        font-size: 0.75rem;
        color: #9ca3af;
    }

    .stat-value {
        display: block;
        font-size: 1.25rem;
        font-weight: bold;
        color: #e5e7eb;
    }
</style>

