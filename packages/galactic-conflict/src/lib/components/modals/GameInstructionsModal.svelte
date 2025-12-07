<script lang="ts">
    export let oncomplete: () => void;
</script>

<div class="modal-overlay">
    <div class="modal">
        <header>
            <h1>🌌 Galactic Conflict</h1>
            <p class="subtitle">A Real-Time Space Strategy Game</p>
        </header>

        <div class="content">
            <section>
                <h2>🎯 Objective</h2>
                <p>
                    Conquer the galaxy by capturing planets and defeating your opponents.
                    The player with the most planets when time runs out wins!
                </p>
            </section>

            <section>
                <h2>🪐 Planets</h2>
                <ul>
                    <li>Each planet produces <strong>resources</strong> based on its size</li>
                    <li>Larger planets produce more resources per minute</li>
                    <li>Use resources to build new ships</li>
                    <li>Click your planet to select it, then click again to build ships</li>
                </ul>
            </section>

            <section>
                <h2>🚀 Armadas</h2>
                <ul>
                    <li>Select one of your planets, then click another planet to send ships</li>
                    <li>Armadas travel through space in real-time</li>
                    <li>Sending to your own planet = reinforcement</li>
                    <li>Sending to enemy/neutral planet = attack!</li>
                </ul>
            </section>

            <section>
                <h2>⚔️ Combat</h2>
                <ul>
                    <li>Battles use Risk-style dice mechanics</li>
                    <li>Attackers roll up to 3 dice, defenders up to 2</li>
                    <li>Ties go to the defender</li>
                    <li>In multi-player battles, everyone attacks the weakest!</li>
                </ul>
            </section>

            <section>
                <h2>🏆 Victory</h2>
                <ul>
                    <li>Last player standing wins immediately</li>
                    <li>If time runs out: most planets wins</li>
                    <li>Tiebreaker: most ships, then most resources</li>
                </ul>
            </section>
        </div>

        <footer>
            <button class="play-btn" on:click={oncomplete}>
                Start Playing! 🎮
            </button>
        </footer>
    </div>
</div>

<style>
    .modal-overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: linear-gradient(135deg, #0f0f1a 0%, #1a1a2e 100%);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
        padding: 1rem;
    }

    .modal {
        background: linear-gradient(145deg, #1e1e2e, #2a2a3e);
        border: 2px solid #4c1d95;
        border-radius: 16px;
        width: 100%;
        max-width: 600px;
        max-height: 90vh;
        overflow-y: auto;
        color: #e5e7eb;
        box-shadow: 0 0 60px rgba(168, 85, 247, 0.3);
    }

    header {
        text-align: center;
        padding: 2rem 2rem 1rem;
        border-bottom: 1px solid #374151;
    }

    h1 {
        margin: 0;
        font-size: 2.5rem;
        background: linear-gradient(135deg, #a78bfa, #c084fc);
        background-clip: text;
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
    }

    .subtitle {
        margin: 0.5rem 0 0;
        color: #9ca3af;
        font-size: 1.1rem;
    }

    .content {
        padding: 1.5rem 2rem;
    }

    section {
        margin-bottom: 1.5rem;
    }

    section:last-child {
        margin-bottom: 0;
    }

    h2 {
        font-size: 1.1rem;
        color: #a78bfa;
        margin: 0 0 0.5rem;
    }

    p {
        margin: 0;
        color: #d1d5db;
        line-height: 1.6;
    }

    ul {
        margin: 0;
        padding-left: 1.5rem;
        color: #d1d5db;
    }

    li {
        margin-bottom: 0.5rem;
        line-height: 1.5;
    }

    li:last-child {
        margin-bottom: 0;
    }

    footer {
        padding: 1.5rem 2rem 2rem;
        text-align: center;
    }

    .play-btn {
        padding: 1rem 3rem;
        font-size: 1.25rem;
        font-weight: 600;
        background: linear-gradient(135deg, #7c3aed, #a855f7);
        border: none;
        border-radius: 12px;
        color: white;
        cursor: pointer;
        transition: all 0.3s ease;
        box-shadow: 0 4px 20px rgba(168, 85, 247, 0.4);
    }

    .play-btn:hover {
        transform: translateY(-2px);
        box-shadow: 0 6px 30px rgba(168, 85, 247, 0.5);
    }

    @media (max-width: 640px) {
        h1 {
            font-size: 1.75rem;
        }

        .content {
            padding: 1rem 1.5rem;
        }
    }
</style>

