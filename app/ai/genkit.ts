
import { genkit, type Genkit } from 'genkit';
import { firebaseConfig } from '@/lib/firebase-config';

/**
 * This file provides a lazy-loaded global Genkit AI instance.
 * All flows and prompts should call `getAI()` from this file to get the instance.
 */

let aiInstance: Genkit | null = null;

export async function getAI(): Promise<Genkit> {
  if (!aiInstance) {
    // Dynamically import the plugin ONLY when getAI is first called.
    const { googleAI } = await import('@genkit-ai/google-genai');
    // In a managed environment, the plugin will automatically discover credentials
    // and the project ID. Providing it explicitly can cause conflicts.
    aiInstance = genkit({
      plugins: [googleAI()],
    });
  }
  return aiInstance;
}
