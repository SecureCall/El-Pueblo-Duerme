
'use server';

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import type { TakeAITurnInput, TakeAITurnOutput } from '@/types';

// Zod schemas are defined here to keep them in a server-only context
export const TakeAITurnInputSchema = z.object({
    game: z.string().describe("A JSON string representing the entire game state object."),
    players: z.string().describe("A JSON string representing an array of all player objects in the game."),
    events: z.string().describe("A JSON string representing an array of all game events that have occurred."),
    currentPlayer: z.string().describe("A JSON string representing the player object for the AI that is taking its turn."),
});

export const TakeAITurnOutputSchema = z.object({
    reasoning: z.string().describe("Your step-by-step thought process to arrive at this action."),
    action: z.string().describe("The action to take. Format: 'TYPE:TARGET_ID' or 'TYPE'. Examples: 'VOTE:player123', 'KILL:player456', 'HEAL:player789', 'CHECK:playerABC', 'SHOOT:playerXYZ', 'POISON:player111', 'SAVE:player222'. If no action is possible, return 'NONE'."),
});

export async function takeAITurn(input: TakeAITurnInput): Promise<TakeAITurnOutput> {
    return takeAITurnFlow(input);
}


const prompt = ai.definePrompt({
    name: 'takeAITurnPrompt',
    input: { schema: TakeAITurnInputSchema },
    output: { schema: TakeAITurnOutputSchema },
    prompt: `Eres un jugador experto en el juego 'El Pueblo Duerme' (similar a Mafia o Werewolf). Estás jugando como un bot de IA. Tu objetivo es ganar la partida para tu facción.

Analiza el estado actual del juego y decide la mejor acción a tomar. Piensa paso a paso.

**REGLAS DEL JUEGO:**
- Aldeanos: Ganan si eliminan a todos los hombres lobo.
- Hombres Lobo: Ganan si igualan o superan en número a los aldeanos.
- Vidente: Cada noche, puede descubrir la verdadera identidad (lobo o no) de un jugador. El Licántropo se ve como lobo.
- Doctor: Cada noche, puede proteger a un jugador de ser eliminado. No puede proteger a la misma persona dos noches seguidas.
- Cazador: Si es eliminado, puede disparar y eliminar a otro jugador.
- Cupido: En la primera noche, elige a dos enamorados. Si uno muere, el otro también. Ganan si son los únicos supervivientes.
- Hechicera: Tiene una poción de veneno (para matar) y una de salvación. Puede usar cada una una vez por partida. La de salvación se usa sobre un jugador para protegerlo esa noche del ataque del lobo.
- Príncipe: Si es el más votado para ser linchado, sobrevive revelando su identidad. No puede ser linchado por votación.
- Gemelas: Dos jugadoras que se conocen y saben que son aliadas desde el principio.
- Licántropo: Un aldeano que es visto como lobo por la Vidente.

**ESTADO ACTUAL DEL JUEGO (en formato JSON):**
- Partida: {{{game}}}
- Todos los Jugadores: {{{players}}}
- Historial de Eventos: {{{events}}}

**TU IDENTIDAD:**
- Eres el jugador: {{{currentPlayer}}}

**TAREA:**
Basado en toda la información, y especialmente en tu identidad y rol dentro de 'currentPlayer', decide tu acción para la fase actual.

1.  **Razonamiento (piensa paso a paso):**
    - ¿Cuál es mi rol y mi objetivo?
    - ¿En qué fase estamos (noche/día)? ¿Qué acciones puedo realizar?
    - ¿Qué ha pasado en las rondas anteriores? ¿Quién murió? ¿Quién votó a quién?
    - ¿Hay algún jugador sospechoso? ¿Por qué?
    - ¿Hay algún jugador que parezca inocente o que sea valioso para mi equipo (ej. mi gemelo/a, mi enamorado/a)?
    - ¿Cuál es la jugada más estratégica que puedo hacer AHORA MISMO? (ej. como Hechicera, ¿es mejor guardar mis pociones o usarlas ahora?).

2.  **Acción:**
    - Basado en tu razonamiento, elige UNA SOLA acción.
    - El formato DEBE ser \`TYPE:TARGET_ID\` o \`TYPE\`.
    - **TYPEs válidos:**
        - **VOTE**: votar durante el día.
        - **KILL**: hombres lobo por la noche.
        - **HEAL**: doctor por la noche.
        - **CHECK**: vidente por la noche.
        - **SHOOT**: cazador al morir.
        - **POISON**: hechicera, usar veneno.
        - **SAVE**: hechicera, usar poción de salvación.
    - **TARGET_ID** debe ser el userId de un jugador vivo.
    - Si no tienes ninguna acción válida o posible, devuelve 'NONE'.

**EJEMPLO DE RESPUESTA (HECHICERA):**
{
  "reasoning": "Soy la Hechicera. En el día, el Jugador X defendió a un lobo conocido, así que es muy sospechoso. Usaré mi poción de veneno en él esta noche para eliminar una amenaza clara. Guardaré mi poción de salvación para más adelante, cuando sepa quién es la vidente o el doctor.",
  "action": "POISON:playerX_id"
}

Ahora, proporciona tu razonamiento y acción para el estado actual del juego.`
});


const takeAITurnFlow = ai.defineFlow(
    {
        name: 'takeAITurnFlow',
        inputSchema: TakeAITurnInputSchema,
        outputSchema: TakeAITurnOutputSchema,
    },
    async (input) => {
        // The context can be large, so we use a model that can handle it.
        const { output } = await prompt(input, { model: 'googleai/gemini-1.5-flash' });
        return output!;
    }
);
