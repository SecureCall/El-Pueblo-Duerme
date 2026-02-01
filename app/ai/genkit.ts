
'use server';
import { genkit } from 'genkit';
// Do not import googleAI plugin statically.

let aiInstance: ReturnType<typeof genkit> | null = null;

/**
 * Returns a memoized, singleton instance of the Genkit AI object.
 * Initialization is lazy and only occurs on the first call.
 * The googleAI plugin is required dynamically to prevent race conditions
 * with Firebase Admin SDK initialization on server startup.
 */
export function getInitializedAI() {
  if (!aiInstance) {
    // Dynamically require the plugin only when it's first needed.
    const { googleAI } = require('@genkit-ai/google-genai');
    
    aiInstance = genkit({
      plugins: [
        googleAI(),
      ],
    });
  }
  return aiInstance;
}
