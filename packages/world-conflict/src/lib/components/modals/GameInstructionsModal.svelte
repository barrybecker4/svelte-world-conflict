<script lang="ts">
  import { onMount } from 'svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import IconButton from '$lib/components/ui/IconButton.svelte';
  import Modal from '$lib/components/ui/Modal.svelte';
  import { TUTORIAL_CARDS, TOTAL_TUTORIAL_CARDS } from '$lib/game/constants/tutorialContent';
  import { loadPlayerName } from '$lib/client/stores/clientStorage';
  import { VERSION } from '$lib/version';
  import { logger } from 'multiplayer-framework/shared';

  interface Props {
    oncomplete?: () => void;
    onclose?: () => void;
  }

  let { oncomplete, onclose }: Props = $props();

  let currentCard = $state(0);
  let isOpen = $state(true);
  let userName = $state('');

  onMount(() => {
    userName = loadPlayerName();
  });

  function nextCard() {
    currentCard = (currentCard + 1) % TOTAL_TUTORIAL_CARDS;
  }

  function prevCard() {
    currentCard = (currentCard - 1 + TOTAL_TUTORIAL_CARDS) % TOTAL_TUTORIAL_CARDS;
  }

  function complete() {
    logger.debug('📖 Got it! - Instructions complete');
    oncomplete?.();
    isOpen = false;
  }

  function handleClose() {
    onclose?.();
    complete();
  }

  const currentTutorial = $derived(TUTORIAL_CARDS[currentCard]);
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

    {#if currentCard < TOTAL_TUTORIAL_CARDS - 1}
      <div class="nav-button-wrapper next">
        <IconButton
          variant="primary"
          size="lg"
          title="Next"
          on:click={nextCard}
        >
          ›
        </IconButton>
      </div>
    {/if}

    <div class="tutorial-content" class:has-image={currentTutorial.image}>
      <div class="tutorial-card">
        <div class="card-header">
          <h2>{currentTutorial.title}</h2>
          <div class="icon">{currentTutorial.icon}</div>
        </div>

        <div class="card-body">
          <ul class="card-content">
            {#each currentTutorial.content as item}
              <li>{@html item}</li>
            {/each}
          </ul>

          {#if currentTutorial.image}
            <div class="card-image">
              <img src={currentTutorial.image} alt="Gameplay preview" />
            </div>
          {/if}
        </div>
      </div>
    </div>

    <div class="bottom-box">
      <!-- Slide indicator dots -->
      <div class="slide-dots">
        {#each Array(TOTAL_TUTORIAL_CARDS) as _, i}
          <span class="dot" class:active={currentCard === i}></span>
        {/each}
      </div>

      {#if currentCard === TOTAL_TUTORIAL_CARDS - 1}
        <div class="start-button-wrapper">
          <Button
            variant="primary"
            size="lg"
            title="Got it"
            on:click={complete}
          >
            Got it!
          </Button>
        </div>
      {/if}
    </div>
  </div>
</Modal>

<style>
  .tutorial-container {
    position: relative;
    width: 90%;
    padding: 1.25rem;
    left: 50px;
  }

  .tutorial-header {
    text-align: center;
    margin-bottom: 1rem;
    position: relative;
  }

  .tutorial-header h1 {
    font-size: 3rem;
    font-weight: bold;
    background: linear-gradient(135deg, #60a5fa, #a855f7, #ec4899);
    background-clip: text;
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    margin-bottom: 0.25rem;
  }

  .user-info {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 1rem;
    margin-bottom: 0.5rem;
    font-size: 0.85rem;
    color: #94a3b8;
  }

  .user-info span {
    color: #aaa;
  }

  .user-info a {
    color: #dde;
    text-decoration: none;
    padding: 0.25rem 0.6rem;
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
    padding: 1.25rem;
    height: 280px;
    backdrop-filter: blur(10px);
    overflow: hidden;
  }

  .tutorial-card {
    height: 100%;
  }

  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
  }

  .card-header h2 {
    font-size: 1.25rem;
    color: #f8fafc;
    margin: 0;
  }

  .icon {
    font-size: 2rem;
  }

  .card-content {
    list-style: none;
    padding: 0;
    margin: 0;
  }

  .card-content li {
    margin-bottom: 0.6rem;
    padding-left: 1.25rem;
    position: relative;
    line-height: 1.4;
    color: #e2e8f0;
    font-size: 0.95rem;
  }

  .card-content li::before {
    content: "•";
    color: #60a5fa;
    position: absolute;
    left: 0;
    font-weight: bold;
  }

  .card-body {
    display: flex;
    gap: 1.5rem;
    align-items: flex-start;
  }

  .has-image .card-content {
    flex: 0 0 55%;
  }

  .card-image {
    flex: 0 0 40%;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .card-image img {
    max-width: 100%;
    height: auto;
    border-radius: 8px;
    border: 2px solid #475569;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  }

  .close-button-wrapper {
    position: absolute;
    top: 0;
    right: 0;
    padding: 0.25rem;
  }

  .close-button-wrapper :global(.icon-btn) {
    background: transparent;
    border: none;
    color: #94a3b8;
    font-size: 1.5rem;
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
    transform: scale(1.2);
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
    font-size: 1rem;
    padding: 0.75rem 2rem;
    text-align: center;
  }

  .slide-dots {
    display: flex;
    justify-content: center;
    gap: 0.5rem;
  }

  .dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: #475569;
    transition: all 0.2s ease;
  }

  .dot.active {
    background: #60a5fa;
    transform: scale(1.2);
  }

  .start-button-wrapper {
    margin-top: 1rem;
    display: flex;
    justify-content: center;
  }
</style>
