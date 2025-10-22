<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import type { Region, GameStateData, Soldier } from '$lib/game/entities/gameTypes';
  import { smokeStore } from '$lib/client/stores/smokeStore';

  export let x: number;
  export let y: number;
  export let hasTemple: boolean = false;
  export let gameState: GameStateData | null = null;
  export let regions: Region[] = [];
  export let region: Region;

  const MAX_INDIVIDUAL_ARMIES = 16;
  const ARMIES_PER_ROW = 8;
  let hiddenSoldierIds = new Set<number>(); // Track soldiers hidden during battle animation
  let isBattleInProgress = false; // Track if we're currently processing battle casualties
  let battleEndTimer: number | null = null; // Timer to clear battle state after animation

  // Get soldiers for this region
  $: allSoldiers = getSoldiersToRender(gameState, region.index);

  // For display purposes, use visible count (excluding hidden soldiers during battle)
  $: visibleCount = allSoldiers.filter(s => !hiddenSoldierIds.has(s.i)).length;
  $: actualSoldierCount = visibleCount;
  $: showIndividualArmies = actualSoldierCount > 0 && actualSoldierCount <= MAX_INDIVIDUAL_ARMIES;
  $: showCountBadge = actualSoldierCount > MAX_INDIVIDUAL_ARMIES;
  $: templeOffset = hasTemple ? 15 : 0;

  // Get soldiers that should be rendered at this region
  // IMPORTANT: Soldiers with attackedRegion or movingToRegion stay rendered at their
  // SOURCE region during animation, even if they're positioned elsewhere visually
  function getSoldiersToRender(state: GameStateData | null, regionIndex: number): Soldier[] {
    if (!state?.soldiersByRegion) return [];

    const soldiersAtRegion = state.soldiersByRegion[regionIndex] || [];

    // Deduplicate soldiers by ID to prevent Svelte keying errors
    // This can happen during state transitions when the same soldier might appear twice
    const seenIds = new Set<number>();
    const uniqueSoldiers = soldiersAtRegion.filter(soldier => {
      if (seenIds.has(soldier.i)) {
        console.warn(`⚠️ Duplicate soldier ID ${soldier.i} detected in region ${regionIndex}, skipping`);
        return false;
      }
      seenIds.add(soldier.i);
      return true;
    });

    // During animation, render all soldiers (including those moving away)
    // The positioning logic will handle where they appear visually
    return uniqueSoldiers;
  }

  interface SoldierPosition {
    soldier: Soldier;
    x: number;
    y: number;
    isAttacking: boolean;
  }

  // Calculate positions for ALL soldiers (including hidden ones for smoke placement)
  $: soldierPositions = calculateSoldierPositions(allSoldiers, region, regions);

  // Filter to visible soldiers for rendering
  $: visibleSoldierPositions = soldierPositions.filter(p => !hiddenSoldierIds.has(p.soldier.i));

  function calculateSoldierPositions(
    soldiersList: Soldier[],
    regionData: Region,
    allRegions: Region[]
  ): SoldierPosition[] {
    if (!soldiersList.length) {
      return [];
    }

    const positions: SoldierPosition[] = [];
    const totalSoldiers = soldiersList.length;

    // Group soldiers by destination for proper indexing
    const soldiersMovingToTarget = new Map<number, Soldier[]>();
    const soldiersStayingHere: Soldier[] = [];

    soldiersList.forEach(s => {
      const dest = (s as any).movingToRegion;
      if (dest !== undefined && dest !== regionData.index) {
        if (!soldiersMovingToTarget.has(dest)) {
          soldiersMovingToTarget.set(dest, []);
        }
        soldiersMovingToTarget.get(dest)!.push(s);
      } else {
        soldiersStayingHere.push(s);
      }
    });

    soldiersList.forEach((soldier, index) => {
      // Check if soldier is moving to a different region
      const movingTo = (soldier as any).movingToRegion;
      if (movingTo !== undefined && movingTo !== regionData.index) {
        // Soldier is moving - position it at the target region
        const targetRegion = allRegions.find(r => r.index === movingTo);
        if (targetRegion) {
          // Get soldiers already at target + soldiers moving there
          const targetSoldierCount = gameState?.soldiersByRegion?.[movingTo]?.length || 0;
          const movingToThisTarget = soldiersMovingToTarget.get(movingTo) || [];
          const indexInMovingGroup = movingToThisTarget.indexOf(soldier);

          // Position after existing soldiers at target
          const finalIndex = targetSoldierCount + indexInMovingGroup;
          const finalTotal = targetSoldierCount + movingToThisTarget.length;
          // Pass target region's temple status to get correct positioning
          const targetHasTemple = targetRegion.hasTemple;
          const targetPos = calculateSoldierBasePosition(finalIndex, finalTotal, targetRegion, targetHasTemple);

          console.log(`🎯 Region ${regionData.index} soldier ${soldier.i} moving to ${movingTo}: positioned at ${finalIndex}/${finalTotal} at (${targetPos.x}, ${targetPos.y})`);

          positions.push({
            soldier,
            x: targetPos.x,
            y: targetPos.y,
            isAttacking: false
          });
          return;
        }
      }

      // Soldier is staying at this region
      // Just use the simple approach - position based on current index and count
      const basePos = calculateSoldierBasePosition(index, totalSoldiers, regionData);

      if (soldiersMovingToTarget.size > 0) {
        console.log(`🏠 Region ${regionData.index} soldier ${soldier.i} staying: positioned at ${index}/${totalSoldiers} at (${basePos.x}, ${basePos.y})`);
      }

      // If soldier has attackedRegion property, position halfway to target (battle)
      if (soldier.attackedRegion !== undefined && soldier.attackedRegion !== regionData.index) {
        const targetRegion = allRegions.find(r => r.index === soldier.attackedRegion);
        if (targetRegion) {
          positions.push({
            soldier,
            x: (basePos.x + targetRegion.x) / 2,
            y: (basePos.y + targetRegion.y) / 2,
            isAttacking: true
          });
          return;
        }
      }

      // Normal position at this region
      positions.push({
        soldier,
        x: basePos.x,
        y: basePos.y,
        isAttacking: false
      });
    });

    return positions;
  }

  function calculateSoldierBasePosition(index: number, totalSoldiers: number, regionData: Region, hasTempleAtRegion?: boolean): { x: number; y: number } {
    const row = Math.floor(index / ARMIES_PER_ROW);
    const col = index % ARMIES_PER_ROW;
    const offsetX = (col - (Math.min(totalSoldiers, ARMIES_PER_ROW) - 1) / 2) * 4;

    // Use provided temple status, or default to current region's temple status
    const regionTempleOffset = hasTempleAtRegion !== undefined
      ? (hasTempleAtRegion ? 15 : 0)
      : templeOffset;

    const offsetY = row * 3 + regionTempleOffset;

    return {
      x: regionData.x + offsetX,
      y: regionData.y + offsetY
    };
  }

  function spawnSmokeAt(x: number, y: number, isAttacker: boolean = false) {
    console.log(`💨 Region ${region.index}: Spawning smoke at (${x}, ${y}), isAttacker: ${isAttacker}`);
    smokeStore.spawnAt(x, y);
  }

  // Handle battle casualty events (incrementally hide soldiers during battle)
  function handleBattleCasualties(event: CustomEvent) {
    const { sourceRegion, targetRegion, attackerCasualties, defenderCasualties } = event.detail;
    console.log(`💨 Region ${region.index}: Received battleCasualties event - source=${sourceRegion}, target=${targetRegion}, A=${attackerCasualties}, D=${defenderCasualties}`);

    // Mark that we're in a battle (prevents premature clearing of hidden soldiers)
    const isInvolvedInBattle = (sourceRegion === region.index && attackerCasualties > 0) ||
                                (targetRegion === region.index && defenderCasualties > 0);

    if (isInvolvedInBattle) {
      isBattleInProgress = true;

      // Clear any existing battle end timer
      if (battleEndTimer !== null) {
        clearTimeout(battleEndTimer);
      }

      // Schedule battle end after a delay (matching animation duration + buffer)
      // This timer resets with each new casualty event, ensuring we wait until ALL casualties are done
      battleEndTimer = setTimeout(() => {
        isBattleInProgress = false;
        battleEndTimer = null;
      }, 2000) as unknown as number; // 500ms per round delay, plus buffer
    }

    // Handle attacker casualties if this is the source region
    if (sourceRegion === region.index && attackerCasualties > 0) {
      const visibleSoldiers = soldierPositions.filter(p => !hiddenSoldierIds.has(p.soldier.i));

      for (let i = 0; i < attackerCasualties && i < visibleSoldiers.length; i++) {
        const casualty = visibleSoldiers[visibleSoldiers.length - 1 - i];
        // Hide soldier and spawn smoke simultaneously
        hiddenSoldierIds = new Set([...hiddenSoldierIds, casualty.soldier.i]);
        spawnSmokeAt(casualty.x, casualty.y, true);
      }
    }

    // Handle defender casualties if this is the target region
    if (targetRegion === region.index && defenderCasualties > 0) {
      const visibleSoldiers = soldierPositions.filter(p => !hiddenSoldierIds.has(p.soldier.i));

      for (let i = 0; i < defenderCasualties && i < visibleSoldiers.length; i++) {
        const casualty = visibleSoldiers[visibleSoldiers.length - 1 - i];
        // Hide soldier and spawn smoke simultaneously
        hiddenSoldierIds = new Set([...hiddenSoldierIds, casualty.soldier.i]);
        spawnSmokeAt(casualty.x, casualty.y);
      }
    }
  }

  onMount(() => {
    if (typeof window !== 'undefined') {
      window.addEventListener('battleCasualties', handleBattleCasualties as EventListener);
    }
  });

  onDestroy(() => {
    if (typeof window !== 'undefined') {
      window.removeEventListener('battleCasualties', handleBattleCasualties as EventListener);
    }

    // Clear battle end timer
    if (battleEndTimer !== null) {
      clearTimeout(battleEndTimer);
    }

    // Clear hidden soldiers when component unmounts
    hiddenSoldierIds.clear();
  });

  // Clear hidden soldiers when battle ends and state updates
  // Only clear when we receive a fresh game state update (actual soldiers are gone from data)
  $: if (gameState && hiddenSoldierIds.size > 0 && !isBattleInProgress) {
    const soldiersWithAttackedRegion = allSoldiers.filter(s => (s as any).attackedRegion !== undefined);

    // Check if any hidden soldiers still exist in the current game state
    const hiddenStillExist = Array.from(hiddenSoldierIds).some(hiddenId =>
      allSoldiers.some(s => s.i === hiddenId)
    );

    // Only clear if:
    // 1. No attacking soldiers (battle animation done)
    // 2. Hidden soldiers no longer exist in game state (server confirmed they're dead)
    if (soldiersWithAttackedRegion.length === 0 && !hiddenStillExist) {
      hiddenSoldierIds = new Set();
    }
  }
