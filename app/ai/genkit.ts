
import 'server-only';
import { genkit, type Genkit } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';

let aiInstance: Genkit | undefined;

function ensureAiInitialized() {
  if (!aiInstance) {
    aiInstance = genkit({
      plugins: [
        googleAI(),
      ],
    });
  }
}

// Export a function that ensures initialization before returning the service.
// This "lazy loading" pattern is crucial to prevent race conditions.
export function getAi(): Genkit {
  ensureAiInitialized();
  return aiInstance!;
}
