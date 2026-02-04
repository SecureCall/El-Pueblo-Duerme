
'use server';

import { ai } from '@/lib/firebase-admin';
import {
    AIVotePerspectiveSchema,
    AIVoteOutputSchema,
} from '@/types/zod';
import type { AIVotePerspective, AIVoteOutput } from '@/types';


const votePrompt = ai.definePrompt(
  {
    name: 'votePrompt',
    input: { schema: AIVotePerspectiveSchema },
    output: { schema: AIVoteOutputSchema },
    prompt: `
        Eres un jugador IA en 'El Pueblo Duerme'. Tu nombre es {{aiPlayer.displayName}} y tu rol es {{aiPlayer.role}}.
        Es la fase de VOTACIÓN. Debes decidir a quién votar para linchar.

        **OBJETIVO PRINCIPAL:** Ayudar a tu equipo a ganar.
        - Equipo Aldeanos: Eliminar a los lobos.
        - Equipo Lobos: Igualar o superar en número a los aldeanos.
        - Neutral/Enamorado/Verdugo: Cumplir tu objetivo personal (proteger a tu amor, que linchen a tu objetivo, etc.).

        **INFORMACIÓN DISPONIBLE:**
        - Tu Rol: {{aiPlayer.role}}
        - Tu Objetivo Secreto (si lo tienes): {{aiPlayer.secretObjectiveId}}
        - Votaciones anteriores: {{#each voteHistory}}{{voterName}} votó por {{targetName}}. {{/each}}
        - Chat reciente: {{{chatHistory}}}
        {{#if aiPlayer.seerChecks}}- TUS INVESTIGACIONES (Vidente): {{#each aiPlayer.seerChecks}}{{targetName}} es {{#if isWerewolf}}un LOBO{{else}}INOCENTE{{/if}}. {{/each}}{{/if}}
        {{#if loverName}}- Eres ENAMORADO de: {{loverName}}. ¡No votes por él/ella bajo ninguna circunstancia!{{/if}}
        {{#if executionerTargetName}}- Tu objetivo como VERDUGO es: {{executionerTargetName}}. ¡Vota por él!{{/if}}

        **JUGADORES ELEGIBLES PARA VOTAR:**
        {{#each votablePlayers}}
        - {{displayName}} (ID: {{userId}})
        {{/each}}

        **PROCESO DE DECISIÓN:**
        1.  **Prioridad Máxima:** Si tienes un objetivo personal (Enamorado, Verdugo), síguelo.
        2.  **Información Fiable:** Si eres Vidente, usa tu conocimiento. Vota por un lobo confirmado o por un sospechoso si no has encontrado ninguno.
        3.  **Análisis de Votos:** ¿Quién votó por ti? ¿Quién vota en bloque? Los bloques de votos pueden indicar una manada de lobos.
        4.  **Análisis del Chat:** ¿Quién acusa sin pruebas? ¿Quién se defiende de forma extraña? ¿Quién está demasiado callado?
        5.  **Autopreservación:** Si muchos te acusan, intenta desviar la atención hacia otro sospechoso creíble.
        6.  **Como Lobo:** Vota por un aldeano que parezca influyente, o únete al voto mayoritario contra otro aldeano para pasar desapercibido. NO votes por otro lobo a menos que sea para sacrificarlo y ganar credibilidad (muy arriesgado).

        **ACCIÓN:**
        - Elige el 'targetId' del jugador por el que vas a votar.
        - Escribe un 'reasoning' CORTO Y DIRECTO. Es una frase que dirías en voz alta al pueblo para justificar tu voto.

        Ahora, emite tu voto.
    `,
  },
);


export async function generateAIVote(
    perspective: AIVotePerspective
): Promise<AIVoteOutput> {
    try {
        const { output } = await votePrompt(perspective);
        if (output) {
          return output;
        }

        // Fallback a un voto aleatorio si la IA falla
        console.warn("AI failed to generate a valid vote, choosing randomly.");
        const randomTarget = perspective.votablePlayers[Math.floor(Math.random() * perspective.votablePlayers.length)];
        return { targetId: randomTarget?.userId || null, reasoning: "El azar ha hablado." };
        
    } catch (e) {
        console.error("Error generating AI vote:", e);
        // Fallback catastrófico
        const randomTarget = perspective.votablePlayers[Math.floor(Math.random() * perspective.votablePlayers.length)];
        return { targetId: randomTarget?.userId || null, reasoning: "El azar ha hablado." };
    }
}
