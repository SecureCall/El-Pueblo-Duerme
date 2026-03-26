# El Pueblo Duerme

Un juego de deducción social multijugador en español, inspirado en Mafia/Werewolf.

## Stack

- **Framework**: Next.js 14.2.30 (App Router)
- **Estilos**: Tailwind CSS + shadcn/ui
- **Base de datos**: Firebase Firestore (tiempo real)
- **Auth**: Firebase Authentication (email/password + Google + Facebook)
- **IA**: Gemini API (generación de contenido)
- **Puerto**: 5000

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

## Motor de Juego — Roles implementados (26)

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
