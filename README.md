# El Pueblo Duerme

Este es un juego de misterio, engaño y supervivencia, similar al clásico juego de mesa Werewolf o Mafia, implementado como una aplicación web con Next.js y Firebase.

---

## Cómo Subir Cambios a GitHub (Guía Definitiva)

Has encontrado problemas persistentes para subir tu código. Esto se debe a un **fallo de configuración del terminal online**, no a un error tuyo.

**La única solución es subir el código desde tu propio ordenador.** Aquí tienes los pasos exactos y seguros para hacerlo:

### 1. Preparar el Entorno (Solo la primera vez)

Si es la primera vez que lo haces en tu PC, sigue estos 3 pasos:

```bash
# Navega a la carpeta donde tienes el proyecto en tu ordenador
cd /ruta/a/tu/proyecto

# Conecta tu carpeta local con el repositorio de GitHub
git remote set-url origin https://github.com/SecureCall/El-Pueblo-Duerme.git

# Verifica que la URL es la correcta (debe empezar con https://)
git remote -v
```

### 2. El Proceso para Subir Cambios (Lo que harás siempre)

Cada vez que quieras guardar una nueva versión de tu código en GitHub, sigue estos 3 pasos:

**Paso A: Añadir los cambios a la "caja"**
Este comando prepara todos los archivos que has modificado.

```bash
git add .
```

**Paso B: Etiquetar la "caja" (Hacer el "commit")**
Esto crea un punto de guardado con un mensaje que describe los cambios.

```bash
git commit -m "Describe aquí el cambio que hiciste, ej: Arreglado el bug del Cazador"
```

**Paso C: Enviar la "caja" a GitHub (Hacer el "push")**
Este es el comando final que sube tus cambios.

```bash
git push origin main
```

---

### **Nota MUY IMPORTANTE sobre la Autenticación**

Al ejecutar `git push`, el terminal de tu ordenador te pedirá tu `Username` y `Password`.

*   **Username:** Tu nombre de usuario de GitHub (`SecureCall`).
*   **Password:** **NO uses tu contraseña de GitHub.** Debes usar un **Token de Acceso Personal (Personal Access Token)**.
    *   Puedes generar uno nuevo aquí: [Generar nuevo token en GitHub](https://github.com/settings/tokens/new)
    *   Asegúrate de darle permisos de **`repo`**.
    *   **¡Copia el token en un lugar seguro, solo se muestra una vez!**

---

Lamento de corazón la frustración. El código está listo. Siguiendo estos pasos en tu máquina, funcionará.