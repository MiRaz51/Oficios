// ========== CONFIGURACIÓN POCKETBASE ==========
console.log('[APP] Versión 2.0 - Rating automático mejorado');
// POCKETBASE_URL y pb ahora se definen en core.pb.js y están disponibles en window
const COLLECTION_PERFILES = 'oficios';
const COLLECTION_MATCHES = 'matches';
const COLLECTION_CALIFICACIONES = 'calificaciones';
const MATCH_EXPIRATION_DAYS = 30;

console.log('[APP] Versión JS calificaciones = v4-debug');

// ========== ESTADO GLOBAL ==========
let __allProfiles = []; // Caché de TODOS los perfiles (versión ligera)
let __fuse = null;   // Instancia de Fuse.js
let __currentItems = [];
let __currentPerfilId = null;
let __sortColumn = 'nombre';
let __sortDirection = 'asc';
let __crossBusy = false;
let __crossTimer = null;
let __lastProfilesLoad = 0; // Marca de tiempo del último load completo de perfiles
let __cachedIP = null;      // Cache de IP pública para evitar múltiples llamadas externas

async function refreshAuthIfNeeded() {
    try {
        if (!window.pb || !window.pb.authStore || !window.pb.authStore.token) {
            return;
        }

        // Refresca el modelo de usuario (incluido verified) desde el servidor
        await window.pb.collection('users').authRefresh();
    } catch (e) {
        console.warn('[Auth] Error al refrescar la sesión, limpiando authStore:', e);
        try { window.pb.authStore.clear(); } catch (_) { }
    }
}

function scrollPerfilAlInicio() {
    const cont = document.querySelector('.perfil-container');
    if (cont) {
        cont.scrollTop = 0;
    }
}

function toTitleCase(str) {
    return (str || '')
        .toLowerCase()
        .split(/\s+/)
        .filter(Boolean)
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
}

function formatFechaCorta(isoString) {
    if (!isoString) return '';
    try {
        const d = new Date(isoString);
        if (isNaN(d.getTime())) throw new Error('Invalid date');

        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        const hh = String(d.getHours()).padStart(2, '0');
        const min = String(d.getMinutes()).padStart(2, '0');

        return `${yyyy}-${mm}-${dd} ${hh}:${min}`;
    } catch {
        return String(isoString).split('.')[0].slice(0, 16).replace('T', ' ');
    }
}

function actualizarIndicadorSesion() {
    try {
        const el = document.getElementById('sessionStatus');
        if (!el) return;

        const user = window.pb?.authStore?.model;
        if (!user) {
            el.textContent = 'No has iniciado sesión';
            return;
        }

        const estado = user.verified ? 'verificado' : 'sin verificar';
        el.textContent = `Sesión: ${user.email || 'sin email'} (${estado})`;
    } catch (e) {
        console.warn('[Sesion] No se pudo actualizar el indicador de sesión:', e);
    }
}

