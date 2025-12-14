// Utilidades compartidas de interfaz para toda la app
// Helper de selección rápida
window.$ = function (sel, root = document) {
  return root.querySelector(sel);
};

// Helper de escape de HTML para evitar inyección
window.esc = function (v) {
  return (v == null ? '' : String(v))
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
};

// Configuración y helpers para mostrar Markdown en diálogos (términos y privacidad)
function setupMarkdownDialog(options) {
  const link = document.getElementById(options.linkId);
  const dialog = document.getElementById(options.dialogId);
  const content = document.getElementById(options.contentId);
  const btnClose = document.getElementById(options.closeBtnId);

  if (!link || !dialog || !content) return;

  // Cargar y mostrar el markdown cuando se pulsa el enlace
  link.addEventListener('click', function (ev) {
    ev.preventDefault();

    // Si ya se cargó antes, simplemente mostrar el diálogo
    if (content.dataset.loaded === 'true') {
      if (typeof dialog.showModal === 'function') {
        dialog.showModal();
      }
      return;
    }

    fetch(options.mdPath)
      .then(function (res) {
        if (!res.ok) throw new Error('No se pudo cargar ' + options.mdPath);
        return res.text();
      })
      .then(function (text) {
        if (typeof marked === 'undefined') {
          // Fallback mínimo si por alguna razón no está marcada la librería
          content.textContent = text;
        } else {
          content.innerHTML = marked.parse(text);
        }
        content.dataset.loaded = 'true';
        if (typeof dialog.showModal === 'function') {
          dialog.showModal();
        }
      })
      .catch(function () {
        content.textContent = 'No se pudo cargar el contenido. Inténtalo de nuevo más tarde.';
        content.dataset.loaded = 'true';
        if (typeof dialog.showModal === 'function') {
          dialog.showModal();
        }
      });
  });

  if (btnClose) {
    btnClose.addEventListener('click', function () {
      dialog.close();
    });
  }
}

// ========== SISTEMA DE NOTIFICACIONES TIPO TOAST ==========

function ensureToastContainer() {
  var existing = document.getElementById('toastContainer');
  if (existing) return existing;

  var container = document.createElement('div');
  container.id = 'toastContainer';
  container.className = 'toast-container';
  document.body.appendChild(container);
  return container;
}

/**
 * Muestra una notificación tipo toast.
 * @param {string} message Mensaje a mostrar
 * @param {('success'|'error'|'info')} [type] Tipo visual
 * @param {{timeout?: number}} [options] Opciones
 */
window.showToast = function showToast(message, type, options) {
  try {
    var container = ensureToastContainer();

    var toast = document.createElement('div');
    toast.className = 'toast';
    if (type) {
      toast.classList.add('toast-' + type);
    }

    toast.textContent = message || '';

    container.appendChild(toast);

    // Forzar reflujo para permitir transición de entrada
    void toast.offsetWidth; // eslint-disable-line no-unused-expressions
    toast.classList.add('toast-visible');

    // Duraciones por defecto según tipo
    var baseTimeout;
    if (type === 'error') {
      baseTimeout = 4500; // errores un poco más largos
    } else if (type === 'success') {
      baseTimeout = 2200; // éxitos rápidos
    } else {
      baseTimeout = 3000; // info intermedio
    }

    var timeout = (options && options.timeout) || baseTimeout;

    setTimeout(function () {
      toast.classList.remove('toast-visible');
      toast.classList.add('toast-hiding');
      setTimeout(function () {
        if (toast.parentNode === container) {
          container.removeChild(toast);
        }
      }, 400);
    }, timeout);
  } catch (e) {
    // Fallback silencioso para no romper la app si algo falla
    // En el peor caso, no se muestra el toast.
  }
};

window.addEventListener('DOMContentLoaded', function () {
  // Diálogo de Guía de Usuario (usa README como contenido de ayuda)
  setupMarkdownDialog({
    linkId: 'btnHelp',
    dialogId: 'dlgHelp',
    contentId: 'helpContent',
    closeBtnId: 'btnCerrarHelp',
    mdPath: 'docs/README.md'
  });

  // Enlaces internos dentro de la guía que abren otros diálogos
  var helpContentEl = document.getElementById('helpContent');
  if (helpContentEl) {
    helpContentEl.addEventListener('click', function (ev) {
      var privacyTarget = ev.target.closest('a[href="#privacy-modal"]');
      if (privacyTarget) {
        ev.preventDefault();
        var privacyLink = document.getElementById('linkPrivacy');
        if (privacyLink) privacyLink.click();
        return;
      }

      var termsTarget = ev.target.closest('a[href="#terms-modal"]');
      if (termsTarget) {
        ev.preventDefault();
        var termsLink = document.getElementById('linkLicense');
        if (termsLink) termsLink.click();
        return;
      }
    });
  }

  // Diálogo de Términos de Uso
  setupMarkdownDialog({
    linkId: 'linkLicense',
    dialogId: 'dlgLicense',
    contentId: 'licenseContent',
    closeBtnId: 'btnCerrarLicense',
    // Ruta absoluta para que funcione tanto en index.html (raíz) como en páginas dentro de /assets
    mdPath: '/docs/LICENSE.md'
  });

  // Diálogo de Política de Privacidad
  setupMarkdownDialog({
    linkId: 'linkPrivacy',
    dialogId: 'dlgPrivacy',
    contentId: 'privacyContent',
    closeBtnId: 'btnCerrarPrivacy',
    // Ruta absoluta para que funcione tanto en index.html (raíz) como en páginas dentro de /assets
    mdPath: '/docs/PRIVACY.md'
  });
});

