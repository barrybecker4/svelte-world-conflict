<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import IconButton from '$lib/components/ui/IconButton.svelte';
  import Modal from '$lib/components/ui/Modal.svelte';
  import { GAME_CONSTANTS } from '$lib/game/constants/gameConstants';
  import { SYMBOLS } from '$lib/game/constants/symbols';
  import { loadPlayerName } from '$lib/client/stores/clientStorage';
  import { VERSION } from '$lib/version';

  const dispatch = createEventDispatcher();

  let currentCard = 0;
  let isOpen = true;
  const totalCards = 5;
  let userName = '';

  onMount(() => {
    userName = loadPlayerName();
  });

  const tutorialCards = [
    {
      title: "How to win (1/5)",
      icon: "♛",
      content: [
        `The standard game lasts <strong>${GAME_CONSTANTS.STANDARD_MAX_TURNS} turns</strong>.`,
        "Once time runs out, <strong>whoever has most regions, wins</strong>.",
        "Your <strong>soldiers</strong> conquer and defend <strong>regions</strong>.",
        "Your <strong>temples</strong> make new soldiers and can be <strong>upgraded</strong> with faith.",
        `You get <strong>faith</strong>(${SYMBOLS.FAITH}) for regions and for soldiers praying at temples.`
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
        `<strong>Elemental upgrades</strong> are purchased with <strong>faith</strong> (${SYMBOLS.FAITH}).`,
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
    console.log('📖 Got it! - Instructions complete');
    dispatch('complete');
    isOpen = false;
  }

  function handleClose() {
    complete();
  }

  $: currentTutorial = tutorialCards[currentCard];
</script>

<Modal
  {isOpen}
  showHeader={false}
  width="1000px"
  on:close={handleClose}
>
  <div class="tutorial-container" data-testid="instructions-modal">
    <div class="tutorial-header">
      <h1>World Conflict</h1>

      <div class="user-info">
        {#if userName}
          <span>User: {userName}</span>
        {/if}
        <span>Version: {VERSION}</span>
        <a href="https://github.com/barrybecker4/svelte-world-conflict/wiki/World-Conflict-History-and-Credits" 
           target="_blank" 
           rel="noopener noreferrer">
          Credits
        </a>
      </div>

      <div class="close-button-wrapper">
        <IconButton variant="default" size="lg" title="Close" on:click={handleClose} data-testid="instructions-close-btn">
          ✕
        </IconButton>
      </div>
    </div>

    <div class="nav-button-wrapper prev">
      <IconButton
        variant="primary"
        size="lg"
        disabled={currentCard === 0}
        title="Previous"
        on:click={prevCard}
      >
        ‹
      </IconButton>
    </div>

    <div class="nav-button-wrapper next">
      <IconButton
        variant="primary"
        size="lg"
        disabled={currentCard === totalCards - 1}
        title="Next"
        on:click={nextCard}
      >
        ›
      </IconButton>
    </div>

    <div class="tutorial-content">
      <div class="tutorial-card">
        <div class="card-header">
          <h2>{currentTutorial.title}</h2>
          <div class="icon">{currentTutorial.icon}</div>
        </div>

        <ul class="card-content">
          {#each currentTutorial.content as item}
            <li>{@html item}</li>
          {/each}
        </ul>
      </div>
    </div>

    <div class="bottom-box">
      {#if currentCard === totalCards - 1}
        <Button variant="success" size="lg" on:click={complete} data-testid="instructions-proceed-btn">
          Got it!
        </Button>
      {:else}
        <Button variant="primary" size="lg" on:click={nextCard} data-testid="instructions-next-btn">
          Next →
        </Button>
      {/if}
    </div>
  </div>
</Modal>

<style>
  .tutorial-container {
    position: relative;
    width: 90%;
    padding: 2rem;
    left: 50px;
  }

  .tutorial-header {
    text-align: center;
    margin-bottom: 2rem;
    position: relative;
  }

  .tutorial-header h1 {
    font-size: 5rem;
    font-weight: bold;
    background: linear-gradient(135deg, #60a5fa, #a855f7, #ec4899);
    background-clip: text;
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    margin-bottom: 0.5rem;
  }

  .user-info {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 1.5rem;
    margin-bottom: 1rem;
    font-size: 1rem;
    color: #94a3b8;
  }

  .user-info span {
    color: #aaa;
  }

  .user-info a {
    color: #dde;
    text-decoration: none;
    padding: 0.35rem 0.75rem;
    border-radius: 6px;
    transition: all 0.2s ease;
  }

  .user-info a:hover {
    background: #444;
    color: #fff;
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

  .close-button-wrapper {
    position: absolute;
    top: 0;
    right: 0;
    padding: 0.5rem;
  }

  .close-button-wrapper :global(.icon-btn) {
    background: transparent;
    border: none;
    color: #94a3b8;
    font-size: 2rem;
  }

  .close-button-wrapper :global(.icon-btn:hover) {
    background: rgba(255, 255, 255, 0.1);
    color: #f8fafc;
  }

  .nav-button-wrapper {
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
  }

  .nav-button-wrapper.prev {
    left: -40px;
  }

  .nav-button-wrapper.next {
    right: -40px;
  }

  .nav-button-wrapper :global(.icon-btn) {
    background: rgba(59, 130, 246, 0.8);
    backdrop-filter: blur(10px);
    font-size: 2rem;
  }

  .nav-button-wrapper :global(.icon-btn:hover:not(.icon-btn-disabled)) {
    background: rgba(59, 130, 246, 1);
    transform: scale(1.5);
  }

  /* Mobile responsive adjustments */
  @media (max-width: 768px) {
    .nav-button-wrapper :global(.icon-btn-lg) {
      width: 40px;
      height: 40px;
      font-size: 1.2rem;
    }
  }

  .bottom-box {
    font-size: 1.2rem;
    padding: 1rem 3rem;
    text-align: center;
  }
</style>
