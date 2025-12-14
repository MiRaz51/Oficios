# Guía futura: migración de PocketBase a plantilla moderna (0.34.2+)

Este documento describe los pasos recomendados para, **en el futuro**, migrar el backend de este proyecto a la plantilla moderna de hooks de PocketBase (v0.34.2 o superior) y poder usar la API nueva (`routerAdd`, `c.queryParam`, `c.bodyParser`, `$apis.requireRecordAuth`, etc.).

---

## 1. Copia de seguridad del entorno actual

1. **Respaldar carpeta `pb_data/` actual**
   - Desde `d:/InAudio/Catalogo de oficios/` copiar la carpeta `pb_data/` completa a un lugar seguro.
   - Opcionalmente, exportar colecciones críticas desde el panel admin (users, oficios, ofertas, calificaciones, etc.).

2. **Respaldar hooks actuales**
   - Guardar una copia de `pb_hooks/` (actualizar_felix, calificaciones, limpiar_ratings, eliminar_cuenta, etc.).

Esto permite volver atrás en caso de problemas.

---

## 2. Crear una instancia NUEVA de PocketBase 0.34.x

1. **Descargar PocketBase 0.34.x**
   - Desde la web oficial, descargar el ejecutable para Windows de la versión deseada (ej. 0.34.2).

2. **Crear una carpeta de servidor nueva** (distinta de la actual)

   Ejemplo:

   ```text
   d:/InAudio/ServidorPB_0_34/
     pocketbase.exe        (nuevo binario 0.34.x)
   ```

3. **Iniciar PocketBase una vez**

   En `d:/InAudio/ServidorPB_0_34/` ejecutar:

   ```bash
   pocketbase.exe serve
   ```

   Esto creará automáticamente:

   ```text
   pb_data/
   pb_hooks/
   pb_migrations/
   pb_data/types.d.ts
   ```

   Esta estructura es la plantilla moderna sobre la que se deben escribir los nuevos hooks.

---

## 3. Migrar esquema y datos

Hay dos caminos posibles:

### Opción A: Copiar `pb_data` (más rápida, requiere misma versión)

1. Detener la instancia nueva.
2. Copiar el contenido de `pb_data/` desde la instancia actual (la que ya tiene datos) a la nueva carpeta `ServidorPB_0_34/`, sustituyendo la `pb_data` recién creada.
3. Volver a arrancar `pocketbase.exe` en la carpeta nueva.

> Usar esta opción solo si las versiones son compatibles (por ejemplo, si simplemente se está moviendo la misma versión a otra carpeta).

### Opción B: Exportar / importar colecciones (más controlada)

1. En la instancia actual (vieja), desde el panel admin:
   - Exportar cada colección importante a JSON o CSV: `users`, `oficios`, `ofertas`, `calificaciones`, etc.

2. En la instancia nueva (0.34.x):
   - Crear las colecciones con el mismo esquema (campos, tipos, reglas).
   - Importar los datos exportados en cada colección.

Esta opción es más trabajo manual, pero es más segura si hay salto de versiones importante.

---

## 4. Reescribir hooks con la API moderna

En la carpeta nueva `pb_hooks/` de `ServidorPB_0_34/`:

1. **Eliminar/ignorar los hooks antiguos copiados tal cual** (no son compatibles con la API moderna).

2. **Escribir hooks nuevos siguiendo la documentación 0.34.x**, por ejemplo:

   - Hooks de registro (`onRecordBeforeCreate`, `onRecordBeforeUpdate`, `onRecordBeforeDelete`, etc.).
   - Rutas personalizadas con `routerAdd(method, path, handler, ...middlewares)`.

3. **Ejemplos concretos a migrar**:

   - `onRecordBeforeDelete` en `users` para:
     - Buscar oficios del usuario (`oficios` con `usuario_id = user.id`) y marcar `estado = 'inactiva'`.
     - Buscar ofertas del usuario (`ofertas` con `usuario_id = user.id`) y marcar `estado = 'inactiva'`.

   - Endpoint para eliminación por correo:
     - `POST /api/request-delete-account` que:
       - Usa `const auth = c.get("authRecord")` y `$apis.requireRecordAuth()` como middleware (en la plantilla moderna sí existe).
       - Crea un registro en `eliminaciones_pendientes` o `delete_requests` con `user`, `token`, `expires_at`, `used`.
       - Envía correo con enlace `GET /api/confirm-delete-account?token=...`.

     - `GET /api/confirm-delete-account` que:
       - Usa `c.queryParam("token")`.
       - Valida el token y expiración.
       - Marca la solicitud como `used`.
       - Llama a `dao.deleteRecord('users', userId)` para eliminar el usuario (disparando el hook de soft delete).

4. Probar cada hook en la consola del servidor nuevo y corregir errores hasta que no aparezcan mensajes rojos al arrancar.

---

## 5. Conectar el frontend al nuevo servidor

1. El frontend (HTML + JS en `assets/`) seguirá igual, pero deberá apuntar a la **URL del nuevo PocketBase**.

   - Si el nuevo servidor corre en otra IP/puerto o dominio, actualizar la inicialización de `window.pb` si es necesario.

2. Probar desde el navegador:
   - Login, creación de cuenta, publicaciones, eliminación de cuenta.

3. Cuando todo funcione contra la nueva instancia:
   - Se puede apagar la instancia antigua o dejarla como backup temporal.

---

## 6. Plan sugerido de migración (resumen)

1. Copia de seguridad de `pb_data/` y `pb_hooks/` actuales.
2. Crear carpeta nueva con PocketBase 0.34.x limpio.
3. Migrar colecciones y datos (copiar `pb_data` o exportar/importar).
4. Reescribir hooks en `pb_hooks/` usando la API moderna y probarlos.
5. Cambiar el frontend para apuntar a la nueva instancia.
6. Verificar todos los flujos críticos (login, perfil, publicaciones, eliminación de cuenta, etc.).

Con este plan documentado, podrás abordar la migración cuando te convenga, sin afectar al funcionamiento actual del proyecto.
