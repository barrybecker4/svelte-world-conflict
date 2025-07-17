import { describe, it, expect, beforeEach } from 'vitest';
import { GameState, type GameStateData } from './GameState';
import { type Player, type Region, type Temple } from './types';

// Simple node environment test - no DOM utilities needed

// Mock game data for testing
const mockPlayers: Player[] = [
    { index: 0, name: 'Alice', color: '#ff6b6b', isAI: false },
    { index: 1, name: 'Bob', color: '#4ecdc4', isAI: false },
    { index: 2, name: 'Charlie', color: '#45b7d1', isAI: true, aiLevel: 2 },
    { index: 3, name: 'Diana', color: '#f9ca24', isAI: false }
];

const mockRegions: Region[] = [
    { index: 0, name: 'Northlands', neighbors: [1, 2], x: 100, y: 50, hasTemple: true },
    { index: 1, name: 'Eastlands', neighbors: [0, 2, 3], x: 150, y: 100, hasTemple: false },
    { index: 2, name: 'Southlands', neighbors: [0, 1, 3], x: 100, y: 150, hasTemple: true },
    { index: 3, name: 'Westlands', neighbors: [1, 2], x: 50, y: 100, hasTemple: false }
];

function createTestGameState(): GameState {
    const initialData: GameStateData = {
        turnIndex: 1,
        playerIndex: 0,
        movesRemaining: 3,
        owners: {
            0: 0, // Alice owns Northlands
            1: 1, // Bob owns Eastlands
            2: 2, // Charlie owns Southlands
            3: 3  // Diana owns Westlands
        },
        temples: {
            0: { regionIndex: 0, level: 0 }, // Basic temple in Northlands
            2: { regionIndex: 2, level: 1 }  // Advanced temple in Southlands
        },
        soldiersByRegion: {
            0: [{ i: 1001 }, { i: 1002 }, { i: 1003 }], // 3 soldiers in Northlands
            1: [{ i: 2001 }, { i: 2002 }],              // 2 soldiers in Eastlands
            2: [{ i: 3001 }, { i: 3002 }, { i: 3003 }, { i: 3004 }], // 4 soldiers in Southlands
            3: [{ i: 4001 }]                            // 1 soldier in Westlands
        },
        cash: {
            0: 50,  // Alice has 50 faith
            1: 30,  // Bob has 30 faith
            2: 75,  // Charlie has 75 faith
            3: 25   // Diana has 25 faith
        },
        id: 1,
        gameId: 'test-game-123'
    };

    return new GameState(initialData);
}

