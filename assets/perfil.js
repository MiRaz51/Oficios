// Lógica de la página Mi perfil
(function () {
  const pb = window.pb;

  async function refreshAuthIfNeeded() {
    try {
      if (!pb || !pb.authStore || !pb.authStore.token) return null;
      const res = await pb.collection('users').authRefresh();
      return res?.record || pb.authStore.model;
    } catch (e) {
      console.warn('[Perfil] Error al refrescar auth, limpiando sesión:', e);
      try { pb.authStore.clear(); } catch (_) { }
      return null;
    }
  }

  async function ejecutarEliminacionDefinitiva(user) {
    if (!user) {
      setMensaje('No hay sesión activa.', 'error');
      mostrarSinSesion();
      return;
    }

    try {
      setMensaje('Eliminando tu cuenta...', 'info');

      await pb.collection('users').delete(user.id);

      try { pb.authStore.clear(); } catch (_) { }

      setMensaje('Tu cuenta ha sido eliminada correctamente. Redirigiendo...', 'success');

      setTimeout(() => {
        window.location.href = '../index.html';
      }, 1500);
    } catch (err) {
      console.error('[Perfil] Error eliminando cuenta:', err);
      const msg = err?.message || 'Error eliminando la cuenta.';
      setMensaje(msg, 'error');
    }
  }

  function setMensaje(texto, tipo = 'info') {
    const el = document.getElementById('perfilMensaje');
    if (!el) return;
    el.textContent = texto || '';
    el.className = 'status-message ' + (tipo || 'info');
  }

  function mostrarSinSesion() {
    document.getElementById('perfilNoSesion').style.display = 'block';
    document.getElementById('perfilContenido').style.display = 'none';
  }

  function mostrarConSesion() {
    document.getElementById('perfilNoSesion').style.display = 'none';
    document.getElementById('perfilContenido').style.display = 'block';
  }

  async function cargarPerfil() {
    const baseUser = pb?.authStore?.model;
    if (!baseUser) {
      mostrarSinSesion();
      return;
    }

    const user = await refreshAuthIfNeeded() || baseUser;
    if (!user) {
      mostrarSinSesion();
      return;
    }

    mostrarConSesion();

    document.getElementById('perfilEmail').value = user.email || '';
    document.getElementById('perfilEstado').value = user.verified ? 'Verificado' : 'Sin verificar';
    document.getElementById('perfilNombre').value = user.nombre || '';
    document.getElementById('perfilWhatsapp').value = user.whatsapp || '';

    setMensaje('', 'info');
  }

  function setupEventos() {
    const btnIrCuenta = document.getElementById('btnIrCuentaDesdePerfil');
    const frm = document.getElementById('frmPerfilCuenta');
    const btnLogoutPerfil = document.getElementById('btnLogoutPerfil');
    const btnEliminarCuenta = document.getElementById('btnEliminarCuenta');
    const dlgConfirmDelete = document.getElementById('dlgConfirmDelete');
    const btnCerrarConfirmDelete = document.getElementById('btnCerrarConfirmDelete');
    const btnCancelarConfirmDelete = document.getElementById('btnCancelarConfirmDelete');
    const btnConfirmarDeleteDefinitivo = document.getElementById('btnConfirmarDeleteDefinitivo');

    if (btnIrCuenta) {
      btnIrCuenta.addEventListener('click', () => {
        window.location.href = 'cuenta.html?return=oficios';
      });
    }

    if (btnLogoutPerfil) {
      btnLogoutPerfil.addEventListener('click', () => {
        try { pb.authStore.clear(); } catch (_) { }
        window.location.href = '../index.html';
      });
    }

    if (btnEliminarCuenta) {
      btnEliminarCuenta.addEventListener('click', async () => {
        const user = pb?.authStore?.model;

        let maskedEmail = '';
        if (user && typeof user.email === 'string') {
          const email = user.email;
          const [local, domain] = email.split('@');
          if (local && domain) {
            const first = local.charAt(0);
            const tail = local.slice(-3);
            maskedEmail = `${first}***${tail}@${domain}`;
          } else {
            maskedEmail = email;
          }
        }

        const mensajeConfirmacion = maskedEmail
          ? `Se eliminará tu cuenta asociada a ${maskedEmail}. Esta acción es permanente y no se puede deshacer. ¿Deseas continuar?`
          : 'Se eliminará tu cuenta de forma permanente. Esta acción no se puede deshacer. ¿Deseas continuar?';

        const confirmar = window.confirm(mensajeConfirmacion);
        if (!confirmar) return;

        // Segunda confirmación mediante modal centrado
        if (!dlgConfirmDelete) {
          // Si por algún motivo no existe el dialog, hacemos la eliminación directa
          await ejecutarEliminacionDefinitiva(user);
          return;
        }

        // Configurar listeners de una sola vez
        const cerrarModal = () => {
          try { dlgConfirmDelete.close(); } catch (_) { }
          document.body.style.overflow = '';
        };

        const onCancelar = () => {
          cerrarModal();
        };

        const onConfirmar = async () => {
          cerrarModal();
          await ejecutarEliminacionDefinitiva(user);
        };

        if (btnCerrarConfirmDelete) btnCerrarConfirmDelete.onclick = onCancelar;
        if (btnCancelarConfirmDelete) btnCancelarConfirmDelete.onclick = onCancelar;
        if (btnConfirmarDeleteDefinitivo) btnConfirmarDeleteDefinitivo.onclick = onConfirmar;

        document.body.style.overflow = 'hidden';
        dlgConfirmDelete.showModal();
      });
    }

    if (frm) {
      frm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const user = pb?.authStore?.model;
        if (!user) {
          setMensaje('No hay sesión activa.', 'error');
          mostrarSinSesion();
          return;
        }

        const nombre = document.getElementById('perfilNombre').value.trim();
        const whatsappRaw = document.getElementById('perfilWhatsapp').value.replace(/\D/g, '');

        if (!nombre) {
          setMensaje('El nombre no puede estar vacío.', 'error');
          return;
        }

        if (whatsappRaw && (!window.isValidWhatsapp9 || !window.isValidWhatsapp9(whatsappRaw))) {
          setMensaje('El WhatsApp debe tener exactamente 9 dígitos numéricos.', 'error');
          return;
        }

        setMensaje('Guardando cambios...', 'info');

        try {
          const updated = await pb.collection('users').update(user.id, {
            nombre,
            whatsapp: whatsappRaw,
          });

          // Actualizar modelo local
          pb.authStore.model = updated;

          setMensaje('Cambios guardados correctamente.', 'success');
        } catch (err) {
          console.error('[Perfil] Error actualizando usuario:', err);

          if (err?.status === 400 && err?.data?.data?.whatsapp) {
            setMensaje('Ese número de WhatsApp ya está asociado a otra cuenta.', 'error');
            return;
          }

          let msg = err?.message || 'Error desconocido actualizando el perfil.';
          if (err?.data?.data) {
            const details = Object.entries(err.data.data)
              .map(([field, e]) => `${field}: ${e.message}`)
              .join('\n');
            if (details) msg += '\n' + details;
          }
          setMensaje(msg, 'error');
        }
      });
    }
  }

  window.addEventListener('load', async () => {
    setupEventos();
    await cargarPerfil();
  });
})();
