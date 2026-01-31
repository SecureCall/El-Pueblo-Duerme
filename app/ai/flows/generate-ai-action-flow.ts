'use server';

import type { AIActionPerspective, AIActionOutput } from '@/types';

/**
 * DUMMY IMPLEMENTATION FOR DIAGNOSTICS.
 * This function returns a default safe action without initializing Genkit.
 */
export async function generateAIAction(
    perspective: AIActionPerspective
): Promise<AIActionOutput> {
    console.log("--- SKIPPING AI ACTION GENERATION (DIAGNOSTIC) ---");
    return { actionType: null, targetIds: [], reasoning: "AI is temporarily disabled for diagnostics." };
}
