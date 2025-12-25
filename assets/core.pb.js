// Configuración centralizada de PocketBase para toda la app
console.log('[CORE] Init PocketBase config');

// URL de PocketBase desplegado en Railway (backend de datos)
const POCKETBASE_URL = 'https://oficios.zeabur.app';

const pb = new PocketBase(POCKETBASE_URL);

try {
  fetch(String(POCKETBASE_URL).replace(/\/+$/, '') + '/api/health', { cache: 'no-store' }).catch(() => { });
} catch (_) { }

// Deshabilitar auto-cancelación para evitar errores en peticiones rápidas
if (pb && typeof pb.autoCancellation === 'function') {
  pb.autoCancellation(false);
}

// Exponer en window para que otros scripts lo reutilicen
window.POCKETBASE_URL = POCKETBASE_URL;
window.pb = pb;

// Seguridad/UX: no mantener sesión activa si el usuario aún no verificó su correo
try {
  const m = window.pb?.authStore?.model;
  if (m && m.verified === false) {
    window.pb.authStore.clear();
  }
} catch (_) { }
