import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
    WorldConflictKVStorage,
    WorldConflictGameStorage,
    type WorldConflictGameRecord,
} from '$lib/storage/world-conflict/index';
import { WorldConflictGameState, type Player, type Region } from '$lib/game/WorldConflictGameState';
import { generateGameId, generatePlayerId, createPlayer, getErrorMessage } from "$lib/server/api-utils";

// Generate connected map based on the correct size configuration
function generateConnectedMap(size: 'Small' | 'Medium' | 'Large'): Region[] {
    // Correct region counts as specified in requirements
    const regionCounts = {
        'Small': 7,   // 5-7 regions
        'Medium': 15, // 10-20 regions
        'Large': 25   // 25-35 regions
    };

    const targetRegions = regionCounts[size];
    const regions: Region[] = [];

    // Calculate grid dimensions to prevent overlap
    const gridWidth = Math.ceil(Math.sqrt(targetRegions * 1.2)); // Slightly wider than square
    const gridHeight = Math.ceil(targetRegions / gridWidth);

    const mapWidth = 800;
    const mapHeight = 600;
    const cellWidth = mapWidth / (gridWidth + 1);
    const cellHeight = mapHeight / (gridHeight + 1);

    // Create exactly the target number of regions in non-overlapping positions
    let regionIndex = 0;
    for (let row = 0; row < gridHeight && regionIndex < targetRegions; row++) {
        for (let col = 0; col < gridWidth && regionIndex < targetRegions; col++) {
            // Calculate base position in grid
            const baseX = (col + 1) * cellWidth;
            const baseY = (row + 1) * cellHeight;

            // Add position variation to make it look natural while preventing overlap
            const offsetX = (Math.random() - 0.5) * cellWidth * 0.3;
            const offsetY = (Math.random() - 0.5) * cellHeight * 0.3;

            regions.push({
                index: regionIndex,
                name: `Region ${regionIndex + 1}`, // Names not displayed, but kept for compatibility
                x: Math.round(baseX + offsetX),
                y: Math.round(baseY + offsetY),
                neighbors: [],
                hasTemple: Math.random() < 0.3 // 30% chance of temple
            });

            regionIndex++;
        }
    }

    // Connect neighbors based on grid adjacency to ensure shared borders
    for (let i = 0; i < regions.length; i++) {
        const region = regions[i];
        const row = Math.floor(i / gridWidth);
        const col = i % gridWidth;

        // Add cardinal direction neighbors (ensuring adjacent regions share borders)
        const potentialNeighbors = [
            (row - 1) * gridWidth + col,     // North
            (row + 1) * gridWidth + col,     // South
            row * gridWidth + (col - 1),     // West
            row * gridWidth + (col + 1),     // East
        ];

        // Occasionally add diagonal neighbors for more interesting connectivity
        if (Math.random() < 0.4) {
            potentialNeighbors.push((row - 1) * gridWidth + (col - 1)); // NW
            potentialNeighbors.push((row - 1) * gridWidth + (col + 1)); // NE
        }

        if (Math.random() < 0.3) {
            potentialNeighbors.push((row + 1) * gridWidth + (col - 1)); // SW
            potentialNeighbors.push((row + 1) * gridWidth + (col + 1)); // SE
        }

        // Connect valid neighbors
        for (const neighborIndex of potentialNeighbors) {
            if (neighborIndex >= 0 && neighborIndex < regions.length && neighborIndex !== i) {
                const neighbor = regions[neighborIndex];
                const distance = Math.sqrt(
                    Math.pow(region.x - neighbor.x, 2) + Math.pow(region.y - neighbor.y, 2)
                );

                // Connect if within reasonable distance (ensures adjacency)
                if (distance < cellWidth * 1.4) {
                    if (!region.neighbors.includes(neighborIndex)) {
                        region.neighbors.push(neighborIndex);
                    }
                    if (!neighbor.neighbors.includes(i)) {
                        neighbor.neighbors.push(i);
                    }
                }
            }
        }
    }

    // Ensure all regions are connected (basic connectivity check)
    const visited = new Set<number>();
    const stack = [0]; // Start from first region

    while (stack.length > 0) {
        const current = stack.pop()!;
        if (visited.has(current)) continue;

        visited.add(current);
        const currentRegion = regions[current];

        for (const neighborIndex of currentRegion.neighbors) {
            if (!visited.has(neighborIndex)) {
                stack.push(neighborIndex);
            }
        }
    }

    // If not all regions are connected, add some random connections
    if (visited.size < regions.length) {
        const unconnected = regions.filter(r => !visited.has(r.index));

        for (const region of unconnected) {
            // Find closest connected region
            let closestDistance = Infinity;
            let closestConnected: Region | null = null;

            for (const connectedIndex of visited) {
                const connected = regions[connectedIndex];
                const distance = Math.sqrt(
                    Math.pow(region.x - connected.x, 2) + Math.pow(region.y - connected.y, 2)
                );

                if (distance < closestDistance) {
                    closestDistance = distance;
                    closestConnected = connected;
                }
            }

            // Connect to closest connected region
            if (closestConnected) {
                region.neighbors.push(closestConnected.index);
                closestConnected.neighbors.push(region.index);
                visited.add(region.index);
            }
        }
    }

    return regions;
}

