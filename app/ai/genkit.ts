'use server';
import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';

let aiInstance: ReturnType<typeof genkit> | null = null;

/**
 * Returns a memoized, singleton instance of the Genkit AI object.
 * Initialization is lazy and only occurs on the first call.
 */
export function getInitializedAI() {
  if (!aiInstance) {
    aiInstance = genkit({
      plugins: [
        googleAI(),
      ],
    });
  }
  return aiInstance;
}
