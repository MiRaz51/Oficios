(async function () {
  const params = new URLSearchParams(window.location.search);
  const token = params.get('token');
  const mensajeEl = document.getElementById('mensaje');
  const estadoEl = document.getElementById('estado');

  if (!token) {
    mensajeEl.textContent = 'Token no proporcionado.';
    estadoEl.textContent = 'El enlace no es válido.';
    estadoEl.className = 'status error';
    return;
  }

  try {
    const resp = await fetch(`/api/confirm-delete-account?token=${encodeURIComponent(token)}`);
    const data = await resp.json().catch(() => null);

    if (!resp.ok || !data || data.success !== true) {
      mensajeEl.textContent = data && data.error
        ? data.error
        : 'No se pudo confirmar la eliminación de la cuenta.';
      estadoEl.textContent = 'La eliminación no ha sido completada.';
      estadoEl.className = 'status error';
      return;
    }

    mensajeEl.textContent = 'Tu cuenta ha sido eliminada correctamente.';
    estadoEl.textContent = 'Ya puedes cerrar esta ventana.';
    estadoEl.className = 'status ok';
  } catch (err) {
    console.error('[Eliminar cuenta] Error confirmando token:', err);
    mensajeEl.textContent = 'Ocurrió un error al procesar la solicitud.';
    estadoEl.textContent = 'Inténtalo de nuevo más tarde.';
    estadoEl.className = 'status error';
  }
})();
