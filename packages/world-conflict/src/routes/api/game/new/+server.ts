import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { GameStorage, type GameRecord } from '$lib/server/storage/GameStorage';
import { GameState } from '$lib/game/state/GameState';
import { Region } from '$lib/game/entities/Region';
import type { Player } from '$lib/game/entities/gameTypes';
import { generateGameId, createPlayer, handleApiError } from "$lib/server/api-utils";
import { MapGenerator } from '$lib/game/map/MapGenerator.ts';

/**
 * Create a new game
 */
export const POST: RequestHandler = async ({ request, platform }) => {
    try {
        const body = await request.json() as { playerName?: string, [key: string]: any };
        const { playerName } = body;

        const gameRecord = createGameRecord(body, platform!);
        console.log("gameRecord gameId = ", gameRecord.gameId);
        await save(gameRecord, platform!);

        // Find the creator player by matching the playerName from the request
        const creatorPlayer = gameRecord.players.find(p =>
            p.name === (playerName?.trim() || '') && !p.isAI
        );

        if (!creatorPlayer) {
            throw new Error('Creator player not found in game record');
        }

        // AI turns will be triggered by the client after it loads the initial state and connects to WebSocket
        // This ensures clients can see and animate the AI's moves properly

        return json({
            gameId: gameRecord.gameId,
            player: creatorPlayer,
            playerSlotIndex: creatorPlayer.slotIndex,
            gameState: gameRecord.worldConflictState,
            message: `Game created successfully as ${gameRecord.status}`
        });

    } catch (error) {
        return handleApiError(error, 'creating game');
    }
};
function createGameRecord(body: any, platform: App.Platform): GameRecord {
  const {
      mapSize = 'Medium',
      playerName,
      gameType = 'MULTIPLAYER',
      maxPlayers = 4,
      aiDifficulty = 'Nice',
      maxTurns = 10,
      timeLimit = 30,
      playerSlots = [], // For configured games (from GameConfiguration)
      settings,
      selectedMapRegions
  } = body;

  if (!playerName?.trim()) {
      throw new Error('Player name is required');
  }

  const gameId = generateGameId();

  const players: Player[] = [];
  const difficulty = settings?.aiDifficulty || aiDifficulty || 'Normal';
  const { hasOpenSlots, gameStatus, finalGameType } = determineGameAttributes(gameType, playerSlots, playerName, players, difficulty);

  // Use the selected map regions instead of generating new ones
  const regions = calculateRegions(selectedMapRegions, settings);

  // Only initialize full game state for ACTIVE games
  let initialGameState;
  if (gameStatus === 'ACTIVE') {
    const difficulty = settings?.aiDifficulty || aiDifficulty || 'Normal';
    initialGameState = GameState.createInitialState(gameId, players, regions, maxTurns, timeLimit, difficulty);
  } else {
    initialGameState = {
      gameId,
      regions,
      players,
      currentPlayerSlot: 0,
      turnCount: 0,
      maxTurns,
      moveTimeLimit: timeLimit,
      aiDifficulty: settings?.aiDifficulty || aiDifficulty || 'Normal',
      gamePhase: 'SETUP'
    };
  }

  return {
    gameId,
    status: gameStatus,
    players: players.map(p => ({
      slotIndex: p.slotIndex,
      name: p.name,
      color: p.color,
      isAI: p.isAI
    })),
    worldConflictState: gameStatus === 'ACTIVE' ? initialGameState.toJSON() : initialGameState,
    createdAt: Date.now(),
    lastMoveAt: Date.now(),
    currentPlayerSlot: 0,
    gameType: finalGameType,
    pendingConfiguration: gameStatus === 'PENDING' && playerSlots.length > 0 ? {
      playerSlots,
      settings: {
        mapSize: settings?.mapSize || 'Medium',
        aiDifficulty: settings?.aiDifficulty || 'Normal',
        maxTurns: maxTurns,
        timeLimit: timeLimit
      },
    } : undefined
  };
}

