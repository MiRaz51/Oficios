// Configuración centralizada de PocketBase para toda la app
console.log('[CORE] Init PocketBase config');

// En desarrollo local usamos la instancia local de PocketBase.
// En cualquier otro host (GitHub Pages, Railway frontend, etc.) usamos la instancia en Railway.
const POCKETBASE_URL = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
  ? 'http://127.0.0.1:8090'
  : 'https://pocketbase-production-eecc.up.railway.app';

const pb = new PocketBase(POCKETBASE_URL);

// Deshabilitar auto-cancelación para evitar errores en peticiones rápidas
if (pb && typeof pb.autoCancellation === 'function') {
  pb.autoCancellation(false);
}

// Exponer en window para que otros scripts lo reutilicen
window.POCKETBASE_URL = POCKETBASE_URL;
window.pb = pb;