function isValidUrlFormat(url) {
    if (!url) return true; // Vacío es válido (campo opcional)
    const trimmed = url.trim();
    if (!/^https?:\/\//i.test(trimmed)) return false;
    try {
        new URL(trimmed);
        return true;
    } catch {
        return false;
    }
}

// ========== CAPA DE DATOS (MODELO) ==========

/**
 * Descarga TODOS los perfiles profesionales aprobados
 */
async function cargarTodosLosPerfiles() {
    try {
        const records = await pb.collection(COLLECTION_PERFILES).getFullList({
            sort: 'nombre',
            // Mostrar todos los perfiles (aprobados y pendientes)
            fields: 'id,nombre,oficio,habilidades,thabilidades,ubicacion,disponibilidad,modalidad,ratingpromedio,totalcalificaciones,totalcontactos,whatsapp,estado'
        });

        __allProfiles = records.map(r => {
            let habilidadesArr = [];

            if (Array.isArray(r.habilidades)) {
                habilidadesArr = r.habilidades;
            } else if (typeof r.habilidades === 'string' && r.habilidades.trim()) {
                habilidadesArr = r.habilidades.split(',').map(s => s.trim()).filter(Boolean);
            } else if (typeof r.thabilidades === 'string' && r.thabilidades.trim()) {
                habilidadesArr = r.thabilidades.split(',').map(s => s.trim()).filter(Boolean);
            }

            return {
                id: r.id,
                nombre: r.nombre || '',
                oficio: r.oficio || '',
                habilidades: habilidadesArr,
                ubicacion: r.ubicacion || '',
                disponibilidad: r.disponibilidad || '',
                modalidad: r.modalidad || '',
                rating_promedio: r.ratingpromedio || 0,
                total_calificaciones: r.totalcalificaciones || 0,
                total_contactos: r.totalcontactos || 0,
                whatsapp: r.whatsapp || '',
                estado: r.estado || 'pendiente'
            };
        });

        // Inicializar Fuse.js para búsqueda difusa
        const options = {
            keys: ['nombre', 'oficio', 'habilidades'],
            threshold: 0.4,
            ignoreLocation: true
        };
        __fuse = new Fuse(__allProfiles, options);

        __lastProfilesLoad = Date.now();
        return __allProfiles;
    } catch (error) {
        console.error('Error cargando perfiles:', error);
        throw error;
    }
}

/**
 * Filtra los perfiles en memoria usando Fuse.js y filtros exactos
 */
function filtrarPerfilesLocalmente({ q = '', oficio = '', ubicacion = '', disponibilidad = '' } = {}) {
    let resultados = [];

    // 1. Filtrado por texto (Fuzzy)
    if (q) {
        if (__fuse) {
            resultados = __fuse.search(q).map(result => result.item);
        } else {
            const qLower = q.toLowerCase();
            resultados = __allProfiles.filter(p =>
                p.nombre.toLowerCase().includes(qLower) ||
                p.oficio.toLowerCase().includes(qLower) ||
                p.habilidades.some(h => h.toLowerCase().includes(qLower))
            );
        }
    } else {
        resultados = [...__allProfiles];
    }

    // 2. Filtros exactos
    if (oficio) resultados = resultados.filter(p => p.oficio === oficio);
    if (ubicacion) resultados = resultados.filter(p => p.ubicacion === ubicacion);
    if (disponibilidad) resultados = resultados.filter(p => p.disponibilidad === disponibilidad);

    return resultados;
}

/**
 * Obtiene un perfil específico por ID con todos sus detalles
 */
async function obtenerPerfilPorId(id) {
    try {
        const r = await pb.collection(COLLECTION_PERFILES).getOne(id);

        // Cargar calificaciones directamente desde la colección correspondiente
        let calificaciones = [];
        try {
            const todas = await pb.collection(COLLECTION_CALIFICACIONES).getFullList({
                sort: '-created',
                $autoCancel: false
            });
            console.log('[APP] TODAS CALIFICACIONES', todas.length, todas);

            // Filtrar por profesional_id (asegurando comparación de strings)
            calificaciones = todas.filter(c => String(c.profesional_id) === String(id));
            console.log('[APP] CALIFICACIONES FILTRADAS PARA', id, calificaciones.length, calificaciones);
        } catch (e) {
            console.error('Error cargando calificaciones para el perfil', id, e);
            calificaciones = [];
        }

        console.log('[APP] CALIFICACIONES PERFIL', id, calificaciones);

        let habilidadesArr = [];
        if (Array.isArray(r.habilidades)) {
            habilidadesArr = r.habilidades;
        } else if (typeof r.habilidades === 'string' && r.habilidades.trim()) {
            habilidadesArr = r.habilidades.split(',').map(s => s.trim()).filter(Boolean);
        } else if (typeof r.thabilidades === 'string' && r.thabilidades.trim()) {
            habilidadesArr = r.thabilidades.split(',').map(s => s.trim()).filter(Boolean);
        }

        const portafolio = r.portafolio_url || r.portafolio || '';

        return {
            id: r.id,
            nombre: r.nombre || '',
            oficio: r.oficio || '',
            habilidades: habilidadesArr,
            experiencia: r.experiencia || '',
            ubicacion: r.ubicacion || '',
            disponibilidad: r.disponibilidad || '',
            modalidad: r.modalidad || '',
            whatsapp: r.whatsapp || '',
            portafolio_url: portafolio,
            foto_perfil: r.foto_perfil || '',
            rating_promedio: r.ratingpromedio || 0,
            total_calificaciones: r.totalcalificaciones || 0,
            total_contactos: r.totalcontactos || 0,
            calificaciones: calificaciones,
            created: r.created,
            updated: r.updated
        };
    } catch (error) {
        console.error('Error obteniendo perfil:', error);
        throw error;
    }
}

/**
 * Obtiene listas únicas de oficios, ubicaciones y disponibilidades
 */
function obtenerCatalogosLocales({ oficio = '', ubicacion = '', disponibilidad = '' } = {}) {
    let filtrados = [...__allProfiles];

    if (oficio) filtrados = filtrados.filter(p => p.oficio === oficio);
    if (ubicacion) filtrados = filtrados.filter(p => p.ubicacion === ubicacion);
    if (disponibilidad) filtrados = filtrados.filter(p => p.disponibilidad === disponibilidad);

    const oficiosSet = new Set();
    const ubicacionesSet = new Set();
    const disponibilidadesSet = new Set();

    filtrados.forEach(r => {
        if (r.oficio) oficiosSet.add(r.oficio);
        if (r.ubicacion) ubicacionesSet.add(r.ubicacion);
        if (r.disponibilidad) disponibilidadesSet.add(r.disponibilidad);
    });

    return {
        oficios: Array.from(oficiosSet).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' })),
        ubicaciones: Array.from(ubicacionesSet).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' })),
        disponibilidades: Array.from(disponibilidadesSet).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
    };
}

// ========== SISTEMA DE MATCHES Y CALIFICACIONES ==========

/**
 * Crea un match y abre WhatsApp
 */
async function crearMatchYContactar(profesionalId, profesionalData) {
    // Generar token único de 3 caracteres
    const token = generarTokenCalificacion();

    // 1. ABRIR WHATSAPP INMEDIATAMENTE (Prioridad UX)
    // Formatear número: quitar no numéricos
    let telefono = (profesionalData.whatsapp || '').replace(/\D/g, '');
    // Asumir España (34) si no tiene código de país y tiene 9 dígitos
    if (telefono.length === 9) {
        telefono = '34' + telefono;
    }

    // Construir link de calificación (archivo reubicado en assets)
    const baseUrl = window.location.origin;
    const linkCalificacion = `${baseUrl}/assets/calificar.html?t=${profesionalId}${token}`;

    // Mensaje con link de calificación
    const mensaje = encodeURIComponent(
        `Hola ${profesionalData.nombre}, vi tu perfil en el Catálogo de Empleos y me interesa contactarte.\n\n` +
        `📝 Después del servicio, califícame aquí:\n${linkCalificacion}\n\n` +
        `(Link válido por 30 días)`
    );
    const url = `https://wa.me/${telefono}?text=${mensaje}`;

    // Abrir en nueva pestaña
    window.open(url, '_blank');

    // 2. REGISTRAR EN BACKEND (Segundo plano)
    // No usamos await para no bloquear, pero capturamos errores para logs
    (async () => {
        try {
            // Obtener info del contratante
            const contratanteInfo = obtenerInfoContratante();

            // Obtener IP (puede fallar si hay bloqueadores, no es crítico)
            let ip = 'unknown';
            try { ip = await obtenerIP(); } catch (_) { /* no crítico */ }

            // Calcular fecha de expiración
            const expiraEn = new Date();
            expiraEn.setDate(expiraEn.getDate() + MATCH_EXPIRATION_DAYS);

            // Crear match en backend con token
            const match = await pb.collection(COLLECTION_MATCHES).create({
                profesional_id: profesionalId,
                token_calificacion: token,
                contratante_info: contratanteInfo,
                estado: 'contacto_creado',
                ip_origen: ip,
                user_agent: navigator.userAgent,
                expira_en: expiraEn.toISOString()
            });

            // Guardar matchId en localStorage
            guardarMatchLocal(match.id, profesionalId);

            // Incrementar contador de contactos
            try {
                await pb.collection(COLLECTION_PERFILES).update(profesionalId, {
                    'totalcontactos+': 1
                });
            } catch (errUpdate) {
                console.warn('Error actualizando contador (atomic):', errUpdate);
            }

            // Actualizar caché local
            const idx = __allProfiles.findIndex(p => p.id === profesionalId);
            if (idx !== -1) {
                __allProfiles[idx].total_contactos++;
            }

            // Actualizar UI si es necesario (opcional, ya que el usuario probablemente se fue a WhatsApp)
            // actualizarBotonesAccion(...) 

        } catch (error) {
            console.error('Error en proceso de fondo (crearMatchYContactar):', error);
            // No mostramos alert al usuario porque ya está en WhatsApp
        }
    })();

    return true; // Retornamos true inmediatamente
}

function generarTokenCalificacion() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let token = '';
    for (let i = 0; i < 3; i++) {
        token += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return token;
}


/**
 * Verifica en localStorage si el usuario puede calificar a un profesional
 * (match pendiente y no expirado)
 */
function puedeCalificarLocal(profesionalId) {
    const matches = obtenerMatchesLocales();
    const matchValido = matches.find(m =>
        m.profesional_id === profesionalId &&
        m.estado === 'contacto_creado' &&
        new Date(m.expira_en) > new Date()
    );
    return matchValido;
}

/**
 * Verifica en PocketBase si existe un match pendiente para este profesional
 * asociado a la IP actual. Si algo falla, cae a la comprobación local.
 */
async function tieneMatchPendiente(profesionalId) {
    try {
        const ip = await obtenerIP();
        const ahora = new Date().toISOString();

        const filter = `profesional_id = "${profesionalId}" && estado = "contacto_creado" && ip_origen = "${ip}" && expira_en > "${ahora}"`;

        const res = await pb.collection(COLLECTION_MATCHES).getList(1, 1, {
            filter,
            $autoCancel: false
        });

        if (res && res.items && res.items.length > 0) {
            return true;
        }

        return false;
    } catch (e) {
        console.warn('No se pudo verificar match pendiente remoto, usando estado local:', e);
        return !!puedeCalificarLocal(profesionalId);
    }
}

/**
 * Registra una calificación
 */
async function registrarCalificacion(matchId, profesionalId, rating, comentario) {
    try {
        // Validar que el match existe y no está expirado
        const match = await pb.collection(COLLECTION_MATCHES).getOne(matchId);

        if (match.estado === 'calificado') {
            throw new Error('Este servicio ya fue calificado');
        }

        if (new Date(match.expira_en) < new Date()) {
            throw new Error('El período para calificar ha expirado (30 días)');
        }

        // Obtener IP
        const ip = await obtenerIP();

        // Crear calificación
        const calificacion = await pb.collection(COLLECTION_CALIFICACIONES).create({
            match_id: matchId,
            profesional_id: profesionalId,
            rating: rating,
            comentario: comentario,
            ip_origen: ip,
            verificada: true
        });

        // Actualizar estado del match
        await pb.collection(COLLECTION_MATCHES).update(matchId, {
            estado: 'calificado',
            calificacion_id: calificacion.id
        });

        // Actualizar match local
        actualizarMatchLocal(matchId, 'calificado');

        // Recalcular rating promedio del profesional
        await recalcularRatingProfesional(profesionalId);

        return calificacion;
    } catch (error) {
        console.error('Error registrando calificación:', error);
        throw error;
    }
}

/**
 * Recalcula el rating promedio de un profesional
 */
async function recalcularRatingProfesional(profesionalId) {
    try {
        const calificaciones = await pb.collection(COLLECTION_CALIFICACIONES).getFullList({
            filter: `profesional_id = "${profesionalId}" && verificada = true`,
            $autoCancel: false
        });

        if (calificaciones.length === 0) {
            await pb.collection(COLLECTION_PERFILES).update(profesionalId, {
                ratingpromedio: 0,
                totalcalificaciones: 0
            });
            return;
        }

        const promedio = calificaciones.reduce((sum, c) => sum + c.rating, 0) / calificaciones.length;
        const promedioRedondeado = parseFloat(promedio.toFixed(1));

        await pb.collection(COLLECTION_PERFILES).update(profesionalId, {
            ratingpromedio: promedioRedondeado,
            totalcalificaciones: calificaciones.length
        });

        // Actualizar caché local
        const idx = __allProfiles.findIndex(p => p.id === profesionalId);
        if (idx !== -1) {
            __allProfiles[idx].rating_promedio = promedioRedondeado;
            __allProfiles[idx].total_calificaciones = calificaciones.length;
        }

        // Forzar actualización de la UI usando el flujo estándar de filtrado y renderizado
        cargarPerfilesUI();

    } catch (error) {
        console.error('[Rating] ✗ Error recalculando rating:', error);
        alert(`Error al actualizar el rating: ${error.message}`);
        throw error;
    }
}

// ========== HELPERS ==========

function obtenerInfoContratante() {
    let nombre = localStorage.getItem('contratante_nombre');
    if (!nombre) {
        nombre = prompt('Por favor, ingresa tu nombre para registrar el contacto:');
        if (nombre) {
            localStorage.setItem('contratante_nombre', nombre.trim());
        } else {
            nombre = 'Anónimo';
        }
    }
    return { nombre, timestamp: new Date().toISOString() };
}

async function obtenerIP() {
    try {
        if (__cachedIP) return __cachedIP;

        const response = await fetch('https://api.ipify.org?format=json');
        const data = await response.json();
        __cachedIP = data.ip || 'unknown';
        return __cachedIP;
    } catch {
        return 'unknown';
    }
}

function guardarMatchLocal(matchId, profesionalId) {
    const matches = JSON.parse(localStorage.getItem('mis_matches') || '[]');
    const expiraEn = new Date();
    expiraEn.setDate(expiraEn.getDate() + MATCH_EXPIRATION_DAYS);

    matches.push({
        matchId,
        profesional_id: profesionalId,
        estado: 'contacto_creado',
        expira_en: expiraEn.toISOString(),
        fecha: new Date().toISOString()
    });
    localStorage.setItem('mis_matches', JSON.stringify(matches));
}

function obtenerMatchesLocales() {
    return JSON.parse(localStorage.getItem('mis_matches') || '[]');
}

function actualizarMatchLocal(matchId, nuevoEstado) {
    const matches = obtenerMatchesLocales();
    const idx = matches.findIndex(m => m.matchId === matchId);
    if (idx !== -1) {
        matches[idx].estado = nuevoEstado;
        localStorage.setItem('mis_matches', JSON.stringify(matches));
    }
}

// ========== LÓGICA DE INTERFAZ (CONTROLLER) ==========

// --- Inicialización ---

window.addEventListener('load', async () => {
    bloquearUI(true);
    try {
        setupEventListeners();
        await refreshAuthIfNeeded();
        actualizarIndicadorSesion();
        setupScrollDetection();

        // Asegurar que el modal de registro esté cerrado al inicio
        $('#dlgRegistro')?.close();

        // Cargar TODOS los datos al inicio
        await cargarTodosLosPerfiles();

        // Inicializar UI con los datos cargados
        cargarCatalogosUI();
        cargarPerfilesUI();

    } catch (e) {
        console.error("Error fatal iniciando app:", e);
        alert("Error iniciando la aplicación. Revisa la consola.");
    } finally {
        bloquearUI(false);
    }
});

// Refrescar datos cuando la pestaña vuelve a tener el foco
window.addEventListener('focus', async () => {
    try {
        await refreshAuthIfNeeded();
        actualizarIndicadorSesion();
        // Solo recargar desde el servidor si ha pasado un tiempo razonable
        const AHORA = Date.now();
        const MAX_AGE_MS = 5 * 60 * 1000; // 5 minutos

        if (!__lastProfilesLoad || (AHORA - __lastProfilesLoad) > MAX_AGE_MS) {
            await cargarTodosLosPerfiles();
            cargarCatalogosUI();
            cargarPerfilesUI();
        }
    } catch (e) {
        console.warn('No se pudieron refrescar los datos al recuperar el foco:', e);
    }
});

function setupEventListeners() {
    // Búsqueda instantánea
    $('#q')?.addEventListener('input', () => {
        if (__crossTimer) clearTimeout(__crossTimer);
        __crossTimer = setTimeout(cargarPerfilesUI, 300);
    });

    // Delegación de eventos para la tabla (acciones y ordenación)
    document.addEventListener('click', (e) => {
        const th = e.target.closest('th.sortable');
        if (th && th.dataset.col) {
            ordenarItemsLocalmente(th.dataset.col);
            return;
        }

        const target = e.target.closest('.view, .contactar');
        if (!target) return;

        const id = target.dataset.id;
        if (!id) return;

        if (target.classList.contains('view')) {
            verPerfilUI(id);
        } else if (target.classList.contains('contactar')) {
            const profesional = __allProfiles.find(p => p.id === id);
            if (profesional) {
                uiContactarWhatsApp(profesional);
            }
        }
    });

    // Filtros
    ['selOficio', 'selUbicacion'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            const origin = id === 'selOficio' ? 'oficio' : 'ubicacion';
            el.addEventListener('change', () => {
                cargarPerfilesUI();
                actualizarFiltrosCruzadosUI(origin);
            });
        }
    });

    // Botones de acción
    $('#btnReset')?.addEventListener('click', resetearFiltros);

    // Navegación en diálogo
    $('#btnAnterior')?.addEventListener('click', navegarAnterior);
    $('#btnSiguiente')?.addEventListener('click', navegarSiguiente);

    // Diálogos
    setupDialogListeners();

    // Registro
    $('#btnSoyProfesional')?.addEventListener('click', () => {
        try {
            const currentUser = window.pb?.authStore?.model;
            if (!currentUser) {
                // No hay sesión: ir a pantalla de cuenta en modo LOGIN
                window.location.href = 'cuenta.html?mode=login&return=oficios';
                return;
            }

            if (!currentUser.verified) {
                alert('Tu cuenta todavía no está verificada. Revisa el correo de verificación que te hemos enviado y vuelve a intentarlo.');
                return;
            }

            const whatsappPerfil = (currentUser.whatsapp || '').replace(/\D/g, '');
            if (!/^\d{9}$/.test(whatsappPerfil)) {
                alert('Antes de registrar tu oficio, configura un número de WhatsApp válido (9 dígitos) en la página "Mi perfil".');
                window.location.href = 'perfil.html';
                return;
            }

            uiMostrarRegistro();
        } catch (e) {
            console.error('[Registro] Error comprobando sesión:', e);
            window.location.href = 'cuenta.html?mode=login&return=oficios';
        }
    });
    $('#btnCancelarRegistro')?.addEventListener('click', () => $('#dlgRegistro')?.close());
    $('#frmRegistro')?.addEventListener('submit', uiEnviarRegistro);

    // Mostrar/ocultar campo "Otros" según selección
    $('#regOficio')?.addEventListener('change', (e) => {
        const container = $('#regOficioOtroContainer');
        const input = $('#regOficioOtro');
        if (e.target.value === 'Otros') {
            container.style.display = 'block';
            input.required = true;
        } else {
            container.style.display = 'none';
            input.required = false;
            input.value = '';
        }
        validarFormularioRegistro(); // Revalidar al cambiar oficio
    });

    // Validar formulario en tiempo real
    const camposRegistro = ['#regNombre', '#regOficio', '#regUbicacion', '#regWhatsapp', '#regModalidad', '#regHabilidades', '#regExperiencia'];
    camposRegistro.forEach(selector => {
        $(selector)?.addEventListener('input', validarFormularioRegistro);
        $(selector)?.addEventListener('change', validarFormularioRegistro);
    }); // Cerrar correctamente el forEach de camposRegistro
} // Cerrar el bloque de listeners

