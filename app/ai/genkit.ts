
import 'server-only';
import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';

// Initialize the AI plugin WITHOUT an explicit API key.
// This forces it to use the same Application Default Credentials as the Firebase Admin SDK,
// resolving the authentication conflict.
export const ai = genkit({
  plugins: [
    googleAI(),
  ],
});
