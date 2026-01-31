
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
    // Explicitly provide the project ID to the plugin to prevent auth conflicts
    // in the App Hosting environment.
    aiInstance = genkit({
      plugins: [googleAI({ projectId: firebaseConfig.projectId })],
    });
  }
  return aiInstance;
}
