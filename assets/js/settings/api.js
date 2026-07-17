/**
 * settings/api.js — wrappers around Auth / Roles for the settings page
 */
(function (global) {
    'use strict';

    var SP = (global.SettingsPage = global.SettingsPage || {});

    async function _jsonFetch(path, options) {
        var res = await Auth.fetch(path, options);
        if (!res) throw new Error('Session expired. Please log in again.');
        var raw = await res.json().catch(function () { return {}; });
        return { res: res, raw: raw, data: raw.data !== undefined ? raw.data : raw, message: raw.message };
    }

    SP.Api = {
        // Profile (current user)
        getProfile: function () {
            return _jsonFetch('/user/profile');
        },
        updateProfile: function (body) {
            return _jsonFetch('/user/profile', {
                method: 'PUT',
                body: JSON.stringify(body),
            });
        },
        changePassword: function (body) {
            return _jsonFetch('/user/password', {
                method: 'PUT',
                body: JSON.stringify(body),
            });
        },

        // Admin users / roles (Roles helper)
        getAdminUsers: function () { return Roles.getAdminUsers(); },
        createAdmin: function (data) { return Roles.createAdmin(data); },
        updateRole: function (userId, adminRoleId) { return Roles.updateRole(userId, adminRoleId); },
        updateStatus: function (userId, status) { return Roles.updateStatus(userId, status); },

        fetchRoles: function () { return Roles.fetchRoles(); },
        createRole: function (name, description) { return Roles.createRole(name, description); },
        deleteRole: function (roleId) { return Roles.deleteRole(roleId); },
        fetchRole: function (roleId) { return Roles.fetchRole(roleId); },
        fetchPermissionCatalogue: function () { return Roles.fetchPermissionCatalogue(); },
        setPermissions: function (roleId, perms) { return Roles.setPermissions(roleId, perms); },
    };
})(window);
