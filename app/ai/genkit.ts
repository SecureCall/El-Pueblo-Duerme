
import { genkit, type Genkit } from 'genkit';

/**
 * This file provides a lazy-loaded global Genkit AI instance.
 * All flows and prompts should call `getAI()` from this file to get the instance.
 */

let aiInstance: Genkit | null = null;

export async function getAI(): Promise<Genkit> {
  if (!aiInstance) {
    // Dynamically import the plugin ONLY when getAI is first called.
    const { googleAI } = await import('@genkit-ai/google-genai');
    aiInstance = genkit({
      plugins: [googleAI()],
    });
  }
  return aiInstance;
}
