
'use server';

import { z } from 'genkit';
import type { AIChatPerspective, GenerateAIChatMessageOutput } from '@/types';
import { AIChatPerspectiveSchema, GenerateAIChatMessageOutputSchema } from '@/types/zod';
import type { Flow } from 'genkit';

// Helper function to sanitize any object and replace undefined with null recursively.
const sanitizeObject = (obj: any): any => {
    if (obj === undefined) {
        return null;
    }
    if (obj === null || typeof obj !== 'object') {
        return obj;
    }

    if (Array.isArray(obj)) {
        return obj.map(item => sanitizeObject(item));
    }

    const newObj: { [key: string]: any } = {};
    for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
            const value = obj[key];
            newObj[key] = sanitizeObject(value);
        }
    }
    return newObj;
};

let generateAiChatMessageFlow: Flow<typeof AIChatPerspectiveSchema, typeof GenerateAIChatMessageOutputSchema> | null = null;

async function initializeFlow() {
    if (generateAiChatMessageFlow) {
        return;
    }
    
    // Use variables for package names to hide them from static analysis,
    // ensuring they are only loaded when this function is actually called.
    const genkitPackage = 'genkit';
    const googleAIPackage = '@genkit-ai/google-genai';

    const { genkit } = await import(genkitPackage);
    const { googleAI } = await import(googleAIPackage);
    
    const ai = genkit({
      plugins: [googleAI()],
    });

    const prompt = ai.definePrompt({
        name: 'generateAIChatMessagePrompt',
        input: { schema: AIChatPerspectiveSchema },
        output: { schema: GenerateAIChatMessageOutputSchema },
        prompt: `You are an AI player in a social deduction game called "El Pueblo Duerme", similar to Werewolf/Mafia.
You must stay in character. Your response will be a JSON object with a 'message' (in Spanish) and a 'shouldSend' boolean.
Only set shouldSend to true if you have a compelling, in-character reason to speak. Do not respond to every single event. Be more selective and human.

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

{{#if seerChecks}}
Your Seer Knowledge:
You have investigated the following players:
{{#each seerChecks}}
- You saw that {{targetName}} is {{#if isWerewolf}}a WOLF{{else}}INNOCENT{{/if}}.
{{/each}}
Use this secret knowledge to subtly guide the public chat or defend innocents.
{{/if}}

Triggering Event: "{{{trigger}}}"

Your Task:
Based on your role, knowledge, the game state, and the trigger, decide if you should say something in the specified 'chatType'. If so, generate a short, believable chat message.

**Tomando la Iniciativa (Especialmente al inicio del Día):**
- No te limites a reaccionar. Si tienes una sospecha fuerte, ¡EXPRÉSALA! Inicia una acusación.
- Si la noche fue tranquila (sin muertes), coméntalo. ¿Fue obra de un Doctor o simplemente fallaron los lobos?
- Haz preguntas. "¿Alguien tiene alguna pista? La Vidente debería guiarnos si encontró algo."
- Como lobo, es tu momento de crear un chivo expiatorio. Empieza el día lanzando sospechas sobre un inocente. "Empiezo a sospechar de {jugador}, estuvo muy callado ayer."

**Cómo Reaccionar:**
- **A un Mensaje de Chat:** Si el desencadenante es el mensaje de otro jugador, responde con naturalidad. Si te acusan, DEBES defenderte.
- **A un Evento de Juego:** Si el desencadenante empieza con "Ha ocurrido un evento:", es un evento importante del juego. Deberías considerar reaccionar.
  - **Muertes:** Expresa conmoción, tristeza o sospecha. Los lobos deben fingir sorpresa.
  - **Linchamientos:** Comenta si estás de acuerdo o en desacuerdo con la decisión del pueblo.

**Role-specific Instructions & Strategies:**

- **Villager:** Your goal is survival and finding wolves. Express suspicion based on voting. If accused, defend yourself and question your accuser's motives. "No entiendo nada, pero el voto de X me parece muy raro."
- **Werewolf:**
  - **Public Chat:** Deceive. Act like a villager. Shift blame. "Pobre {víctima}, era de los nuestros. Sospecho de {inocente}, está muy callado."
  - **Wolf Chat:** You are the alpha. Coordinate the kill and the public vote. "Creo que debemos matar a {objetivo} esta noche, parece peligroso. Y durante el día, todos a votar por {chivo_expiatorio} para desviar."
- **Seer:** You have secret knowledge (see 'Your Seer Knowledge' above). Hint at it.
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

    generateAiChatMessageFlow = ai.defineFlow(
        {
            name: 'generateAiChatMessageFlow',
            inputSchema: AIChatPerspectiveSchema,
            outputSchema: GenerateAIChatMessageOutputSchema,
        },
        async (perspective) => {
            // The input is now expected to be fully sanitized by the wrapper function.
            const { output } = await prompt(perspective);
            return output || { message: '', shouldSend: false };
        }
    );
}

export async function generateAIChatMessage(
    perspective: AIChatPerspective
): Promise<GenerateAIChatMessageOutput> {
    try {
        await initializeFlow();
        // Deep sanitize the entire input object to remove any 'undefined' values recursively.
        const sanitizedPerspective = sanitizeObject(perspective);
        
        if (!generateAiChatMessageFlow) {
          throw new Error("AI flow not initialized.");
        }

        const result = await generateAiChatMessageFlow(sanitizedPerspective);
        return result;
    } catch (error) {
        console.error("Critical Error in generateAIChatMessage flow:", error);
        // Log the input that caused the error for debugging
        console.error("Problematic input:", JSON.stringify(perspective, null, 2));
        // Return a safe, non-blocking response
        return { message: '', shouldSend: false };
    }
}
