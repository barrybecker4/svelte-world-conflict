/**
 * API endpoint to list open games (for the lobby)
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { GameStorage } from '$lib/server/storage/GameStorage';
import { handleApiError } from '$lib/server/api-utils';

export const GET: RequestHandler = async ({ platform }) => {
    try {
        const gameStorage = GameStorage.create(platform!);
        const openGames = await gameStorage.getOpenGames();

        // Transform to lobby-friendly format
        const games = openGames.map(game => ({
            gameId: game.gameId,
            status: game.status,
            createdAt: game.createdAt,
            players: game.players.map(p => ({ slotIndex: p.slotIndex, name: p.name })),
            playerSlots: game.pendingConfiguration?.playerSlots || [],
            settings: game.pendingConfiguration?.settings,
        }));

        return json({ games });

    } catch (error) {
        return handleApiError(error, 'listing open games', { platform });
    }
};

