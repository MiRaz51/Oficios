// Variables globales (PocketBase se inicializa en core.pb.js como window.pb)
let matchData = null;
let profesionalData = null;
let selectedRating = 0;

// Función principal de inicialización
async function inicializar() {
    try {
        // Extraer token de la URL: ?t=3461234567801A7X
        const urlParams = new URLSearchParams(window.location.search);
        const token = urlParams.get('t');

        if (!token || token.length <= 3) {
            mostrarError('Link inválido o incompleto. Verifica que hayas copiado la URL completa.');
            return;
        }

        // El token se compone de: [ID_PROFESIONAL] + [3_CHARS_TOKEN]
        // El ID del profesional puede tener longitud variable
        const tokenCalificacion = token.slice(-3);
        const profesionalId = token.slice(0, -3);


        // Buscar match válido (SIN EXPAND para evitar errores de contexto)
        let matches;
        try {
            const filterQuery = `profesional_id = "${profesionalId}" && token_calificacion = "${tokenCalificacion}"`;
            matches = await pb.collection('matches').getFullList({
                filter: filterQuery
            });
        } catch (errMatch) {
            console.error('Error buscando match:', errMatch);
            throw new Error(`Error buscando match: ${errMatch.message}`);
        }

        if (matches.length === 0) {
            mostrarError('Link no encontrado. Es posible que ya hayas calificado este servicio.');
            return;
        }

        matchData = matches[0];

        // Validar que no esté expirado
        if (new Date(matchData.expira_en) < new Date()) {
            mostrarError('Este link ha expirado. Los links son válidos por 30 días desde el contacto inicial.');
            return;
        }

        // Validar que no esté ya calificado
        if (matchData.estado === 'calificado') {
            mostrarError('Ya has calificado este servicio. Gracias por tu opinión.');
            return;
        }

        // Cargar datos del profesional (Petición separada para mayor robustez)
        try {
            profesionalData = await pb.collection('oficios').getOne(matchData.profesional_id);
        } catch (errProf) {
            console.error('Error cargando profesional:', errProf);
            throw new Error('No se pudo cargar la información del profesional. ID: ' + matchData.profesional_id);
        }

        document.getElementById('profesionalNombre').textContent =
            `¿Cómo fue tu experiencia con ${profesionalData.nombre}?`;

        configurarEventos();

    } catch (error) {
        console.error('Error en inicialización de calificación:', error);
        mostrarError(`Error técnico: ${error.message || error}. Por favor verifica que el servidor backend esté corriendo.`);
    }
}

// Configurar eventos de la interfaz
function configurarEventos() {
    // Estrellas interactivas
    const stars = document.querySelectorAll('.star-large');
    stars.forEach(star => {
        star.addEventListener('click', () => {
            selectedRating = parseInt(star.dataset.value);
            actualizarEstrellas();
            validarFormulario();
        });

        // Efecto hover
        star.addEventListener('mouseenter', () => {
            const value = parseInt(star.dataset.value);
            stars.forEach((s, i) => {
                s.style.color = i < value ? '#ffc107' : '#ddd';
            });
        });

        star.addEventListener('mouseleave', () => {
            actualizarEstrellas();
        });
    });

    // Contador de caracteres
    const comentario = document.getElementById('comentario');
    const charCount = document.getElementById('charCount');
    comentario.addEventListener('input', () => {
        charCount.textContent = `${comentario.value.length}/200`;
    });

    // Enviar calificación
    document.getElementById('btnEnviar').addEventListener('click', enviarCalificacion);
}

// Actualizar visualización de estrellas
function actualizarEstrellas() {
    const stars = document.querySelectorAll('.star-large');
    stars.forEach((star, index) => {
        if (index < selectedRating) {
            star.textContent = '★';
            star.style.color = '#ffc107';
        } else {
            star.textContent = '☆';
            star.style.color = '#ddd';
        }
    });
}

// Validar que se haya seleccionado al menos una estrella
function validarFormulario() {
    const btnEnviar = document.getElementById('btnEnviar');
    btnEnviar.disabled = selectedRating === 0;
}

// Enviar calificación a PocketBase
async function enviarCalificacion() {
    try {
        const btnEnviar = document.getElementById('btnEnviar');
        btnEnviar.disabled = true;
        btnEnviar.textContent = 'Enviando...';

        const comentario = document.getElementById('comentario').value.trim();

        // Crear calificación
        const calificacion = await pb.collection('calificaciones').create({
            match_id: matchData.id,
            profesional_id: profesionalData.id,
            rating: selectedRating,
            comentario: comentario || '',
            verificada: true
        });

        // Actualizar match
        await pb.collection('matches').update(matchData.id, {
            estado: 'calificado',
            calificacion_id: calificacion.id
        });

        // Recalcular rating del profesional
        await recalcularRating(profesionalData.id);

        // Mostrar mensaje de éxito
        document.getElementById('calificarForm').style.display = 'none';
        document.getElementById('mensajeResultado').style.display = 'block';

    } catch (error) {
        console.error('Error:', error);
        alert('Error al enviar la calificación. Por favor, intenta nuevamente.');
        const btnEnviar = document.getElementById('btnEnviar');
        btnEnviar.disabled = false;
        btnEnviar.textContent = 'Enviar Calificación';
    }
}

// Recalcular rating promedio del profesional
async function recalcularRating(profesionalId) {
    try {
        const calificaciones = await pb.collection('calificaciones').getFullList({
            filter: `profesional_id = "${profesionalId}" && verificada = true`
        });

        if (calificaciones.length === 0) return;

        const promedio = calificaciones.reduce((sum, c) => sum + c.rating, 0) / calificaciones.length;
        const promedioRedondeado = parseFloat(promedio.toFixed(1));

        await pb.collection('oficios').update(profesionalId, {
            ratingpromedio: promedioRedondeado,
            totalcalificaciones: calificaciones.length
        });
    } catch (error) {
        console.error('[Calificar] Error recalculando rating:', error);
        // No mostrar error al usuario, es un proceso secundario
    }
}

// Mostrar mensaje de error
function mostrarError(mensaje) {
    document.getElementById('calificarForm').style.display = 'none';
    document.getElementById('errorTexto').textContent = mensaje;
    document.getElementById('mensajeError').style.display = 'block';
}

// Iniciar al cargar la página
window.addEventListener('load', inicializar);
