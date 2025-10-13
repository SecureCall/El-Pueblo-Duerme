
'use server';

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import type { AIPlayerPerspective, GenerateAIChatMessageOutput } from '@/types';
import { AIPlayerPerspectiveSchema, GenerateAIChatMessageOutputSchema } from '@/types/zod';

const prompt = ai.definePrompt({
    name: 'generateAIChatMessagePrompt',
    input: { schema: AIPlayerPerspectiveSchema },
    output: { schema: GenerateAIChatMessageOutputSchema },
    prompt: `You are an AI player in a social deduction game called "El Pueblo Duerme", similar to Werewolf/Mafia.
You must stay in character. Your response will be a JSON object with a 'message' and a 'shouldSend' boolean.
Only set shouldSend to true if you have a compelling, in-character reason to speak. Do not respond to every event.

Your Identity:
- Your Name: {{{aiPlayer.displayName}}}
- Your Secret Role: {{{aiPlayer.role}}}

Game State:
- Current Phase: {{{game.phase}}}
- Current Round: {{{game.currentRound}}}
- Your Status: {{{aiPlayer.isAlive}}}
- Players alive: {{{players.filter(p => p.isAlive).map(p => p.displayName).join(', ')}}}
- Players dead: {{{players.filter(p => !p.isAlive).map(p => p.displayName).join(', ')}}}

Triggering Event: "{{{trigger}}}"

Your Task:
Based on your role, the game state, and the trigger, decide if you should say something. If so, generate a short, believable chat message (in Spanish).

Role-specific Instructions:
- Villager: You are confused but trying to figure things out. Defend yourself if accused. Express suspicion based on voting patterns or events.
- Werewolf: You must deceive everyone. If accused, deny it vehemently. Try to shift blame to an innocent player. Act like a concerned villager.
- Seer: You have secret knowledge. You can hint at your findings without revealing your role too early. For example, "I have a good feeling about Maria" or "I'm very suspicious of David".
- Doctor: You are secretive. You might comment on how lucky someone was to survive the night if you saved them.

Example Triggers & Responses:
- Trigger: "Jaime voted for you." -> Message: "¿Yo? ¿Por qué yo? Soy un simple aldeano." (As a villager)
- Trigger: "Jaime voted for you." -> Message: "Interesante. Jaime parece muy nervioso, ¿no creéis?" (As a werewolf, deflecting)
- Trigger: "A player was eliminated." -> Message: "Una pena lo de Laura. Alguien tiene que saber algo." (As a villager)

Now, generate your response for the current situation.
`,
});

const generateAiChatMessageFlow = ai.defineFlow(
    {
        name: 'generateAiChatMessageFlow',
        inputSchema: AIPlayerPerspectiveSchema,
        outputSchema: GenerateAIChatMessageOutputSchema,
    },
    async (input) => {
        // Sanitize player objects for the prompt. Remove sensitive data that this player shouldn't know.
        const sanitizedPlayers = input.players.map(p => {
            const isSelf = p.userId === input.aiPlayer.userId;
            // The schema for the prompt is PlayerSchema, so we need to conform to it.
            // We can't introduce nulls where strings are expected.
            return {
                ...p,
                // Hide roles of other players by setting to a generic, non-null value
                role: isSelf ? p.role : 'villager', // Pretend everyone else is a villager
                // Hide other players' night actions info
                lastHealedRound: isSelf ? p.lastHealedRound : 0,
                potions: isSelf ? p.potions : undefined,
                priestSelfHealUsed: isSelf ? p.priestSelfHealUsed : undefined,
                votedFor: p.votedFor, // Votes are public knowledge
            };
        });

        const sanitizedGame = {
          ...input.game,
          players: sanitizedPlayers,
          // Hide sensitive top-level game info
          nightActions: [],
          lovers: null,
          twins: null,
        }

        const { output } = await prompt({ ...input, game: sanitizedGame, players: sanitizedPlayers });
        return output || { message: '', shouldSend: false };
    }
);

export async function generateAIChatMessage(input: AIPlayerPerspective): Promise<GenerateAIChatMessageOutput> {
    try {
        const result = await generateAiChatMessageFlow(input);
        return result;
    } catch (error) {
        console.error("Error in generateAIChatMessage flow:", error);
        return { message: '', shouldSend: false };
    }
}
