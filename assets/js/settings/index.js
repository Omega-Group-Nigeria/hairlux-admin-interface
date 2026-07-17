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

    function start() {
        var maybePromise = SP.Handlers.init();
        if (maybePromise && typeof maybePromise.then === 'function') {
            maybePromise.catch(function (err) {
                console.error('[SettingsPage] init failed', err);
            });
        }
    }

    function boot() {
        Auth.requireAuth().then(function (ok) {
            if (!ok) return; // redirecting to login — do not load profile / flash UI work
            RBAC.loadFromStorage();
            SP.State.isSuperAdmin = RBAC.isSuperAdmin();
            document.body.classList.remove('settings-auth-pending');
            if (Auth.hideAuthBootScreen) Auth.hideAuthBootScreen();
            start();
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot);
    } else {
        boot();
    }
})(window);
