# El Pueblo Duerme

Este es un juego de misterio, engaño y supervivencia, similar al clásico juego de mesa Werewolf o Mafia, implementado como una aplicación web con Next.js y Firebase.

---

## Cómo Subir Cambios a GitHub (Guía Definitiva)

Has encontrado problemas persistentes para subir tu código. La causa era una configuración incorrecta del repositorio (un "submódulo"). El problema ya está solucionado.

**A partir de ahora, puedes seguir el proceso normal sin problemas.**

### El Proceso para Subir Cambios

Cada vez que quieras guardar una nueva versión de tu código en GitHub, sigue estos 3 pasos:

**Paso 1: Añadir todos tus archivos nuevos y modificados**
Este comando prepara todos los archivos que has modificado.

```bash
git add .
```

**Paso 2: Crear un punto de guardado con un mensaje descriptivo**
Esto crea un punto de guardado con un mensaje que describe los cambios.

```bash
git commit -m "Describe aquí el cambio que has hecho, ej: ¡Versión final! El juego termina correctamente."
```

**Paso 3: Subir todos los cambios a GitHub**
Este es el comando final que sube tus cambios.

```bash
git push origin main
```

---

### **Nota MUY IMPORTANTE sobre la Autenticación**

Si al ejecutar `git push`, el terminal te pide tu `Username` y `Password`:

*   **Username:** Tu nombre de usuario de GitHub (`SecureCall`).
*   **Password:** **NO uses tu contraseña de GitHub.** Debes usar un **Token de Acceso Personal (Personal Access Token)**.
    *   Puedes generar uno nuevo aquí: [Generar nuevo token en GitHub](https://github.com/settings/tokens/new)
    *   Asegúrate de darle permisos de **`repo`**.
    *   **¡Copia el token en un lugar seguro, solo se muestra una vez!**
