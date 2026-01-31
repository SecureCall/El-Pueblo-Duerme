'use server';

import type { AIChatPerspective, GenerateAIChatMessageOutput } from '@/types';

/**
 * DUMMY IMPLEMENTATION FOR DIAGNOSTICS.
 * This function returns a non-sending message without initializing Genkit.
 */
export async function generateAIChatMessage(
    perspective: AIChatPerspective
): Promise<GenerateAIChatMessageOutput> {
    console.log("--- SKIPPING AI CHAT GENERATION (DIAGNOSTIC) ---");
    return { message: '', shouldSend: false };
}
