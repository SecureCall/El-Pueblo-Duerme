
import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';

/**
 * This file contains the global Genkit AI instance.
 * All flows and prompts should import `ai` from this file.
 */

export const ai = genkit({
    plugins: [googleAI()],
});
