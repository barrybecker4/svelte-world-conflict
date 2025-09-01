import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { GameStorage, type GameRecord } from '$lib/storage/GameStorage';
import { GameState } from '$lib/game/classes/GameState';
import { Region } from '$lib/game/classes/Region';
import type { Player } from '$lib/game/classes/Player';
import { generateGameId, generatePlayerId, createPlayer, getErrorMessage } from "$lib/server/api-utils";
import { MapGenerator } from '$lib/game/map/MapGenerator.ts';

/**
 * Create a new game
 */
export const POST: RequestHandler = async ({ request, platform }) => {
    try {
        const body = await request.json();
        const { playerName } = body;

        const gameRecord = createGameRecord(body, platform);
        console.log("gameRecord gameId = ", gameRecord.gameId);
        await save(gameRecord, platform);

        // Find the creator player by matching the playerName from the request
        const creatorPlayer = gameRecord.players.find(p =>
            p.name === playerName.trim() && !p.isAI
        );

        if (!creatorPlayer) {
            throw new Error('Creator player not found in game record');
        }

        return json({
            gameId: gameRecord.gameId,
            player: creatorPlayer,
            playerIndex: creatorPlayer.index,
            gameState: gameRecord.worldConflictState,
            message: `Game created successfully as ${gameRecord.status}`
        });

    } catch (error) {
        console.error('Error creating game:', error);
        return json({
            error: 'Failed to create game',
            details: getErrorMessage(error)
        }, { status: 500 });
    }
};
function createGameRecord(body: any, platform: App.Platform): GameRecord {
  const {
      mapSize = 'Medium',
      playerName,
      gameType = 'MULTIPLAYER',
      maxPlayers = 4,
      aiDifficulty = 'Nice',
      turns = 10,
      timeLimit = 30,
      playerSlots = [], // For configured games (from GameConfiguration)
      settings,
      selectedMapRegions
  } = body;

  if (!playerName?.trim()) {
      return json({ error: 'Player name is required' }, { status: 400 });
  }

  const gameId = generateGameId();

  const players: Player[] = [];
  const { hasOpenSlots, gameStatus, finalGameType } = determineGameAttributes(gameType, playerSlots, playerName, players);

  // Use the selected map regions instead of generating new ones
  const regions = calculateRegions(selectedMapRegions, settings);

  // Only initialize full game state for ACTIVE games
  let initialGameState;
  if (gameStatus === 'ACTIVE') {
    initialGameState = GameState.createInitialState(gameId, players, regions);
  } else {
    initialGameState = {
      gameId,
      regions,
      players,
      currentPlayerIndex: 0,
      turnCount: 0,
      gamePhase: 'SETUP'
    };
  }

  return {
    gameId,
    status: gameStatus,
    players: players.map(p => ({
      id: p.id || generatePlayerId(),
      name: p.name,
      color: p.color,
      isAI: p.isAI,
      index: p.index
    })),
    worldConflictState: gameStatus === 'ACTIVE' ? initialGameState.toJSON() : initialGameState,
    createdAt: Date.now(),
    lastMoveAt: Date.now(),
    currentPlayerIndex: 0,
    gameType: finalGameType,
    pendingConfiguration: gameStatus === 'PENDING' && playerSlots.length > 0 ? {
      settings,
      playerSlots,
      selectedMapRegions // Store the selected map for pending games too
    } : undefined
  };
}

function calculateRegions(selectedMapRegions, settings): Region[] {
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
      playerCount: Math.max(players.length, 2)
    });
  }
  return regions;
}

/**
 * Determines player attributes and initialize players in the process
 */
function determineGameAttributes(gameType: string, playerSlots: any[], playerName: string, players: Player[]) {
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

            if (activeSlots.length < 2) {
                return json({ error: 'At least 2 players are required' }, { status: 400 });
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
                    players.push(createPlayer(slot.customName || slot.name, slot.index, false));
                } else if (slot.type === 'Open') {
                    // Open slot - don't add a player yet, they'll join later
                    continue;
                } else if (slot.type === 'AI') {
                    // AI player - create regardless of game status (PENDING or ACTIVE)
                    players.push(createPlayer(slot.defaultName, slot.index, true));
                }
            }
        }
    } else {
        // Fallback to 2-player AI game
        const humanPlayer = createPlayer(playerName.trim(), 0, false);
        const aiPlayer = createPlayer('AI Player', 1, true);
        players.push(humanPlayer, aiPlayer);
        gameStatus = 'ACTIVE';
        finalGameType = 'AI';
    }

    return { hasOpenSlots, gameStatus, finalGameType };
}

async function save(gameRecord: GameRecord, platform: App.Platform): void {
    const gameStorage = GameStorage.create(platform!);
    console.log("saveGame after new. gameId: " + gameRecord.gameId);
    await gameStorage.saveGame(gameRecord);
    console.log(`Created and saved game: ${gameRecord.status} gameId: ${gameRecord.gameId} with ${gameRecord.players.length} players`);
}
