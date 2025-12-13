<script lang="ts">
    import { TUTORIAL_CARDS, TOTAL_TUTORIAL_CARDS } from '$lib/game/constants/tutorialContent';

    export let oncomplete: () => void;

    let currentCard = 0;

    function nextCard() {
        if (currentCard < TOTAL_TUTORIAL_CARDS - 1) {
            currentCard++;
        }
    }

    function prevCard() {
        if (currentCard > 0) {
            currentCard--;
        }
    }

    $: currentTutorial = TUTORIAL_CARDS[currentCard];
    $: isLastCard = currentCard === TOTAL_TUTORIAL_CARDS - 1;
    $: isFirstCard = currentCard === 0;
</script>

<div class="modal-overlay">
    <div class="modal">
        <header>
            <h1>Galactic Conflict</h1>
            <p class="subtitle">A Real-Time Space Strategy Game</p>
        </header>

        <div class="content">
            <div class="card-header">
                <h2>{currentTutorial.icon} {currentTutorial.title}</h2>
            </div>

            <ul class="card-content">
                {#each currentTutorial.content as item}
                    <li>{@html item}</li>
                {/each}
            </ul>
        </div>

        <div class="navigation">
            <button
                class="nav-btn prev"
                on:click={prevCard}
                disabled={isFirstCard}
                aria-label="Previous slide"
            >
                ‹
            </button>

            <div class="dots">
                {#each TUTORIAL_CARDS as _, index}
                    <button
                        class="dot"
                        class:active={index === currentCard}
                        on:click={() => currentCard = index}
                        aria-label="Go to slide {index + 1}"
                    ></button>
                {/each}
            </div>

            <button
                class="nav-btn next"
                on:click={nextCard}
                disabled={isLastCard}
                aria-label="Next slide"
            >
                ›
            </button>
        </div>

        <footer>
            <button class="play-btn" on:click={oncomplete}>
                Start Playing!
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
        max-width: 500px;
        max-height: 90vh;
        overflow-y: auto;
        color: #e5e7eb;
        box-shadow: 0 0 60px rgba(168, 85, 247, 0.3);
    }

    header {
        text-align: center;
        padding: 1.5rem 1.5rem 1rem;
        border-bottom: 1px solid #374151;
    }

    h1 {
        margin: 0;
        font-size: 1.75rem;
        background: linear-gradient(135deg, #a78bfa, #c084fc);
        background-clip: text;
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
    }

    .subtitle {
        margin: 0.5rem 0 0;
        color: #9ca3af;
        font-size: 0.9rem;
    }

    .content {
        padding: 1.5rem;
        min-height: 200px;
    }

    .card-header {
        margin-bottom: 1rem;
    }

    .card-header h2 {
        font-size: 1.25rem;
        color: #a78bfa;
        margin: 0;
    }

    .card-content {
        margin: 0;
        padding-left: 1.5rem;
        color: #d1d5db;
    }

    .card-content li {
        margin-bottom: 0.75rem;
        line-height: 1.6;
    }

    .card-content li:last-child {
        margin-bottom: 0;
    }

    .navigation {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 1rem;
        padding: 0 1.5rem 1rem;
    }

    .nav-btn {
        width: 40px;
        height: 40px;
        border-radius: 50%;
        border: 2px solid #4c1d95;
        background: transparent;
        color: #a78bfa;
        font-size: 1.5rem;
        cursor: pointer;
        transition: all 0.2s ease;
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .nav-btn:hover:not(:disabled) {
        background: #4c1d95;
        color: white;
    }

    .nav-btn:disabled {
        opacity: 0.3;
        cursor: not-allowed;
    }

    .dots {
        display: flex;
        gap: 0.5rem;
    }

    .dot {
        width: 10px;
        height: 10px;
        border-radius: 50%;
        border: none;
        background: #4c1d95;
        cursor: pointer;
        transition: all 0.2s ease;
        padding: 0;
    }

    .dot.active {
        background: #a78bfa;
        transform: scale(1.2);
    }

    .dot:hover:not(.active) {
        background: #7c3aed;
    }

    footer {
        padding: 1rem 1.5rem 1.5rem;
        text-align: center;
    }

    .play-btn, .next-btn {
        padding: 0.875rem 2rem;
        font-size: 1.1rem;
        font-weight: 600;
        border: none;
        border-radius: 12px;
        color: white;
        cursor: pointer;
        transition: all 0.3s ease;
    }

    .play-btn {
        background: linear-gradient(135deg, #7c3aed, #a855f7);
        box-shadow: 0 4px 20px rgba(168, 85, 247, 0.4);
    }

    .play-btn:hover {
        transform: translateY(-2px);
        box-shadow: 0 6px 30px rgba(168, 85, 247, 0.5);
    }

    .next-btn {
        background: linear-gradient(135deg, #4c1d95, #6d28d9);
        box-shadow: 0 4px 15px rgba(124, 58, 237, 0.3);
    }

    .next-btn:hover {
        transform: translateY(-2px);
        box-shadow: 0 6px 25px rgba(124, 58, 237, 0.4);
    }

    @media (max-width: 640px) {
        .modal {
            max-width: 100%;
            margin: 0.5rem;
        }

        h1 {
            font-size: 1.5rem;
        }

        .content {
            padding: 1rem;
            min-height: 180px;
        }

        .card-header h2 {
            font-size: 1.1rem;
        }

        .card-content {
            font-size: 0.95rem;
        }
    }
</style>
