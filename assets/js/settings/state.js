/**
 * settings/state.js — central page state for Profile & Settings
 */
(function (global) {
    'use strict';

    var SP = (global.SettingsPage = global.SettingsPage || {});

    SP.State = {
        VALID_SECTIONS: ['profile', 'security', 'business-hours', 'home-service', 'cancellation-policy', 'admin-management'],

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

        /** Home service settings from GET /admin/settings/home-service (contains serviceableAreas) */
        homeService: null,

        /** Serviceable areas draft: [{ state, city }], city "*" = whole state */
        serviceableAreas: [],

        /** True while local area edits have not been persisted to the API yet */
        serviceableAreasDirty: false,

        /** Bundled state -> cities reference data (window.NG_CITIES) */
        ngCities: window.NG_CITIES || {},

        /** Cancellation policy from GET /admin/bookings/cancellation-policy */
        cancellationPolicy: null,

        /** Local edits before save */
        cancellationPolicyDirty: false,
    };
})(window);