</script>

<!-- Army rendering -->
{#if showCountBadge}
  <!-- Show count for large armies -->
  <circle
    cx={x}
    cy={y + templeOffset}
    r="10"
    fill="rgba(0,0,0,0.7)"
    stroke="#fbfbf4"
    stroke-width="1"
  />
  <text
    x={x}
    y={y + templeOffset + 3}
    text-anchor="middle"
    font-size="10"
    font-weight="bold"
    fill="#fbfbf4"
  >
    {actualSoldierCount}
  </text>
{:else if showIndividualArmies}
  <!-- Show individual army markers with smooth positioning -->
  {#each visibleSoldierPositions as { soldier, x: soldierX, y: soldierY, isAttacking } (soldier.i)}
    <circle
      cx={soldierX}
      cy={soldierY}
      r="2.5"
      fill="#fbfbf4"
      stroke={isAttacking ? "#ff0000" : "#333"}
      stroke-width={isAttacking ? "0.5" : "0.3"}
      style="transition: cx 0.6s ease-in-out, cy 0.6s ease-in-out, stroke 0.3s ease-in-out;"
    />
  {/each}
{/if}

<style>
  /* Army count styling */
  text {
    font-family: 'Arial', sans-serif;
    text-shadow: 1px 1px 2px rgba(0,0,0,0.8);
  }

  circle {
    filter: drop-shadow(0 1px 1px rgba(0,0,0,0.3));
  }
</style>
