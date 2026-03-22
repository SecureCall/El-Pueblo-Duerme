# El Pueblo Duerme

Un juego de deducción social multijugador en español, inspirado en Mafia/Werewolf.

## Stack

- **Framework**: Next.js 14.2.30 (App Router)
- **Estilos**: Tailwind CSS + shadcn/ui
- **Base de datos**: Firebase Firestore (tiempo real)
- **Auth**: Firebase Authentication (email/password + Google + Facebook)
- **IA**: Gemini API (generación de contenido)
- **Puerto**: 5000

## Motor de Juego (Game Engine)

El juego es 100% automático con narrador IA:
- **Sin Máster humano** — el host actúa como "conductor" que avanza las fases con temporizadores automáticos
- **Orden de noche dinámico** — se calcula en base a qué roles están activos en la partida (lib/game/roles.ts → getNightOrder)
- **Lobos se ven entre sí** desde el inicio + chat de lobos exclusivo para coordinar kills
- **Temporizador de debate automático**: 120s (≤6), 180s (≤10), 240s (≤16), 300s (≤24), 360s (32+)
- **Audio del narrador** en todas las transiciones de fase y victorias
- **Muertes en cadena**: Cazador (última bala), Virginia Woolf (arrastra a su objetivo), Cupido (enamorados)
- **Hombre Ebrio**: gana si es eliminado — victoria especial con audio propio
- **Condición de victoria**: aldeanos (eliminan lobos), lobos (igualan aldeanos), hombre_ebrio, vampiro, verdugo

### Fases del Juego
1. `role-reveal` — Cada jugador ve su rol (10s)
2. `night` — Roles se despiertan uno a uno en orden dinámico (30s/rol)
3. `night-result` — Anuncio de muertos al amanecer (6s)
4. `day` — Debate con chat público + timer escalable (120-360s)
5. `vote` — Votación (60s)
6. `vote-result` — Veredicto + acción especial del Cazador si aplica (6s)
7. `ended` — Pantalla de victoria con todos los roles revelados

### Chats disponibles
- `lobbyChat` — Pre-partida
- `publicChat` — Debate del día
- `wolfChat` — Solo lobos (visible durante día Y noche)
- `twinChat` — Solo gemelas
- `loversChat` — Solo enamorados (Cupido)
- `ghostChat` — Solo muertos (Fantasma)

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

## Variables de Entorno (Replit Secrets)

- `FIREBASE_PRIVATE_KEY`
- `GOOGLE_APPLICATION_CREDENTIALS_JSON`
- `GEMINI_API_KEY`
- `NEXT_PUBLIC_FIREBASE_*` (6 variables públicas)
