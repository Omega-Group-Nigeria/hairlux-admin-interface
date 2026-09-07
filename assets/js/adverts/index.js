/**
 * adverts/index.js — bootstraps the Advert Banners admin page modules
 *
 * Load order (required):
 *   state.js → utils.js → api.js → ui.js → handlers.js → index.js
 */
(function (global) {
    'use strict';

    var A = global.Adverts;
    if (!A || !A.Handlers || !A.Handlers.init) {
        console.error('[Adverts] modules failed to load — check script tags / order');
        return;
    }

    Auth.requireAuth();
    RBAC.loadFromStorage();
    RBAC.applyPageGuardForCurrentPage();

    function start() {
        var maybePromise = A.Handlers.init();
        if (maybePromise && typeof maybePromise.then === "function") {
            maybePromise.catch(function (err) {
                console.error("[Adverts] init failed", err);
            });
        }
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", start);
    } else {
        start();
    }
})(window);