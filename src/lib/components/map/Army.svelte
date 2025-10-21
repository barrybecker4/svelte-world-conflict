<script lang="ts">
  import type { Region, GameStateData, Soldier } from '$lib/game/entities/gameTypes';

  export let x: number;
  export let y: number;
  export let hasTemple: boolean = false;
  export let gameState: GameStateData | null = null;
  export let regions: Region[] = [];
  export let region: Region;

  const MAX_INDIVIDUAL_ARMIES = 16;
  const ARMIES_PER_ROW = 8;

  // Get soldiers for this region:
  // - All soldiers physically at this region
  // - But EXCLUDE any that are currently animating away (they'll be rendered at their source)
  $: soldiers = getSoldiersToRender(gameState, region.index);
  $: actualSoldierCount = soldiers.length;
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

  // Calculate positions for each soldier
  $: soldierPositions = calculateSoldierPositions(soldiers, region, regions);

  function calculateSoldierPositions(
    soldiersList: Soldier[],
    regionData: Region,
    allRegions: Region[]
  ): SoldierPosition[] {
    if (!soldiersList.length) {
      return [];
    }

    const positions: SoldierPosition[] = [];

    soldiersList.forEach((soldier, index) => {
      const basePos = calculateSoldierBasePosition(index, soldiersList.length, regionData);
      
      // Check for movingToRegion (peaceful move - full distance)
      // Only apply if soldier is NOT already at the target region
      if ((soldier as any).movingToRegion !== undefined && (soldier as any).movingToRegion !== regionData.index) {
        const targetRegion = allRegions.find(r => r.index === (soldier as any).movingToRegion);
        if (targetRegion) {
          // Check if target region has a temple (for proper vertical offset)
          const targetHasTemple = gameState?.templesByRegion?.[targetRegion.index] !== undefined;
          
          // Calculate where this soldier will be positioned at the target
          // Use the same index to maintain spacing/formation
          const targetPos = calculateSoldierBasePosition(index, soldiersList.length, targetRegion, targetHasTemple);
          
          positions.push({
            soldier,
            x: targetPos.x,
            y: targetPos.y,
            isAttacking: false
          });
          return;
        }
      }
      
      // If soldier has attackedRegion property, position halfway to target (battle)
      // Only apply if soldier is NOT already at the attacked region
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
      
      // Normal position
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
  {#each soldierPositions as { soldier, x: soldierX, y: soldierY, isAttacking } (soldier.i)}
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
