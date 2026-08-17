# El Pueblo Duerme — Android + iOS

## Objetivo

Preparar el proyecto para publicar una aplicación Android en Google Play y una aplicación iOS en App Store sin duplicar el motor del juego.

## Arquitectura

- Next.js/Vercel: web y API.
- Firebase: Auth, Firestore y servicios de datos.
- Capacitor: contenedor nativo Android/iOS.
- El cliente móvil nunca será la autoridad del juego.
- Las decisiones sensibles deben resolverse mediante APIs server-side y transacciones Firestore.

## Identidad de aplicación

- Android/iOS bundle ID: `com.securecall.elpuebloduerme`
- Nombre visible: `El Pueblo Duerme`

## Desarrollo local

1. Instalar dependencias.
2. Configurar `CAP_SERVER_URL` si se quiere apuntar a otro entorno.
3. Ejecutar `npm run build` antes de sincronizar Capacitor.
4. Ejecutar `npx cap sync`.
5. Abrir Android Studio con `npx cap open android`.
6. Abrir Xcode con `npx cap open ios`.

## Importante sobre Next.js

La primera fase utiliza la URL de producción como origen del WebView porque el proyecto actual contiene API routes/server-side y no es todavía una aplicación Next.js puramente estática.

Antes de la publicación definitiva se debe completar una segunda fase:

- separar claramente UI móvil y APIs;
- eliminar dependencias de APIs del cliente que requieran `window` durante SSR;
- preparar una estrategia de assets locales/offline para la carcasa móvil;
- integrar deep links;
- integrar FCM/APNs;
- integrar Sign in with Apple y Google Sign-In;
- gestionar suspensión/reanudación y reconexión;
- configurar iconos, splash screen y assets de las tiendas;
- configurar firma Android/iOS y variables de producción.

## Seguridad

Nunca poner credenciales Firebase Admin, claves privadas, secretos de VAPID, claves de APNs ni secretos de servidor en la aplicación móvil.

La APK/IPA se considera un cliente no confiable. El servidor debe validar autenticación, rol, fase, objetivos y permisos de cada acción de juego.