interface NewGameRequest {
    players: Array<{
        name: string;
        type: string;
        index: number;
        isAI: boolean;
    }>;
    settings: {
        aiDifficulty: string;
        turns: number | string;
        timeLimit: number | string;
        mapSize: 'Small' | 'Medium' | 'Large';
    };
    regions?: Region[]; // Optional - we'll generate if not provided
}

export const POST: RequestHandler = async ({ request, platform }) => {
    try {
        const requestData = await request.json() as NewGameRequest;
        const { players: playerSetup, settings, regions: providedRegions } = requestData;

        console.log(`🎯 NEW GAME REQUEST: ${playerSetup.length} players, ${settings.mapSize} map`);

        if (!playerSetup || playerSetup.length < 2) {
            return json({ error: 'At least 2 players required' }, { status: 400 });
        }

        const kv = new WorldConflictKVStorage(platform!);
        const gameStorage = new WorldConflictGameStorage(kv);

        // Generate or use provided regions
        const regions = providedRegions || generateConnectedMap(settings.mapSize);

        console.log(`🗺️  Map: ${settings.mapSize} (${regions.length} regions)`);

        // Create players from setup
        const players: Player[] = playerSetup.map(p => createPlayer(p.name, p.index, p.isAI));

        const gameId = generateGameId();

        // Create proper initial game state using the correct method
        const gameState = WorldConflictGameState.createInitialState(gameId, players, regions);

        const newGame: WorldConflictGameRecord = {
            gameId,
            players,
            status: 'ACTIVE', // Start immediately with configured players
            createdAt: Date.now(),
            lastMoveAt: Date.now(),
            currentPlayerIndex: 0,
            gameType: 'MULTIPLAYER',
            worldConflictState: gameState.toJSON() // Convert to plain object for storage
        };

        await gameStorage.saveGame(newGame);

        // Return info for the human player (the one marked as 'Set')
        const humanPlayer = playerSetup.find(p => p.type === 'Set');
        const playerId = generatePlayerId();

        console.log(`✅ Created new game ${gameId}`);
        console.log(`   Players: ${players.length}`);
        console.log(`   Human player: ${humanPlayer?.name} (index ${humanPlayer?.index})`);
        console.log(`   Home regions assigned: ${Object.keys(gameState.owners).length}`);

        return json({
            success: true,
            gameId,
            playerId,
            playerIndex: humanPlayer?.index || 0,
            status: 'ACTIVE',
            message: 'Game created successfully!'
        });

    } catch (error) {
        console.error('❌ Error creating new game:', error);
        return json({
            error: 'Failed to create game: ' + getErrorMessage(error)
        }, { status: 500 });
    }
};
