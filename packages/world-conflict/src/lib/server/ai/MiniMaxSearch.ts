/**
 * Minimax Search Algorithm
 * Tree search for AI move selection
 */

import type { GameState, Player, Region } from '$lib/game/state/GameState';
import type { Command } from '$lib/game/commands/Command';
import { ArmyMoveCommand } from '$lib/game/commands/ArmyMoveCommand';
import { EndTurnCommand } from '$lib/game/commands/EndTurnCommand';
import { CommandProcessor } from '$lib/game/commands/CommandProcessor';
import { heuristicForPlayer } from './AiHeuristics';
import { shuffleWithRng } from '$lib/game/utils/arrayUtils';
import type { AiLevel } from '$lib/game/entities/aiPersonalities';

/**
 * Represents a node in the minimax game tree
 */
class Node {
    parent: Node | null;
    activePlayer: Player;
    depth: number;
    move: Command | null;
    state: GameState;
    possibleMoves: Command[];
    bestMove: Command | null;
    value: number | null;

    constructor(
        parent: Node | null,
        activePlayer: Player,
        depth: number,
        move: Command | null,
        state: GameState,
        possibleMoves: Command[]
    ) {
        this.parent = parent;
        this.activePlayer = activePlayer;
        this.depth = depth;
        this.move = move;
        this.state = state;
        this.possibleMoves = possibleMoves;
        this.bestMove = null;
        this.value = null;
    }
}

/**
 * Perform minimax search to find the best move
 * Uses iterative deepening with time limit
 *
 * @param forPlayer - The player to maximize for
 * @param fromState - Current game state
 * @param depth - Search depth (usually moves remaining)
 * @param maxTime - Maximum thinking time in milliseconds
 * @param aiLevel - AI difficulty level
 * @returns Promise<Command> - Best move found
 */
export async function miniMaxSearch(
    forPlayer: Player,
    fromState: GameState,
    depth: number,
    maxTime: number,
    aiLevel: AiLevel
): Promise<Command> {
    const simulation = fromState.copy();
    const initialNode = new Node(
        null,
        forPlayer,
        depth,
        null,
        simulation,
        possibleMoves(fromState)
    );

    let currentNode: Node | null = initialNode;
    const unitOfWork = 100;
    const timeStart = Date.now();

    return new Promise((resolve) => {
        function doSomeWork() {
            let stepsRemaining = unitOfWork;

            while (stepsRemaining-- > 0) {
                // Do some thinking
                currentNode = minMaxDoSomeWork(currentNode, forPlayer, aiLevel);

                // Cap thinking time
                const elapsedTime = Date.now() - timeStart;

                if (!currentNode || elapsedTime > maxTime) {
                    // We're done, return the best move we found
                    let bestMove = initialNode.bestMove;
                    if (!bestMove) {
                        bestMove = new EndTurnCommand(fromState, forPlayer);
                    }
                    resolve(bestMove);
                    return;
                }
            }

            // Continue thinking (async to allow other operations)
            setImmediate(() => doSomeWork());
        }

        doSomeWork();
    });
}

/**
 * Perform one iteration of minimax work
 */
function minMaxDoSomeWork(node: Node | null, forPlayer: Player, aiLevel: AiLevel): Node | null {
    if (!node) return null;

    if (node.depth === 0) {
        // Terminal node - evaluate and return
        node.value = heuristicForPlayer(node.activePlayer, node.state, aiLevel);
        return minMaxReturnFromChild(node.parent, node, forPlayer);
    }

    const move = node.possibleMoves.shift();
    if (!move) {
        // We're done analyzing this node, return value to parent
        return minMaxReturnFromChild(node.parent, node, forPlayer);
    } else {
        // Spawn a child node
        const childState = executeMove(node.state, move);
        return new Node(
            node,
            node.activePlayer,
            node.depth - 1,
            move,
            childState,
            possibleMoves(childState)
        );
    }
}

/**
 * Backpropagate value from child to parent
 */
function minMaxReturnFromChild(node: Node | null, child: Node, forPlayer: Player): Node | null {
    if (node) {
        // What sort of node are we?
        const activePlayer = node.state.activePlayer();
        const maximizingNode = activePlayer && activePlayer.slotIndex === forPlayer.slotIndex;

        // Is the value from child better than what we have?
        const better =
            !node.bestMove ||
            (maximizingNode && child.value !== null && (node.value === null || child.value > node.value)) ||
            (!maximizingNode && child.value !== null && (node.value === null || child.value < node.value));

        if (better) {
            node.bestMove = child.move;
            node.value = child.value;
        }
    }

    // Work will resume in this node on the next iteration
    return node;
}

/**
 * Generate all possible moves from a state
 */
function possibleMoves(state: GameState): Command[] {
    const moves: Command[] = [];
    const player = state.activePlayer();

    if (!player) {
        return [new EndTurnCommand(state, player!)];
    }

    // Ending turn is always an option
    moves.push(new EndTurnCommand(state, player));

    // Are we out of move points?
    if (!state.movesRemaining) {
        return moves;
    }

    // Add army moves for all possible movements
    for (const region of state.regions) {
        if (state.regionHasActiveArmy(player, region)) {
            // There is a move from here!
            // Iterate over all possible neighbors
            const soldiers = state.soldierCount(region.index);
            const neighbors = region.neighbors || [];

            for (const neighborIdx of neighbors) {
                const neighbor = state.regions[neighborIdx];

                // Try moving the entire army
                if (!isDumbMove(state, player, region, neighbor, soldiers)) {
                    moves.push(new ArmyMoveCommand(state, player, region.index, neighborIdx, soldiers));
                }

                // Try moving half the army (for more nuanced strategies)
                if (soldiers > 1) {
                    const halfSoldiers = Math.floor(soldiers / 2);
                    if (!isDumbMove(state, player, region, neighbor, halfSoldiers)) {
                        moves.push(new ArmyMoveCommand(state, player, region.index, neighborIdx, halfSoldiers));
                    }
                }
            }
        }
    }

    // Return shuffled moves to avoid bias from generation order
    // Use seeded RNG for deterministic behavior
    return shuffleWithRng(moves, state.rng);
}

/**
 * Check if a move is obviously bad (suicide move)
 */
function isDumbMove(state: GameState, player: Player, source: Region, dest: Region, soldierCount: number): boolean {
    // Suicide moves are dumb - attacking with fewer soldiers than defender has
    if (!state.isOwnedBy(dest.index, player) && state.soldierCount(dest.index) > soldierCount) {
        return true;
    }
    return false;
}

/**
 * Execute a move and return the resulting state
 */
function executeMove(state: GameState, move: Command): GameState {
    const processor = new CommandProcessor();
    const result = processor.process(move);

    if (result.success && result.newState) {
        return result.newState;
    }

    // If move fails, return the original state
    return state;
}