function calculateRegions(selectedMapRegions: any, settings: any): Region[] {
  let regions: Region[];

  if (selectedMapRegions && selectedMapRegions.length > 0) {
    console.log('Using selected map from configuration with', selectedMapRegions.length, 'regions');
    // Reconstruct Region objects from the serialized data
    regions = selectedMapRegions.map((regionData: any) => {
      return new Region(regionData);
    });
  } else {
    console.log('No selected map found, generating new map');
    // Fallback to generating a new map if none provided
    const mapSize = settings?.mapSize || 'Medium';
    const mapGenerator = new MapGenerator(800, 600);
    regions = mapGenerator.generateMap({
      size: mapSize as 'Small' | 'Medium' | 'Large',
      playerCount: 2
    });
  }
  return regions;
}

/**
 * Determines player attributes and initialize players in the process
 */
function determineGameAttributes(gameType: string, playerSlots: any[], playerName: string, players: Player[], aiDifficulty: string): { hasOpenSlots: boolean, gameStatus: 'PENDING' | 'ACTIVE', finalGameType: 'MULTIPLAYER' | 'AI' } {
    let hasOpenSlots = false;
    let gameStatus: 'PENDING' | 'ACTIVE' = 'ACTIVE';
    let finalGameType: 'MULTIPLAYER' | 'AI' = 'AI';

    if (gameType === 'MULTIPLAYER') {
        if (playerSlots.length === 0) {
            // Simple multiplayer lobby game - just create the creator
            const creatorPlayer = createPlayer(playerName.trim(), 0, false);
            players.push(creatorPlayer);
            gameStatus = 'PENDING';
            finalGameType = 'MULTIPLAYER';
        } else {
            // Configured game from GameConfiguration component
            const activeSlots = playerSlots.filter((slot: any) => slot.type !== 'Off');
            console.log("activeSlots = ", activeSlots);
            console.log("First slot properties:", Object.keys(activeSlots[0]));

            if (activeSlots.length < 2) {
                throw new Error('At least 2 players are required');
            }

            // Check if ANY slots are "Open" - if so, game should be PENDING
            hasOpenSlots = activeSlots.some((slot: any) => slot.type === 'Open');

            if (hasOpenSlots) {
                gameStatus = 'PENDING';
                finalGameType = 'MULTIPLAYER';
            } else {
                gameStatus = 'ACTIVE';
                finalGameType = 'AI'; // All slots are filled with Set/AI players
            }

            for (let i = 0; i < activeSlots.length; i++) {
                const slot = activeSlots[i];
                if (slot.type === 'Set') {
                    // Human player
                    players.push(createPlayer(slot.customName || slot.name, slot.slotIndex, false));
                } else if (slot.type === 'Open') {
                    // Open slot - don't add a player yet, they'll join later
                    continue;
                } else if (slot.type === 'AI') {
                    // AI player - create with difficulty-based personality
                    players.push(createPlayer(slot.defaultName, slot.slotIndex, true, aiDifficulty));
                }
            }
        }
    } else {
        // Fallback to 2-player AI game
        const humanPlayer = createPlayer(playerName.trim(), 0, false);
        const aiPlayer = createPlayer('AI Player', 1, true, aiDifficulty);
        players.push(humanPlayer, aiPlayer);
        gameStatus = 'ACTIVE';
        finalGameType = 'AI';
    }

    return { hasOpenSlots, gameStatus, finalGameType };
}

async function save(gameRecord: GameRecord, platform: App.Platform): Promise<void> {
    const gameStorage = GameStorage.create(platform!);
    console.log("saveGame after new. gameId: " + gameRecord.gameId);
    await gameStorage.saveGame(gameRecord);
    console.log(`Created and saved game: ${gameRecord.status} gameId: ${gameRecord.gameId} with ${gameRecord.players.length} players`);
}
