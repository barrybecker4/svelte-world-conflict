<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import type { GameStateData, Player } from '$lib/game/state/GameState';
  import Button from '$lib/components/ui/Button.svelte';
  import Panel from '$lib/components/ui/Panel.svelte';
  import Section from '$lib/components/ui/Section.svelte';
  import { Temple } from '$lib/game/entities/Temple';
  import { TEMPLE_UPGRADES_BY_NAME, type TempleUpgradeDefinition } from '$lib/game/constants/templeUpgradeDefinitions';
  import { SYMBOLS } from '$lib/game/constants/symbols';

  export let regionIndex: number;
  export let gameState: GameStateData | null = null;
  export let currentPlayer: Player | null = null;
  export let onPurchase: (upgradeIndex: number) => Promise<void>;
  export let onDone: () => void;

  onMount(() => {
    console.log('🏛️ TempleUpgradePanel mounted for region', regionIndex);
  });

  onDestroy(() => {
    console.log('🏛️ TempleUpgradePanel destroyed');
  });

  $: templeData = gameState?.templesByRegion?.[regionIndex];
  $: temple = templeData ? Temple.deserialize(templeData) : null;
  $: currentFaith = gameState && currentPlayer ? (gameState.faithByPlayer[currentPlayer.slotIndex] || 0) : 0;
  $: movesRemaining = gameState?.movesRemaining ?? 3;
  $: numBoughtSoldiers = gameState?.numBoughtSoldiers || 0;

  $: templeInfo = temple?.getDisplayInfo() || { name: 'Basic Temple', description: 'No upgrades' };

  // Calculate available upgrade options
  $: availableOptions = getAvailableOptions(temple, currentFaith, numBoughtSoldiers);

  interface UpgradeOption {
    upgrade: TempleUpgradeDefinition;
    cost: number;
    canAfford: boolean;
    displayName: string;
    description: string;
  }

  function getAvailableOptions(temple: Temple | null, faith: number, soldiersBought: number): UpgradeOption[] {
    const options: UpgradeOption[] = [];

    // Always show soldier option
    const costArray = TEMPLE_UPGRADES_BY_NAME.SOLDIER.cost;
    const soldierCost = soldiersBought < costArray.length ? costArray[soldiersBought] : (8 + soldiersBought);
    options.push({
      upgrade: TEMPLE_UPGRADES_BY_NAME.SOLDIER,
      cost: soldierCost,
      canAfford: faith >= soldierCost,
      displayName: 'Extra soldier',
      description: TEMPLE_UPGRADES_BY_NAME.SOLDIER.description
    });

    if (temple?.upgradeIndex !== undefined && temple.upgradeIndex !== 0) {
      // Temple has an upgrade - show option to upgrade to next level
      const currentUpgrade = temple.getCurrentUpgrade();
      if (currentUpgrade && temple.canUpgrade()) {
        const nextLevel = temple.level + 1;
        const nextLevelCost = currentUpgrade.cost[nextLevel];
        
        // Level 0 = "Temple of X", Level 1 = "Cathedral of X"
        const levelPrefix = nextLevel === 0 ? 'Temple' : 'Cathedral';
        const upgradeName = currentUpgrade.name.charAt(0) + currentUpgrade.name.slice(1).toLowerCase();
        
        options.push({
          upgrade: currentUpgrade,
          cost: nextLevelCost,
          canAfford: faith >= nextLevelCost,
          displayName: `${levelPrefix} of ${upgradeName}`,
          description: temple.getUpgradeFormattedDescription(currentUpgrade, nextLevel)
        });
      }

      // Show rebuild option
      options.push({
        upgrade: TEMPLE_UPGRADES_BY_NAME.REBUILD,
        cost: 0,
        canAfford: true,
        displayName: 'Rebuild temple',
        description: 'Switch to a different upgrade.'
      });
    } else {
      // No upgrade or basic temple - show all temple options
      const templeUpgrades = [
        TEMPLE_UPGRADES_BY_NAME.WATER,
        TEMPLE_UPGRADES_BY_NAME.FIRE,
        TEMPLE_UPGRADES_BY_NAME.AIR,
        TEMPLE_UPGRADES_BY_NAME.EARTH
      ];

      for (const upgrade of templeUpgrades) {
        const cost = upgrade.cost[0];
        const upgradeName = upgrade.name.charAt(0) + upgrade.name.slice(1).toLowerCase();
        
        options.push({
          upgrade,
          cost,
          canAfford: faith >= cost,
          displayName: `Temple of ${upgradeName}`,
          description: upgrade.description.replace('{level}', 'Temple').replace('{value}', upgrade.level[0].toString())
        });
      }
    }

    return options;
  }

  async function handlePurchase(upgradeIndex: number) {
    console.log('🏛️ TempleUpgradePanel: Purchase button clicked for upgrade', upgradeIndex);
    await onPurchase(upgradeIndex);
  }

  function handleDone() {
    console.log('🏛️ TempleUpgradePanel: Done button clicked');
    onDone();
  }
</script>

