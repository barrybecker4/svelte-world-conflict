import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.ts';
import {
    WorldConflictKVStorage,
    WorldConflictGameStorage, type WorldConflictGameRecord,
} from '$lib/storage/world-conflict/index.ts';
import type { Player, Region } from '$lib/game/WorldConflictGameState.ts';
import { generateGameId, generatePlayerId, createPlayer, getErrorMessage } from "$lib/server/api-utils.ts";

// Generate connected map based on the correct size configuration
function generateConnectedMap(size: 'Small' | 'Medium' | 'Large'): Region[] {
    // Correct region counts matching the original game
    const regionCounts = {
        'Small': 15,
        'Medium': 20,
        'Large': 25
    };

    const targetRegions = regionCounts[size];
    const regions: Region[] = [];

    // Calculate grid dimensions based on target regions
    const gridWidth = Math.ceil(Math.sqrt(targetRegions * 1.2)); // Slightly wider than square
    const gridHeight = Math.ceil(targetRegions / gridWidth);

    const mapWidth = 800;
    const mapHeight = 600;
    const cellWidth = mapWidth / (gridWidth + 1);
    const cellHeight = mapHeight / (gridHeight + 1);

    // Fantasy region names for immersion
    const regionNames = [
        'Northwind Keep', 'Ironforge', 'Silverpine', 'Goldmeadow', 'Stormhaven', 'Dragonspire',
        'Thornwood', 'Mistmoor', 'Sunhallow', 'Darkfell', 'Brightwater', 'Shadowmere',
        'Roseheart', 'Wolfsburg', 'Eaglecrest', 'Lionhold', 'Ravenshollow', 'Swiftwater',
        'Ironwood', 'Goldhill', 'Silverbrook', 'Redstone', 'Greendale', 'Blackwater',
        'Whitehaven', 'Greyrock', 'Bluewater', 'Fairwind', 'Stronghold', 'Freeport',
        'Ravenscroft', 'Goldspire', 'Silverfall', 'Ironmoor', 'Greenhill'
    ];

    // Create exactly the target number of regions
    let regionIndex = 0;
    for (let row = 0; row < gridHeight && regionIndex < targetRegions; row++) {
        for (let col = 0; col < gridWidth && regionIndex < targetRegions; col++) {
            // Add position variation to make it look natural
            const baseX = (col + 1) * cellWidth;
            const baseY = (row + 1) * cellHeight;
            const offsetX = (Math.random() - 0.5) * cellWidth * 0.3;
            const offsetY = (Math.random() - 0.5) * cellHeight * 0.3;

            regions.push({
                index: regionIndex,
                name: regionNames[regionIndex] || `Region ${regionIndex + 1}`,
                x: Math.round(baseX + offsetX),
                y: Math.round(baseY + offsetY),
                neighbors: [],
                hasTemple: Math.random() < 0.3 // 30% chance of temple
            });

            regionIndex++;
        }
    }

    // Connect neighbors based on grid proximity
    for (let i = 0; i < regions.length; i++) {
        const region = regions[i];
        const row = Math.floor(i / gridWidth);
        const col = i % gridWidth;

        // Cardinal directions
        const neighbors = [
            row > 0 ? (row - 1) * gridWidth + col : -1,           // North
            row < gridHeight - 1 ? (row + 1) * gridWidth + col : -1, // South
            col > 0 ? row * gridWidth + (col - 1) : -1,           // West
            col < gridWidth - 1 ? row * gridWidth + (col + 1) : -1   // East
        ];

        // Add some diagonal connections for variety (but not too many)
        if (Math.random() < 0.3) {
            if (row > 0 && col > 0 && (row - 1) * gridWidth + (col - 1) < regions.length) {
                neighbors.push((row - 1) * gridWidth + (col - 1)); // NW
            }
        }
        if (Math.random() < 0.3) {
            if (row > 0 && col < gridWidth - 1 && (row - 1) * gridWidth + (col + 1) < regions.length) {
                neighbors.push((row - 1) * gridWidth + (col + 1)); // NE
            }
        }

        // Add valid neighbors
        for (const neighborIndex of neighbors) {
            if (neighborIndex >= 0 && neighborIndex < regions.length) {
                if (!region.neighbors.includes(neighborIndex)) {
                    region.neighbors.push(neighborIndex);
                }
                // Ensure bidirectional connection
                if (!regions[neighborIndex].neighbors.includes(i)) {
                    regions[neighborIndex].neighbors.push(i);
                }
            }
        }
    }

    // Ensure minimum connectivity (each region should have at least 2 neighbors)
    regions.forEach(region => {
        if (region.neighbors.length < 2) {
            // Find closest unconnected regions
            const distances = regions
                .map((other, idx) => ({
                    index: idx,
                    distance: Math.sqrt(
                        Math.pow(region.x - other.x, 2) + Math.pow(region.y - other.y, 2)
                    )
                }))
                .filter(d => d.index !== region.index && !region.neighbors.includes(d.index))
                .sort((a, b) => a.distance - b.distance);

            // Connect to closest regions until we have at least 2 neighbors
            for (let i = 0; i < distances.length && region.neighbors.length < 3; i++) {
                const newNeighbor = distances[i].index;
                region.neighbors.push(newNeighbor);
                regions[newNeighbor].neighbors.push(region.index);
            }
        }
    });

    console.log(`🗺️  Generated ${size} map: ${regions.length} regions, avg ${(regions.reduce((sum, r) => sum + r.neighbors.length, 0) / regions.length).toFixed(1)} neighbors per region`);

    return regions;
}

