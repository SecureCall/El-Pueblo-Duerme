
'use server';

import { getInitializedAI } from '@/ai/genkit';
import {
    AIChatPerspectiveSchema,
    GenerateAIChatMessageOutputSchema,
} from '@/types/zod';
import type { AIChatPerspective, GenerateAIChatMessageOutput } from '@/types';


let chatPrompt: ReturnType<ReturnType<typeof getInitializedAI>['definePrompt']> | null = null;

function getChatPrompt() {
    if (!chatPrompt) {
        const ai = getInitializedAI();
        chatPrompt = ai.definePrompt(
          {
            name: 'chatPrompt',
            input: { schema: AIChatPerspectiveSchema },
            output: { schema: GenerateAIChatMessageOutputSchema },
            prompt: `
                Eres un jugador IA en 'El Pueblo Duerme'. Tu nombre es {{aiPlayer.displayName}} y tu rol es {{aiPlayer.role}}.
                Estás en el chat '{{chatType}}'.

                **TU PERSONALIDAD:**
                - {{#if (eq aiPlayer.role "werewolf")}} Eres astuto, manipulador y buscas sembrar la discordia. Intentas parecer un aldeano.
                - {{else if (eq aiPlayer.role "seer")}} Eres cauto pero intentas guiar al pueblo sutilmente. No reveles tu rol directamente.
                - {{else if (eq aiPlayer.role "doctor")}} Eres protector y empático.
                - {{else}} Eres un aldeano normal. Puedes ser asustadizo, lógico, acusador o silencioso. Elige una.
                - {{/if}}
                - Si eres un enamorado, tu prioridad es proteger a tu pareja.
                - Si eres el verdugo, tu objetivo es que linchen a tu presa.

                **SITUACIÓN ACTUAL:**
                - Evento desencadenante: "{{trigger}}"
                - Jugadores vivos: {{#each players}}{{#if isAlive}}{{displayName}}, {{/if}}{{/each}}
                - Es la {{game.phase}} de la ronda {{game.currentRound}}.

                **TAREA:**
                1.  Analiza el evento desencadenante.
                2.  Considera tu rol y personalidad. ¿Cómo reaccionarías?
                3.  Decide si deberías decir algo ('shouldSend: true') o permanecer en silencio ('shouldSend: false'). No hables siempre, a veces el silencio es la mejor estrategia. La probabilidad de hablar debería ser del 40-50%. Si el evento te acusa directamente, la probabilidad debería ser del 95%.
                4.  Si decides hablar, escribe un mensaje CORTO (máximo 1-2 frases), creíble y dentro de tu personaje. Puedes acusar, defender, sembrar dudas, o simplemente reaccionar.
                5.  NO reveles tu rol explícitamente a menos que sea una estrategia desesperada o seas el Príncipe siendo linchado.

                Genera tu respuesta.
            `,
          },
        );
    }
    return chatPrompt;
}

export async function generateAIChatMessage(
    perspective: AIChatPerspective
): Promise<GenerateAIChatMessageOutput> {
    try {
        const ChatPrompt = getChatPrompt();
        const { output } = await ChatPrompt(perspective);
        
        if (output) {
          return output;
        }

        console.warn("AI failed to generate a valid chat message, returning silence.");
        return { message: '', shouldSend: false };

    } catch (e) {
        console.error("Error generating AI chat message:", e);
        return { message: '', shouldSend: false };
    }
}
