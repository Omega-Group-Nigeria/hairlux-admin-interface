/**
 * settings/state.js — central page state for Profile & Settings
 */
(function (global) {
    'use strict';

    var SP = (global.SettingsPage = global.SettingsPage || {});

    SP.State = {
        VALID_SECTIONS: ['profile', 'security', 'admin-management'],

        /** Current user profile from GET /user/profile */
        profile: null,

        /** Whether the signed-in user is SUPER_ADMIN (gates admin management) */
        isSuperAdmin: false,

        /** Admin users list for Admin Management tab */
        adminUsers: [],

        /** Roles list cache for selects / permissions UI */
        rolesCache: [],

        /** Role id currently selected in the Permissions tab */
        permRole: null,
    };
})(window);
