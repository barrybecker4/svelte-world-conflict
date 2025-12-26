<script lang="ts">
    export let settings: {
        neutralPlanetCount?: number;
        planetCount?: number;
        gameDuration?: number;
        armadaSpeed?: number;
    };
    export let activePlayerCount: number;
    export let neutralPlanets: number;
    export let totalPlanets: number;
</script>

<section class="settings-section">
    <h2>Game Settings</h2>
    <div class="settings-grid">
        <div class="setting">
            <span class="setting-label">Planets</span>
            <span class="setting-value">{totalPlanets} ({neutralPlanets} neutral)</span>
        </div>
        <div class="setting">
            <span class="setting-label">Duration</span>
            <span class="setting-value">{settings?.gameDuration || 15} min</span>
        </div>
        <div class="setting">
            <span class="setting-label">Armada Speed</span>
            <span class="setting-value">{settings?.armadaSpeed || 100} u/min</span>
        </div>
    </div>
</section>

<style>
    .settings-section {
        margin-bottom: 1.5rem;
    }

    h2 {
        margin: 0 0 1rem;
        font-size: 1rem;
        color: #9ca3af;
        text-transform: uppercase;
        letter-spacing: 0.05em;
    }

    .settings-grid {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 1rem;
    }

    .setting {
        text-align: center;
        padding: 0.75rem;
        background: rgba(255, 255, 255, 0.05);
        border-radius: 8px;
    }

    .setting-label {
        display: block;
        font-size: 0.75rem;
        color: #9ca3af;
        margin-bottom: 0.25rem;
    }

    .setting-value {
        font-size: 1.1rem;
        font-weight: bold;
    }

    @media (max-width: 640px) {
        .settings-grid {
            grid-template-columns: 1fr;
        }
    }
</style>
