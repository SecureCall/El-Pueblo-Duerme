# El Pueblo Duerme

Este es un juego de misterio, engaño y supervivencia, similar al clásico juego de mesa Werewolf o Mafia, implementado como una aplicación web con Next.js y Firebase.

## Cómo empezar

Este repositorio contiene el código fuente del juego. Para ponerlo en marcha en tu propio entorno, necesitarás configurar un proyecto de Firebase.

### Instrucciones para subir cambios a GitHub desde tu ordenador

Si has estado trabajando en un entorno de desarrollo online (como este) y has tenido problemas de autenticación al intentar subir tus cambios, aquí tienes la solución definitiva para hacerlo desde tu propio ordenador:

1.  **Descarga los archivos del proyecto:** Asegúrate de tener la versión más reciente de todos los archivos del proyecto en tu máquina local.
2.  **Abre un terminal:** Navega hasta la carpeta del proyecto en tu ordenador.
3.  **Añade todos los cambios:**
    ```bash
    git add .
    ```
4.  **Crea un "commit" con un mensaje:**
    ```bash
    git commit -m "Versión final con correcciones de audio y errores del Cazador"
    ```
5.  **Configura la URL del repositorio remoto (si no lo has hecho ya):**
    ```bash
    git remote add origin https://github.com/SecureCall/El-Pueblo-Duerme.git
    ```
    Si te da un error diciendo que `origin already exists`, no te preocupes, puedes saltar este paso.

6.  **Sube los cambios a la rama principal (`main`):**
    ```bash
    git push -u origin main
    ```

**Nota MUY IMPORTANTE sobre la autenticación:**
Al ejecutar `git push`, el terminal te pedirá tu `Username` (tu usuario de GitHub) y `Password`.
*   **Password:** Debes usar un **Token de Acceso Personal (Personal Access Token)** de GitHub como contraseña. Puedes generar uno nuevo en la [configuración de desarrollador de tu cuenta de GitHub](https://github.com/settings/tokens/new) (asegúrate de darle permisos de `repo`). **¡Copia el token en un lugar seguro, solo se muestra una vez!**

Lamento muchísimo las frustraciones y el tiempo perdido. El código está listo, solo necesita salir de este entorno para llegar a su destino final.