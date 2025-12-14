# Empleos en Comunidad

Catálogo comunitario de **oficios, servicios y ofertas de empleo** con contacto directo por WhatsApp.

---

## ¿Qué es esta aplicación?

**Empleos en Comunidad** es una aplicación web pensada para barrios, asociaciones y grupos donde:

- Personas con un **oficio, profesión o habilidad práctica** pueden darse a conocer.  
- Personas que **buscan contratar** un servicio o cubrir un empleo pueden encontrar contactos de confianza en su entorno.  

Todo funciona directamente desde el navegador, sin necesidad de instalar nada.

---

## Funciones principales

### 👷 Catálogo de oficios

- Ver perfiles de personas que ofrecen servicios (fontaneros, electricistas, profesores, cuidadores, etc.).  
- Buscar por **nombre**, **oficio**, **ubicación** o **modalidad** (presencial, remoto o híbrido).  
- Ver información básica de cada perfil: experiencia, habilidades, portafolio y número de WhatsApp.

### 📣 Ofertas de empleo

- Publicar ofertas de trabajo dirigidas a oficios concretos.  
- Describir las tareas, requisitos y condiciones básicas.  
- Indicar ubicación y modalidad de trabajo.  
- Incluir un número de WhatsApp para recibir contactos de personas interesadas.

### 📱 Contacto directo por WhatsApp

- Cada perfil y oferta incluye un **botón/enlace de contacto**.  
- Al pulsarlo, se abre automáticamente WhatsApp (web o app) con el número configurado.  
- No se gestionan conversaciones dentro de la aplicación: el contacto es siempre directo entre las personas.

---

## Cómo usar la aplicación

### 1. Si buscas a alguien que trabaje para ti

1. Entra en la sección de **oficios**.  
2. Usa el buscador y los filtros para encontrar el tipo de servicio que necesitas.  
3. Abre el perfil que te interese para ver más detalles.  
4. Pulsa en el botón de **WhatsApp** para contactar directamente con la persona.

### 2. Si ofreces tus servicios (tienes un oficio)

1. En la página de oficios, pulsa **"Tengo un oficio"**.  
2. Si no has iniciado sesión, la aplicación te llevará primero a la pantalla de **cuenta** para que **inicies sesión** o **crees una cuenta nueva**.  
3. Una vez con sesión iniciada y correo verificado, vuelve a oficios y completa el formulario con tu oficio, ubicación y número de WhatsApp (se toma de tu cuenta).  
4. Describe brevemente tu experiencia y tus habilidades.  
5. Envía el formulario para publicar tu perfil en el catálogo.

### 3. Si quieres publicar una oferta de empleo

1. Entra en la sección de **ofertas**.  
2. Pulsa en **"Publicar oferta"**. Si no tienes sesión iniciada, irás primero a la pantalla de cuenta para **iniciar sesión** o **crear una cuenta**.  
3. Una vez iniciada sesión, se usará el WhatsApp de tu cuenta como número de contacto de la oferta.  
4. Selecciona el oficio al que va dirigida la oferta.  
5. Escribe la ubicación, modalidad y descripción del trabajo.  
6. Envía el formulario para que la oferta quede visible para toda la comunidad.

---

## Recomendaciones de uso

✅ Ofrece información clara y honesta sobre tu experiencia y tus servicios.  
✅ Mantén tu número de WhatsApp actualizado si cambias de teléfono.  
✅ Sé respetuoso en las conversaciones y acuerdos que hagas fuera de la aplicación.  
✅ Si una oferta deja de estar disponible, pide que se elimine o se marque como cerrada (según cómo se gestione en tu despliegue).

---

## Sesión, seguridad y privacidad (resumen)

- Para **publicar oficios u ofertas** es necesario tener una **cuenta de usuario** y haber iniciado sesión.  
- El acceso se realiza mediante **correo electrónico + contraseña**, gestionados por PocketBase.  
- El sistema cierra la sesión automáticamente tras un periodo de **inactividad prolongada**, por seguridad.  
- No se almacenan contraseñas de WhatsApp ni se gestionan chats desde la web; sólo se crean enlaces de contacto.

Para más detalles sobre tratamiento de datos y condiciones legales, consulta los diálogos de **Política de Privacidad** y **Términos de Uso** accesibles desde el pie de página de la aplicación.

---

## Aspectos técnicos (resumen)

- Aplicación web estática (HTML, CSS y JavaScript) servida como **PWA instalable** en dispositivos móviles y escritorio.  
- Uso de **PocketBase** como backend ligero para usuarios, oficios, ofertas, matches y calificaciones.  
- En desarrollo se utiliza una instancia local (`http://127.0.0.1:8090`) y en producción una instancia desplegada en la nube (Railway).  
- Soporte de **modo offline básico** mediante *service worker* que cachea el esqueleto de la app para que cargue más rápido.  
- Comunicación por **HTTPS** en despliegues productivos correctamente configurados.
 

---

## Contacto y soporte

Si necesitas ayuda técnica, quieres proponer una mejora o tienes dudas sobre el funcionamiento de la aplicación, puedes contactar con el desarrollador:

- **Desarrollador:** GMR  
- **Correo electrónico:** miraz.gmr51@gmail.com

---

**Empleos en Comunidad** – Conectando oficios, personas y oportunidades.  
**Desarrollado por:** GMR

