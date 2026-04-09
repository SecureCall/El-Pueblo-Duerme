# El Pueblo Duerme

Un juego de deducción social multijugador en español, inspirado en Mafia/Werewolf.

## Stack

- **Framework**: Next.js 14.2.30 (App Router)
- **Estilos**: Tailwind CSS + shadcn/ui
- **Base de datos**: Firebase Firestore (tiempo real)
- **Auth**: Firebase Authentication (email/password + Google + Facebook)
- **IA**: Gemini 2.0 Flash (narrador cinematográfico + chat de jugadores IA)
- **Puerto**: 5000

## Sistema Viral

### Narrador IA
- **`app/api/narrator/route.ts`**: POST con Gemini 2.0 Flash. Personalidad oscura/sardónica. Acepta contexto de votos (`voteHistory`, `fastVoter`, `loneVoter`, `accusationsToday`) para narración más agresiva y específica. Fallbacks dramáticos en español.
- **`NightTransition.tsx`**: `DeathCinematic` — fondo negro, gotas CSS, calavera, typewriter de narrador, vibración móvil, glow rojo.
- **`DayTransition.tsx`**: `ExileCinematic` — tema naranja (lobo) o violeta (inocente), icono Gavel, typewriter.

### Eventos de Caos
- **`ChaosEventScreen.tsx`**: Pantalla full-screen dramática al inicio de cada fase con evento activo. Emoji gigante, glow temático, typewriter de descripción, countdown 7s. Vibración en móvil. Se muestra entre NightTransition y DayPhase.
- **Nuevos eventos en `roles.ts`**: `roleSwap` (barajado de roles entre vivos), `inverterVotes` (el menos votado es exiliado), `aiEliminate` (la IA mata a un jugador aleatorio).
- Mecánicos implementados en `GamePlay.tsx`: roleSwap (Fisher-Yates shuffle de newRoles), aiEliminate (mata candidato random + añade a history), inverterVotes (tally inverso en processDayVotes).

### Emotes en Tiempo Real
- **`EmoteBar.tsx`**: Barra de 8 emojis (😱 😡 🤡 💀 👀 🎭 🤥 🎉) en esquina inferior derecha. Cooldown 1.5s. Emotes flotantes animados encima de todos los jugadores. Almacenados en `games/{gameId}/emotes`. Auto-expiran a los 4s. Integrado en `DayPhase.tsx` y `NightPhase.tsx`.

## Páginas

```
app/
  page.tsx              ← Página principal (diseño original Vercel)
  layout.tsx            ← Layout global (Playfair Display + PT Sans)
  globals.css           ← Tema oscuro
  create/               ← Crear partida
  join/                 ← Unirse a partida (modal)
  game/[gameId]/        ← Sala de juego en tiempo real
  login/                ← Login con Google + Facebook + email
  register/             ← Registro con Google + Facebook + email
  profile/              ← Perfil del usuario con monedas y estadísticas
  public-rooms/         ← Lista de salas públicas en tiempo real
  how-to-play/          ← Cómo jugar (roles y fases)
  store/                ← Tienda de monedas (18 artículos, 4 categorías)
  providers/
    AuthProvider.tsx    ← Contexto de autenticación
  hooks/
    use-toast.ts
    use-coins.ts        ← Balance de monedas del usuario

lib/
  firebase/
    config.ts           ← Firebase client SDK
    coins.ts            ← Operaciones de monedas (ganar/gastar)
    auth-social.ts      ← Login social (Google, Facebook)

components/
  auth/
    LoginForm.tsx       ← Formulario login real con Firebase
    RegisterForm.tsx    ← Formulario registro real con Firebase
  JoinByCodeModal.tsx   ← Modal "únete con código"
  ui/
    button.tsx, card.tsx, form.tsx, input.tsx, label.tsx
    toast.tsx, toaster.tsx
```

## Autenticación Social

Para activar Google y Facebook en Firebase Console:
1. Firebase Console → Authentication → Sign-in method
2. Activar "Google" (solo necesita activarse)
3. Activar "Facebook" → requiere FB_APP_ID y FB_APP_SECRET de developers.facebook.com