function validarFormularioRegistro() {
    // Validación ligera en vivo (sin bloquear el botón de envío)
    const whatsappInput = $('#regWhatsapp');
    if (whatsappInput) {
        const value = whatsappInput.value.trim();
        // Marcar visualmente si el formato de WhatsApp no es de 9 dígitos
        if (value && !/^\d{9}$/.test(value)) {
            whatsappInput.classList.add('input-error');
        } else {
            whatsappInput.classList.remove('input-error');
        }
    }
}

// --- Funciones Principales de UI ---

function cargarPerfilesUI() {
    const params = obtenerParametrosFiltros();
    const tabla = $('#tabla');

    try {
        const items = filtrarPerfilesLocalmente(params);
        __currentItems = items;

        if (!params.q) {
            // Orden inicial por rating: mayor a menor
            ordenarItemsLocalmente('rating_promedio', 'desc');
        } else {
            renderTabla(items);
        }

    } catch (err) {
        tabla.innerHTML = `<div class="error-message">Error: ${err.message}</div>`;
    }
}

function cargarCatalogosUI() {
    try {
        const params = obtenerParametrosFiltros();
        const data = obtenerCatalogosLocales();
        actualizarSelects(data, params);
    } catch (err) {
        console.error('Error cargando catálogos iniciales:', err);
    }
}

