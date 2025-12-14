# Propuestas de mejoras para "Empleos en Comunidad"

Este documento recoge ideas de mejora que se han ido comentando para implementar más adelante.

## 1. Experiencia de usuario (UX/UI)

- **Mejorar flujos de registro y contacto**
  - Barra o pasos de progreso en el registro de oficio.
  - Mensajes de éxito y error más visibles (notificaciones tipo "toast" en lugar de solo `alert`).

- **Filtros y búsqueda más potentes**
  - Filtro por rango de rating (ej. perfiles con ≥ 4 estrellas).
  - Filtro por disponibilidad (inmediata, tardes, fines de semana, etc.).
  - Búsqueda por palabras clave en experiencia/habilidades.

- **Mejorar visualización de perfiles**
  - Mostrar badges como "Nuevo" o "Destacado".
  - Incluir un pequeño resumen de experiencia directamente en la tabla o tarjetas.

## 2. Funcionalidad adicional

- **Sistema de favoritos**
  - Permitir que el usuario guarde perfiles como favoritos (en `localStorage` o colección específica).
  - Añadir una vista "Mis profesionales guardados".

- **Historial de contactos del usuario**
  - Listar los profesionales que un usuario ya ha contactado, usando la colección `matches`.

- **Moderación de perfiles**
  - Usar un campo `estado` (`pendiente`, `aprobado`, `rechazado`).
  - Panel simple para aprobar o rechazar nuevos perfiles antes de que se muestren en el catálogo público.

## 3. Seguridad y privacidad

- **Verificación básica de teléfono**
  - Opcional: validar el número de WhatsApp antes de publicar (código de verificación o revisión manual).

- **Limitaciones adicionales de uso**
  - Reglas de límite diario de creación de perfiles por número, además del límite total existente.

## 4. Mejora técnica del código

- **Manejo de errores más amigable**
  - Sustituir `alert()` por un componente reutilizable de notificaciones.

- **Modularizar la lógica**
  - Separar `app.js` en varios módulos: `perfiles`, `matches`, `calificaciones`, `ui`, etc., para facilitar mantenimiento.

## 5. Futuras extensiones

- **PWA / modo offline avanzado**
  - La aplicación ya es instalable como PWA y cachea el *app shell* básico.  
  - Mejora futura: cachear también **datos dinámicos** (último catálogo de oficios y ofertas) para permitir consultas rápidas incluso sin conexión.

- **Métricas y analítica mínima**
  - Contar visitas a perfiles, filtros más usados, etc., para entender mejor el uso real de la aplicación.

---

Estas ideas están pensadas para priorizar más adelante según el tiempo disponible y el impacto que se quiera conseguir en el proyecto.
