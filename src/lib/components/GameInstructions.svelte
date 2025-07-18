<!-- src/lib/components/GameInstructions.svelte -->
<script>
  import { createEventDispatcher } from 'svelte';

  const dispatch = createEventDispatcher();
  let currentCard = 0;
  const totalCards = 5;

  const tutorialCards = [
    {
      title: "How to win (1/5)",
      icon: "♛",
      content: [
        "The standard game lasts <strong>15 turns</strong>.",
        "Once time runs out, <strong>whoever has most regions, wins</strong>.",
        "Your <strong>soldiers</strong> conquer and defend <strong>regions</strong>.",
        "Your <strong>temples</strong> make new soldiers and can be <strong>upgraded</strong> with faith.",
        "You get <strong>faith</strong>(☥) for regions and for soldiers praying at temples."
      ]
    },
    {
      title: "Temples (2/5)",
      icon: "🏛️",
      content: [
        "Each player <strong>starts with one temple</strong> under their control.",
        "After your turn, each of your temples <strong>produces a new soldier</strong>.",
        "You can <strong>take over</strong> your enemies' temples.",
        "There are <strong>neutral temples</strong> that you can conquer.",
        "Temples can be imbued with <strong>elemental powers</strong> using upgrades."
      ]
    },
    {
      title: "Soldiers (3/5)",
      icon: "⚔️",
      content: [
        "Soldiers can <strong>move between neighboring regions</strong>.",
        "You can <strong>attack enemy regions</strong> with your soldiers.",
        "Combat uses <strong>dice rolls</strong> - more soldiers = better odds.",
        "Winning an attack <strong>conquers the region</strong>.",
        "Soldiers that conquer a region <strong>cannot move again</strong> that turn."
      ]
    },
    {
      title: "Combat (4/5)",
      icon: "🎲",
      content: [
        "Combat is resolved with <strong>dice rolls</strong>.",
        "Attacker and defender each roll dice based on army size.",
        "Higher dice rolls win - ties go to the <strong>defender</strong>.",
        "Losing armies are eliminated until one side has no soldiers.",
        "Strategy tip: <strong>attack with overwhelming force</strong>!"
      ]
    },
    {
      title: "Upgrades (5/5)",
      icon: "✨",
      content: [
        "<strong>Elemental upgrades</strong> are purchased with <strong>faith</strong> (☥).",
        "There are <strong>2 levels</strong> of each upgrade type.",
        "Instead of upgrading, you can use faith to <strong>recruit soldiers</strong>.",
        "Each soldier you recruit in a turn gets <strong>more expensive</strong>.",
        "If a temple is lost, the <strong>upgrade is lost with it</strong>."
      ]
    }
  ];

  function nextCard() {
    currentCard = (currentCard + 1) % totalCards;
  }

  function prevCard() {
    currentCard = (currentCard - 1 + totalCards) % totalCards;
  }

  function complete() {
    console.log('📖 Got it! button clicked');
    dispatch('complete');
  }

  function close() {
    console.log('❌ Close button clicked');
    dispatch('complete'); // Same action as "Got it!"
  }
</script>