<Panel variant="glass" padding={false} customClass="game-info-panel">
  
  <!-- Temple Header -->
  <Section title="" customClass="temple-section">
    <div class="temple-header">
      <h3 class="temple-name">{templeInfo.name}</h3>
      <p class="temple-description">{templeInfo.description}</p>
    </div>
  </Section>

  <!-- Action Banner -->
  <Section title="" customClass="action-banner-section">
    <div class="action-banner" style="background: {currentPlayer?.color || '#d97706'};">
      Choose an upgrade to build.
    </div>
  </Section>

  <!-- Stats Display -->
  <Section title="">
    <div class="stat-display">
      <div class="stat-item">
        <div class="stat-value">{movesRemaining} <span class="symbol">{@html SYMBOLS.MOVES}</span></div>
        <div class="stat-label">moves</div>
      </div>
      <div class="stat-item">
        <div class="stat-value">{currentFaith} <span class="symbol">{@html SYMBOLS.FAITH}</span></div>
        <div class="stat-label">faith</div>
      </div>
    </div>
  </Section>

  <!-- Upgrade Options -->
  <Section title="" flex={true} flexDirection="column" gap="8px" customClass="flex-1 upgrade-options-section">
    {#each availableOptions as option}
      <button
        class="upgrade-option"
        class:disabled={!option.canAfford}
        disabled={!option.canAfford}
        on:click={() => handlePurchase(option.upgrade.index)}
      >
        <div class="option-header">
          <span class="option-name">{option.displayName}</span>
          <span class="option-cost">({option.cost}{@html SYMBOLS.FAITH})</span>
        </div>
        <div class="option-description">{option.description}</div>
      </button>
    {/each}
  </Section>

  <!-- Done Button -->
  <Section title="">
    <Button variant="secondary" size="lg" uppercase on:click={handleDone}>
      Done
    </Button>
  </Section>

</Panel>

<style>
  /* Main container */
  :global(.game-info-panel) {
    width: 280px;
    height: 100vh;
    background: linear-gradient(135deg, rgba(30, 41, 59, 0.95), rgba(15, 23, 42, 0.95));
    border: 1px solid var(--border-light, #374151);
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  /* Temple Header Section */
  :global(.temple-section) {
    background: rgba(15, 23, 42, 0.6);
    border-bottom: 1px solid var(--border-light, #374151);
  }

  .temple-header {
    text-align: center;
    padding: var(--space-3, 12px);
  }

  .temple-name {
    font-size: var(--text-lg, 1.125rem);
    font-weight: var(--font-bold, bold);
    color: var(--text-primary, #f7fafc);
    margin: 0 0 4px 0;
  }

  .temple-description {
    font-size: var(--text-sm, 0.875rem);
    color: var(--text-secondary, #cbd5e1);
    margin: 0;
  }

  /* Action Banner */
  :global(.action-banner-section) {
    padding: 0 !important;
  }

  .action-banner {
    padding: var(--space-3, 12px);
    text-align: center;
    font-weight: var(--font-semibold, 600);
    color: var(--text-primary, #f7fafc);
    font-size: var(--text-base, 1rem);
    text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.5);
  }

  /* Stats Display */
  .stat-display {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--space-2, 8px);
  }

  .stat-item {
    text-align: center;
    padding: var(--space-2, 8px);
    background: rgba(15, 23, 42, 0.4);
    border-radius: var(--radius-sm, 4px);
  }

  .stat-value {
    font-size: var(--text-xl, 1.25rem);
    font-weight: var(--font-bold, bold);
    color: var(--text-primary, #f7fafc);
    margin-bottom: 2px;
  }

  .stat-value .symbol {
    font-size: 0.8em;
    opacity: 0.7;
    margin-left: 2px;
  }

  .stat-label {
    font-size: var(--text-xs, 0.75rem);
    color: var(--text-secondary, #94a3b8);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  /* Upgrade Options */
  :global(.upgrade-options-section) {
    overflow-y: auto;
  }

  .upgrade-option {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
    padding: var(--space-3, 12px);
    background: rgba(15, 23, 42, 0.6);
    border: 2px solid rgba(100, 116, 139, 0.3);
    border-radius: var(--radius-md, 6px);
    cursor: pointer;
    transition: all 0.2s ease;
    text-align: left;
    width: 100%;
  }

  .upgrade-option:hover:not(.disabled) {
    background: rgba(96, 165, 250, 0.1);
    border-color: var(--border-accent, #60a5fa);
    transform: translateY(-1px);
  }

  .upgrade-option.disabled {
    opacity: 0.5;
    cursor: not-allowed;
    background: rgba(15, 23, 42, 0.3);
  }

  .option-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 100%;
    gap: var(--space-2, 8px);
  }

  .option-name {
    font-weight: var(--font-semibold, 600);
    color: var(--text-primary, #f7fafc);
    font-size: var(--text-sm, 0.875rem);
  }

  .option-cost {
    font-weight: var(--font-bold, bold);
    color: var(--accent-primary, #fbbf24);
    font-size: var(--text-sm, 0.875rem);
  }

  .option-description {
    font-size: var(--text-xs, 0.75rem);
    color: var(--text-secondary, #cbd5e1);
    line-height: 1.3;
  }

  /* Flex section override */
  :global(.flex-1) {
    flex: 1;
    overflow-y: auto;
  }
</style>

