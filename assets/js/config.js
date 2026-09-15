// Global config — loaded before all other scripts.

(function (global) {
  'use strict';

  function stripTrailingSlash(url) {
    return String(url || '').replace(/\/$/, '');
  }

  function configJsonUrl() {
    var scripts = document.getElementsByTagName('script');
    for (var i = 0; i < scripts.length; i++) {
      var src = scripts[i].src;
      if (src && /\/config\.js(?:\?|$)/.test(src)) {
        return src.replace(/config\.js(?:\?.*)?$/, 'config.jsonc');
      }
    }
    return './assets/js/config.jsonc';
  }

  function stripJsonComments(text) {
    return String(text || '')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '');
  }

  function loadConfig() {
    try {
      var xhr = new XMLHttpRequest();
      xhr.open('GET', configJsonUrl(), false);
      xhr.send(null);
      if (xhr.status === 200 && xhr.responseText) {
        return JSON.parse(stripJsonComments(xhr.responseText)) || {};
      }
    } catch (err) {}
    return {};
  }

  function fallbackApiBase() {
    var host = (global.location && global.location.hostname) || '';
    if (host === 'localhost' || host === '127.0.0.1') return 'http://localhost:3000';
    if (host.indexOf('hairlux.com.ng') !== -1) return 'https://api.hairlux.com.ng';
    return 'http://localhost:3000';
  }

  var cfg = loadConfig();

  global.API_BASE = stripTrailingSlash(cfg.API_BASE || fallbackApiBase());
  global.CLOUDINARY_CLOUD_NAME = cfg.CLOUDINARY_CLOUD_NAME || '';
})(window);

(function setupBackdropCleanup() {
  function removeAll(selector) {
    document.querySelectorAll(selector).forEach(function (el) {
      if (el && el.parentNode) el.parentNode.removeChild(el);
    });
  }

  function cleanupBackdrops() {
    var shownModalCount = document.querySelectorAll('.modal.show').length;
    var shownOffcanvasCount = document.querySelectorAll('.offcanvas.show').length;

    if (shownModalCount === 0) {
      removeAll('.modal-backdrop');
      document.body.classList.remove('modal-open');
      document.body.style.removeProperty('padding-right');
    }

    if (shownOffcanvasCount === 0) {
      removeAll('.offcanvas-backdrop');
    }

    if (shownModalCount === 0 && shownOffcanvasCount === 0) {
      document.body.style.removeProperty('overflow');
    }
  }

  function queueCleanup() {
    window.setTimeout(cleanupBackdrops, 0);
  }

  document.addEventListener('hidden.bs.modal', queueCleanup);
  document.addEventListener('hidden.bs.offcanvas', queueCleanup);

  window.HairluxCleanupBackdrops = cleanupBackdrops;
}());
