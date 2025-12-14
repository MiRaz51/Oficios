(function () {
  if (!('serviceWorker' in navigator)) return;

  window.addEventListener('load', function () {
    navigator.serviceWorker.register('assets/sw.js')
      .catch(function (err) {
        console.error('[PWA] Error registrando service worker:', err);
      });
  });
})();
