
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

