const COLLECTION_OFERTAS = 'ofertas';

function actualizarIndicadorSesionOfertas() {
    try {
        const el = document.getElementById('sessionStatusOfertas');
        if (!el) return;

        const user = window.pb?.authStore?.model;
        if (!user) {
            el.textContent = 'No has iniciado sesión';
            return;
        }

        const estado = user.verified ? 'verificado' : 'sin verificar';
        el.textContent = `Sesión: ${user.email || 'sin email'} (${estado})`;
    } catch (e) {
        console.warn('[Sesion] No se pudo actualizar el indicador de sesión en ofertas:', e);
    }
}

let todasLasOfertas = [];

document.addEventListener('DOMContentLoaded', async () => {
    // Elementos del DOM
    const ofertasLista = document.getElementById('ofertas-lista');
    const mensajeEstado = document.getElementById('mensaje-estado');
    const qInput = document.getElementById('q-ofertas');
    const ubicacionSelect = document.getElementById('sel-ubicacion-ofertas');
    const modalidadSelect = document.getElementById('sel-modalidad-ofertas');
    const resetButton = document.getElementById('btn-reset-ofertas');

    const mostrarMensaje = (texto) => {
        ofertasLista.innerHTML = '';
        mensajeEstado.textContent = texto;
        mensajeEstado.style.display = 'block';
    };

    const cargarOfertas = async () => {
        mostrarMensaje('Cargando ofertas...');
        try {
            // Carga sencilla sin parámetros extra para evitar errores 400
            todasLasOfertas = await pb.collection(COLLECTION_OFERTAS).getFullList();

            // Ocultar ofertas marcadas como inactivas
            todasLasOfertas = todasLasOfertas.filter(o => o.estado !== 'inactiva');

            // Ordenar de más reciente a más antigua según fecha_publicacion o created
            todasLasOfertas.sort((a, b) => {
                const fechaA = new Date(a.fecha_publicacion || a.created || 0).getTime();
                const fechaB = new Date(b.fecha_publicacion || b.created || 0).getTime();
                return fechaB - fechaA; // descendente
            });

            if (todasLasOfertas.length === 0) {
                mostrarMensaje('No hay ofertas de empleo disponibles en este momento.');
                return;
            }

            mensajeEstado.style.display = 'none';
            popularFiltros();
            filtrarYRenderizar();

        } catch (error) {
            console.error('Error al cargar las ofertas:', error);
            mostrarMensaje('Hubo un error al cargar las ofertas. Por favor, intenta de nuevo más tarde.');
        }
    };

    const popularFiltros = () => {
        const ubicaciones = [...new Set(todasLasOfertas.map(o => o.ubicacion))].sort();
        const modalidades = [...new Set(todasLasOfertas.map(o => o.modalidad))].sort();

        ubicaciones.forEach(ubicacion => {
            const option = new Option(ubicacion, ubicacion);
            ubicacionSelect.add(option);
        });

        modalidades.forEach(modalidad => {
            const option = new Option(modalidad, modalidad);
            modalidadSelect.add(option);
        });
    };

    const filtrarYRenderizar = () => {
        const textoBusqueda = qInput.value.toLowerCase();
        const ubicacionSeleccionada = ubicacionSelect.value;
        const modalidadSeleccionada = modalidadSelect.value;

        const ofertasFiltradas = todasLasOfertas.filter(oferta => {
            const busquedaCoincide = !textoBusqueda ||
                oferta.titulo.toLowerCase().includes(textoBusqueda) ||
                oferta.descripcion.toLowerCase().includes(textoBusqueda);

            const ubicacionCoincide = !ubicacionSeleccionada || oferta.ubicacion === ubicacionSeleccionada;
            const modalidadCoincide = !modalidadSeleccionada || oferta.modalidad === modalidadSeleccionada;

            return busquedaCoincide && ubicacionCoincide && modalidadCoincide;
        });

        if (ofertasFiltradas.length === 0) {
            mostrarMensaje('No se encontraron ofertas que coincidan con los filtros seleccionados.');
        } else {
            mensajeEstado.style.display = 'none';
            renderOfertas(ofertasFiltradas);
        }
    };

    const renderOfertas = (ofertas) => {

        ofertasLista.innerHTML = ofertas.map(oferta => {
            // Mostrar siempre algún valor de fecha formateado sin segundos
            const fechaBruta = oferta.fecha_publicacion || oferta.created || '';
            const fechaTexto = window.formatFechaCorta(fechaBruta);

            const descripcionHtml = (oferta.descripcion || '').replace(/\n/g, '<br>');
            const nombreContacto = oferta.nombre_contacto || '';

            return `
                <div class="oferta-card">
                    <div class="oferta-header">
                        <h3>${oferta.titulo}</h3>
                        <span class="oferta-fecha">Publicado: ${fechaTexto}</span>
                    </div>
                    <div class="oferta-body">

                        <div class="oferta-detalle">
                            <span>📍</span>
                            <strong>Ubicación:</strong> ${oferta.ubicacion}
                        </div>
                        <div class="oferta-detalle">
                            <span>💼</span>
                            <strong>Modalidad:</strong> <span class="oferta-tag">${oferta.modalidad}</span>
                        </div>
                        <div class="oferta-descripcion">${descripcionHtml}</div>
                        ${nombreContacto ? `<p class="oferta-contacto">Publicado por: <strong>${nombreContacto}</strong></p>` : ''}

                    </div>
                    <div class="oferta-footer">
                        <a href="https://api.whatsapp.com/send?phone=${oferta.whatsapp_contacto}&text=Hola, te contacto por la oferta de '${oferta.titulo}' publicada en Empleos en Comunidad."
                           target="_blank" class="btn-whatsapp">
                            📱 Contactar por WhatsApp
                        </a>
                    </div>
                </div>
            `;
        }).join('');
    };

    // Event Listeners
    qInput.addEventListener('input', filtrarYRenderizar);
    ubicacionSelect.addEventListener('change', filtrarYRenderizar);
    modalidadSelect.addEventListener('change', filtrarYRenderizar);
    resetButton.addEventListener('click', () => {
        qInput.value = '';
        ubicacionSelect.value = '';
        modalidadSelect.value = '';
        filtrarYRenderizar();
    });

    // --- Lógica para el modal de publicación ---
    const dlgPublicar = document.getElementById('dlg-publicar-oferta');
    const btnPublicar = document.getElementById('btn-publicar-oferta');
    const btnCancelarOferta = document.getElementById('btn-cancelar-oferta');
    const frmPublicarOferta = document.getElementById('frm-publicar-oferta');

    const lockScroll = () => { document.body.style.overflow = 'hidden'; };
    const unlockScroll = () => { document.body.style.overflow = ''; };

    btnPublicar.addEventListener('click', () => {
        try {
            const currentUser = window.pb?.authStore?.model;

            if (!currentUser) {
                // No hay sesión: ir a pantalla de cuenta en modo LOGIN
                window.location.href = 'cuenta.html?mode=login&return=ofertas';
                return;
            }

            const whatsappPerfil = (currentUser.whatsapp || '').replace(/\D/g, '');
            if (!/^\d{9}$/.test(whatsappPerfil)) {
                alert('Antes de publicar una oferta, configura un número de WhatsApp válido (9 dígitos) en la página "Mi perfil".');
                window.location.href = 'perfil.html';
                return;
            }

            const inputWhatsapp = document.getElementById('oferta-whatsapp');
            if (inputWhatsapp) {
                inputWhatsapp.value = whatsappPerfil;
            }

            dlgPublicar.showModal();
            lockScroll();

        } catch (e) {
            console.error('[Ofertas] Error comprobando sesión:', e);
            window.location.href = 'cuenta.html?mode=login&return=ofertas';
        }
    });

    btnCancelarOferta.addEventListener('click', () => {
        dlgPublicar.close();
        unlockScroll();
    });

    frmPublicarOferta.addEventListener('submit', async (e) => {
        e.preventDefault();

        const btnEnviar = document.getElementById('btn-enviar-oferta');
        btnEnviar.disabled = true;
        btnEnviar.textContent = 'Publicando...';

        try {
            const currentUser = window.pb?.authStore?.model;
            if (!currentUser) {
                const msgNoUser = 'Debes crear una cuenta e iniciar sesión para publicar ofertas.';
                if (typeof window.showToast === 'function') {
                    window.showToast(msgNoUser, 'error');
                } else {
                    alert(msgNoUser);
                }
                window.location.href = 'cuenta.html?mode=login&return=ofertas';
                return;
            }

            const whatsappPerfil = (currentUser.whatsapp || '').replace(/\D/g, '');
            if (!/^\d{9}$/.test(whatsappPerfil)) {
                const msgWpInvalido = 'El WhatsApp de contacto de tu cuenta no es válido. Configúralo en "Mi perfil" (9 dígitos).';
                if (typeof window.showToast === 'function') {
                    window.showToast(msgWpInvalido, 'error');
                } else {
                    alert(msgWpInvalido);
                }
                window.location.href = 'perfil.html';
                return;
            }

            const data = {
                "titulo": document.getElementById('oferta-titulo').value,
                "ubicacion": document.getElementById('oferta-ubicacion').value,
                "modalidad": document.getElementById('oferta-modalidad').value,
                "descripcion": document.getElementById('oferta-descripcion').value,
                // Guardar en PocketBase con prefijo 34 para cumplir el patrón ^34[0-9]{9}$
                "whatsapp_contacto": `34${whatsappPerfil}`,
                "estado": "activa",
                "fecha_publicacion": new Date().toISOString(),
                "usuario_id": currentUser.id,
                "nombre_contacto": (typeof currentUser.nombre === 'string' ? currentUser.nombre : ''),
            };

            await pb.collection(COLLECTION_OFERTAS).create(data);

            const msgOk = '¡Oferta publicada con éxito!';
            if (typeof window.showToast === 'function') {
                window.showToast(msgOk, 'success');
            } else {
                alert(msgOk);
            }

            frmPublicarOferta.reset();
            dlgPublicar.close();
            unlockScroll();

            cargarOfertas(); // Recargar la lista

        } catch (error) {
            console.error('Error al publicar la oferta:', error);
            const msgErr = 'Hubo un error al publicar la oferta. Por favor, revisa los datos e intenta de nuevo.';
            if (typeof window.showToast === 'function') {
                window.showToast(msgErr, 'error');
            } else {
                alert(msgErr);
            }
        } finally {
            btnEnviar.disabled = false;
            btnEnviar.textContent = 'Publicar Oferta';
        }
    });

    // Cerrar modal también debe restaurar el scroll si se cierra con ESC o clic en el backdrop
    dlgPublicar.addEventListener('close', unlockScroll);

    // Carga inicial
    cargarOfertas();
});