describe('GameState', () => {
    let gameState: GameState;

    beforeEach(() => {
        gameState = createTestGameState();
    });

    describe('Basic State Properties', () => {
        it('should initialize with correct basic properties', () => {
            expect(gameState.turnIndex).toBe(1);
            expect(gameState.playerIndex).toBe(0);
            expect(gameState.movesRemaining).toBe(3);
            expect(gameState.gameId).toBe('test-game-123');
            expect(gameState.id).toBe(1);
        });

        it('should return correct active player', () => {
            const activePlayer = gameState.activePlayer(mockPlayers);
            expect(activePlayer.name).toBe('Alice');
            expect(activePlayer.index).toBe(0);
        });
    });

    describe('Region Ownership', () => {
        it('should correctly identify region owners', () => {
            const northlandsOwner = gameState.owner(0, mockPlayers);
            expect(northlandsOwner?.name).toBe('Alice');

            const eastlandsOwner = gameState.owner(1, mockPlayers);
            expect(eastlandsOwner?.name).toBe('Bob');
        });

        it('should correctly check region ownership', () => {
            const alice = mockPlayers[0];
            const bob = mockPlayers[1];

            expect(gameState.isOwnedBy(0, alice)).toBe(true);
            expect(gameState.isOwnedBy(0, bob)).toBe(false);
            expect(gameState.isOwnedBy(1, bob)).toBe(true);
            expect(gameState.isOwnedBy(1, alice)).toBe(false);
        });

        it('should count regions correctly', () => {
            mockPlayers.forEach(player => {
                expect(gameState.regionCount(player)).toBe(1);
            });
        });

        it('should set and remove owners correctly', () => {
            const alice = mockPlayers[0];
            const bob = mockPlayers[1];

            // Transfer ownership
            gameState.setOwner(1, alice);
            expect(gameState.isOwnedBy(1, alice)).toBe(true);
            expect(gameState.regionCount(alice)).toBe(2);

            // Remove ownership
            gameState.setOwner(1, null);
            expect(gameState.owner(1, mockPlayers)).toBeNull();
        });
    });

    describe('Army Management', () => {
        it('should count soldiers correctly', () => {
            expect(gameState.soldierCount(0)).toBe(3); // Northlands
            expect(gameState.soldierCount(1)).toBe(2); // Eastlands
            expect(gameState.soldierCount(2)).toBe(4); // Southlands
            expect(gameState.soldierCount(3)).toBe(1); // Westlands
        });

        it('should add soldiers correctly', () => {
            const initialCount = gameState.soldierCount(0);
            gameState.addSoldiers(0, 2);
            expect(gameState.soldierCount(0)).toBe(initialCount + 2);
        });

        it('should remove soldiers correctly', () => {
            const initialCount = gameState.soldierCount(0);
            const removed = gameState.removeSoldiers(0, 1);

            expect(gameState.soldierCount(0)).toBe(initialCount - 1);
            expect(removed).toHaveLength(1);
            expect(removed[0]).toHaveProperty('i');
        });

        it('should transfer soldiers between regions', () => {
            const fromCount = gameState.soldierCount(0);
            const toCount = gameState.soldierCount(1);

            gameState.transferSoldiers(0, 1, 2);

            expect(gameState.soldierCount(0)).toBe(fromCount - 2);
            expect(gameState.soldierCount(1)).toBe(toCount + 2);
        });

        it('should calculate total soldiers for player', () => {
            const alice = mockPlayers[0];
            const totalSoldiers = gameState.totalSoldiers(alice, mockRegions);
            expect(totalSoldiers).toBe(3); // Only owns Northlands with 3 soldiers
        });
    });

    describe('Temple Management', () => {
        it('should get temple for region', () => {
            const northlandsTemple = gameState.templeForRegion(0);
            expect(northlandsTemple).toBeDefined();
            expect(northlandsTemple?.regionIndex).toBe(0);
            expect(northlandsTemple?.level).toBe(0);

            const eastlandsTemple = gameState.templeForRegion(1);
            expect(eastlandsTemple).toBeNull();
        });

        it('should get temples for player', () => {
            const alice = mockPlayers[0];
            const charlie = mockPlayers[2];

            const aliceTemples = gameState.templesForPlayer(alice);
            expect(aliceTemples).toHaveLength(1);
            expect(aliceTemples[0].regionIndex).toBe(0);

            const charlieTemples = gameState.templesForPlayer(charlie);
            expect(charlieTemples).toHaveLength(1);
            expect(charlieTemples[0].regionIndex).toBe(2);
        });

        it('should set and remove temples', () => {
            const newTemple: Temple = { regionIndex: 1, level: 0 };

            gameState.setTemple(1, newTemple);
            expect(gameState.templeForRegion(1)).toEqual(newTemple);

            gameState.removeTemple(1);
            expect(gameState.templeForRegion(1)).toBeNull();
        });
    });

    describe('Move Validation', () => {
        it('should validate moves from owned regions', () => {
            const alice = mockPlayers[0];
            const bob = mockPlayers[1];

            expect(gameState.canMoveFrom(0, alice)).toBe(true);  // Alice owns Northlands
            expect(gameState.canMoveFrom(0, bob)).toBe(false);   // Bob doesn't own Northlands
            expect(gameState.canMoveFrom(1, bob)).toBe(true);    // Bob owns Eastlands
        });

        it('should validate moves between adjacent regions', () => {
            const alice = mockPlayers[0];

            // Valid move: Northlands to Eastlands (adjacent)
            expect(gameState.canMoveTo(0, 1, alice, mockRegions)).toBe(true);

            // Invalid move: Northlands to Westlands (not adjacent)
            expect(gameState.canMoveTo(0, 3, alice, mockRegions)).toBe(false);
        });

        it('should not allow moves with no moves remaining', () => {
            const alice = mockPlayers[0];
            gameState.movesRemaining = 0;

            expect(gameState.canMoveFrom(0, alice)).toBe(false);
            expect(gameState.canMoveTo(0, 1, alice, mockRegions)).toBe(false);
        });
    });

    describe('Resource Management', () => {
        it('should get cash for player', () => {
            const alice = mockPlayers[0];
            expect(gameState.cashForPlayer(alice)).toBe(50);
        });

        it('should add cash to player', () => {
            const alice = mockPlayers[0];
            gameState.addCash(alice, 25);
            expect(gameState.cashForPlayer(alice)).toBe(75);
        });

        it('should remove cash from player', () => {
            const alice = mockPlayers[0];

            const success = gameState.removeCash(alice, 30);
            expect(success).toBe(true);
            expect(gameState.cashForPlayer(alice)).toBe(20);

            const failure = gameState.removeCash(alice, 50);
            expect(failure).toBe(false);
            expect(gameState.cashForPlayer(alice)).toBe(20);
        });
    });

    describe('Turn Management', () => {
        it('should get next player correctly', () => {
            const nextPlayer = gameState.getNextPlayer(mockPlayers);
            expect(nextPlayer.name).toBe('Bob');
            expect(nextPlayer.index).toBe(1);
        });

        it('should advance to next player', () => {
            const nextPlayer = gameState.advanceToNextPlayer(mockPlayers);

            expect(nextPlayer.name).toBe('Bob');
            expect(gameState.playerIndex).toBe(1);
            expect(gameState.movesRemaining).toBe(3); // BASE_MOVES_PER_TURN
        });

        it('should handle player elimination', () => {
            const alice = mockPlayers[0];

            // Remove Alice's region
            gameState.setOwner(0, null);

            expect(gameState.isPlayerEliminated(alice)).toBe(true);
            expect(gameState.regionCount(alice)).toBe(0);
        });
    });

    describe('State Management', () => {
        it('should create deep copy', () => {
            const copy = gameState.copy();

            expect(copy).not.toBe(gameState);
            expect(copy.id).toBe(gameState.id + 1);
            expect(copy.gameId).toBe(gameState.gameId);

            // Modify copy and ensure original is unchanged
            copy.movesRemaining = 99;
            expect(gameState.movesRemaining).toBe(3);
        });

        it('should validate game state', () => {
            const validation = gameState.validate(mockPlayers, mockRegions);
            expect(validation.valid).toBe(true);
            expect(validation.errors).toHaveLength(0);
        });

        it('should handle player 0 ownership correctly', () => {
            // Specifically test that player 0 (index 0) is treated as a valid owner
            const region0Owner = gameState.owner(0, mockPlayers);
            expect(region0Owner?.index).toBe(0);
            expect(region0Owner?.name).toBe('Alice');

            // Test validation doesn't fail for player 0 ownership
            const validation = gameState.validate(mockPlayers, mockRegions);
            expect(validation.valid).toBe(true);
        });

        it('should detect invalid player index', () => {
            gameState.playerIndex = 99;
            const validation = gameState.validate(mockPlayers, mockRegions);
            expect(validation.valid).toBe(false);
            expect(validation.errors).toContain('Invalid player index: 99');
        });

        it('should serialize and deserialize correctly', () => {
            const serialized = gameState.toJSON();
            const deserialized = GameState.fromJSON(serialized);

            expect(deserialized.turnIndex).toBe(gameState.turnIndex);
            expect(deserialized.playerIndex).toBe(gameState.playerIndex);
            expect(deserialized.gameId).toBe(gameState.gameId);
            expect(deserialized.soldierCount(0)).toBe(gameState.soldierCount(0));
        });
    });
});