function actualizarFiltrosCruzadosUI() {
    const params = obtenerParametrosFiltros();

    const data = {
        oficios: obtenerCatalogosLocales({ ...params, oficio: '' }).oficios,
        ubicaciones: obtenerCatalogosLocales({ ...params, ubicacion: '' }).ubicaciones,
        disponibilidades: obtenerCatalogosLocales({ ...params, disponibilidad: '' }).disponibilidades
    };

    actualizarSelects(data, params);
}

async function verPerfilUI(id) {
    const dlg = $('#dlg');
    if (!dlg) return;

    __currentPerfilId = id;
    const itemCache = __currentItems.find(i => i.id === id);

    // Asegurar que el footer del diálogo tenga siempre los botones de navegación y cierre
    ensureDialogNav();

    if (itemCache) {
        // Mostramos primero la información que ya tenemos en memoria para que el usuario
        // vea el perfil inmediatamente.
        renderDetallePerfil(itemCache);
        actualizarBotonesAccion(itemCache);
        actualizarBotonesNavegacion();
    }

    // Colocar siempre el scroll del contenido al inicio al abrir/navegar
    scrollPerfilAlInicio();

    // Abrir siempre el diálogo sin banner de "verificando información" para que
    // la experiencia sea más limpia.
    if (typeof dlg.showModal === 'function') {
        dlg.showModal();
    } else {
        dlg.setAttribute('open', 'true');
    }
    lockAppScroll();

    try {
        deshabilitarFormulario(true);
        const dataFull = await obtenerPerfilPorId(id);
        renderDetallePerfil(dataFull);
        await actualizarBotonesAccion(dataFull);
        actualizarBotonesNavegacion();
    } catch (e) {
        alert("Error cargando detalles: " + e.message);
        dlg.close();
    } finally {
        deshabilitarFormulario(false);
        limpiarMensajeCarga();
    }
}

async function uiContactarWhatsApp(arg) {
    // Permitir llamar desde el modal (usando __currentPerfilId)
    // o directamente desde la tabla pasando el perfil completo

    // Detectar si el argumento es realmente un perfil o sólo un evento de clic
    const perfilDesdeTabla = (arg && typeof arg === 'object' && 'id' in arg && 'whatsapp' in arg)
        ? arg
        : null;

    let profesionalId = __currentPerfilId;
    let perfil = null;

    if (perfilDesdeTabla) {
        // Llamada desde la tabla principal
        profesionalId = perfilDesdeTabla.id;
        perfil = perfilDesdeTabla;
    } else {
        // Llamada desde el modal de perfil (sin argumento o con evento)
        if (!__currentPerfilId) return;
        perfil = __currentItems.find(p => p.id === __currentPerfilId) || null;
    }

    if (!profesionalId || !perfil) return;

    try {
        mostrarMensajeCarga('Registrando contacto...', 'Abriendo WhatsApp');

        // 1) Comprobar si ya existe un match pendiente reciente para este profesional
        const yaTieneMatchPendiente = await tieneMatchPendiente(profesionalId);

        if (yaTieneMatchPendiente) {
            // Si ya hay un match pendiente, no generamos un nuevo link de calificación.
            // Solo abrimos WhatsApp sin el enlace para evitar inflar la puntuación.

            let telefono = (perfil.whatsapp || '').replace(/\D/g, '');
            if (telefono.length === 9) {
                telefono = '34' + telefono;
            }

            const mensaje = encodeURIComponent(
                `Hola ${perfil.nombre}, vi tu perfil en el Catálogo de Empleos y me interesa contactarte.\n\n` +
                `Ya tengo un enlace de calificación activo para ti, lo usaré después del servicio.\n`
            );
            const url = `https://wa.me/${telefono}?text=${mensaje}`;
            window.open(url, '_blank');

            alert('Ya existe un enlace de calificación activo para este profesional.\n\nNo se ha generado uno nuevo para evitar duplicados.');

            // Actualizar botones por si el estado cambió previamente
            const dataFull = await obtenerPerfilPorId(profesionalId);
            actualizarBotonesAccion(dataFull);

            return;
        }

        // 2) Si no hay match pendiente, crear uno nuevo con su link de calificación
        await crearMatchYContactar(profesionalId, perfil);

        alert('Contacto registrado. Ahora podrás calificar este servicio después de trabajar con el profesional.');

        // Actualizar botones para mostrar opción de calificar
        const dataFull = await obtenerPerfilPorId(profesionalId);
        actualizarBotonesAccion(dataFull);

    } catch (e) {
        alert('Error: ' + e.message);
    } finally {
        limpiarMensajeCarga();
    }
}

