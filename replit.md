# El Pueblo Duerme

Un juego de deducción social multijugador en español, inspirado en Mafia/Werewolf.

## Stack

- **Framework**: Next.js 14.2.30 (App Router)
- **Estilos**: Tailwind CSS + shadcn/ui
- **Base de datos**: Firebase Firestore (tiempo real)
- **Auth**: Firebase Authentication
- **IA**: Gemini API (generación de contenido)
- **Puerto**: 5000

## Estructura

```
app/
  page.tsx          ← Página principal
  layout.tsx        ← Layout global (Playfair Display + PT Sans)
  globals.css       ← Tema oscuro
  create/           ← Crear partida
  join/             ← Unirse a partida
  game/[gameId]/    ← Sala de juego
  login/            ← Login
  register/         ← Registro
  store/            ← Tienda de monedas
    page.tsx
    components/
      VideoReward.tsx   ← Ver vídeos para ganar monedas
      StoreItem.tsx     ← Artículo de tienda
  providers/
    AuthProvider.tsx
  hooks/
    use-toast.ts
    use-coins.ts        ← Balance de monedas del usuario

lib/
  firebase/
    config.ts           ← Firebase client SDK
    coins.ts            ← Operaciones de monedas (ganar/gastar)

components/
  ui/
    button.tsx
    card.tsx
    toast.tsx
    toaster.tsx
```

## Sistema de Monedas

- Los usuarios ganan **50 monedas** por ver un vídeo (máx. 5/día)
- Las monedas se guardan en Firestore: `users/{uid}.coins`
- Las compras se registran en `users/{uid}/purchases`
- El historial de monedas en `users/{uid}/coinHistory`

## Categorías de la Tienda

1. **Cosméticos** — Avatares, marcos, temas, emotes
2. **Ventajas de Juego** — Salas premium, roles exclusivos, destacar sala
3. **Social** — Títulos, mensajes dorados, perfiles personalizados
4. **Recompensas** — Pases de temporada, cofres misteriosos

## Variables de Entorno

Las claves de Firebase están configuradas en Replit Secrets:
- `FIREBASE_PRIVATE_KEY`
- `GOOGLE_APPLICATION_CREDENTIALS_JSON`
- `GEMINI_API_KEY`
- `NEXT_PUBLIC_FIREBASE_*` (6 variables públicas)

## Imágenes

- `/public/noche.png` — Fondo bosque oscuro
- `/public/logo.png` — Logo del juego (lobo)
