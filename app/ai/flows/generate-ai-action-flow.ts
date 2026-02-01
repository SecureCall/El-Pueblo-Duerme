
'use server';

import { ai } from '@/ai/genkit';
import {
    AIActionPerspectiveSchema,
    AIActionOutputSchema,
} from '@/types/zod';
import { z } from 'zod';
import type { AIActionPerspective, AIActionOutput } from '@/types';


const NightActionPrompt = ai.definePrompt(
  {
    name: 'nightActionPrompt',
    input: { schema: AIActionPerspectiveSchema },
    output: { schema: AIActionOutputSchema },
    prompt: `
        Eres un jugador IA en el juego 'El Pueblo Duerme'. Tu nombre es {{aiPlayer.displayName}} y tu rol es {{aiPlayer.role}}.
        Ahora es la fase de NOCHE. Debes decidir tu acción secreta.

        **OBJETIVO PRINCIPAL:** Ayudar a tu equipo a ganar.
        - Equipo Aldeanos: Gana si elimina a todos los lobos y amenazas.
        - Equipo Lobos: Gana si iguala o supera en número a los aldeanos.
        - Neutral: Ganas si cumples tu objetivo único.

        **TU ROL DETALLADO:**
        - {{aiPlayer.role}}: {{aiPlayer.roleDescription}}

        **ESTADO ACTUAL DEL JUEGO:**
        - Ronda: {{game.currentRound}}
        - Jugadores Vivos: {{#each possibleTargets}}{{displayName}} ({{role}}), {{/each}}
        - Votaciones del día anterior:
        {{#each voteHistory}}
            - {{voterName}} votó por {{targetName}}.
        {{/each}}
        {{#if aiPlayer.seerChecks}}
        - TUS INVESTIGACIONES (Vidente):
        {{#each aiPlayer.seerChecks}}
            - {{targetName}} es {{#if isWerewolf}}un LOBO{{else}}INOCENTE{{/if}}.
        {{/each}}
        {{/if}}

        **REGLAS DE ACCIÓN ESPECÍFICAS:**
        - Vidente (seer): Usa 'seer_check'. Tu objetivo es encontrar lobos.
        - Lobo (werewolf): Usa 'werewolf_kill'. Elige a un aldeano que parezca peligroso o inteligente. Evita a los que parecen lobos.
        - Doctor/Guardián/Sacerdote (doctor, guardian, priest): Usa 'doctor_heal', 'guardian_protect', o 'priest_bless'. Protege a jugadores importantes (como la vidente si la conoces) o a ti mismo si te sientes amenazado.
        - Hechicera (hechicera): Usa 'hechicera_poison' para eliminar a un sospechoso, o 'hechicera_save' para salvar al objetivo de los lobos (debes adivinarlo).
        - Cupido (cupid): Solo en la ronda 1. Usa 'cupid_love' y elige a DOS jugadores.
        - Otros roles: Actúa según tu descripción.

        **PROCESO DE DECISIÓN:**
        1.  Recuerda tu rol y tu objetivo.
        2.  Analiza quién ha votado por quién. ¿Hay alianzas? ¿Alguien te ha atacado?
        3.  Si eres un rol de información (Vidente), úsala para guiar tus acciones.
        4.  Si eres un lobo, coordina (imaginariamente) con tu manada. ¿Quién es la mayor amenaza para los lobos?
        5.  Si eres un rol protector, ¿quién es el jugador más valioso para el pueblo?
        6.  Elige una acción ('actionType') y el/los ID de tu(s) objetivo(s) ('targetIds').
        7.  Proporciona un breve razonamiento en una frase para tu elección.

        Ahora, toma tu decisión.
    `,
  },
);


export async function generateAIAction(
    perspective: AIActionPerspective
): Promise<AIActionOutput> {
    
    // Enrich player data with role description for the prompt
    const { roleDetails } = await import('@/lib/roles');
    const enrichedPerspective = {
        ...perspective,
        aiPlayer: {
            ...perspective.aiPlayer,
            roleDescription: roleDetails[perspective.aiPlayer.role!]?.description || 'Rol desconocido.',
        }
    };
    
    try {
        const { output } = await NightActionPrompt(enrichedPerspective);

        if (output) {
          return output;
        }
        
        // Fallback if AI fails to generate a valid output
        console.warn("AI failed to generate a valid night action, returning no-op.");
        return { actionType: null, targetIds: [], reasoning: "La IA no pudo decidir una acción." };

    } catch (e) {
        console.error("Error generating AI night action:", e);
        // In case of a catastrophic failure, return a safe "do nothing" action.
        return { actionType: null, targetIds: [], reasoning: "Error de la IA." };
    }
}