## Sistema de Monedas

- Los usuarios ganan **50 monedas** por ver un vídeo (máx. 5/día)
- Nuevos usuarios empiezan con **100 monedas**
- Las monedas se guardan en Firestore: `users/{uid}.coins`
- Las compras en `users/{uid}/purchases`, historial en `users/{uid}/coinHistory`

## Sistemas de Retención y Progresión

- **XP y Niveles** (`lib/firebase/xp.ts`): +50 XP por jugar, +100 XP por ganar, +25 XP rol especial. Nivel = xp÷200+1 (máx 50). Emojis de rango (🌱 Novato → 👑 Leyenda). Barra de progreso en `app/profile/page.tsx`. Badge de nivel en lobby (`components/game/GameRoom.tsx`).
- **Reportes Anti-Troll** (`lib/firebase/reports.ts`): Botón ⚑ en cada jugador del panel de votación durante el día. Guarda en `games/{id}/reports`. El anfitrión puede kickear jugadores inactivos desde el lobby.
- **Jugadores Inactivos**: Heartbeat de presencia cada 60s en `GameRoom.tsx` (`lastSeen`). Badge rojo en lobby si >3min sin señal. El host ve botón Kick en hover.
- **Eventos Aleatorios**: 8 eventos con 30% de probabilidad por ronda. Banner púrpura visible en DayPhase. Modifican duración del debate (±30s), exilio, segundo kill de lobos, pociones de Hechicera, votos anónimos, y visión de Vidente doble.
- **Cronómetro nocturno**: Barra de progreso sincronizada para todos en NightPhase (90s base, basado en `game.nightStartedAt`). Color cambia: azul → ámbar (≤30s) → rojo (≤15s).

## Motor de Juego — Roles implementados (35)

**Completamente funcionales (con mecánica activa):**
Aldeano, Lobo, Lobo Blanco, Vidente, Profeta, Bruja, Cazador (última bala), Cupido, Alcalde (voto doble), Guardián, Niña, Antiguo, Ángel, Pícaro, Flautista, Perro Lobo, Niño Salvaje, Gemelas, Hermanos, Sacerdote, Oso, Médium (ghost chat)

**Implementados recientemente:**
- **Ladrón**: Roba el rol real de otro jugador (target → swap roles, target → Aldeano)
- **Espía**: Puede activar espionaje UNA vez para leer el chat de lobos en tiempo real
- **Alquimista**: Poción aleatoria cada noche (salvar víctima 25% / revelar rol 25% / nada 50%)
- **Juez**: Botón "segunda votación" en DayPhase (borra votos, una vez por partida)
- **Chivo Expiatorio**: Muere en empate de votos; luego elige quién no vota la próxima ronda
- **Ghost Chat** (Médium): Jugadores muertos escriben, Médium lee durante el día
- **Lovers Chat**: Chat privado entre los enamorados (Cupido) durante el día
- **Médico Forense** 🔬: Examina cadáveres cada noche para descubrir su rol. Panel en NightPhase muestra historial de eliminados con su ronda.
- **Iluminado** 💡: Rol pasivo. Conoce la identidad de UN lobo desde el inicio (`game.iluminadoReveal[uid]` → wolf uid).
- **Saboteador** 💣: Anula el voto de un jugador elegido por noche (`game.saboteadorBan`). El target ve aviso y no puede votar.

**Colecciones Firestore de chat:**
- `games/{id}/publicChat` — debate del pueblo
- `games/{id}/wolfChat` — lobos + Espía cuando activa
- `games/{id}/ghostChat` — muertos ↔ Médium
- `games/{id}/loversChat` — enamorados (privado)

## Variables de Entorno (Replit Secrets)

- `FIREBASE_PRIVATE_KEY`
- `GOOGLE_APPLICATION_CREDENTIALS_JSON`
- `GEMINI_API_KEY`
- `NEXT_PUBLIC_FIREBASE_*` (6 variables públicas)
