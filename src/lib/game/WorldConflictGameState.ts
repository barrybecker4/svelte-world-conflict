import { assignHomeBaseRegions, createOwnerAssignments } from '$lib/game/data/map/homeBasePlacement';
import type { Player, WorldConflictGameStateData } from '$lib/game/gameTypes';

export class WorldConflictGameState {
    // ... other methods remain the same ...

    private initializeStartingPositions(): void {
        console.log('🎮 Initializing game starting positions...');

        // Initialize cash for all players
        this.state.players.forEach((player) => {
            this.state.cash[player.index] = 100;
        });

        // IMPORTANT: Clear any existing soldiers - start fresh
        this.state.soldiersByRegion = {};

        // First, set up ALL temple regions (both neutral and player-owned)
        this.state.regions.forEach(region => {
            if (region.hasTemple) {
                // Add temple structure
                this.state.temples[region.index] = {
                    regionIndex: region.index,
                    level: 0
                };

                // Add exactly 3 soldiers to ALL temple regions
                this.addSoldiers(region.index, 3);
            }
        });

        // Use the extracted home base assignment utility
        const homeBaseAssignments = assignHomeBaseRegions(this.state.players, this.state.regions);
        
        // Apply the assignments to game state
        const owners = createOwnerAssignments(homeBaseAssignments);
        this.state.owners = { ...this.state.owners, ...owners };

        // Log the results
        homeBaseAssignments.forEach(assignment => {
            const player = this.state.players[assignment.playerIndex];
            console.log(`✅ Player ${player.index} (${player.name}) assigned home region ${assignment.regionIndex} (${assignment.region.name}) with temple`);
        });

        // Validation logging
        console.log('🏁 Game initialization complete:');
        console.log(`   📍 Players with home regions: ${Object.keys(this.state.owners).length}`);
        console.log(`   🏛️  Total temple regions: ${Object.keys(this.state.temples).length}`);
        console.log(`   ⚔️  Total soldiers placed: ${Object.values(this.state.soldiersByRegion).reduce((sum, soldiers) => sum + soldiers.length, 0)}`);
        
        // Ensure the game has valid starting conditions
        if (homeBaseAssignments.length < this.state.players.length) {
            console.warn(`⚠️ Warning: Only ${homeBaseAssignments.length} out of ${this.state.players.length} players have home regions!`);
        }
    }

    // ... rest of class remains the same ...
}
