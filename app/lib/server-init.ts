import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';

// This file is the single source of truth for the Genkit AI instance.
// It is intentionally separate from Firebase Admin initialization to prevent
// credential conflicts on server startup.

// Initialize Genkit
const ai = genkit({
  plugins: [googleAI()],
});

// Export the initialized instance
export { ai };
