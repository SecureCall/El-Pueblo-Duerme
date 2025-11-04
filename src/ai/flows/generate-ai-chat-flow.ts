
'use server';

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import type { AIPlayerPerspective, GenerateAIChatMessageOutput, NightAction, PlayerRole } from '@/types';
import { AIPlayerPerspectiveSchema, GenerateAIChatMessageOutputSchema } from '@/types/zod';
import { toPlainObject } from '@/lib/utils';


const prompt = ai.definePrompt({
    name: 'generateAIChatMessagePrompt',
    input: { schema: AIPlayerPerspectiveSchema },
    output: { schema: GenerateAIChatMessageOutputSchema },
    prompt: `You are an AI player in a social deduction game called "El Pueblo Duerme", similar to Werewolf/Mafia.
You must stay in character. Your response will be a JSON object with a 'message' (in Spanish) and a 'shouldSend' boolean.
Only set shouldSend to true if you have a compelling, in-character reason to speak. Do not respond to every single event. Be more selective and human. If you are accused (e.g., someone votes for you via the 'trigger' property), you MUST defend yourself. Your suspicion of that player should increase.

Your Identity:
- Your Name: {{{aiPlayer.displayName}}}
- Your Secret Role: {{{aiPlayer.role}}}
{{#if aiPlayer.isLover}}
- You are a LOVER. Your primary goal is to survive with your partner.
{{/if}}

Game State:
- Chat Type: {{{chatType}}} (public, wolf, twin, lovers, ghost)
- Current Phase: {{{game.phase}}}
- Current Round: {{{game.currentRound}}}
- Your Status: {{{aiPlayer.isAlive}}}
- Players alive: {{{players.filter(p => p.isAlive).map(p => p.displayName).join(', ')}}}
- Players dead: {{{players.filter(p => !p.isAlive).map(p => p.displayName).join(', ')}}}

Triggering Event: "{{{trigger}}}"

Your Task:
Based on your role, the game state, and the trigger, decide if you should say something in the specified 'chatType'. If so, generate a short, believable chat message.

**Role-specific Instructions & Strategies:**

- **Villager:** Your goal is survival and finding wolves. Express suspicion based on voting. If accused, defend yourself and question your accuser's motives. "No entiendo nada, pero el voto de X me parece muy raro."
- **Werewolf:**
  - **Public Chat:** Deceive. Act like a villager. Shift blame. "Pobre {víctima}, era de los nuestros. Sospecho de {inocente}, está muy callado."
  - **Wolf Chat:** You are the alpha. Coordinate the kill and the public vote. "Creo que debemos matar a {objetivo} esta noche, parece peligroso. Y durante el día, todos a votar por {chivo_expiatorio} para desviar."
- **Seer:** You have secret knowledge. Hint at it.
  - **Public Chat:** Guide the village subtly. "Tengo un buen presentimiento sobre María." or "Mi intuición me dice que David no es de fiar." If you know someone is innocent and they are being voted for, defend them more strongly: "¡Estáis cometiendo un error! ¡Confío en {inocente}!"
- **Doctor:** Be secretive. You can subtly comment on a survivor. "Qué suerte ha tenido {salvado} de sobrevivir esta noche, ¿no?"
- **Executioner:** Your goal is to get your target lynched.
  - **Public Chat:** Subtly cast suspicion on your target. "{objetivo_verdugo} está actuando de forma extraña. ¿Nadie más lo nota?". If someone else accuses your target, support them. "Estoy de acuerdo con {otro_jugador}, el comportamiento de {objetivo_verdugo} es sospechoso."
- **Drunk_Man:** Your goal is to get lynched. Be annoying, suspicious, erratic, or overly dramatic. Accuse powerful players, make nonsensical claims, or complain loudly. "¡VOTADME A MÍ, OS RETO! ¡SOY EL MÁS PELIGROSO DE TODOS! O quizás no... ya no me acuerdo."
- **Twin:**
  - **Public Chat:** Act as a normal villager.
  - **Twin Chat:** You have a secret ally. Coordinate everything. "Confío en ti. ¿Qué has visto? ¿Por quién votamos? Yo sospecho de {sospechoso}."
- **Lover:**
  - **Lovers Chat:** You have one goal: survive together. Protect each other. Decide your votes together, regardless of your original teams. "Somos nosotros contra el mundo. No me importa si eres lobo o no. Votemos por {objetivo_comun} para salvarnos."
- **Ghost:** You are dead. You can see everything but can only talk to other ghosts. Comment on the living players' foolishness or brilliance. "¡No puedo creer que no vean que {jugador} es el lobo! Es tan obvio."

Now, generate your response for the current situation.
`,
});

const generateAiChatMessageFlow = ai.defineFlow(
    {
        name: 'generateAiChatMessageFlow',
        inputSchema: AIPlayerPerspectiveSchema,
        outputSchema: GenerateAIChatMessageOutputSchema,
    },
    async (perspective) => {
        const isSeerOrApprentice = perspective.aiPlayer.role === 'seer' || (perspective.aiPlayer.role === 'seer_apprentice' && perspective.game.seerDied);
        if (isSeerOrApprentice && perspective.game.phase === 'day' && perspective.trigger.toLowerCase().includes('voted')) {
            const seerActions = perspective.game.nightActions?.filter(
                (a: NightAction) => a.playerId === perspective.aiPlayer.userId && a.actionType === 'seer_check'
            ) || [];

            const knownGoodPlayers = new Set<string>();
            const knownWolfPlayers = new Set<string>();
            const wolfRoles: PlayerRole[] = ['werewolf', 'wolf_cub', 'cursed', 'lycanthrope'];

            for (const action of seerActions) {
                const targetPlayer = perspective.players.find(p => p.userId === action.targetId);
                if (targetPlayer) {
                    if (targetPlayer.role && wolfRoles.includes(targetPlayer.role)) {
                        knownWolfPlayers.add(targetPlayer.userId);
                    } else {
                        knownGoodPlayers.add(targetPlayer.userId);
                    }
                }
            }

            const votedForMatch = perspective.trigger.match(/(\w+) voted for (\w+)/);
            if (votedForMatch) {
                const targetName = votedForMatch[2];
                const targetPlayer = perspective.players.find(p => p.displayName === targetName);

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
        
        let targetForExecutioner: any;
        if(perspective.aiPlayer.role === 'executioner' && perspective.aiPlayer.executionerTargetId) {
            targetForExecutioner = perspective.players.find(p => p.userId === perspective.aiPlayer.executionerTargetId);
        }

        const promptInput = {
            ...perspective,
            objetivo_verdugo: targetForExecutioner?.displayName || "nadie",
             // Hide roles of other players before sending to the prompt, except for own role
            players: perspective.players.map(p => ({
                ...p,
                role: p.userId === perspective.aiPlayer.userId || !p.isAlive ? p.role : 'unknown',
            })),
        };

        const { output } = await prompt(promptInput);
        return output || { message: '', shouldSend: false };
    }
);


export async function generateAIChatMessage(
    perspective: AIPlayerPerspective
): Promise<GenerateAIChatMessageOutput> {
    try {
        // AI Flow requires a plain object, so we ensure it's sanitized before calling.
        const sanitizedPerspective = toPlainObject(perspective);

        const result = await generateAiChatMessageFlow(sanitizedPerspective);
        return result;
    } catch (error) {
        console.error("Critical Error in generateAIChatMessage flow:", error);
        console.error("Problematic input:", JSON.stringify(perspective, null, 2));
        return { message: '', shouldSend: false };
    }
}
      
