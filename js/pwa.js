/**
 * Service Worker registration + PWA install prompt
 */

let deferredInstallPrompt = null;

export function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js', { scope: './' }).catch((err) => {
      console.warn('[pwa] SW register failed', err);
    });
  });
}

export function setupInstallPrompt() {
  const btn = document.getElementById('btn-install');
  if (!btn) return;

  btn.hidden = true;

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;
    btn.hidden = false;
  });

  window.addEventListener('appinstalled', () => {
    deferredInstallPrompt = null;
    btn.hidden = true;
  });

  // Already installed / standalone
  const standalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true;
  if (standalone) btn.hidden = true;

  btn.addEventListener('click', async () => {
    if (!deferredInstallPrompt) {
      // iOS / unsupported: show brief tip
      btn.textContent = '請用瀏覽器「加到主畫面」';
      setTimeout(() => {
        btn.innerHTML = '<span class="gear-icon" aria-hidden="true">⬇</span><span>安裝應用程式</span>';
      }, 2800);
      return;
    }
    deferredInstallPrompt.prompt();
    try {
      await deferredInstallPrompt.userChoice;
    } catch {
      /* ignore */
    }
    deferredInstallPrompt = null;
    btn.hidden = true;
  });
}
