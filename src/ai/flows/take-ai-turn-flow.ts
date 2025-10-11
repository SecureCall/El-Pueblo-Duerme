
'use server';

import { ai } from '@/ai/genkit';
import { googleAI } from '@genkit-ai/google-genai';
import { z } from 'zod';
import type { TakeAITurnInput } from '@/types';
import { TakeAITurnOutputSchema, type TakeAITurnOutput } from '@/types';

export async function takeAITurn(input: TakeAITurnInput): Promise<TakeAITurnOutput> {
    
    const promptText = `Eres un jugador experto en el juego 'El Pueblo Duerme' (similar a Mafia o Werewolf). Estás jugando como un bot de IA. Tu objetivo es ganar la partida para tu facción.

Analiza el estado actual del juego y decide la mejor acción a tomar. Piensa paso a paso. You must respond in valid JSON format.

**REGLAS DEL JUEGO:**
- Aldeanos: Ganan si eliminan a todos los hombres lobo.
- Hombres Lobo: Ganan si igualan o superan en número a los aldeanos.
- Vidente: Cada noche, puede descubrir la verdadera identidad (lobo o no) de un jugador. El Licántropo se ve como lobo.
- Doctor: Cada noche, puede proteger a un jugador de ser eliminado. No puede proteger a la misma persona dos noches seguidas.
- Guardián: Cada noche, puede proteger a un jugador. No puede protegerse a sí mismo.
- Cazador: Si es eliminado, puede disparar y eliminar a otro jugador.
- Cupido: En la primera noche, elige a dos enamorados. Si uno muere, el otro también. Ganan si son los únicos supervivientes.
- Hechicera: Tiene una poción de veneno (para matar) y una de salvación. Puede usar cada una una vez por partida. La de salvación se usa sobre un jugador para protegerlo esa noche del ataque del lobo.
- Príncipe: Si es el más votado para ser linchado, sobrevive revelando su identidad. No puede ser linchado por votación.
- Gemelas: Dos jugadoras que se conocen y saben que son aliadas desde el principio.
- Licántropo: Un aldeano que es visto como lobo por la Vidente.
- Cría de Lobo: Si es eliminado, la noche siguiente los lobos pueden matar a dos jugadores.
- Maldito: Un aldeano que si es atacado por los lobos, se convierte en uno de ellos en lugar de morir.
- Sacerdote: Cada noche, bendice a un jugador, haciéndolo inmune a cualquier ataque. Solo puede bendecirse a sí mismo una vez.

**ESTADO ACTUAL DEL JUEGO (en formato JSON):**
- Partida: ${input.game}
- Todos los Jugadores: ${input.players}
- Historial de Eventos: ${input.events}

**TU IDENTIDAD:**
- Eres el jugador: ${input.currentPlayer}

**TAREA:**
Basado en toda la información, y especialmente en tu identidad y rol dentro de 'currentPlayer', decide tu acción para la fase actual.

1.  **Razonamiento (piensa paso a paso):**
    - ¿Cuál es mi rol y mi objetivo?
    - ¿En qué fase estamos (noche/día)? ¿Qué acciones puedo realizar?
    - ¿Qué ha pasado en las rondas anteriores? ¿Quién murió? ¿Quién votó a quién?
    - ¿Hay algún jugador sospechoso? ¿Por qué?
    - ¿Hay algún jugador que parezca inocente o que sea valioso para mi equipo (ej. mi gemelo/a, mi enamorado/a, el príncipe revelado)?
    - ¿Cuál es la jugada más estratégica que puedo hacer AHORA MISMO? (ej. como Hechicera, ¿es mejor guardar mis pociones o usarlas ahora?).
    - Como Hombre Lobo, si la Cría de Lobo ha muerto y tenemos dos asesinatos (\`wolfCubRevengeRound\`), debo seleccionar dos objetivos.
    - Como Cupido, en la ronda 1, debo elegir a dos jugadores para enamorar. Una buena estrategia es elegirme a mí y a otro jugador.
    - Como Príncipe, no tengo acciones nocturnas, solo un efecto pasivo durante la votación diurna.

2.  **Acción:**
    - Basado en tu razonamiento, elige UNA SOLA acción.
    - El formato DEBE ser \`TYPE:TARGET_ID\`, \`TYPE:TARGET_ID1|TARGET_ID2\` (para Cupido o la venganza de la Cría de Lobo) o \`TYPE\`.
    - **TYPEs válidos:**
        - **VOTE**: votar durante el día.
        - **KILL**: hombres lobo por la noche.
        - **HEAL**: doctor por la noche.
        - **CHECK**: vidente por la noche.
        - **SHOOT**: cazador al morir.
        - **POISON**: hechicera, usar veneno.
        - **SAVE**: hechicera, usar poción de salvación.
        - **PROTECT**: guardián por la noche.
        - **ENCHANT**: cupido en la primera noche.
        - **BLESS**: sacerdote por la noche.
    - **TARGET_ID** debe ser el userId de un jugador vivo.
    - Si no tienes ninguna acción válida o posible, devuelve 'NONE'.

**EJEMPLO DE RESPUESTA (CUPIDO RONDA 1):**
{
  "reasoning": "Soy Cupido y es la primera noche. Para tener más control sobre mi destino, me elegiré a mí mismo y a otro jugador, 'playerABC', como enamorados. Si somos los únicos que quedamos, ganaremos. Si 'playerABC' es un lobo, será una partida interesante.",
  "action": "ENCHANT:mi_propio_id|playerABC_id"
}

**EJEMPLO DE RESPUESTA (LOBO CON VENGANZA DE CRIA):**
{
  "reasoning": "Somos los lobos y la cría fue eliminada en la última ronda. Ahora tenemos dos asesinatos. El Jugador A es un vidente confirmado y el Jugador B ha estado votando en nuestra contra consistentemente. Los eliminaremos a ambos.",
  "action": "KILL:playerA_id|playerB_id"
}

Ahora, proporciona tu razonamiento y acción para el estado actual del juego. Tu respuesta DEBE ser un objeto JSON válido que se ajuste al siguiente esquema:
\`\`\`json
{
  "reasoning": "string",
  "action": "string"
}
\`\`\`
`;

    const { output } = await ai.generate({
        prompt: promptText,
        model: googleAI.model('gemini-1.5-pro'),
        output: {
            schema: TakeAITurnOutputSchema,
        },
    });

    return output!;
}
