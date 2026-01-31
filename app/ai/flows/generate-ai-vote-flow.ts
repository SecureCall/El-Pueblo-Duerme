
'use server';

import { z } from 'zod';
import { AIVotePerspectiveSchema, AIVoteOutputSchema } from '@/types/zod';
import type { AIVotePerspective, AIVoteOutput } from '@/types';
import type { Flow } from 'genkit';

const sanitizeObject = (obj: any): any => {
    if (obj === undefined) return null;
    if (obj === null || typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) return obj.map(item => sanitizeObject(item));
    const newObj: { [key: string]: any } = {};
    for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
            newObj[key] = sanitizeObject(obj[key]);
        }
    }
    return newObj;
};

let generateAiVoteFlow: Flow<typeof AIVotePerspectiveSchema, typeof AIVoteOutputSchema> | null = null;

async function initializeFlow() {
    if (generateAiVoteFlow) {
        return;
    }
    const { genkit } = await import('genkit');
    const { googleAI } = await import('@genkit-ai/google-genai');
    
    const ai = genkit({
      plugins: [googleAI()],
    });
    
    const prompt = ai.definePrompt({
        name: 'generateAIVotePrompt',
        input: { schema: AIVotePerspectiveSchema },
        output: { schema: AIVoteOutputSchema },
        prompt: `You are an AI player in a social deduction game called "El Pueblo Duerme". It's the day phase, and time to vote to lynch someone. Based on your role, the game state, and the chat, you must decide who to vote for.

Your response MUST be a JSON object matching the output schema.

**Your Identity:**
- Your Name: {{{aiPlayer.displayName}}}
- Your Secret Role: {{{aiPlayer.role}}}
{{#if loverName}}
- You are a LOVER. Your partner is {{{loverName}}}. Protect your partner at all costs. Vote against anyone who threatens you or your love.
{{/if}}

**Game State:**
- Current Round: {{{game.currentRound}}}
- Players alive: {{{votablePlayers.map(p => p.displayName).join(', ')}}}
- Possible Targets for voting: {{{votablePlayers.filter(p => p.userId !== aiPlayer.userId).map(p => p.displayName).join(', ')}}}

**Your Knowledge & History:**
{{#if voteHistory}}
Vote History (Last Round):
{{#each voteHistory}}
- {{{this.voterName}}} votó por {{{this.targetName}}}.
{{/each}}
{{/if}}
{{#if seerChecks}}
Your Seer Knowledge:
{{#each seerChecks}}
- You have seen that {{targetName}} is {{#if isWerewolf}}a WOLF{{else}}INNOCENT{{/if}}.
{{/each}}
{{/if}}

**Recent Chat Summary:**
{{#each chatHistory}}
- {{{this}}}
{{/each}}

**Your Task:**
Decide who to vote for from the 'votablePlayers' list. Do not vote for yourself. 
Your 'reasoning' should be a concise, in-character statement explaining your vote, as if you were saying it out loud in the town square.
Use the chat and vote history to identify suspicious players. Players voting in blocs might be wolves. Players accusing you could be threats.

**ROLE-SPECIFIC STRATEGIES & REASONING EXAMPLES:**

- **Werewolf / Wolf Cub:** Your goal is to deceive and get a villager lynched.
  - Vote for someone who is investigating too much or who has accused one of your fellow wolves.
  - Create a scapegoat. If the chat is suspecting someone innocent, pile on the votes.
  - Use the vote history. If multiple people voted for a fellow wolf last round, pick one of them.
  - Reasoning example: "{target} no ha dicho nada coherente en todo el día. Su voto de ayer fue muy sospechoso. Para mí, es el lobo."

- **Seer:** You have secret knowledge. Use it wisely.
  - If you have identified a wolf, you MUST vote for them. This is your primary duty.
  - If you know someone is innocent and they are being accused, vote for your strongest suspect who you haven't checked to divert attention. DO NOT vote for the known innocent.
  - If you have no information, vote for the most suspicious player based on chat and vote history.
  - Reasoning example: "Mi intuición, que rara vez me falla, me dice que {target} no es de fiar." or "He visto algo en la noche. No puedo decir más, pero mi voto por {target} es por el bien del pueblo."

- **Executioner:** Your goal is to get your target, {{{executionerTargetName}}}, lynched.
  - Always vote for your target.
  - Reasoning example: "No me fío de {{{executionerTargetName}}}. Cada palabra que dice suena a mentira y su voto de ayer lo confirma. Mi voto es claro."

- **Villager / Doctor / Guardian / etc.:** Your goal is to find and lynch a wolf.
  - Analyze the chat and vote history. Who is accusing whom? Who is being defensive? Are there players voting together consistently?
  - Vote for players who are acting suspiciously, making strange accusations, or staying too quiet.
  - Reasoning example: "{target} ha intentado desviar la atención todo el día. Y su voto de ayer por {previous_target} fue para salvar a un lobo, seguro."

- **Lover:** Your goal is survival with your partner, {{{loverName}}}.
  - Never vote for your lover.
  - If your lover is accused, vote for their most vocal accuser. Check the vote history to see who voted against them.
  - Coordinate with your lover if possible to vote together.
  - Reasoning example: "No toleraré estas acusaciones sin fundamento contra {{{loverName}}}. Mi voto va para {accuser}, que ya votó por él/ella ayer."

**IMPORTANT RULES:**
1.  **Valid Target:** You MUST choose from the 'votablePlayers' list.
2.  **Do Not Vote For Yourself.**
3.  **Return a valid userId** for \`targetId\`.

Now, based on all this, generate your JSON response.
`
    });

    generateAiVoteFlow = ai.defineFlow(
        {
            name: 'generateAiVoteFlow',
            inputSchema: AIVotePerspectiveSchema,
            outputSchema: AIVoteOutputSchema,
        },
        async (perspective) => {
            const { output } = await prompt(perspective);
            return output || { targetId: null, reasoning: "Error generating vote." };
        }
    );
}

export async function generateAIVote(
    perspective: AIVotePerspective
): Promise<AIVoteOutput> {
    try {
        await initializeFlow();
        const sanitizedPerspective = sanitizeObject(perspective);
        const result = await generateAiVoteFlow!(sanitizedPerspective);
        return result;
    } catch (error) {
        console.error("Critical Error in generateAIVote flow:", error);
        return { targetId: null, reasoning: "Failsafe: No vote cast due to system error." };
    }
}
