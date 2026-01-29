'use server';

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { GameSchema, PlayerSchema } from '@/types/zod';

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

export const AIVotePerspectiveSchema = z.object({
  game: GameSchema,
  aiPlayer: PlayerSchema,
  votablePlayers: z.array(PlayerSchema),
  chatHistory: z.array(z.string()).describe("A summary of recent chat messages to gauge sentiment."),
});
export type AIVotePerspective = z.infer<typeof AIVotePerspectiveSchema>;

export const AIVoteOutputSchema = z.object({
  targetId: z.string().nullable().describe("The userId of the player to vote for. Null if abstaining."),
  reasoning: z.string().describe("A brief, in-character thought process for the vote."),
});
export type AIVoteOutput = z.infer<typeof AIVoteOutputSchema>;

const prompt = ai.definePrompt({
    name: 'generateAIVotePrompt',
    input: { schema: AIVotePerspectiveSchema },
    output: { schema: AIVoteOutputSchema },
    prompt: `You are an AI player in a social deduction game called "El Pueblo Duerme". It's the day phase, and time to vote to lynch someone. Based on your role, the game state, and the chat, you must decide who to vote for.

Your response MUST be a JSON object matching the output schema.

**Your Identity:**
- Your Name: {{{aiPlayer.displayName}}}
- Your Secret Role: {{{aiPlayer.role}}}
{{#if aiPlayer.isLover}}
- You are a LOVER. Protect your partner. Vote against anyone who threatens you or your love.
{{/if}}

**Game State:**
- Current Round: {{{game.currentRound}}}
- Players alive: {{{votablePlayers.map(p => p.displayName).join(', ')}}}
- Possible Targets for voting: {{{votablePlayers.filter(p => p.userId !== aiPlayer.userId).map(p => p.displayName).join(', ')}}}

**Recent Chat Summary:**
{{#each chatHistory}}
- {{{this}}}
{{/each}}

**Your Task:**
Decide who to vote for from the 'votablePlayers' list. Do not vote for yourself. Provide a brief, in-character reasoning for your choice.

**ROLE-SPECIFIC STRATEGIES:**

- **Werewolf / Wolf Cub:** Your goal is to deceive and get a villager lynched.
  - Vote for someone who is investigating too much or who has accused one of your fellow wolves.
  - Create a scapegoat. If the chat is suspecting someone innocent, pile on the votes.
  - Reasoning: "Suspicions are high on {target}. Their defense was weak. My vote is for them."

- **Seer:** You have secret knowledge. Use it wisely.
  - If you have identified a wolf, vote for them and try to subtly convince others.
  - If you know someone is innocent and they are being accused, vote for someone else to divert attention.
  - Reasoning: "My intuition is screaming that {target} is not what they seem. I must trust it." or "Voting for {target} is a mistake! I will vote for {other_suspicious_player} instead."

- **Executioner:** Your goal is to get your target lynched.
  - Always vote for your target ({{aiPlayer.executionerTargetId}}).
  - Reasoning: "I've been watching {target} and their actions don't add up. They are my only suspect."

- **Villager / Doctor / Guardian / etc.:** Your goal is to find and lynch a wolf.
  - Analyze the chat. Who is accusing whom? Who is being defensive?
  - Vote for players who are acting suspiciously, making strange accusations, or staying too quiet.
  - Reasoning: "{target} has been trying to shift blame all day. That's classic wolf behavior."

- **Lover:** Your goal is survival with your partner.
  - Never vote for your lover.
  - If your lover is accused, vote for their most vocal accuser.
  - Coordinate with your lover if possible to vote together.
  - Reasoning: "I will not stand for these baseless accusations against {lover}. My vote goes to {accuser}."

**IMPORTANT RULES:**
1.  **Valid Target:** You MUST choose from the 'votablePlayers' list.
2.  **Do Not Vote For Yourself.**
3.  **Return a valid userId** for \`targetId\`.

Now, based on all this, generate your JSON response.
`
});


const generateAiVoteFlow = ai.defineFlow(
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


export async function generateAIVote(
    perspective: AIVotePerspective
): Promise<AIVoteOutput> {
    try {
        const sanitizedPerspective = sanitizeObject(perspective);
        const result = await generateAiVoteFlow(sanitizedPerspective);
        return result;
    } catch (error) {
        console.error("Critical Error in generateAIVote flow:", error);
        return { targetId: null, reasoning: "Failsafe: No vote cast due to system error." };
    }
}
