/**
 * beauticians/index.js — bootstraps the Beauticians admin page modules
 *
 * Load order (required):
 *   state.js → utils.js → api.js → ui.js → handlers.js → index.js
 */
(function (global) {
    'use strict';

    var BP = global.BeauticiansPage;
    if (!BP || !BP.Handlers || !BP.Handlers.init) {
        console.error('[BeauticiansPage] modules failed to load — check script tags / order');
        return;
    }

    // Ensure bootstrap is available on modules that captured it at load time
    BP.bootstrap = global.tabler && global.tabler.bootstrap;

    Auth.requireAuth();
    RBAC.loadFromStorage();
    RBAC.applyPageGuardForCurrentPage();

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () {
            BP.Handlers.init();
        });
    } else {
        BP.Handlers.init();
    }
})(window);