async function uiMostrarFormularioCalificacion() {
    const matchValido = puedeCalificar(__currentPerfilId);
    if (!matchValido) {
        alert('No tienes un contacto válido con este profesional para calificar.');
        return;
    }

    const dlgCalificar = $('#dlgCalificar');
    if (dlgCalificar) {
        dlgCalificar.showModal();
    }
}

async function uiEnviarCalificacion() {
    const matchValido = puedeCalificar(__currentPerfilId);
    if (!matchValido) {
        alert('No tienes un contacto válido con este profesional.');
        return;
    }

    const rating = parseInt($('#ratingValue')?.value || '0');
    const comentario = $('#comentarioCalificacion')?.value.trim() || '';

    if (rating < 1 || rating > 5) {
        alert('Por favor selecciona una calificación de 1 a 5 estrellas.');
        return;
    }

    try {
        mostrarMensajeCarga('Enviando calificación...', 'Guardando en base de datos');

        await registrarCalificacion(matchValido.matchId, __currentPerfilId, rating, comentario);

        alert('¡Calificación enviada con éxito! Gracias por tu feedback.');

        // Cerrar modal de calificación
        $('#dlgCalificar')?.close();

        // Actualizar perfil
        const dataFull = await obtenerPerfilPorId(__currentPerfilId);
        renderDetallePerfil(dataFull);
        await actualizarBotonesAccion(dataFull);

        // Actualizar tabla
        cargarPerfilesUI();

    } catch (e) {
        alert('Error: ' + e.message);
    } finally {
        limpiarMensajeCarga();
    }
}

// --- Registro de Profesionales ---

async function validarLimiteRegistros(whatsapp) {
    const registrosExistentes = await pb.collection(COLLECTION_PERFILES).getFullList({
        filter: `whatsapp = "${whatsapp}"`
    });

    if (registrosExistentes.length >= 3) {
        throw new Error('Ya has alcanzado el límite de 3 oficios registrados con este número de WhatsApp.');
    }

    return registrosExistentes;
}

/**
 * Genera un código de 2 caracteres basado en el nombre del oficio
 * Usa un hash simple para generar un código alfanumérico único
 */
function getCodigoOficio(oficio) {
    // Normalizar el oficio: quitar acentos, convertir a mayúsculas
    const oficioNormalizado = oficio
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toUpperCase();

    // Generar hash simple
    let hash = 0;
    for (let i = 0; i < oficioNormalizado.length; i++) {
        hash = ((hash << 5) - hash) + oficioNormalizado.charCodeAt(i);
        hash = hash & hash; // Convertir a entero de 32 bits
    }

    // Convertir a código de 2 caracteres alfanuméricos (A-Z, 0-9)
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const absHash = Math.abs(hash);
    const char1 = chars[absHash % chars.length];
    const char2 = chars[Math.floor(absHash / chars.length) % chars.length];

    return char1 + char2;
}

function uiMostrarRegistro() {
    const dlg = $('#dlgRegistro');
    if (dlg) {
        // Prefijar el nombre con el nombre de la cuenta actual
        try {
            const currentUser = window.pb?.authStore?.model;
            const inputNombre = $('#regNombre');
            const inputWhatsapp = $('#regWhatsapp');
            if (currentUser && inputNombre && typeof currentUser.nombre === 'string') {
                inputNombre.value = currentUser.nombre;
            }
            if (currentUser && inputWhatsapp && typeof currentUser.whatsapp === 'string') {
                inputWhatsapp.value = currentUser.whatsapp.replace(/\D/g, '');
            }
        } catch (e) {
            console.warn('[Registro] No se pudo prefijar el nombre desde la cuenta:', e);
        }

        dlg.showModal();
    }
}

