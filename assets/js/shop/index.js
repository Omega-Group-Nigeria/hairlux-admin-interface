/**
 * shop/index.js — bootstraps the Shop admin page modules
 *
 * Load order (required):
 *   state.js → utils.js → api.js → ui.js → handlers.js → index.js
 */
(function (global) {
    'use strict';

    var SP = global.ShopPage;
    if (!SP || !SP.Handlers || !SP.Handlers.init) {
        console.error('[ShopPage] modules failed to load — check script tags / order');
        return;
    }

    SP.bootstrap = global.tabler && global.tabler.bootstrap;

    Auth.requireAuth();
    RBAC.loadFromStorage();
    RBAC.applyPageGuardForCurrentPage();

    function start() {
        var maybePromise = SP.Handlers.init();
        if (maybePromise && typeof maybePromise.then === 'function') {
            maybePromise.catch(function (err) {
                console.error('[ShopPage] init failed', err);
            });
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', start);
    } else {
        start();
    }
})(window);
