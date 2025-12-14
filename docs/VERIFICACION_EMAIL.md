# Diseño de verificación por correo con enlace mágico

Este documento describe cómo implementar una verificación de usuarios mediante **correo electrónico + enlace mágico**, usando los componentes que ya se están utilizando en el proyecto:

- **PocketBase** como base de datos y servidor backend.
- **Gmail** como servidor SMTP, configurado directamente en PocketBase.
- Una **colección de verificaciones** en PocketBase para gestionar tokens y estados.

## 1. Objetivo

Evitar que cualquier persona (o bot) pueda crear perfiles y ofertas de empleo sin control, añadiendo una capa de verificación por correo:

1. El usuario introduce su correo (además de su WhatsApp y demás datos).
2. La aplicación envía un **correo con un enlace mágico de verificación**.
3. Hasta que el usuario no hace clic en ese enlace, el perfil/oferta no se considera verificado ni se activa.

## 2. Componentes

### 2.1. Configuración SMTP en PocketBase (Gmail)

En la consola de administración de PocketBase (Settings → Mail), configurar:

- **SMTP host**: `smtp.gmail.com`
- **SMTP port**: `587`
- **Username**: cuenta de Gmail o Google Workspace (p.ej. `tucuenta@gmail.com`).
- **Password**: **contraseña de aplicación** de Gmail (no la contraseña normal).
- **From address**: algo como `"Empleos en Comunidad" <tucuenta@gmail.com>`.

Pasos previos en la cuenta de Google:

1. Activar **verificación en dos pasos**.
2. Crear una **contraseña de aplicación** y usarla como password SMTP en PocketBase.

Con esto, PocketBase puede enviar correos usando Gmail.

### 2.2. Colección `verificaciones` en PocketBase

Crear una nueva colección, por ejemplo llamada `verificaciones`, con campos como:

- `email` (string): correo del usuario.
- `token` (string): cadena aleatoria larga, usada en el enlace mágico.
- `tipo` (string o enum): por ejemplo `"oficio"` o `"oferta"`.
- `expira_en` (datetime): fecha/hora de expiración del enlace.
- `estado` (enum): `"pendiente"`, `"usado"`, `"expirado"`.
- (Opcional) `draft_id` (relación o string): id de borrador de perfil/oferta asociado.
- (Opcional) `ip_origen` (string): IP desde la que se solicitó la verificación.

También se puede reutilizar esta colección para otros tipos de validación en el futuro.

### 2.3. Campos adicionales en `oficios` / `ofertas`

En las colecciones donde se guardan los datos públicos:

- Añadir campo booleano `verificado` (por defecto `false`).
- Opcional: campo `verificacion_id` (relación con `verificaciones`).
- Campo `estado` (ej: `"pendiente_verificacion"`, `"activo"`, `"rechazado"`).

## 3. Flujo con enlace mágico

### 3.1. Solicitud de verificación

1. El usuario rellena el formulario de **registro de oficio** o **creación de oferta** incluyendo:
   - Nombre, oficio/puesto, WhatsApp, etc.
   - **Correo electrónico**.

2. El frontend envía estos datos a PocketBase. Dos variantes posibles:

   - **A)** Guardar primero un borrador en `oficios`/`ofertas` con `verificado = false` y `estado = "pendiente_verificacion"`, y almacenar su `id` como `draft_id` en `verificaciones`.
   - **B)** Guardar solo la verificación primero, y crear el perfil/oferta únicamente cuando se haga clic en el enlace.

3. PocketBase (por lógica de tu código o por un hook) crea un registro en la colección `verificaciones` con:

   - `email`: correo introducido por el usuario.
   - `token`: token aleatorio (string seguro).
   - `tipo`: `"oficio"` o `"oferta"`.
   - `expira_en`: ahora + X minutos/hours (ej. 24 horas).
   - `estado`: `"pendiente"`.
   - Opcionalmente `draft_id` y `ip_origen`.

4. Se construye un **enlace mágico** del tipo:

   - `https://TU_DOMINIO/verificar-email?token=TOKEN_GENERADO`

5. Se envía un correo al usuario con este enlace, usando el SMTP configurado en PocketBase (Gmail).

### 3.2. Clic en el enlace mágico

1. El usuario abre su correo y hace clic en el enlace.
2. La URL apunta a un endpoint que puede estar:
   - En un **hook/custom endpoint** de PocketBase, o
   - En una pequeña API externa que a su vez llama a PocketBase.

3. Ese endpoint:

   - Lee el parámetro `token`.
   - Busca en la colección `verificaciones` un registro con:
     - `token` igual al recibido.
     - `estado = "pendiente"`.
     - `expira_en` > hora actual.

4. Si encuentra un registro válido:

   - Marca la verificación como `estado = "usado"`.
   - Dependiendo de la variante elegida:

     - **Variante A (borrador previo)**:
       - Busca el perfil/oferta en `oficios` o `ofertas` usando `draft_id`.
       - Actualiza ese registro:
         - `verificado = true`.
         - `estado = "activo"`.

     - **Variante B (crear en el momento)**:
       - Crea ahora el registro definitivo en `oficios` o `ofertas` usando los datos asociados a la verificación (pueden estar guardados en la propia colección `verificaciones` o en otra de borradores).

5. Devuelve una respuesta al navegador mostrando una página simple tipo:

   - "Tu correo ha sido verificado. Tu perfil/oferta ya está activo en Empleos en Comunidad".

### 3.3. Manejo de errores y expiración

- Si el `token` no existe, ya fue usado o está expirado (`expira_en < ahora`):
  - Mostrar un mensaje claro: "El enlace de verificación no es válido o ha caducado".
  - Opcional: ofrecer reenviar un nuevo enlace.

## 4. Consideraciones de seguridad y límite de uso

- **Límites por correo**: no permitir solicitar infinitas verificaciones para el mismo email en poco tiempo.
- **Límites por IP**: limitar el número de solicitudes de verificación por IP en un intervalo.
- **Estado de los perfiles**: solo mostrar en el catálogo público los perfiles/ofertas con `verificado = true` y `estado = "activo"`.

## 5. Ventajas de este enfoque

- No requiere servicios externos adicionales aparte de:
  - PocketBase (ya en uso).
  - Gmail como SMTP (configurable dentro de PocketBase).
- Es suficientemente robusto para:
  - Confirmar que el correo existe y el usuario tiene acceso a él.
  - Reducir creación masiva de perfiles u ofertas falsos.
- Escalable: si en el futuro se quiere usar un proveedor de email dedicado (SendGrid, MailerSend, Resend, etc.), solo habría que cambiar la configuración SMTP, manteniendo la lógica de verificación.

---

Este diseño queda como referencia para implementarlo en una fase futura del proyecto, cuando se quiera endurecer el control de creación de perfiles y ofertas de empleo.
