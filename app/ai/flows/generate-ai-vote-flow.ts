'use server';

import type { AIVotePerspective, AIVoteOutput } from '@/types';

/**
 * DUMMY IMPLEMENTATION FOR DIAGNOSTICS.
 * This function returns a default safe vote without initializing Genkit.
 */
export async function generateAIVote(
    perspective: AIVotePerspective
): Promise<AIVoteOutput> {
    console.log("--- SKIPPING AI VOTE GENERATION (DIAGNOSTIC) ---");
    // Fallback to a random vote to avoid breaking game logic if no vote is cast.
    const votablePlayers = perspective.votablePlayers.filter(p => p.userId !== perspective.aiPlayer.userId);
    const randomTarget = votablePlayers.length > 0 ? votablePlayers[Math.floor(Math.random() * votablePlayers.length)] : null;
    return { targetId: randomTarget?.userId || null, reasoning: "AI is temporarily disabled for diagnostics." };
}
