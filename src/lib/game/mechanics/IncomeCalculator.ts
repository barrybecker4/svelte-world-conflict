import type { GameState, Player } from '$lib/game/state/GameState';
import { Temple } from '$lib/game/entities/Temple';

/**
 * Calculates faith income for a player based on their controlled regions and temples.
 * 
 * Faith income rules:
 * 1. One faith for each region owned
 * 2. One faith for each soldier stationed at owned temples (soldiers praying)
 * 3. Water temples provide percentage bonus to total income
 */
export class IncomeCalculator {
    /**
     * Calculate the total faith income for a player
     * @param state The current game state
     * @param player The player to calculate income for
     * @returns The total faith income amount
     */
    static calculateIncome(state: GameState, player: Player): number {
        const regionCount = state.regionCount(player);
        console.log(`Player ${player.slotIndex} owns ${regionCount} regions`);

        // Calculate soldiers praying at temples (soldiers stationed at temple regions owned by player)
        const soldiersAtTemples = this.countSoldiersPrayingAtTemples(state, player);

        const baseIncome = regionCount + soldiersAtTemples;
        
        // Apply Water temple percentage bonuses
        const waterBonusPercent = this.calculateWaterTempleBonus(state, player);
        
        const totalIncome = Math.floor(baseIncome * (1 + waterBonusPercent / 100));
        console.log(
            `Player ${player.slotIndex} faith income: ${regionCount} regions + ${soldiersAtTemples} soldiers at temples = ${baseIncome} base faith, +${waterBonusPercent}% from Water temples = ${totalIncome} total faith`
        );

        return totalIncome;
    }

    /**
     * Count soldiers stationed at temples owned by the player
     * @param state The current game state
     * @param player The player to count soldiers for
     * @returns The number of soldiers praying at temples
     */
    private static countSoldiersPrayingAtTemples(state: GameState, player: Player): number {
        let soldiersAtTemples = 0;

        // Iterate through all regions to find owned temple regions
        for (const regionIndex in state.templesByRegion) {
            const regionIdx = parseInt(regionIndex);
            const temple = state.templesByRegion[regionIdx];

            // Check if player owns this temple region
            if (temple && state.isOwnedBy(regionIdx, player)) {
                // Count soldiers at this temple region
                const soldiers = state.soldiersByRegion[regionIdx];
                if (soldiers && soldiers.length > 0) {
                    // All soldiers at owned temple regions generate faith
                    soldiersAtTemples += soldiers.length;
                    console.log(
                        `Player ${player.slotIndex} has ${soldiers.length} soldiers praying at temple region ${regionIdx}`
                    );
                }
            }
        }

        return soldiersAtTemples;
    }

    /**
     * Calculate total Water temple income bonus percentage
     * @param state The current game state
     * @param player The player to calculate bonus for
     * @returns The total percentage bonus from Water temples
     */
    private static calculateWaterTempleBonus(state: GameState, player: Player): number {
        let waterBonusPercent = 0;

        for (const regionIndex in state.templesByRegion) {
            const regionIdx = parseInt(regionIndex);
            const templeData = state.templesByRegion[regionIdx];
            
            if (templeData && state.isOwnedBy(regionIdx, player)) {
                const temple = Temple.deserialize(templeData);
                const incomeBonus = temple.getIncomeBonus();
                if (incomeBonus > 0) {
                    waterBonusPercent += incomeBonus;
                    console.log(
                        `Player ${player.slotIndex} has Water temple at region ${regionIdx} with ${incomeBonus}% bonus`
                    );
                }
            }
        }

        return waterBonusPercent;
    }
}