// Proper game state initialization with EXACTLY 1 home base per player
function initializeWorldConflictGame(
    gameId: string,
    players: Player[],
    regions: Region[]
): any {
    const numRegions = regions.length;
    const numPlayers = players.length;

    // Initialize all regions as neutral (-1 means unoccupied)
    const owners: { [key: number]: number } = {};
    const soldiersByRegion: { [key: number]: any[] } = {};
    const cash: { [key: number]: number } = {};

    // Initialize cash for each player
    players.forEach((player, index) => {
        cash[index] = 0;
    });

    // Give each player EXACTLY 1 starting region (home base)
    const assignedRegions = new Set<number>();

    players.forEach((player, playerIndex) => {
        // Find regions with temples for home bases (more strategic)
        const templeRegions = regions
            .filter(region => region.hasTemple && !assignedRegions.has(region.index))
            .sort(() => Math.random() - 0.5); // Randomize

        // If not enough temple regions, use any available regions
        const availableRegions = templeRegions.length > 0
            ? templeRegions
            : regions.filter(region => !assignedRegions.has(region.index));

        // Assign EXACTLY 1 home base per player
        if (availableRegions.length > 0) {
            const homeRegion = availableRegions[0];
            owners[homeRegion.index] = playerIndex;
            assignedRegions.add(homeRegion.index);

            // Give starting armies (typically 2-3)
            const startingArmies = 2 + Math.floor(Math.random() * 2); // 2-3 armies
            soldiersByRegion[homeRegion.index] = new Array(startingArmies).fill(null).map((_, idx) => ({
                i: Math.floor(Math.random() * 1000000000000000) // Random ID like the original
            }));

            console.log(`🏰 Player ${player.name} starts at ${homeRegion.name} with ${startingArmies} armies`);
        }
    });

    // All unoccupied regions get 1 neutral army and no owner
    for (let i = 0; i < numRegions; i++) {
        if (!owners.hasOwnProperty(i)) {
            // Leave owners[i] undefined for neutral regions
            soldiersByRegion[i] = [{
                i: Math.floor(Math.random() * 1000000000000000) // Neutral army
            }];
        }
    }

    const occupiedCount = Object.keys(owners).length;
    const neutralCount = numRegions - occupiedCount;

    console.log(`📊 Game initialized: ${occupiedCount} player home bases, ${neutralCount} neutral regions`);
    console.log(`📊 Expected: ${numPlayers} home bases (1 per player), ${numRegions - numPlayers} neutral regions`);

    return {
        turnIndex: 1,
        playerIndex: 0,
        movesRemaining: 3,
        owners,
        temples: {}, // Initialize empty temples object
        soldiersByRegion,
        cash,
        id: Math.floor(Math.random() * 1000000000),
        gameId,
        players,
        regions,
        conqueredRegions: [],
        floatingText: []
    };
}

interface NewGameRequest {
    playerName: string;
    gameType?: 'MULTIPLAYER' | 'AI';
    mapSize?: 'Small' | 'Medium' | 'Large';
}

export const POST: RequestHandler = async ({ request, platform }) => {
    try {
        const { playerName, gameType = 'MULTIPLAYER', mapSize = 'Medium' } = await request.json() as NewGameRequest;

        console.log(`🎯 NEW GAME REQUEST: Player "${playerName}" wants ${gameType} game (${mapSize} map)`);

        if (!playerName) {
            return json({ error: 'Player name required' }, { status: 400 });
        }

        const kv = new WorldConflictKVStorage(platform!);
        const gameStorage = new WorldConflictGameStorage(kv);

        // Generate connected map with correct size configuration
        const regions = generateConnectedMap(mapSize);

        // Verify we got the right number of regions
        const expectedCounts = { 'Small': 15, 'Medium': 20, 'Large': 25 };
        const expectedCount = expectedCounts[mapSize];
        console.log(`🗺️  Map generation: Expected ${expectedCount} regions, got ${regions.length}`);

        // Create players
        const players: Player[] = [
            createPlayer(playerName, 0, false)
        ];

        // Add AI players for AI games
        if (gameType === 'AI') {
            players.push(
                createPlayer('AI Warrior', 1, true),
                createPlayer('AI Strategist', 2, true)
            );
        }

        const gameId = generateGameId();
        const status = gameType === 'AI' ? 'ACTIVE' : 'PENDING';

        // Create proper initial game state
        const worldConflictState = initializeWorldConflictGame(gameId, players, regions);

        const newGame: WorldConflictGameRecord = {
            gameId,
            players,
            status: status as 'PENDING' | 'ACTIVE' | 'COMPLETED',
            createdAt: Date.now(),
            lastMoveAt: Date.now(),
            currentPlayerIndex: 0,
            gameType: gameType as 'MULTIPLAYER' | 'AI', // Ensure this field exists
            worldConflictState
        };

        await gameStorage.saveGame(newGame);

        console.log(`✅ Created new ${gameType} game ${gameId} for ${playerName}`);
        console.log(`   Map: ${mapSize} (${regions.length} regions)`);
        console.log(`   Players: ${players.length} (${Object.keys(worldConflictState.owners).length} home bases)`);
        console.log(`   Neutral regions: ${regions.length - Object.keys(worldConflictState.owners).length}`);

        return json({
            success: true,
            gameId,
            players: players.map(p => ({
                name: p.name,
                index: p.index,
                color: p.color,
                isAI: p.isAI
            })),
            playerIndex: 0,
            status,
            message: gameType === 'AI' ? 'Game started!' : 'Waiting for other players...'
        });

    } catch (error) {
        console.error('❌ Error creating new game:', error);
        return json({
            error: 'Failed to create game: ' + getErrorMessage(error)
        }, { status: 500 });
    }
};
