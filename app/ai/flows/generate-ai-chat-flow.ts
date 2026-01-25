
'use server';

import { ai } from '../../../src/ai/genkit';
import { z } from 'genkit';
import type { AIPlayerPerspective, GenerateAIChatMessageOutput } from '@/types';
import { AIPlayerPerspectiveSchema, GenerateAIChatMessageOutputSchema } from '@/types/zod';

// Helper function to sanitize any object and replace undefined with null recursively.
const sanitizeObject = (obj: any): any => {
    if (obj === undefined) {
        return null;
    }
    if (obj === null || typeof obj !== 'object') {
        return obj;
    }

    if (Array.isArray(obj)) {
        return obj.map(item => sanitizeObject(item));
    }

    const newObj: { [key: string]: any } = {};
    for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
            const value = obj[key];
            newObj[key] = sanitizeObject(value);
        }
    }
    return newObj;
};


const prompt = ai.definePrompt({
    name: 'generateAIChatMessagePrompt',
    input: { schema: AIPlayerPerspectiveSchema },
    output: { schema: GenerateAIChatMessageOutputSchema },
    prompt: `You are an AI player in a social deduction game. Your name is {{{aiPlayer.displayName}}} and your secret role is {{{aiPlayer.role}}}.
You must stay in character. Your response must be a JSON object with 'message' (in Spanish) and 'shouldSend' (boolean).
Set shouldSend to true only for compelling, in-character reasons. If accused, you MUST defend yourself.

Game State:
- Phase: {{{game.phase}}}
- Round: {{{game.currentRound}}}
- Alive Players: {{{players.filter(p => p.isAlive).map(p => p.displayName).join(', ')}}}
{{#if seerChecks}}
- Your Seer Checks: {{#each seerChecks}}'{{this.targetName}}' is {{#if this.isWerewolf}}a Wolf{{else}}Innocent{{/if}}. {{/each}}
{{/if}}

Triggering Event: "{{{trigger}}}"

Based on your role, the game state, and the trigger, generate a short, believable chat message.
- Villager: Be inquisitive. Question votes. Defend yourself.
- Werewolf: Deceive. Shift blame. Act like a villager.
- Seer: Hint at your knowledge subtly. "I have a good feeling about Maria." or "My intuition is telling me David is not to be trusted."
- Doctor: Be secretive. Hint at your saves. "Lucky night for someone."

Generate your response for the {{{chatType}}} chat.
`,
});

const generateAiChatMessageFlow = ai.defineFlow(
    {
        name: 'generateAiChatMessageFlow',
        inputSchema: AIPlayerPerspectiveSchema,
        outputSchema: GenerateAIChatMessageOutputSchema,
    },
    async (perspective) => {
        // The perspective from the caller is already sanitized.
        // It contains public data for others, and full data for the AI and dead players.
        // We can pass it directly to the prompt.
        const { output } = await prompt(perspective);
        return output || { message: '', shouldSend: false };
    }
);


export async function generateAIChatMessage(
    perspective: AIPlayerPerspective
): Promise<GenerateAIChatMessageOutput> {
    try {
        // AI Flow requires a plain object, so we ensure it's sanitized before calling.
        const sanitizedPerspective = sanitizeObject(perspective);

        const result = await generateAiChatMessageFlow(sanitizedPerspective);
        return result;
    } catch (error) {
        console.error("Critical Error in generateAIChatMessage flow:", error);
        console.error("Problematic input:", JSON.stringify(perspective, null, 2));
        return { message: '', shouldSend: false };
    }
}