async function uiEnviarRegistro(e) {
    e.preventDefault(); // Prevenir submit normal

    let whatsapp = $('#regWhatsapp').value.replace(/\D/g, '');
    if (whatsapp.length === 9) whatsapp = '34' + whatsapp;

    // Obtener oficio (del select o del campo "Otros")
    let oficio = $('#regOficio').value;
    if (oficio === 'Otros') {
        oficio = $('#regOficioOtro').value.trim();
        if (!oficio) {
            alert('Por favor, especifica tu oficio.');
            return;
        }
    }

    // Validaciones de campos antes de continuar
    const nombre = $('#regNombre').value.trim();
    const ubicacion = $('#regUbicacion').value.trim();
    const modalidad = $('#regModalidad').value;
    const habilidadesTexto = $('#regHabilidades').value.trim();
    const experienciaTexto = $('#regExperiencia').value.trim();
    const portafolioInput = ($('#regPortafolio')?.value || '').trim();

    const errores = [];

    if (!nombre) errores.push({ id: 'regNombre', mensaje: 'Por favor, indica tu nombre completo.' });
    if (!oficio) errores.push({ id: 'regOficio', mensaje: 'Selecciona tu oficio o profesión.' });
    if (!ubicacion) errores.push({ id: 'regUbicacion', mensaje: 'Indica tu ubicación.' });

    const whatsappLocal = $('#regWhatsapp').value.trim();
    if (!whatsappLocal) {
        errores.push({ id: 'regWhatsapp', mensaje: 'Introduce tu número de WhatsApp.' });
    } else if (!/^\d{9}$/.test(whatsappLocal)) {
        errores.push({ id: 'regWhatsapp', mensaje: 'El WhatsApp debe tener exactamente 9 dígitos numéricos (ej: 612345678).' });
    }

    if (!modalidad) errores.push({ id: 'regModalidad', mensaje: 'Selecciona la modalidad de trabajo.' });
    if (!habilidadesTexto) errores.push({ id: 'regHabilidades', mensaje: 'Indica al menos una habilidad principal.' });
    if (!experienciaTexto) errores.push({ id: 'regExperiencia', mensaje: 'Describe brevemente tu experiencia.' });

    if (oficio === 'Otros' && !oficio) {
        errores.push({ id: 'regOficioOtro', mensaje: 'Especifica tu oficio en el campo "Especifica tu oficio".' });
    }

    if (portafolioInput && !isValidUrlFormat(portafolioInput)) {
        errores.push({ id: 'regPortafolio', mensaje: 'El enlace de portafolio no es válido. Asegúrate de que empiece por http:// o https://' });
    }

    if (errores.length > 0) {
        const primero = errores[0];
        alert(primero.mensaje);
        const el = document.getElementById(primero.id);
        if (el) {
            el.focus();
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        return;
    }

    try {
        // Verificar sesión de usuario
        const currentUser = window.pb?.authStore?.model;
        if (!currentUser) {
            alert('Debes crear una cuenta e iniciar sesión antes de registrar tu oficio.');
            window.location.href = 'cuenta.html?return=oficios';
            return;
        }

        if (!currentUser.verified) {
            alert('Tu cuenta todavía no está verificada. Revisa el correo de verificación que te hemos enviado y vuelve a intentarlo.');
            return;
        }

        mostrarMensajeCarga('Validando...', 'Verificando registros existentes');

        // Validar límite de 3 registros por WhatsApp
        await validarLimiteRegistros(whatsapp);

        const datos = {
            nombre: toTitleCase(nombre),
            oficio: oficio, // Usar el oficio original (con mayúsculas, acentos, etc.)
            ubicacion: ubicacion,
            whatsapp: whatsapp,
            modalidad: modalidad,
            // Guardar en el campo existente `portafolio` de PocketBase
            portafolio: portafolioInput || '',
            // Habilidades como texto plano separado por comas, compatible con el campo de texto de PocketBase
            habilidades: habilidadesTexto
                .split(',')
                .map(s => s.trim())
                .filter(s => s)
                .join(', '),
            experiencia: experienciaTexto,
            disponibilidad: 'disponible',
            usuario_id: currentUser.id
        };

        mostrarMensajeCarga('Enviando solicitud...', 'Registrando tu perfil');

        // Crear registro en PocketBase
        await pb.collection(COLLECTION_PERFILES).create(datos);

        alert('¡Solicitud enviada con éxito!\n\nTu perfil ha sido registrado y ya es visible en el catálogo.');

        // Limpiar y cerrar
        $('#frmRegistro').reset();
        $('#dlgRegistro').close();
        $('#regOficioOtroContainer').style.display = 'none'; // Ocultar campo "Otros"

        // Recargar perfiles para mostrar el nuevo registro
        await cargarTodosLosPerfiles();
        cargarCatalogosUI();
        cargarPerfilesUI();

    } catch (err) {
        console.error('Error registro:', err);
        let msg = err.message;
        if (err.data && err.data.data) {
            const errors = Object.entries(err.data.data)
                .map(([field, e]) => `${field}: ${e.message}`)
                .join('\n');
            if (errors) msg += '\n\nDetalles:\n' + errors;
        }
        alert('Error al enviar solicitud: ' + msg);
    } finally {
        limpiarMensajeCarga();
    }
}

function resetearFiltros() {
    $('#q').value = '';
    $('#selOficio').value = '';
    $('#selUbicacion').value = '';

    cargarCatalogosUI();
    cargarPerfilesUI();
}

// --- Helpers de Renderizado y DOM ---

function obtenerParametrosFiltros() {
    return {
        q: $('#q')?.value.trim() || '',
        oficio: $('#selOficio')?.value || '',
        ubicacion: $('#selUbicacion')?.value || ''
    };
}

function renderTabla(items) {
    actualizarEstadisticas(items);
    const el = $('#tabla');
    if (!el) return;

    const rows = items.map(item => {
        const habilidadesMostrar = item.habilidades.slice(0, 3).join(', ');
        const masHabilidades = item.habilidades.length > 3 ? ` +${item.habilidades.length - 3}` : '';
        const estrellas = renderEstrellas(item.rating_promedio);

        return `
        <tr>
            <td data-label="Nombre">${esc(item.nombre)}</td>
            <td data-label="Oficio">${esc(item.oficio)}</td>
            <td data-label="Ubicación">${esc(item.ubicacion)}</td>
            <td data-label="Rating" class="rating-cell">
                <div class="rating-content">
                    ${estrellas} <span class="rating-count">(${item.total_calificaciones})</span>
                </div>
            </td>
            <td class="no-print actions-cell">
                <button class="primary view" data-id="${item.id}">👤 Ver Perfil</button>
                <button class="btn-whatsapp contactar" data-id="${item.id}">
                    <span>📱</span> WhatsApp
                </button>
            </td>
        </tr>`;
    }).join('');

    const sortIcon = (col) => __sortColumn !== col ? ' ↕' : (__sortDirection === 'asc' ? ' ↑' : ' ↓');

    el.innerHTML = `
    <table>
        <thead><tr>
            <th class="sortable" data-col="nombre">Nombre${sortIcon('nombre')}</th>
            <th class="sortable" data-col="oficio">Oficio${sortIcon('oficio')}</th>
            <th class="sortable" data-col="ubicacion">Ubicación${sortIcon('ubicacion')}</th>
            <th class="sortable" data-col="rating_promedio">Rating${sortIcon('rating_promedio')}</th>
            <th class="no-print">Acciones</th>
        </tr></thead>
        <tbody>${rows}</tbody>
    </table>`;

    // Los listeners ahora se manejan por delegación en setupEventListeners()
    // Esto es más robusto y evita problemas al re-renderizar
}

/*
function renderDetallePerfil(data) {
   ...
}
*/

function renderDetallePerfil(data) {
    const f = $('#frmPerfil');
    if (!f) return;

    // Normalizar valores numéricos para evitar errores con registros antiguos
    const ratingPromedio = Number(data.rating_promedio) || 0;
    const totalCalificaciones = Number(data.total_calificaciones) || 0;

    // Título del modal
    $('#dlgTitle').textContent = data.nombre || 'Perfil Profesional';

    // Fecha de publicación (usar created por defecto)
    const fechaTexto = formatFechaCorta(data.created || data.updated || '');
    const fechaEl = $('#perfilFechaPublicacion');
    if (fechaEl) {
        fechaEl.textContent = fechaTexto ? `Publicado: ${fechaTexto}` : '';
    }

    // Llenar campos básicos
    $('#perfilNombre').textContent = data.nombre || '';
    $('#perfilOficio').textContent = data.oficio || '';
    $('#perfilUbicacion').textContent = data.ubicacion || '';
    $('#perfilModalidad').textContent = data.modalidad || '';

    // Experiencia: soportar registros antiguos donde pueda venir en otro campo de texto
    const experienciaTexto = (data.experiencia && String(data.experiencia).trim())
        || (data.texperiencia && String(data.texperiencia).trim())
        || '';
    $('#perfilExperiencia').textContent = experienciaTexto || 'Sin información';

    // Habilidades: soportar tanto array como texto plano (ej: registros antiguos)
    let habilidadesArr = [];
    if (Array.isArray(data.habilidades)) {
        habilidadesArr = data.habilidades;
    } else if (typeof data.habilidades === 'string' && data.habilidades.trim()) {
        habilidadesArr = data.habilidades.split(',').map(s => s.trim()).filter(Boolean);
    } else if (typeof data.thabilidades === 'string' && data.thabilidades.trim()) {
        // Campo auxiliar usado en algunos registros antiguos ("T habilidades" en PocketBase)
        habilidadesArr = data.thabilidades.split(',').map(s => s.trim()).filter(Boolean);
    }

    const habilidadesHTML = habilidadesArr.map(h =>
        `<span class="habilidad-tag">${esc(h)}</span>`
    ).join('');
    $('#perfilHabilidades').innerHTML = habilidadesHTML || 'Sin habilidades especificadas';

    // Rating
    const estrellas = renderEstrellas(ratingPromedio);
    $('#perfilRating').innerHTML = `
        ${estrellas}
        <span class="rating-text">${ratingPromedio.toFixed(1)} (${totalCalificaciones} calificaciones)</span>
    `;

    // Badge de confiabilidad
    const badge = getBadgeConfiabilidad(ratingPromedio, totalCalificaciones);
    $('#perfilBadge').innerHTML = badge;

    // Contactos registrados
    $('#perfilContactos').textContent = Number(data.total_contactos) || 0;

    // Portafolio
    if (data.portafolio_url) {
        $('#perfilPortafolio').innerHTML = `<a href="${esc(data.portafolio_url)}" target="_blank">Ver portafolio →</a>`;
    } else {
        $('#perfilPortafolio').textContent = 'Sin portafolio';
    }

    // Foto de perfil
    if (data.foto_perfil) {
        const fotoUrl = pb.files.getUrl(data, data.foto_perfil);
        $('#perfilFoto').innerHTML = `<img src="${fotoUrl}" alt="${esc(data.nombre)}" />`;
    } else {
        $('#perfilFoto').innerHTML = `<div class="foto-placeholder">${data.nombre.charAt(0).toUpperCase()}</div>`;
    }

    // Calificaciones recientes
    renderCalificacionesRecientes(data.calificaciones || []);
}

function renderCalificacionesRecientes(calificaciones) {
    const container = $('#calificacionesRecientes');
    if (!container) return;

    if (calificaciones.length === 0) {
        container.innerHTML = '<p class="sin-calificaciones">Aún no hay calificaciones</p>';
        return;
    }

    const html = calificaciones.slice(0, 5).map(cal => `
        <div class="calificacion-item">
            <div class="calificacion-header">
                ${renderEstrellas(cal.rating)}
                <span class="calificacion-fecha">${new Date(cal.created).toLocaleDateString()}</span>
            </div>
            ${cal.comentario ? `<p class="calificacion-comentario">${esc(cal.comentario)}</p>` : ''}
        </div>
    `).join('');

    container.innerHTML = html;
}

function renderEstrellas(rating) {
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 >= 0.5;
    const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);

    let html = '';
    for (let i = 0; i < fullStars; i++) html += '<span class="star filled">★</span>';
    if (hasHalfStar) html += '<span class="star half">★</span>';
    for (let i = 0; i < emptyStars; i++) html += '<span class="star">☆</span>';

    return html;
}

