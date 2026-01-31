
import { genkit, type Genkit } from 'genkit';

/**
 * This file provides a lazy-loaded global Genkit AI instance.
 * All flows and prompts should call `getAI()` from this file to get the instance.
 */

let aiInstance: Genkit | null = null;

export function getAI(): Genkit {
  if (!aiInstance) {
    // Dynamically require the plugin ONLY when getAI is first called.
    // This prevents the plugin from initializing on server startup for non-AI actions.
    const { googleAI } = require('@genkit-ai/google-genai');
    aiInstance = genkit({
      plugins: [googleAI()],
    });
  }
  return aiInstance;
}
