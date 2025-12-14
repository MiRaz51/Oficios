(function () {
  const pb = window.pb;

  function getUsuarioIdFilter(userId) {
    // Compatibilidad: usuario_id puede ser relación simple o múltiple según la configuración de PocketBase.
    return `(usuario_id = "${userId}" || usuario_id ?= "${userId}")`;
  }

  function buildUpdateDiagnostic({
    pbUrl,
    collection,
    recordId,
    error,
    user,
    record
  }) {
    const authId = user?.id || '';
    const authEmail = user?.email || '';
    const authVerified = typeof user?.verified === 'boolean' ? String(user.verified) : '';
    const usuarioId = record?.usuario_id;
    const usuarioIdType = Array.isArray(usuarioId) ? 'array' : typeof usuarioId;
    const suggestRule = usuarioIdType === 'array'
      ? '(@request.auth.id ?= usuario_id) && @request.auth.verified = true'
      : '(@request.auth.id = usuario_id) && @request.auth.verified = true';

    const matchesOwner = Array.isArray(usuarioId)
      ? usuarioId.includes(authId)
      : (usuarioId === authId);

    return [
      `PocketBase: ${pbUrl}`,
      `Colección: ${collection}`,
      `Record id: ${recordId}`,
      `Error status: ${error?.status ?? ''}`,
      `Error message: ${error?.message ?? ''}`,
      `Auth id: ${authId}`,
      `Auth email: ${authEmail}`,
      `Auth verified: ${authVerified}`,
      `Record.usuario_id: ${typeof usuarioId === 'undefined' ? '(undefined)' : JSON.stringify(usuarioId)}`,
      `Record.usuario_id type: ${usuarioIdType}`,
      `Auth es dueño (según usuario_id): ${String(!!matchesOwner)}`,
      `Sugerencia Update rule: ${suggestRule}`
    ].join('\n');
  }

  function requireSessionOrRedirect() {
    const user = pb?.authStore?.model;
    if (!user) {
      const noSesion = document.getElementById('publicacionesNoSesion');
      const contenido = document.getElementById('publicacionesContenido');
      if (noSesion && contenido) {
        noSesion.style.display = 'block';
        contenido.style.display = 'none';
      }
      return null;
    }

    const noSesion = document.getElementById('publicacionesNoSesion');
    const contenido = document.getElementById('publicacionesContenido');
    if (noSesion && contenido) {
      noSesion.style.display = 'none';
      contenido.style.display = 'block';
    }

    return user;
  }

  async function cargarPublicacionesUsuario(user) {
    if (!user) return;

    const listaOficios = document.getElementById('listaOficiosUsuario');
    const listaOfertas = document.getElementById('listaOfertasUsuario');
    if (!listaOficios || !listaOfertas) return;

    listaOficios.innerHTML = 'Cargando oficios...';
    listaOfertas.innerHTML = 'Cargando ofertas...';

    try {
      let [oficios, ofertas] = await Promise.all([
        pb.collection('oficios').getFullList({
          filter: getUsuarioIdFilter(user.id),
          $autoCancel: false
        }),
        pb.collection('ofertas').getFullList({
          filter: getUsuarioIdFilter(user.id),
          $autoCancel: false
        })
      ]);

      // Fallback para datos antiguos sin usuario_id: buscar por WhatsApp del usuario
      if ((!oficios || oficios.length === 0) || (!ofertas || ofertas.length === 0)) {
        const userPhone = (user.whatsapp || '').replace(/\D/g, '');

        if (userPhone) {
          const [allOficios, allOfertas] = await Promise.all([
            oficios && oficios.length ? Promise.resolve(oficios) : pb.collection('oficios').getFullList({ $autoCancel: false }),
            ofertas && ofertas.length ? Promise.resolve(ofertas) : pb.collection('ofertas').getFullList({ $autoCancel: false })
          ]);

          if (!oficios || oficios.length === 0) {
            oficios = (allOficios || []).filter(o => {
              const w = String(o.whatsapp || '').replace(/\D/g, '');
              return w.endsWith(userPhone);
            });
          }

          if (!ofertas || ofertas.length === 0) {
            ofertas = (allOfertas || []).filter(o => {
              const w = String(o.whatsapp_contacto || '').replace(/\D/g, '');
              return w.endsWith(userPhone);
            });
          }
        }
      }

      // Ordenar por fecha de publicación: más recientes primero
      const oficiosOrdenados = (oficios || []).slice().sort((a, b) => {
        const fechaA = new Date(a.updated || a.created || 0).getTime();
        const fechaB = new Date(b.updated || b.created || 0).getTime();
        return fechaB - fechaA;
      });

      const ofertasOrdenadas = (ofertas || []).slice().sort((a, b) => {
        const fechaA = new Date(a.fecha_publicacion || a.created || 0).getTime();
        const fechaB = new Date(b.fecha_publicacion || b.created || 0).getTime();
        return fechaB - fechaA;
      });

      renderListaOficios(oficiosOrdenados);
      renderListaOfertas(ofertasOrdenadas);

    } catch (e) {
      console.error('[Publicaciones] Error cargando publicaciones:', e);
      if (typeof window.showToast === 'function') {
        window.showToast('No se pudieron cargar tus publicaciones.', 'error');
      }
    }
  }

  function renderListaOficios(oficios) {
    const cont = document.getElementById('listaOficiosUsuario');
    if (!cont) return;

    if (!oficios.length) {
      cont.innerHTML = '<p>No tienes oficios publicados.</p>';
      return;
    }

    cont.innerHTML = oficios.map(o => {
      const estado = o.estado || 'activa';
      const etiqueta = estado === 'activa' ? 'Activa' : 'Inactiva';
      const accion = estado === 'activa' ? 'Desactivar' : 'Reactivar';
      const nuevoEstado = estado === 'activa' ? 'inactiva' : 'activa';

      return `
      <div class="pub-item" data-tipo="oficio" data-id="${o.id}" data-next-estado="${nuevoEstado}">
        <div class="pub-main">
          <strong>${o.oficio || '(Sin oficio)'}</strong> - ${o.nombre || ''}
        </div>
        <div class="pub-meta">
          <span class="pub-estado pub-estado-${estado}">Estado: ${etiqueta}</span>
          <button class="secondary btn-toggle-estado">${accion}</button>
        </div>
      </div>`;
    }).join('');
  }

  function renderListaOfertas(ofertas) {
    const cont = document.getElementById('listaOfertasUsuario');
    if (!cont) return;

    if (!ofertas.length) {
      cont.innerHTML = '<p>No tienes ofertas publicadas.</p>';
      return;
    }

    cont.innerHTML = ofertas.map(o => {
      const estado = o.estado || 'activa';
      const etiqueta = estado === 'activa' ? 'Activa' : 'Inactiva';
      const accion = estado === 'activa' ? 'Desactivar' : 'Reactivar';
      const nuevoEstado = estado === 'activa' ? 'inactiva' : 'activa';

      return `
      <div class="pub-item" data-tipo="oferta" data-id="${o.id}" data-next-estado="${nuevoEstado}">
        <div class="pub-main">
          <strong>${o.titulo || '(Sin título)'}</strong> - ${o.ubicacion || ''}
        </div>
        <div class="pub-meta">
          <span class="pub-estado pub-estado-${estado}">Estado: ${etiqueta}</span>
          <button class="secondary btn-toggle-estado">${accion}</button>
        </div>
      </div>`;
    }).join('');
  }

  async function cambiarEstadoIndividual(el, user) {
    const tipo = el.dataset.tipo;
    const id = el.dataset.id;
    const nextEstado = el.dataset.nextEstado;
    if (!tipo || !id || !nextEstado) return;

    const confirmMsg = nextEstado === 'inactiva'
      ? 'Esta publicación dejará de ser visible para el público. ¿Continuar?'
      : 'Esta publicación volverá a ser visible para el público. ¿Continuar?';

    if (!window.confirm(confirmMsg)) return;

    const collection = tipo === 'oficio' ? 'oficios' : 'ofertas';

    try {
      await pb.collection(collection).update(id, { estado: nextEstado });

      if (typeof window.showToast === 'function') {
        const msg = nextEstado === 'inactiva'
          ? 'Publicación desactivada.'
          : 'Publicación reactivada.';
        window.showToast(msg, 'success');
      }

      await cargarPublicacionesUsuario(user);
    } catch (e) {
      console.error('[Publicaciones] Error cambiando estado individual:', e);
      if (typeof window.showToast === 'function') {
        const msg = (e && (e.status === 404 || e.status === 403))
          ? 'No se pudo actualizar. Revisa que estés logueado con el mismo usuario dueño (usuario_id) y que la regla Update use = (relación simple) o ?= (relación múltiple).'
          : 'No se pudo actualizar la publicación.';
        window.showToast(msg, 'error');
      }

      if (e && (e.status === 404 || e.status === 403)) {
        try {
          const record = await pb.collection(collection).getOne(id, { fields: 'id,usuario_id' });
          const diag = buildUpdateDiagnostic({
            pbUrl: window.POCKETBASE_URL,
            collection,
            recordId: id,
            error: e,
            user: pb?.authStore?.model,
            record
          });
          window.prompt('Diagnóstico (copia y pégalo aquí si hace falta):', diag);
        } catch (_) {
          const diag = buildUpdateDiagnostic({
            pbUrl: window.POCKETBASE_URL,
            collection,
            recordId: id,
            error: e,
            user: pb?.authStore?.model,
            record: null
          });
          window.prompt('Diagnóstico (copia y pégalo aquí si hace falta):', diag);
        }
      }
    }
  }

  async function cambiarEstadoMasivo(user, nuevoEstado) {
    if (!user) return;

    const confirmMsg = nuevoEstado === 'inactiva'
      ? 'Todas tus publicaciones dejarán de ser visibles para el público. ¿Continuar?'
      : 'Todas tus publicaciones volverán a ser visibles para el público. ¿Continuar?';

    if (!window.confirm(confirmMsg)) return;

    try {
      const [oficios, ofertas] = await Promise.all([
        pb.collection('oficios').getFullList({
          filter: `${getUsuarioIdFilter(user.id)} && estado != "${nuevoEstado}"`,
          $autoCancel: false
        }),
        pb.collection('ofertas').getFullList({
          filter: `${getUsuarioIdFilter(user.id)} && estado != "${nuevoEstado}"`,
          $autoCancel: false
        })
      ]);

      const updates = [];
      oficios.forEach(o => {
        updates.push(pb.collection('oficios').update(o.id, { estado: nuevoEstado }));
      });
      ofertas.forEach(o => {
        updates.push(pb.collection('ofertas').update(o.id, { estado: nuevoEstado }));
      });

      await Promise.allSettled(updates);

      if (typeof window.showToast === 'function') {
        const msg = nuevoEstado === 'inactiva'
          ? 'Todas tus publicaciones han sido desactivadas.'
          : 'Todas tus publicaciones han sido reactivadas.';
        window.showToast(msg, 'success');
      }

      await cargarPublicacionesUsuario(user);
    } catch (e) {
      console.error('[Publicaciones] Error cambiando estado masivo:', e);
      if (typeof window.showToast === 'function') {
        window.showToast('No se pudieron actualizar todas las publicaciones.', 'error');
      }
    }
  }

  window.addEventListener('load', async () => {
    const user = requireSessionOrRedirect();

    const btnIrLogin = document.getElementById('btnIrLoginPublicaciones');
    if (btnIrLogin) {
      btnIrLogin.addEventListener('click', () => {
        window.location.href = 'cuenta.html?mode=login&return=publicaciones';
      });
    }

    if (!user) return;

    await cargarPublicacionesUsuario(user);

    const cont = document.body;
    cont.addEventListener('click', async (e) => {
      const item = e.target.closest('.btn-toggle-estado');
      if (!item) return;
      const wrapper = item.closest('.pub-item');
      if (!wrapper) return;
      const currentUser = pb?.authStore?.model;
      await cambiarEstadoIndividual(wrapper.dataset && wrapper, currentUser);
    });

    const btnDesactivarTodas = document.getElementById('btnDesactivarTodas');
    const btnReactivarTodas = document.getElementById('btnReactivarTodas');

    if (btnDesactivarTodas) {
      btnDesactivarTodas.addEventListener('click', () => cambiarEstadoMasivo(pb?.authStore?.model, 'inactiva'));
    }
    if (btnReactivarTodas) {
      btnReactivarTodas.addEventListener('click', () => cambiarEstadoMasivo(pb?.authStore?.model, 'activa'));
    }
  });
})();