function getBadgeConfiabilidad(rating, totalCalificaciones) {
    if (totalCalificaciones === 0) {
        return '<span class="badge-confiabilidad badge-nueva">Nuevo</span>';
    } else if (rating >= 4.5 && totalCalificaciones >= 5) {
        return '<span class="badge-confiabilidad badge-alta">Confiabilidad Alta</span>';
    } else if (rating >= 3.5) {
        return '<span class="badge-confiabilidad badge-media">Confiabilidad Media</span>';
    } else {
        return '';
    }
}

async function actualizarBotonesAccion(data) {
    const btnContactar = $('#btnContactarWhatsApp');
    const btnCalificar = $('#btnCalificar');

    if (btnContactar) {
        btnContactar.onclick = uiContactarWhatsApp;
    }

    // Por decisión de negocio, la calificación se maneja sólo por WhatsApp.
    // El botón "Calificar Servicio" ya no debe mostrarse en la página.
    if (btnCalificar) {
        btnCalificar.style.display = 'none';
        btnCalificar.onclick = null;
    }
}

function ordenarItemsLocalmente(col, forceDir) {
    if (forceDir) {
        __sortDirection = forceDir;
    } else if (__sortColumn === col) {
        __sortDirection = __sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
        // Dirección inicial por columna
        if (col === 'rating_promedio') {
            __sortDirection = 'desc'; // Mayor rating primero
        } else {
            __sortDirection = 'asc';
        }
    }
    __sortColumn = col;

    const sorted = [...__currentItems].sort((a, b) => {
        let valA = a[col] || '';
        let valB = b[col] || '';

        if (col === 'rating_promedio') {
            return __sortDirection === 'asc' ? valA - valB : valB - valA;
        }

        valA = String(valA).toLowerCase();
        valB = String(valB).toLowerCase();
        return __sortDirection === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
    });

    __currentItems = sorted;
    renderTabla(sorted);
}

function actualizarEstadisticas(items) {
    const total = items.length;
    const contactos = items.reduce((sum, i) => sum + (i.total_contactos || 0), 0);

    $('#statTotal').textContent = total;
    $('#statPrestados').textContent = contactos;

    // Filtros label
    const params = obtenerParametrosFiltros();
    const hayFiltros = Object.values(params).some(v => v);
    const label = document.querySelector('.stat-label');
    if (label) label.textContent = hayFiltros ? 'Resultados:' : 'Total de profesionales:';

    const divFiltros = $('#filtrosAplicados');
    if (divFiltros) {
        if (!hayFiltros) divFiltros.textContent = '';
        else {
            const txt = [];
            if (params.q) txt.push(`Búsqueda: "${params.q}"`);
            if (params.oficio) txt.push(`Oficio: ${params.oficio}`);
            if (params.ubicacion) txt.push(`Ubicación: ${params.ubicacion}`);
            divFiltros.textContent = 'Filtros: ' + txt.join(' | ');
        }
    }
}

// --- Manejo de Selects y UI Auxiliar ---

function actualizarSelects(data, selectedValues = {}) {
    const update = (id, items = [], currentVal) => {
        const el = document.getElementById(id);
        if (!el) return;

        const defaultText = el.dataset.defaultText || el.firstElementChild?.textContent?.replace('Cargando...', '') || 'Todos';
        el.dataset.defaultText = defaultText;

        el.innerHTML = `<option value="">${defaultText}</option>` +
            items.map(v => `<option value="${v}">${v}</option>`).join('');

        if (currentVal && items.map(String).includes(String(currentVal))) {
            el.value = currentVal;
        }
    };

    update('selOficio', data.oficios, selectedValues.oficio);
    update('selUbicacion', data.ubicaciones, selectedValues.ubicacion);

    // Listeners para filtros cruzados
    ['selOficio', 'selUbicacion', 'btnReset'].forEach(id => {
        const el = document.getElementById(id);
        if (el && !el.dataset.listenerAttached) {
            el.dataset.listenerAttached = 'true';
        }
    });
}

function toggleSelects(disabled) {
    ['selOficio', 'selUbicacion', 'btnReset'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.disabled = disabled;
    });
}

function bloquearUI(bloquear) {
    toggleSelects(bloquear);
    const q = $('#q');
    if (q) q.disabled = bloquear;
}

// ========== FUNCIONES AUXILIARES (del código original) ==========

function setupScrollDetection() {
    // Implementación original si existe
}

