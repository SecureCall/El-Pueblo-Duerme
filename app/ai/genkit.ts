
'use server';
import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';

/**
 * Initializes and exports the Genkit AI instance.
 * This centralized instance is configured to use the Google AI plugin.
 * It automatically uses the 'GEMINI_API_KEY' environment variable for authentication,
 * which is the recommended secure practice.
 */
export const ai = genkit({
  plugins: [
    googleAI(),
  ],
});