<!-- Full screen overlay matching GAS styling -->
<div class="tutorial-overlay">
  <div class="tutorial-container">
    <div class="tutorial-header">
      <h1>World Conflict
        <br/>
        <span class="title-subheader">
          Learn the rules of strategic conquest
        </span>
      </h1>
      <button class="close-button" on:click={close} aria-label="Close instructions">
        ×
      </button>
    </div>

    <div class="tutorial-content">
      <div class="tutorial-card">
        <div class="card-header">
          <h2>{tutorialCards[currentCard].title}</h2>
          <div class="icon">{tutorialCards[currentCard].icon}</div>
        </div>

        <ul class="card-content">
          {#each tutorialCards[currentCard].content as item}
            <li>{@html item}</li>
          {/each}
        </ul>
      </div>
    </div>

    <!-- Navigation arrows -->
    <button
      class="nav-button prev"
      class:disabled={currentCard === 0}
      on:click={prevCard}
      disabled={currentCard === 0}
      aria-label="Previous tutorial card"
    >
      «
    </button>

    <button
      class="nav-button next"
      class:disabled={currentCard === totalCards - 1}
      on:click={nextCard}
      disabled={currentCard === totalCards - 1}
      aria-label="Next tutorial card"
    >
      »
    </button>

    <!-- Bottom action -->
    <div class="bottom-box">
      <button class="got-it-button" on:click={complete}>
        Got it!
      </button>
    </div>
  </div>
</div>

<style>
  .tutorial-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: linear-gradient(135deg, #1e293b 0%, #334155 100%);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    color: white;
    font-family: system-ui, sans-serif;
  }

  .tutorial-container {
    position: relative;
    max-width: 600px;
    width: 90%;
    padding: 2rem;
  }

  .tutorial-header {
    text-align: center;
    margin-bottom: 2rem;
    position: relative;
  }

  .close-button {
    position: absolute;
    top: 0;
    right: 0;
    background: none;
    border: none;
    color: #94a3b8;
    font-size: 2rem;
    cursor: pointer;
    padding: 0.5rem;
    line-height: 1;
    transition: color 0.2s;
  }

  .close-button:hover {
    color: #f8fafc;
  }

  .tutorial-header h1 {
    font-size: 3rem;
    font-weight: bold;
    background: linear-gradient(135deg, #60a5fa, #a855f7, #ec4899);
    background-clip: text;
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    margin-bottom: 0.5rem;
  }

  .title-subheader {
    font-size: 1.2rem;
    color: #94a3b8;
    font-weight: normal;
  }

  .tutorial-content {
    background: rgba(15, 23, 42, 0.8);
    border: 2px solid #475569;
    border-radius: 12px;
    padding: 2rem;
    min-height: 300px;
    backdrop-filter: blur(10px);
  }

  .tutorial-card {
    height: 100%;
  }

  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1.5rem;
  }

  .card-header h2 {
    font-size: 1.5rem;
    color: #f8fafc;
    margin: 0;
  }

  .icon {
    font-size: 2.5rem;
  }

  .card-content {
    list-style: none;
    padding: 0;
    margin: 0;
  }

  .card-content li {
    margin-bottom: 1rem;
    padding-left: 1.5rem;
    position: relative;
    line-height: 1.6;
    color: #e2e8f0;
  }

  .card-content li::before {
    content: "•";
    color: #60a5fa;
    position: absolute;
    left: 0;
    font-weight: bold;
  }

  .nav-button {
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    background: rgba(59, 130, 246, 0.8);
    color: white;
    border: none;
    width: 50px;
    height: 50px;
    border-radius: 50%;
    font-size: 1.5rem;
    font-weight: bold;
    cursor: pointer;
    transition: all 0.2s;
    backdrop-filter: blur(10px);
  }

  .nav-button:hover:not(.disabled) {
    background: rgba(59, 130, 246, 1);
    transform: translateY(-50%) scale(1.1);
  }

  .nav-button.disabled {
    background: rgba(75, 85, 99, 0.5);
    cursor: not-allowed;
    color: #6b7280;
  }

  .nav-button.prev {
    left: -70px;
  }

  .nav-button.next {
    right: -70px;
  }

  .bottom-box {
    text-align: center;
    margin-top: 2rem;
  }

  .got-it-button {
    background: linear-gradient(135deg, #10b981, #059669);
    color: white;
    border: none;
    padding: 1rem 3rem;
    border-radius: 8px;
    font-weight: 600;
    font-size: 1.2rem;
    cursor: pointer;
    transition: all 0.2s;
    text-decoration: none;
    display: inline-block;
  }

  .got-it-button:hover {
    background: linear-gradient(135deg, #059669, #047857);
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(16, 185, 129, 0.4);
  }

  /* Mobile responsiveness */
  @media (max-width: 768px) {
    .tutorial-container {
      width: 95%;
      padding: 1rem;
    }

    .tutorial-header h1 {
      font-size: 2rem;
    }

    .tutorial-content {
      padding: 1.5rem;
      min-height: 250px;
    }

    .nav-button {
      width: 40px;
      height: 40px;
      font-size: 1.2rem;
    }

    .nav-button.prev {
      left: -50px;
    }

    .nav-button.next {
      right: -50px;
    }

    .card-header h2 {
      font-size: 1.2rem;
    }

    .icon {
      font-size: 2rem;
    }
  }
</style>
