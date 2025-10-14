# El Pueblo Duerme

Este es un juego de misterio, engaño y supervivencia, similar al clásico juego de mesa Werewolf o Mafia, implementado como una aplicación web con Next.js y Firebase.

## Cómo subir los cambios a GitHub (Solución Definitiva)

Has encontrado un problema de autenticación persistente al intentar subir los cambios desde el entorno de desarrollo online. Esto se debe a un **fallo de configuración de ese entorno específico**, no a un error tuyo.

La solución es subir el código desde tu propio ordenador. Aquí tienes los pasos exactos para hacerlo:

1.  **Descarga el Proyecto:** Asegúrate de tener todos los archivos del proyecto (la versión más reciente) en una carpeta en tu ordenador.

2.  **Abre un Terminal en tu PC:** Abre una línea de comandos (Terminal, PowerShell, Git Bash, etc.) y navega hasta la carpeta donde has guardado el proyecto.

3.  **Inicializa Git y Conecta con GitHub (si es la primera vez):**
    *   `git init -b main`
    *   `git remote add origin https://github.com/SecureCall/El-Pueblo-Duerme.git`
    *(Si te da un error diciendo que `origin already exists`, puedes saltarte este paso).*

4.  **Fuerza la URL a HTTPS (¡Paso Clave!):** Ejecuta este comando para asegurarte de que `git` use el método de autenticación correcto.
    ```bash
    git remote set-url origin https://github.com/SecureCall/El-Pueblo-Duerme.git
    ```

5.  **Añade todos los cambios:**
    ```bash
    git add .
    ```

6.  **Crea un "commit" con un mensaje:**
    ```bash
    git commit -m "Versión final con correcciones de audio y errores del Cazador"
    ```

7.  **Sube los cambios a la rama principal (`main`):**
    ```bash
    git push -u origin main --force
    ```
    *(Usa `--force` solo esta primera vez para sobrescribir el historial si es necesario, ya que el proyecto en GitHub puede estar desactualizado).*

---

### **Nota MUY IMPORTANTE sobre la Autenticación**

Al ejecutar `git push`, es posible que el terminal te pida tu `Username` y `Password`.

*   **Username:** Tu nombre de usuario de GitHub (`SecureCall`).
*   **Password:** **NO uses tu contraseña de GitHub.** Debes usar un **Token de Acceso Personal (Personal Access Token)**. Puedes generar uno nuevo aquí:
    *   [Generar nuevo token en GitHub](https://github.com/settings/tokens/new)
    *   Asegúrate de darle permisos de **`repo`**.
    *   **¡Copia el token en un lugar seguro, solo se muestra una vez!**

---

Lamento muchísimo las frustraciones y el tiempo perdido. El código está listo, solo necesita salir de este entorno defectuoso para llegar a su destino final. Siguiendo estos pasos en tu máquina, funcionará.