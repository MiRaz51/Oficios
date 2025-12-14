// Menú de usuario reutilizable para todas las páginas
(function () {
  const pb = window.pb;

  // --- Gestión de cierre de sesión por inactividad ---
  const MAX_INACTIVIDAD_MS = 30 * 60 * 1000; // 30 minutos
  let inactividadTimerId = null;

  function limpiarSesionPorInactividad() {
    const tieneSesion = !!(pb && pb.authStore && pb.authStore.token);
    if (!tieneSesion) return;

    try { pb.authStore.clear(); } catch (_) { }
    // Redirigir a la pantalla principal
    window.location.href = '../index.html';
  }

  function resetInactividadTimer() {
    // Solo tiene sentido si hay sesión activa
    const tieneSesion = !!(pb && pb.authStore && pb.authStore.token);
    if (!tieneSesion) {
      if (inactividadTimerId) {
        clearTimeout(inactividadTimerId);
        inactividadTimerId = null;
      }
      return;
    }

    if (inactividadTimerId) {
      clearTimeout(inactividadTimerId);
    }
    inactividadTimerId = setTimeout(limpiarSesionPorInactividad, MAX_INACTIVIDAD_MS);
  }

  async function refreshAuthIfNeeded() {
    try {
      if (!pb || !pb.authStore || !pb.authStore.token) return;
      await pb.collection('users').authRefresh();
    } catch (e) {
      console.warn('[Usuario] Error en authRefresh, limpiando sesión:', e);
      try { pb.authStore.clear(); } catch (_) { }
    }
  }

  function updateUserMenu() {
    const container = document.getElementById('userMenu');
    const icon = document.getElementById('userMenuIcon');
    const btnLogout = document.getElementById('btnLogout');
    const btnPerfil = document.getElementById('btnMiPerfil');
    const btnLogin = document.getElementById('btnLoginCuenta');
    const btnRegistro = document.getElementById('btnRegistroCuenta');
    if (!container || !icon) return;

    const user = pb?.authStore?.model;
    if (!user) {
      // Sin sesión: mostrar texto simple para compatibilidad máxima en móviles
      icon.textContent = 'Menú';
      container.classList.add('user-menu-loggedout');
      container.classList.remove('user-menu-loggedin');

      if (btnPerfil) btnPerfil.style.display = 'none';
      if (btnLogout) btnLogout.style.display = 'none';
      if (btnLogin) btnLogin.style.display = 'block';
      if (btnRegistro) btnRegistro.style.display = 'block';
      return;
    }

    let initials = '';
    if (user.nombre && typeof user.nombre === 'string') {
      const parts = user.nombre.trim().split(/\s+/).filter(Boolean);
      if (parts.length === 1) {
        initials = parts[0][0] || '';
      } else if (parts.length > 1) {
        initials = (parts[0][0] || '') + (parts[parts.length - 1][0] || '');
      }
    }

    if (!initials && user.email && typeof user.email === 'string') {
      const emailPart = user.email.split('@')[0] || '';
      if (emailPart.length >= 2) {
        initials = emailPart[0] + emailPart[1];
      } else if (emailPart.length === 1) {
        initials = emailPart[0];
      }
    }

    if (!initials) {
      initials = 'US';
    }

    icon.textContent = initials.toUpperCase();
    container.classList.add('user-menu-loggedin');
    container.classList.remove('user-menu-loggedout');

    // Con sesión: solo opciones de perfil y logout
    if (btnPerfil) btnPerfil.style.display = 'block';
    if (btnLogout) btnLogout.style.display = 'block';
    if (btnLogin) btnLogin.style.display = 'none';
    if (btnRegistro) btnRegistro.style.display = 'none';
  }

  function setupUserMenuEvents() {
    const btn = document.getElementById('btnUserMenu');
    const dropdown = document.getElementById('userMenuDropdown');
    const btnLogout = document.getElementById('btnLogout');
    const btnPerfil = document.getElementById('btnMiPerfil');
    const btnLogin = document.getElementById('btnLoginCuenta');
    const btnRegistro = document.getElementById('btnRegistroCuenta');
    const btnCambiarVista = document.getElementById('btnCambiarVista');
    const btnMisPublicaciones = document.getElementById('btnMisPublicaciones');

    if (btn && dropdown) {
      // Ocultar por defecto
      dropdown.style.display = 'none';

      btn.addEventListener('click', () => {
        const isOpen = dropdown.style.display === 'block';
        dropdown.style.display = isOpen ? 'none' : 'block';
      });

      document.addEventListener('click', (e) => {
        if (dropdown.style.display !== 'block') return;
        if (!btn.contains(e.target) && !dropdown.contains(e.target)) {
          dropdown.style.display = 'none';
        }
      });
    }

    if (btnLogout) {
      btnLogout.addEventListener('click', () => {
        try { pb.authStore.clear(); } catch (_) { }
        window.location.href = '../index.html';
      });
    }

    if (btnPerfil) {
      btnPerfil.addEventListener('click', () => {
        const user = pb?.authStore?.model;
        if (!user) {
          window.location.href = 'cuenta.html?return=oficios';
          return;
        }
        window.location.href = 'perfil.html';
      });
    }

    if (btnMisPublicaciones) {
      btnMisPublicaciones.addEventListener('click', () => {
        const user = pb?.authStore?.model;
        if (!user) {
          window.location.href = 'cuenta.html?mode=login&return=publicaciones';
          return;
        }
        window.location.href = 'publicaciones.html';
      });
    }

    if (btnLogin) {
      btnLogin.addEventListener('click', () => {
        const params = new URLSearchParams(window.location.search);
        const currentReturn = params.get('return') === 'ofertas' ? 'ofertas' : 'oficios';
        window.location.href = `cuenta.html?mode=login&return=${currentReturn}`;
      });
    }

    if (btnRegistro) {
      btnRegistro.addEventListener('click', () => {
        const params = new URLSearchParams(window.location.search);
        const currentReturn = params.get('return') === 'ofertas' ? 'ofertas' : 'oficios';
        window.location.href = `cuenta.html?mode=registro&return=${currentReturn}`;
      });
    }

    if (btnCambiarVista) {
      const path = window.location.pathname || '';
      const isOfertas = path.includes('ofertas');

      // Ajustar el texto según la página actual
      btnCambiarVista.textContent = isOfertas ? 'Ver oficios' : 'Ver ofertas';

      btnCambiarVista.addEventListener('click', () => {
        const currentPath = window.location.pathname || '';
        const ahoraEsOfertas = currentPath.includes('ofertas');
        if (ahoraEsOfertas) {
          window.location.href = 'oficios.html';
        } else {
          window.location.href = 'ofertas.html';
        }
      });
    }
  }

  async function initUserMenu() {
    updateUserMenu();
    setupUserMenuEvents();
    resetInactividadTimer();

    // Refrescar en background para no bloquear la UI en conexiones lentas
    refreshAuthIfNeeded().then(() => {
      updateUserMenu();
      resetInactividadTimer();
    });
  }

  window.addEventListener('load', () => {
    // Pequeño delay para asegurar que core.pb.js inicializó pb
    setTimeout(initUserMenu, 50);
  });

  window.addEventListener('focus', async () => {
    await refreshAuthIfNeeded();
    updateUserMenu();
    resetInactividadTimer();
  });

  // Eventos globales para detectar actividad del usuario y reiniciar el contador
  ['click', 'mousemove', 'keydown', 'touchstart', 'scroll'].forEach((evt) => {
    window.addEventListener(evt, resetInactividadTimer, { passive: true });
  });
})();
