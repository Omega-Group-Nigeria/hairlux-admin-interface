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

    RBAC.loadFromStorage();
    RBAC.applyPageGuardForCurrentPage();

    function start() {
        A.Handlers.init();
        RBAC.fetchMe().then(function () {
            RBAC.applyPageGuardForCurrentPage();
            RBAC.applyNavVisibility();
        });
    }

    function boot() {
        Auth.requireAuth()
            .then(start)
            .catch(function (err) {
                console.error("[Adverts] auth failed", err);
            });
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", boot);
    } else {
        boot();
    }
})(window);