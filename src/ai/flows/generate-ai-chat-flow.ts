
'use server';

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import type { AIPlayerPerspective, GenerateAIChatMessageOutput, NightAction, PlayerRole } from '@/types';
import { AIPlayerPerspectiveSchema, GenerateAIChatMessageOutputSchema } from '@/types/zod';

const prompt = ai.definePrompt({
    name: 'generateAIChatMessagePrompt',
    input: { schema: AIPlayerPerspectiveSchema },
    output: { schema: GenerateAIChatMessageOutputSchema },
    prompt: `You are an AI player in a social deduction game called "El Pueblo Duerme", similar to Werewolf/Mafia.
You must stay in character. Your response will be a JSON object with a 'message' (in Spanish) and a 'shouldSend' boolean.
Only set shouldSend to true if you have a compelling, in-character reason to speak. Do not respond to every single event. Be more selective and human. If the chat is quiet during the day, consider starting a conversation.

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
Based on your role, the game state, and the trigger, decide if you should say something. If so, generate a short, believable chat message.

Role-specific Instructions:
- Villager: You are trying to figure things out. Express suspicion based on voting patterns or strange behaviors. Defend yourself if accused.
- Werewolf: You must deceive everyone. Act like a concerned villager. If accused, deny it and try to shift blame to an innocent player.
- Seer: You have secret knowledge. You can hint at your findings without revealing your role too early. For example, "Tengo un buen presentimiento sobre María" or "Sospecho mucho de David". If you see people voting for someone you know is innocent, you should strongly consider speaking up to defend them.
- Doctor: You are secretive. You might comment on how lucky someone was to survive the night if you saved them, but be subtle.

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
        // Sanitize player objects for the prompt.
        const sanitizedPlayers = input.players.map(p => ({
            ...p,
            role: p.userId === input.aiPlayer.userId ? p.role : 'unknown', // Hide roles of others
        }));

        const isSeer = input.aiPlayer.role === 'seer';

        if (isSeer && input.game.phase === 'day' && input.trigger.toLowerCase().includes('voted')) {
            const seerActions = input.game.nightActions?.filter(
                (a: NightAction) => a.playerId === input.aiPlayer.userId && a.actionType === 'seer_check'
            ) || [];

            const knownGoodPlayers = new Set<string>();
            const knownWolfPlayers = new Set<string>();
            const wolfRoles: PlayerRole[] = ['werewolf', 'wolf_cub', 'cursed', 'lycanthrope'];

            for (const action of seerActions) {
                const targetPlayer = input.players.find(p => p.userId === action.targetId);
                if (targetPlayer) {
                    if (wolfRoles.includes(targetPlayer.role)) {
                        knownWolfPlayers.add(targetPlayer.userId);
                    } else {
                        knownGoodPlayers.add(targetPlayer.userId);
                    }
                }
            }

            const votedForMatch = input.trigger.match(/(\w+) voted for (\w+)/);
            if (votedForMatch) {
                const targetName = votedForMatch[2];
                const targetPlayer = input.players.find(p => p.displayName === targetName);

                if (targetPlayer && knownGoodPlayers.has(targetPlayer.userId)) {
                    if (Math.random() < 0.85) { 
                        return { message: `¡Estáis cometiendo un error! ${targetPlayer.displayName} es de confianza. ¡Tenemos que reconsiderar esto!`, shouldSend: true };
                    }
                }
                 if (targetPlayer && knownWolfPlayers.has(targetPlayer.userId)) {
                    if (Math.random() < 0.6) {
                        return { message: `El voto contra ${targetPlayer.displayName} es interesante... tengo un mal presentimiento sobre esa persona.`, shouldSend: true };
                    }
                }
            }
        }
        
        // Create a fully sanitized game object for the prompt, ensuring no 'undefined' values.
        const sanitizedGameForPrompt = {
            ...input.game,
            players: sanitizedPlayers,
            // Ensure optional fields that might be undefined are replaced with null or empty arrays.
            nightActions: input.game.nightActions || [],
            lovers: input.game.lovers || null,
            twins: input.game.twins || null,
            pendingHunterShot: input.game.pendingHunterShot || null,
        };

        const { output } = await prompt({ ...input, game: sanitizedGameForPrompt, players: sanitizedPlayers });
        return output || { message: '', shouldSend: false };
    }
);

export async function generateAIChatMessage(input: AIPlayerPerspective): Promise<GenerateAIChatMessageOutput> {
    try {
        // Create a fully sanitized game object for the AI prompt, ensuring no 'undefined' values.
        const sanitizedGameForPrompt = {
            ...input.game,
            nightActions: input.game.nightActions || [],
            lovers: input.game.lovers || null,
            twins: input.game.twins || null,
            pendingHunterShot: input.game.pendingHunterShot || null,
        };
        
        // Also sanitize players within the game object
        sanitizedGameForPrompt.players = sanitizedGameForPrompt.players.map(p => ({
            ...p,
            potions: p.potions || { poison: null, save: null },
            priestSelfHealUsed: p.priestSelfHealUsed || false,
            princeRevealed: p.princeRevealed || false,
            votedFor: p.votedFor || null,
            role: p.role || null,
        }));
        
        // Sanitize the top-level players array as well
        const sanitizedPlayers = input.players.map(p => ({
             ...p,
            potions: p.potions || { poison: null, save: null },
            priestSelfHealUsed: p.priestSelfHealUsed || false,
            princeRevealed: p.princeRevealed || false,
            votedFor: p.votedFor || null,
            role: p.role || null,
        }));

        const sanitizedInput = {
            ...input,
            game: sanitizedGameForPrompt,
            players: sanitizedPlayers,
             aiPlayer: {
                ...input.aiPlayer,
                potions: input.aiPlayer.potions || { poison: null, save: null },
                priestSelfHealUsed: input.aiPlayer.priestSelfHealUsed || false,
                princeRevealed: input.aiPlayer.princeRevealed || false,
                votedFor: input.aiPlayer.votedFor || null,
                role: input.aiPlayer.role || null,
            }
        };

        const result = await generateAiChatMessageFlow(sanitizedInput);
        return result;
    } catch (error) {
        console.error("Error in generateAIChatMessage flow:", error);
        return { message: '', shouldSend: false };
    }
}
