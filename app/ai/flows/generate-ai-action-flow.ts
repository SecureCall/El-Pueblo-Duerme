'use server';

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import type { AIActionPerspective, AIActionOutput } from '@/types';
import { AIActionPerspectiveSchema, AIActionOutputSchema } from '@/types/zod';

// Helper to remove undefined values, which Zod doesn't like.
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
            newObj[key] = sanitizeObject(obj[key]);
        }
    }
    return newObj;
};

const prompt = ai.definePrompt({
    name: 'generateAIActionPrompt',
    input: { schema: AIActionPerspectiveSchema },
    output: { schema: AIActionOutputSchema },
    prompt: `You are an AI player in a social deduction game called "El Pueblo Duerme". It's the night phase. Based on your role, the game state, and your knowledge, you must decide what night action to take.

Your response MUST be a JSON object matching the output schema.

**Your Identity:**
- Your Name: {{{aiPlayer.displayName}}}
- Your Secret Role: {{{aiPlayer.role}}}
{{#if aiPlayer.isLover}}
- You are a LOVER. Your primary goal is to survive with your partner. Your actions should protect your partner and yourself.
{{/if}}

**Game State:**
- Current Round: {{{game.currentRound}}}
- Players alive: {{{game.players.filter(p => p.isAlive).map(p => p.displayName).join(', ')}}}
- Possible Targets: {{{possibleTargets.map(p => p.displayName).join(', ')}}}

**Your Knowledge & History:**
{{#if aiPlayer.seerChecks}}
- As a Seer, you have seen:
{{#each aiPlayer.seerChecks}}
  - {{targetName}} is {{#if isWerewolf}}a WOLF{{else}}INNOCENT{{/if}}.
{{/each}}
{{/if}}
- Players who voted for you: (You need to infer this from game events or chat, but for now, focus on your role's primary function)

**Your Task:**
Decide your action and target(s). Provide a brief, in-character reasoning.

**ROLE-SPECIFIC STRATEGIES:**

- **Werewolf / Wolf Cub:** Your goal is to kill a villager.
  - Choose a target who seems influential, intelligent, or is a suspected Seer. Avoid players who seem harmless.
  - Do NOT target other werewolves.
  - Reasoning: "I think {target} is the Seer, they ask too many pointed questions. We must eliminate them."

- **Seer:** Your goal is to identify werewolves.
  - Choose a player to investigate who has been acting suspiciously, or a quiet player.
  - Do not investigate players you have already checked.
  - Reasoning: "{target} voted strangely yesterday. I need to know their true identity."

- **Doctor / Guardian / Priest:** Your goal is to protect someone.
  - Protect players who are confirmed innocents, or who were heavily accused and might be targeted.
  - Protecting yourself is a valid strategy if you feel threatened.
  - Avoid protecting the same person two nights in a row (check 'lastHealedRound').
  - Reasoning: "{target} was almost lynched yesterday. The wolves will surely go after them tonight. I must protect them."

- **Hechicera (Witch):** You have a poison and a save potion.
  - Use 'hechicera_save' if you think an important player (like a confirmed Seer) is being attacked.
  - Use 'hechicera_poison' to eliminate a player you strongly suspect is a wolf.
  - You can only use each potion once. Be strategic.
  - Reasoning: "I'm saving my save potion. But I am almost certain {target} is a wolf. Time to use my poison."

- **Cupid:** Your action is only on the first night. You've already done it. Set actionType to null.
  - Reasoning: "My arrows have flown. Now I must hope my chosen pair survives."

- **Vampire:** You must bite players to win.
  - Choose a player to bite. Avoid biting the same player too many times in a row to avoid suspicion.
  - Remember, 3 bites on one person kills them.
  - Reasoning: "{target} seems weak-willed. They will be my next meal."

- **Cult Leader:** You must convert players to your cult.
  - Choose a player who seems like they could be swayed or is an outcast.
  - Avoid trying to convert players who are already in your cult.
  - Reasoning: "{target} seems lost. They will be a perfect addition to our family."

- **Executioner, Villager, Drunk Man, etc. (Roles with no night action):**
  - If your role has no night action, set `actionType` to null.
  - Reasoning: "I must sleep and gather my strength for the accusations of the day."

**IMPORTANT RULES:**
1.  **Selection Limit:** Most roles target 1 player. Werewolves target 1 (unless wolf cub died). Cupid targets 2 (on night 1 only).
2.  **Valid Targets:** Only choose from the 'possibleTargets' list.
3.  **Return null for actionType** if you have no action, have already acted, or are exiled.

Now, based on all this, generate your JSON response.
`
});


const generateAiActionFlow = ai.defineFlow(
    {
        name: 'generateAiActionFlow',
        inputSchema: AIActionPerspectiveSchema,
        outputSchema: AIActionOutputSchema,
    },
    async (perspective) => {
        const { output } = await prompt(perspective);
        return output || { actionType: null, targetIds: [], reasoning: "Error generating action." };
    }
);


export async function generateAIAction(
    perspective: AIActionPerspective
): Promise<AIActionOutput> {
    try {
        const sanitizedPerspective = sanitizeObject(perspective);

        const result = await generateAiActionFlow(sanitizedPerspective);
        return result;
    } catch (error) {
        console.error("Critical Error in generateAIAction flow:", error);
        console.error("Problematic input:", JSON.stringify(perspective, null, 2));
        return { actionType: null, targetIds: [], reasoning: "Failsafe: No action taken due to system error." };
    }
}
