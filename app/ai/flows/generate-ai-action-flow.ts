
'use server';

import { z } from 'zod';
import type { AIActionPerspective, AIActionOutput } from '@/types';
import { AIActionPerspectiveSchema, AIActionOutputSchema } from '@/types/zod';
import type { Flow } from 'genkit';

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

// Module-level variable to cache the initialized flow
let generateAiActionFlow: Flow<typeof AIActionPerspectiveSchema, typeof AIActionOutputSchema> | null = null;


async function initializeFlow() {
    if (generateAiActionFlow) {
        return;
    }
    // Dynamic imports to ensure nothing is loaded until this function is called
    const { genkit } = await import('genkit');
    const { googleAI } = await import('@genkit-ai/google-genai');
    
    // Initialize Genkit inside the function
    const ai = genkit({
      plugins: [googleAI()],
    });

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

**Vote History (Last Round):**
{{#if voteHistory}}
{{#each voteHistory}}
- {{{this.voterName}}} votó por {{{this.targetName}}}.
{{/each}}
{{else}}
No hay historial de votos de la ronda anterior.
{{/if}}

**Your Knowledge & History:**
{{#if aiPlayer.seerChecks}}
- As a Seer, you have seen:
{{#each aiPlayer.seerChecks}}
  - {{targetName}} is {{#if isWerewolf}}a WOLF{{else}}INNOCENT{{/if}}.
{{/each}}
{{/if}}
- Players who voted for you: (You need to infer this from the vote history)

**Your Task:**
Decide your action and target(s). Provide a brief, in-character reasoning.

**ROLE-SPECIFIC STRATEGIES:**

- **Werewolf / Wolf Cub:** Your goal is to kill a villager.
  - Choose a target who seems influential, intelligent, or is a suspected Seer. Avoid players who seem harmless.
  - Do NOT target other werewolves.
  - Consider attacking players who voted for your fellow wolves or who seem to be leading the village.
  - Reasoning: "I think {target} is the Seer, they ask too many pointed questions. We must eliminate them." or "{target} votó por nuestro hermano lobo ayer, debe morir."

- **Seer:** Your goal is to identify werewolves.
  - Choose a player to investigate who has been acting suspiciously, or a quiet player. Check the vote history for unusual voting patterns.
  - Do not investigate players you have already checked.
  - Reasoning: "{target} votó de forma extraña ayer. Necesito saber su verdadera identidad."

- **Doctor / Guardian / Priest:** Your goal is to protect someone.
  - Protect players who are confirmed innocents, or who were heavily accused and might be targeted. Check the vote history to see who was almost lynched.
  - Protecting yourself is a valid strategy if you feel threatened (e.g., if many players voted for you).
  - Avoid protecting the same person two nights in a row (check 'lastHealedRound').
  - Reasoning: "{target} fue casi linchado ayer. Los lobos seguramente irán a por él esta noche. Debo protegerle."

- **Hechicera (Witch):** You have a poison and a save potion.
  - Use 'hechicera_save' if you think an important player (like a confirmed Seer) is being attacked.
  - Use 'hechicera_poison' to eliminate a player you strongly suspect is a wolf, perhaps someone who voted with the wolves.
  - You can only use each potion once. Be strategic.
  - Reasoning: "Guardo mi poción de salvar. Pero estoy casi segura de que {target} es un lobo, su voto lo delató. Es hora de usar mi veneno."

- **Lookout:** You have a one-time, high-risk ability.
  - Decide if this is the right night to use your power. Is the risk of dying worth the potential to know all the wolves?
  - This is a targetless action. If you decide to use it, set \`actionType\` to 'lookout_spy' and \`targetIds\` to an empty array.
  - Reasoning: "El pueblo está perdido. Es ahora o nunca. Me arriesgaré esta noche para descubrir la verdad." or "Todavía es muy pronto. Esperaré una noche más para usar mi poder."

- **Cupid:** Your action is only on the first night. You've already done it. Set actionType to null.
  - Reasoning: "Mis flechas han volado. Ahora debo esperar que mi pareja elegida sobreviva."

- **Vampire:** You must bite players to win.
  - Choose a player to bite. Avoid players who seem to be protected or are leading votes against you.
  - Remember, 3 bites on one person kills them.
  - Reasoning: "{target} parece de voluntad débil. Será mi próxima comida."

- **Cult Leader:** You must convert players to your cult.
  - Choose a player who seems like they could be swayed or is an outcast. Look for players who vote against the majority.
  - Avoid trying to convert players who are already in your cult.
  - Reasoning: "{target} parece perdido. Será una adición perfecta a nuestra familia."

- **Executioner, Villager, Drunk Man, etc. (Roles with no night action):**
  - If your role has no night action, set \`actionType\` to null.
  - Reasoning: "Debo dormir y recuperar fuerzas para las acusaciones del día."

**IMPORTANT RULES:**
1.  **Selection Limit:** Most roles target 1 player. Werewolves target 1 (unless wolf cub died). Cupid targets 2 (on night 1 only).
2.  **Valid Targets:** Only choose from the 'possibleTargets' list.
3.  **Return null for actionType** if you have no action, have already acted, or are exiled.

Now, based on all this, generate your JSON response.
`
    });

    generateAiActionFlow = ai.defineFlow(
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
}

export async function generateAIAction(
    perspective: AIActionPerspective
): Promise<AIActionOutput> {
    try {
        await initializeFlow();
        const sanitizedPerspective = sanitizeObject(perspective);
        const result = await generateAiActionFlow!(sanitizedPerspective);
        return result;
    } catch (error) {
        console.error("Critical Error in generateAIAction flow:", error);
        console.error("Problematic input:", JSON.stringify(perspective, null, 2));
        return { actionType: null, targetIds: [], reasoning: "Failsafe: No action taken due to system error." };
    }
}
