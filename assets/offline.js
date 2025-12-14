document.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('btnOfflineRetry');
  if (btn) {
    btn.addEventListener('click', () => {
      location.reload();
    });
  }
});
