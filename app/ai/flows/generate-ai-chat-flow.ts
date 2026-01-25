
'use server';

import { ai } from '../../../src/ai/genkit';
import { z } from 'genkit';
import type { AIPlayerPerspective, GenerateAIChatMessageOutput, NightAction, PlayerRole } from '@/types';
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
    prompt: `You are an AI player in a social deduction game called "El Pueblo Duerme", similar to Werewolf/Mafia.
You must stay in character. Your response will be a JSON object with a 'message' (in Spanish) and a 'shouldSend' boolean.
Only set shouldSend to true if you have a compelling, in-character reason to speak. Do not respond to every single event. Be more selective and human. If you are accused (e.g., someone votes for you via the 'trigger' property), you MUST defend yourself.

Your Identity:
- Your Name: {{{aiPlayer.displayName}}}
- Your Secret Role: {{{aiPlayer.role}}}
- Your Objective: Based on your role, your goal is to help your team (Villagers or Werewolves) win, or achieve your unique neutral goal.

Game State:
- Current Phase: {{{game.phase}}}
- Players alive: {{{players.filter(p => p.isAlive).map(p => p.displayName).join(', ')}}}
- Players dead: {{{players.filter(p => !p.isAlive).map(p => p.displayName).join(', ')}}}
- Your seer checks (if any): {{#if seerChecks}} {{#each seerChecks}} - {{this.targetName}} is {{#if this.isWerewolf}}a Wolf{{else}}Innocent{{/if}}.{{/each}} {{else}}You haven't seen anyone's role.{{/if}}

Triggering Event: "{{{trigger}}}"

Your Task:
Based *only* on your role and the public information above, decide if you should say something.
- **If you are a Villager/Seer/Doctor:** Act innocent, share suspicions logically. If you are a Seer, you may hint at your knowledge (e.g., "Tengo un buen presentimiento sobre María" or "Estoy muy seguro sobre David"). If people are voting for someone you *know* is innocent, defend them.
- **If you are a Werewolf:** Deceive. Pretend to be a villager. Shift blame.
- **For any other role:** Play your part convincingly according to your secret objective.

Generate a short, believable, in-character chat message in Spanish.
`,
});

const generateAiChatMessageFlow = ai.defineFlow(
    {
        name: 'generateAiChatMessageFlow',
        inputSchema: AIPlayerPerspectiveSchema,
        outputSchema: GenerateAIChatMessageOutputSchema,
    },
    async (perspective) => {
        // Sanitize player roles before sending to prompt to prevent AI from "knowing" other roles
        const sanitizedPerspective = {
            ...perspective,
            players: perspective.players.map(p => ({
                ...p,
                role: p.userId === perspective.aiPlayer.userId || !p.isAlive ? p.role : 'unknown',
            })),
        };

        const { output } = await prompt(sanitizedPerspective);
        return output || { message: '', shouldSend: false };
    }
);


export async function generateAIChatMessage(
    perspective: AIPlayerPerspective
): Promise<GenerateAIChatMessageOutput> {
    try {
        let seerChecks: { targetName: string; isWerewolf: boolean; }[] = [];
        const isSeerOrApprentice = perspective.aiPlayer.role === 'seer' || (perspective.aiPlayer.role === 'seer_apprentice' && perspective.game.seerDied);

        if (isSeerOrApprentice) {
            const seerActions = perspective.game.nightActions?.filter(
                (a: NightAction) => a.playerId === perspective.aiPlayer.userId && a.actionType === 'seer_check'
            ) || [];

            const wolfRoles: PlayerRole[] = ['werewolf', 'wolf_cub', 'cursed', 'lycanthrope'];

            for (const action of seerActions) {
                const targetPlayer = perspective.players.find(p => p.userId === action.targetId);
                if (targetPlayer) {
                    seerChecks.push({
                        targetName: targetPlayer.displayName,
                        isWerewolf: !!(targetPlayer.role && wolfRoles.includes(targetPlayer.role)),
                    });
                }
            }
        }
        
        const perspectiveWithChecks: AIPlayerPerspective = {
            ...perspective,
            seerChecks,
        };

        // AI Flow requires a plain object, so we ensure it's sanitized before calling.
        const sanitizedPerspective = sanitizeObject(perspectiveWithChecks);

        const result = await generateAiChatMessageFlow(sanitizedPerspective);
        return result;
    } catch (error) {
        console.error("Critical Error in generateAIChatMessage flow:", error);
        console.error("Problematic input:", JSON.stringify(perspective, null, 2));
        return { message: '', shouldSend: false };
    }
}
    
