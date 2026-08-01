/**
 * settings/index.js — bootstraps the Profile & Settings page modules
 *
 * Load order (required):
 *   state.js → utils.js → api.js → ui.js → handlers.js → index.js
 */
(function (global) {
    'use strict';

    var SP = global.SettingsPage;
    if (!SP || !SP.Handlers || !SP.Handlers.init) {
        console.error('[SettingsPage] modules failed to load — check script tags / order');
        return;
    }

    SP.bootstrap = global.tabler && global.tabler.bootstrap;
    SP.State.isSuperAdmin = RBAC.isSuperAdmin();

    Auth.requireAuth();
    RBAC.loadFromStorage();
    SP.State.isSuperAdmin = RBAC.isSuperAdmin();

    function start() {
        var maybePromise = SP.Handlers.init();
        if (maybePromise && typeof maybePromise.then === 'function') {
            maybePromise.catch(function (err) {
                console.error('[SettingsPage] init failed', err);
            });
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', start);
    } else {
        start();
    }
})(window);
