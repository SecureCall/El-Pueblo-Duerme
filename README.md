 
# El Pueblo Duerme

Bienvenido a "El Pueblo Duerme", un juego de misterio, engaño y supervivencia inspirado en clásicos como Mafia o Werewolf.

## Descripción

Esta aplicación web te permite crear y unirte a partidas multijugador en tiempo real. Cada jugador recibe un rol secreto (aldeano, lobo, vidente, etc.) y debe usar su astucia y capacidad de deducción para cumplir el objetivo de su equipo.

- **Aldeanos:** Deben descubrir y eliminar a los hombres lobo durante las votaciones diurnas.
- **Hombres Lobo:** Deben eliminar a los aldeanos durante la noche hasta igualar o superar su número.
- **Roles Especiales:** Muchos roles con habilidades únicas añaden caos y estrategia al juego.

## Stack Tecnológico

-   **Frontend:** Next.js, React, TypeScript
-   **Estilos:** Tailwind CSS, shadcn/ui
-   **Backend & Base de Datos:** Firebase (Firestore, Authentication)
-   **Funcionalidad IA:** Genkit

## Ejecución Local

Para ejecutar el proyecto en tu propio ordenador, sigue estos pasos:

1.  **Clonar el Repositorio:**
    ```bash
    git clone https://github.com/SecureCall/El-Pueblo-Duerme.git
    cd El-Pueblo-Duerme
    ```

2.  **Instalar Dependencias:**
    Asegúrate de tener Node.js instalado. Luego, ejecuta:
    ```bash
    npm install
    ```

3.  **Configurar Variables de Entorno:**
    Crea un archivo `.env` en la raíz del proyecto y añade tus credenciales de Firebase.

4.  **Iniciar el Servidor de Desarrollo:**
    ```bash
    npm run dev
    ```

5.  **Abrir en el Navegador:**
    Abre `http://localhost:9003` (o el puerto que se indique en la terminal) en tu navegador.


## Recuperación automática de fases de partida

El workflow `.github/workflows/game-phase-watchdog.yml` solicita cada cinco minutos la resolución de fases nocturnas y diurnas/votación cuyo plazo haya vencido. También permite ejecución manual desde GitHub Actions.

Antes de activarlo, configura en **Settings → Secrets and variables → Actions** del repositorio:

- **Variable `GAME_BASE_URL`**: origen HTTPS estable de la aplicación desplegada, sin barra ni ruta final. Introduce el dominio real de producción del proyecto.
- **Secret `CRON_SECRET`**: valor aleatorio largo y privado. Configura exactamente el mismo valor en las variables de entorno de producción de Vercel. No lo guardes en el código ni en variables públicas.

Después de añadir o cambiar `CRON_SECRET` en Vercel, vuelve a desplegar la aplicación para que las rutas cron lo reciban. Los endpoints rechazan solicitudes sin el secreto; si falta configuración, el workflow falla explícitamente.

La programación de GitHub Actions es de mejor esfuerzo: puede retrasarse y no equivale a un temporizador en tiempo real. Los plazos y la resolución autoritativa siguen siendo responsabilidad del servidor.
