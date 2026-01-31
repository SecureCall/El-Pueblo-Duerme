
import { genkit, type Genkit } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';

/**
 * This file provides a lazy-loaded global Genkit AI instance.
 * All flows and prompts should call `getAI()` from this file to get the instance.
 */

let aiInstance: Genkit | null = null;

export function getAI(): Genkit {
  if (!aiInstance) {
    aiInstance = genkit({
      plugins: [googleAI()],
    });
  }
  return aiInstance;
}
