/**
 * Roles & Permissions helper
 *
 * Roles are persisted server-side via the /admin/roles API.
 * Role names are stored ALL-CAPS on the server.
 * SUPER_ADMIN is a built-in protected role.
 *
 * Depends on auth.js (Auth.fetch) being loaded first.
 */
const Roles = (() => {

    // ── Role color cache (used for display; colors cleaned up on role delete) ──
    const COLORS_KEY = 'hairlux_role_colors';

    function _loadColorCache() {
        try { return JSON.parse(localStorage.getItem(COLORS_KEY) || '{}'); } catch(e) { return {}; }
    }

    function _saveColorCache(map) {
        try { localStorage.setItem(COLORS_KEY, JSON.stringify(map)); } catch(e) {}
    }

    function _removeRoleColor(roleId) {
        var map = _loadColorCache();
        delete map[roleId];
        _saveColorCache(map);
    }

    // ── Internal roles cache (populated by fetchRoles) ────────────────────────
    var _rolesCache = [];

    // ── Permission catalogue cache ────────────────────────────────────────────
    var _permCatalogueCache = null;

    // ── Roles API ─────────────────────────────────────────────────────────────

    /**
     * GET /admin/roles
     * Returns all roles, each augmented with a `color` from local cache.
     * Updates the internal _rolesCache.
     */
    async function fetchRoles() {
        const res = await Auth.fetch('/admin/roles');
        const raw = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(raw.message || 'Failed to load roles');
        var colorMap = _loadColorCache();
        _rolesCache = (raw.data || []).map(function(r) {
            return Object.assign({}, r, { color: colorMap[r.id] || 'secondary' });
        });
        return _rolesCache;
    }

    /**
     * POST /admin/roles
     * Name is forced to UPPER CASE before sending (API is case-sensitive).
     * @param {string} name
     * @param {string} [description]
     */
    async function createRole(name, description) {
        var upperName = (name || '').trim().toUpperCase();
        if (!upperName) throw new Error('Role name is required.');
        var body = { name: upperName };
        if (description) body.description = description;
        const res = await Auth.fetch('/admin/roles', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify(body),
        });
        const raw = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(raw.message || 'Failed to create role');
        return raw.data;
    }

    /**
     * DELETE /admin/roles/{id}
     * Blocked server-side if users still assigned.
     */
    async function deleteRole(roleId) {
        if (!roleId) throw new Error('Role ID required.');
        const res = await Auth.fetch('/admin/roles/' + roleId, { method: 'DELETE' });
        const raw = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(raw.message || 'Failed to delete role');
        _removeRoleColor(roleId);
        return raw.data || raw;
    }

    // ── Permissions API ───────────────────────────────────────────────────────

    /**
     * GET /admin/roles/permissions
     * Returns grouped permission catalogue from the server.
     * Result is cached for the session.
     */
    async function fetchPermissionCatalogue() {
        if (_permCatalogueCache) return _permCatalogueCache;
        const res = await Auth.fetch('/admin/roles/permissions');
        const raw = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(raw.message || 'Failed to load permission catalogue');
        _permCatalogueCache = raw.data; // { total, groups: [{group, permissions:[{key,label}]}] }
        return _permCatalogueCache;
    }

    /**
     * PUT /admin/roles/{id}/permissions
     * Completely replaces the permission set for a role.
     * @param {string}   roleId
     * @param {string[]} permissions  Array of permission keys
     */
    async function setPermissions(roleId, permissions) {
        const res = await Auth.fetch('/admin/roles/' + roleId + '/permissions', {
            method:  'PUT',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ permissions: permissions }),
        });
        const raw = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(raw.message || 'Failed to save permissions');
        return raw.data;
    }

    /**
     * GET /admin/roles/{id}
     * Fetches a single role with its full permission set.
     */
    async function fetchRole(roleId) {
        const res = await Auth.fetch('/admin/roles/' + roleId);
        const raw = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(raw.message || 'Role not found');
        return raw.data;
    }

    // ── Display helpers ───────────────────────────────────────────────────────

    /**
     * Get display label from a role name/key string (as stored on user records).
     * Works purely on string — no async needed.
     */
    function getRoleLabel(nameOrKey) {
        if (!nameOrKey) return '—';
        if (nameOrKey === 'SUPER_ADMIN') return 'Super Admin';
        // Format ALL_CAPS → Title Case for readability
        return nameOrKey.replace(/_/g, ' ').replace(/\w\S*/g, function(w) {
            return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
        });
    }

    /**
     * Get Tabler colour for a role — looks up the internal cache by name or id.
     * Falls back to 'secondary'.
     */
    function getRoleColor(nameOrIdOrKey) {
        if (!nameOrIdOrKey) return 'secondary';
        if (nameOrIdOrKey === 'SUPER_ADMIN') return 'danger';
        // Try to find in cached roles by id first, then by name
        var found = _rolesCache.find(function(r) {
            return r.id === nameOrIdOrKey || r.name === nameOrIdOrKey;
        });
        return found ? (found.color || 'secondary') : 'secondary';
    }

    /** Generate a Tabler badge <span> for a role name/key string. */
    function roleBadge(nameOrKey) {
        return '<span class="badge bg-' + getRoleColor(nameOrKey) + '-lt">' + _esc(getRoleLabel(nameOrKey)) + '</span>';
    }

    function _esc(s) {
        return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    }

    // ── Admin user API calls ──────────────────────────────────────────────────

    /** GET /admin/users — returns all non-customer accounts. */
    /**
     * GET /admin/users — fetches all admin staff (role=ADMIN) and super admins
     * (role=SUPER_ADMIN) in parallel, then merges them.
     *
     * Response shape per call: { data: User[], meta: { total, page, limit, totalPages } }
     * For role=ADMIN users the `role` field is their custom role name (e.g. "CASHIER").
     * For role=SUPER_ADMIN users the `role` field is "SUPER_ADMIN".
     */
    async function getAdminUsers() {
        const [resAdmin, resSuperAdmin] = await Promise.all([
            Auth.fetch('/admin/users?role=ADMIN&limit=100&page=1'),
            Auth.fetch('/admin/users?role=SUPER_ADMIN&limit=100&page=1'),
        ]);

        const [rawAdmin, rawSuper] = await Promise.all([
            resAdmin.json().catch(() => ({})),
            resSuperAdmin.json().catch(() => ({})),
        ]);

        if (!resAdmin.ok)      throw new Error(rawAdmin.message      || 'Failed to load admin users');
        if (!resSuperAdmin.ok) throw new Error(rawSuper.message || 'Failed to load super admin users');

        const adminUsers = Array.isArray(rawAdmin.data)      ? rawAdmin.data      : [];
        const superUsers = Array.isArray(rawSuper.data) ? rawSuper.data : [];

        return superUsers.concat(adminUsers);
    }

    /**
     * POST /admin/users
     * Accepts `adminRoleId` (UUID) — preferred — or `role` (name string).
     * At least one must be provided.
     */
    async function createAdmin(data) {
        const res = await Auth.fetch('/admin/users', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify(data),
        });
        const raw = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(raw.message || 'Failed to create admin user');
        return raw.data || raw;
    }

    /** PUT /admin/users/{id}/status */
    async function updateStatus(userId, status) {
        const res = await Auth.fetch('/admin/users/' + userId + '/status', {
            method:  'PUT',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ status }),
        });
        const raw = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(raw.message || 'Failed to update status');
        return raw.data || raw;
    }

    /**
     * PATCH /admin/users/{id}
     * Sends { adminRoleId } (UUID) per AssignAdminRoleDto.
     */
    async function updateRole(userId, adminRoleId) {
        const res = await Auth.fetch('/admin/users/' + userId, {
            method:  'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ adminRoleId }),
        });
        const raw = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(raw.message || 'Failed to update role');
        return raw.data || raw;
    }

    // ── Public API ────────────────────────────────────────────────────────────

    return {
        // Roles
        fetchRoles,
        createRole,
        deleteRole,
        // Permissions
        fetchPermissionCatalogue,
        setPermissions,
        fetchRole,
        // Display
        getRoleLabel,
        getRoleColor,
        roleBadge,
        // Admin users
        getAdminUsers,
        createAdmin,
        updateStatus,
        updateRole,
    };

})();
