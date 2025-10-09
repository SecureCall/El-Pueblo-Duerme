'use server';

import { ai } from '@/ai/genkit';
import { z } from 'genkit/zod';
import { Game, GameEvent, Player } from '@/types';
import { Timestamp } from 'firebase/firestore';

// Helper to convert Firestore Timestamps to something JSON-serializable (ISO strings)
const toJSONCompatible = (obj: any): any => {
    if (!obj) return obj;
    if (obj instanceof Timestamp) {
        return obj.toDate().toISOString();
    }
    if (Array.isArray(obj)) {
        return obj.map(toJSONCompatible);
    }
    if (typeof obj === 'object') {
        const newObj: { [key: string]: any } = {};
        for (const key in obj) {
            newObj[key] = toJSONCompatible(obj[key]);
        }
        return newObj;
    }
    return obj;
};

// Define serializable versions of types
const SerializablePlayerSchema = z.object({
    userId: z.string(),
    gameId: z.string(),
    role: z.string().nullable(),
    isAlive: z.boolean(),
    votedFor: z.string().nullable(),
    displayName: z.string(),
    joinedAt: z.string(), // ISO String
    lastHealedRound: z.number().optional(),
    isAI: z.boolean().optional(),
});

const SerializableGameEventSchema = z.object({
    gameId: z.string(),
    round: z.number(),
    type: z.string(),
    message: z.string(),
    data: z.any().optional(),
    createdAt: z.string(), // ISO String
});


export const TakeAITurnInputSchema = z.object({
    game: toJSONCompatible(z.custom<Game>()),
    players: z.array(SerializablePlayerSchema),
    events: z.array(SerializableGameEventSchema),
    currentPlayer: SerializablePlayerSchema,
});

export type TakeAITurnInput = z.infer<typeof TakeAITurnInputSchema>;

export const TakeAITurnOutputSchema = z.object({
    reasoning: z.string().describe("Tu proceso de pensamiento paso a paso para llegar a esta acción."),
    action: z.string().describe("La acción a realizar. Formato: 'TYPE:TARGET_ID' o 'TYPE'. Ejemplos: 'VOTE:player123', 'KILL:player456', 'HEAL:player789', 'CHECK:playerABC', 'SHOOT:playerXYZ'. Si no hay acción posible, devuelve 'NONE'."),
});

export type TakeAITurnOutput = z.infer<typeof TakeAITurnOutputSchema>;

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
- Vidente: Cada noche, puede descubrir la verdadera identidad (lobo o no) de un jugador.
- Doctor: Cada noche, puede proteger a un jugador de ser eliminado. No puede proteger a la misma persona dos noches seguidas.
- Cazador: Si es eliminado, puede disparar y eliminar a otro jugador.
- Cupido: En la primera noche, elige a dos enamorados. Si uno muere, el otro también. Los enamorados ganan si son los únicos dos supervivientes, sin importar sus bandos.

**ESTADO ACTUAL DEL JUEGO:**
- Partida: {{{JSONstringify game}}}
- Fase Actual: {{game.phase}}
- Ronda Actual: {{game.currentRound}}
- Todos los Jugadores: {{{JSONstringify players}}}
- Historial de Eventos: {{{JSONstringify events}}}

**TU IDENTIDAD:**
- Eres el jugador: {{{JSONstringify currentPlayer}}}
- Tu Rol: {{currentPlayer.role}}

**JUGADORES VIVOS:**
{{#each players}}
{{#if this.isAlive}}
- {{this.displayName}} (ID: {{this.userId}})
{{/if}}
{{/each}}

**TAREA:**
Basado en toda la información, decide tu acción.

1.  **Razonamiento (piensa paso a paso):**
    - ¿Cuál es mi rol y mi objetivo?
    - ¿Qué ha pasado en las rondas anteriores? ¿Quién murió? ¿Quién votó a quién?
    - ¿Hay algún jugador sospechoso? ¿Por qué?
    - ¿Hay algún jugador que parezca inocente o que sea valioso para mi equipo?
    - ¿Cuál es la jugada más estratégica que puedo hacer AHORA MISMO?

2.  **Acción:**
    - Basado en tu razonamiento, elige una acción.
    - El formato DEBE ser \`TYPE:TARGET_ID\`.
    - **TYPEs válidos:** VOTE (votar durante el día), KILL (hombres lobo por la noche), HEAL (doctor por la noche), CHECK (vidente por la noche), SHOOT (cazador al morir).
    - **TARGET_ID** debe ser el ID del jugador objetivo de la lista de jugadores vivos.
    - Si estás enamorado y tu amante muere, mueres de desamor, no hay acción que tomar.
    - Si no tienes ninguna acción válida o posible, devuelve 'NONE'.

**EJEMPLO DE RESPUESTA:**
{
  "reasoning": "Soy un Hombre Lobo. En la fase de día, 'Jugador A' acusó a mi compañero lobo, 'Jugador B'. 'Jugador A' parece inteligente y es una amenaza. Por la noche, mi objetivo más lógico es eliminar a 'Jugador A' para proteger a mi equipo.",
  "action": "KILL:playerA_id"
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