function setupDialogListeners() {
    // Cerrar diálogos
    $('#btnCerrarDialog')?.addEventListener('click', () => {
        $('#dlg')?.close();
        unlockAppScroll();
    });

    // Botón de cierre superior (X) en móvil
    $('#btnCerrarDialogTop')?.addEventListener('click', () => {
        $('#dlg')?.close();
        unlockAppScroll();
    });

    $('#btnCerrarCalificar')?.addEventListener('click', () => {
        $('#dlgCalificar')?.close();
    });

    $('#btnEnviarCalificacion')?.addEventListener('click', uiEnviarCalificacion);

    // Rating interactivo
    setupRatingStars();

    // Cerrar con ESC
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            $('#dlg')?.close();
            $('#dlgCalificar')?.close();
            $('#dlgRegistro')?.close(); // Añadido
            unlockAppScroll();
        }
    });
}

function setupRatingStars() {
    const stars = document.querySelectorAll('.rating-input .star');
    const ratingValue = $('#ratingValue');

    stars.forEach((star, index) => {
        star.addEventListener('click', () => {
            const rating = index + 1;
            if (ratingValue) ratingValue.value = rating;

            stars.forEach((s, i) => {
                if (i < rating) {
                    s.classList.add('filled');
                } else {
                    s.classList.remove('filled');
                }
            });
        });

        star.addEventListener('mouseenter', () => {
            const rating = index + 1;
            stars.forEach((s, i) => {
                if (i < rating) {
                    s.classList.add('hover');
                } else {
                    s.classList.remove('hover');
                }
            });
        });
    });

    document.querySelector('.rating-input')?.addEventListener('mouseleave', () => {
        stars.forEach(s => s.classList.remove('hover'));
    });
}

function navegarAnterior() {
    if (!__currentPerfilId) return;
    const idx = __currentItems.findIndex(i => i.id === __currentPerfilId);
    if (idx > 0) {
        verPerfilUI(__currentItems[idx - 1].id);
        scrollPerfilAlInicio();
    }
}

function navegarSiguiente() {
    if (!__currentPerfilId) return;
    const idx = __currentItems.findIndex(i => i.id === __currentPerfilId);
    if (idx < __currentItems.length - 1) {
        verPerfilUI(__currentItems[idx + 1].id);
        scrollPerfilAlInicio();
    }
}

function actualizarBotonesNavegacion() {
    const idx = __currentItems.findIndex(i => i.id === __currentPerfilId);
    const btnAnterior = $('#btnAnterior');
    const btnSiguiente = $('#btnSiguiente');
    const btnCerrar = $('#btnCerrarDialog');

    if (btnAnterior) btnAnterior.disabled = idx <= 0;
    if (btnSiguiente) btnSiguiente.disabled = idx >= __currentItems.length - 1;

    // El botón Cerrar debe estar siempre disponible
    if (btnCerrar) {
        btnCerrar.disabled = false;
        btnCerrar.style.display = '';
    }
}

function ensureDialogNav() {
    const footer = document.querySelector('.perfil-footer');
    if (!footer) return;

    let nav = footer.querySelector('.dialog-nav');
    if (!nav) {
        nav = document.createElement('div');
        nav.className = 'dialog-nav';
        nav.innerHTML = `
            <button type="button" id="btnAnterior" class="secondary">← Atrás</button>
            <button type="button" id="btnSiguiente" class="secondary">Siguiente →</button>
            <button type="button" id="btnCerrarDialog" class="btn-cerrar-footer">Cerrar</button>
        `;
        footer.appendChild(nav);

        // Conectar eventos si se acaban de crear
        $('#btnAnterior')?.addEventListener('click', navegarAnterior);
        $('#btnSiguiente')?.addEventListener('click', navegarSiguiente);
        $('#btnCerrarDialog')?.addEventListener('click', () => {
            $('#dlg')?.close();
            unlockAppScroll();
        });

        // Asegurar también el botón de cierre superior (X) si existe
        $('#btnCerrarDialogTop')?.addEventListener('click', () => {
            $('#dlg')?.close();
            unlockAppScroll();
        });
    }
}

function lockAppScroll() {
    document.body.style.overflow = 'hidden';
}

function unlockAppScroll() {
    document.body.style.overflow = '';
}

function deshabilitarFormulario(disabled) {
    // Solo afectar a los botones de acción principales mientras se carga el perfil.
    // Los botones de navegación (Anterior/Siguiente) se controlan aparte
    // en actualizarBotonesNavegacion para que solo se desactiven
    // al inicio o al final de la lista.

    const btnContactar = $('#btnContactarWhatsApp');
    const btnCalificar = $('#btnCalificar');

    if (btnContactar) btnContactar.disabled = disabled;
    if (btnCalificar) btnCalificar.disabled = disabled;
}

function mostrarMensajeCarga(titulo, mensaje) {
    const div = $('#mensajeCargaMovil');
    if (div) {
        div.innerHTML = `<div class="loading-message"><strong>${titulo}</strong><br>${mensaje}</div>`;
        div.style.display = 'block';
    }
}

function limpiarMensajeCarga() {
    const div = $('#mensajeCargaMovil');
    if (div) {
        div.innerHTML = '';
        div.style.display = 'none';
    }
}

function generateId(length = 15) {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

function normalizarOficio(oficio) {
    return oficio
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // Quitar acentos
        .replace(/[^a-z0-9]/g, '_')       // Reemplazar caracteres especiales
        .replace(/_+/g, '_')              // Eliminar guiones dobles
        .replace(/^_|_$/g, '');           // Quitar guiones al inicio/fin
}

// Mapeo de oficios a códigos numéricos de 2 dígitos
const CODIGOS_OFICIOS = {
    // Construcción y Mantenimiento (01-06)
    'Fontanero': '01',
    'Electricista': '02',
    'Pintor': '03',
    'Albañil': '04',
    'Carpintero': '05',
    'Cerrajero': '06',
    // Hogar y Limpieza (11-14)
    'Limpieza del Hogar': '11',
    'Jardinero': '12',
    'Cuidador/a de Personas Mayores': '13',
    'Cuidador/a de Niños': '14',
    // Reparaciones (21-24)
    'Técnico de Electrodomésticos': '21',
    'Técnico de Aire Acondicionado': '22',
    'Mecánico de Automóviles': '23',
    'Reparación de Ordenadores': '24',
    // Servicios Profesionales (31-34)
    'Profesor Particular': '31',
    'Diseñador Gráfico': '32',
    'Fotógrafo': '33',
    'Traductor': '34',
    // Otros Servicios (41-43)
    'Mudanzas': '41',
    'Transporte': '42',
    'Peluquero/a': '43'
};

function getCodigoOficio(oficio) {
    // Si está en el mapeo, devolver código
    if (CODIGOS_OFICIOS[oficio]) {
        return CODIGOS_OFICIOS[oficio];
    }

    // Para "Otros", generar código basado en hash simple
    // Usar los primeros 2 caracteres del oficio normalizado como base
    const normalizado = oficio.toLowerCase().replace(/[^a-z0-9]/g, '');
    const char1 = normalizado.charCodeAt(0) || 97; // 'a' por defecto
    const char2 = normalizado.charCodeAt(1) || 97;

    // Generar código entre 50-99 para "Otros"
    const codigo = 50 + ((char1 + char2) % 50);
    return codigo.toString().padStart(2, '0');
}



