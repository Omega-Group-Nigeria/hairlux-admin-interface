/**
 * rbac.js — Hairlux Admin
 * Role-Based Access Control helper.
 *
 * Depends on auth.js being loaded first (uses Auth.fetch).
 * Load after auth.js and nav-config.js on every protected page.
 *
 * Usage in every protected page:
 *
 *   // 1. Outside DOMContentLoaded — sync guard from localStorage
 *   RBAC.loadFromStorage();
 *   RBAC.applyPageGuard('bookings:read'); // or array / null
 *   RBAC.applyPageGuardForCurrentPage();  // reads rule from NavConfig for this page
 *
 *   // 2. Inside DOMContentLoaded — re-hydrate from server then refresh nav
 *   RBAC.fetchMe().then(function() { RBAC.applyNavVisibility(); });
 *
 * Nav visibility is applied synchronously from localStorage whenever the sidebar
 * renders (see layout.js). fetchMe only updates permissions when the API responds.
 */
const RBAC = (() => {

    // ── In-memory state (re-seeded on every page) ─────────────────────────────
    let _role = null;   // 'ADMIN' | 'SUPER_ADMIN' | null
    let _permissions = [];     // string[]
    // Dev Feedback Round 9: Branch Filter automation -- non-empty only
    // for an admin who's also a branch manager (their linked Staff
    // record has managedBranches set), same convention staff-portal-
    // app.js's applyModuleVisibility already uses for the equivalent
    // staff-portal check. Array, not a single object -- one manager can
    // now oversee multiple branches (the old one-branch-per-manager DB
    // constraint was dropped). [{ id, name }, ...], possibly empty.
    let _managedBranches = [];

    // ── Hydration ─────────────────────────────────────────────────────────────

    /**
     * Seed in-memory state from a user object that includes adminRole.permissions.
     * The user object shape expected (from login or GET /auth/me):
     *   { role: 'ADMIN', adminRole: { id, name, permissions: [...] }, ... }
     *
     * Also writes the updated user back to localStorage so the next page starts fresh.
     */
    function hydrate(userData) {
        if (!userData) return;
        _role = userData.role || null;
        // Permissions may come as a flat array on the user object (current API shape)
        // or nested inside adminRole (legacy / login response shape)
        if (Array.isArray(userData.permissions)) {
            _permissions = userData.permissions;
        } else if (userData.adminRole && Array.isArray(userData.adminRole.permissions)) {
            _permissions = userData.adminRole.permissions;
        } else {
            _permissions = [];
        }
        _managedBranches = Array.isArray(userData.managedBranches) ? userData.managedBranches : [];
        try { localStorage.setItem('hairlux_user', JSON.stringify(userData)); } catch (_) { }
    }

    /**
     * Quick synchronous seed from whatever is already stored in localStorage.
     * Call this immediately after Auth.requireAuth() so can() works right away
     * while the async fetchMe() call is still in flight.
     */
    function loadFromStorage() {
        try {
            const u = JSON.parse(localStorage.getItem('hairlux_user') || 'null');
            if (u) hydrate(u);
        } catch (_) { }
    }

    /**
     * Call GET /auth/me, re-hydrate permissions from the server response.
     * This is the required re-hydration path on every page load per the RBAC guide.
     * Returns the user object on success, or null on failure (graceful degradation).
     */
    async function fetchMe() {
        try {
            const res = await Auth.fetch('/auth/me');
            if (!res) return null;
            const raw = await res.json().catch(() => ({}));
            if (!res.ok) {
                console.warn('[RBAC] GET /auth/me failed:', raw.message || res.status);
                return null;
            }
            const userData = raw.data || raw;
            hydrate(userData);
            return userData;
        } catch (err) {
            console.warn('[RBAC] fetchMe error:', err.message);
            return null;
        }
    }

    // ── Permission check ──────────────────────────────────────────────────────

    /**
     * Returns true if the current user holds the given permission string.
     * SUPER_ADMIN always returns true regardless of the permission list.
     * @param {string} permission  e.g. 'bookings:read'
     */
    function can(permission) {
        if (_role === 'SUPER_ADMIN') return true;
        return _permissions.includes(permission);
    }

    /** True only for SUPER_ADMIN users. */
    function isSuperAdmin() { return _role === 'SUPER_ADMIN'; }

    /** Return the current role string ('ADMIN', 'SUPER_ADMIN', or null). */
    function getRole() { return _role; }

    /** Copy of the manager's branches -- [{ id, name }, ...], possibly empty. */
    function getManagedBranches() { return _managedBranches.slice(); }

    /** Convenience for the common case of just needing the ids to filter/restrict by. */
    function getManagedBranchIds() { return _managedBranches.map(function (b) { return b.id; }); }

    /**
     * True for any admin whose linked Staff record manages at least one branch.
     * SUPER_ADMIN is never branch-scoped -- the group owner always sees every
     * branch, even if their own Staff record also happens to manage one.
     */
    function isManagerScoped() { return _role !== 'SUPER_ADMIN' && _managedBranches.length > 0; }

    /**
     * Branch Scope -- single-select. For a branch manager: strips every branch
     * they don't manage AND the empty "All branches" / placeholder option
     * (for a multi-branch manager, "All" would send no branchId and the API
     * would return every branch in the group), preselects their first branch,
     * and locks the control when they manage only one. No-op for everyone else.
     * Returns true when scoping was applied, so the caller can reload data.
     */
    function applyBranchScope(selectEl) {
        if (!isManagerScoped() || !selectEl) return false;
        var managedIds = getManagedBranchIds();
        Array.from(selectEl.options).forEach(function (o) {
            if (managedIds.indexOf(o.value) === -1) o.remove();
        });
        if (managedIds.indexOf(selectEl.value) === -1) selectEl.value = managedIds[0];
        selectEl.disabled = managedIds.length === 1;
        selectEl.setAttribute('data-branch-scoped', '1');
        return true;
    }

    function applyBranchScopeMultiSelect(selectEl) {
        if (!isManagerScoped() || !selectEl) return false;
        var managedIds = getManagedBranchIds();
        Array.from(selectEl.options).forEach(function (o) {
            if (managedIds.indexOf(o.value) === -1) { o.remove(); return; }
            o.selected = true;
        });
        selectEl.setAttribute('data-branch-scoped', '1');
        return true;
    }

    /**
     * Request-level enforcement -- wrap every branch param a page sends to the
     * API. Makes scoping independent of whether the <select> has been
     * populated/scoped yet (removes the race where a page's first, unscoped
     * load resolves after the scoped reload and shows every branch).
     *   scopeBranchId('')        -> manager's first branch
     *   scopeBranchId(foreignId) -> manager's first branch
     *   scopeBranchId(ownId)     -> ownId
     * Non-managers get the value back unchanged.
     */
    function scopeBranchId(branchId) {
        if (!isManagerScoped()) return branchId;
        var managedIds = getManagedBranchIds();
        return managedIds.indexOf(branchId) !== -1 ? branchId : managedIds[0];
    }

    /** Multi-branch variant: keeps only managed ids; empty/none -> all managed ids. */
    function scopeBranchIds(branchIds) {
        if (!isManagerScoped()) return branchIds;
        var managedIds = getManagedBranchIds();
        var kept = (branchIds || []).filter(function (id) { return managedIds.indexOf(id) !== -1; });
        return kept.length ? kept : managedIds;
    }

    /**
     * For non-paginated list endpoints that accept ONE optional branchId
     * (alerts, queues, badge counts). Non-managers: fn(branchId) as-is.
     * Managers: fn(branchId) if it's one of theirs, otherwise one call per
     * managed branch with the resulting arrays merged -- so a multi-branch
     * manager sees all of their branches, never anyone else's.
     *   var alerts = await RBAC.fetchAcrossScope(undefined, function (id) { return Inventory.getAlerts(id, false); });
     */
    async function fetchAcrossScope(branchId, fn) {
        if (!isManagerScoped()) return fn(branchId);
        var managedIds = getManagedBranchIds();
        var ids = managedIds.indexOf(branchId) !== -1 ? [branchId] : managedIds;
        var results = await Promise.all(ids.map(function (id) { return fn(id); }));
        if (results.length === 1) return results[0];
        var seen = {};
        return [].concat.apply([], results.map(function (r) {
            return Array.isArray(r) ? r : (r && Array.isArray(r.data) ? r.data : []);
        })).filter(function (row) {
            // A record spanning two managed branches (e.g. a stock transfer) comes back from both calls.
            if (!row || row.id == null) return true;
            if (seen[row.id]) return false;
            seen[row.id] = true;
            return true;
        });
    }

    /** Filter a branch list ([{ id, ... }]) down to the manager's branches. Unchanged for non-managers. */
    function filterBranches(branches) {
        if (!isManagerScoped() || !Array.isArray(branches)) return branches;
        var managedIds = getManagedBranchIds();
        return branches.filter(function (b) { return b && managedIds.indexOf(b.id) !== -1; });
    }

    /** Return a copy of the current permissions array. */
    function getPermissions() { return _permissions.slice(); }

    // ── Nav visibility ────────────────────────────────────────────────────────

    /** Page permission rules — sourced from NavConfig (nav-config.js). */
    function _getNavMap() {
        if (typeof NavConfig !== 'undefined' && NavConfig.buildPagePermissionMap) {
            return NavConfig.buildPagePermissionMap();
        }
        return {};
    }

    /**
     * Returns the filename of the first page in the nav order that the current
     * user is allowed to access (skipping index.html itself).
     * Falls back to 'settings.html' if nothing matches.
     */
    function getFirstAccessiblePage() {
        var order = (typeof NavConfig !== 'undefined' && NavConfig.getAccessiblePageOrder)
            ? NavConfig.getAccessiblePageOrder()
            : [];
        var navMap = _getNavMap();
        for (var i = 0; i < order.length; i++) {
            var rule = navMap[order[i]];
            if (!rule) continue;
            var allowed = rule.type === 'require'
                ? can(rule.perm)
                : rule.perms.some(function (p) { return can(p); });
            if (allowed) return order[i];
        }
        return 'settings.html';
    }

    /**
     * Walk every top-level navbar nav item and hide those the current user
     * cannot access. Safe to call multiple times (idempotent).
     *
     * Works for both root-level pages (./page.html) and sub-directory pages
     * (../page.html) without any per-page HTML changes.
     */
    function _pageFromHref(href) {
        return (href || '').replace(/^(\.\.\/|\.\/)+/, '').split('#')[0].split('?')[0];
    }

    function _ruleAllows(rule) {
        if (!rule) return null; // no rule found -- caller decides the default
        return rule.type === 'require'
            ? can(rule.perm)
            : rule.perms.some(function (p) { return can(p); });
    }

    /** Link-level rules keyed by the configured href (hash/query kept) -- see NavConfig.buildLinkPermissionMap. */
    function _getLinkMap() {
        if (typeof NavConfig !== 'undefined' && NavConfig.buildLinkPermissionMap) {
            return NavConfig.buildLinkPermissionMap();
        }
        return {};
    }

    /** The rule for one sidebar link: its own (by data-nav-key) first, else its page's. */
    function _ruleForLink(a, navMap, linkMap) {
        var key = a.getAttribute('data-nav-key');
        if (key && linkMap[key]) return linkMap[key];
        return navMap[_pageFromHref(a.getAttribute('href'))];
    }

    function applyNavVisibility() {
        var sidebar = document.getElementById('app-sidebar');
        if (!sidebar) return;

        var navMap = _getNavMap();
        var linkMap = _getLinkMap();
        sidebar.querySelectorAll(':scope > .nav-item').forEach(function (li) {
            var dropdownLinks = Array.from(li.querySelectorAll('.dropdown-menu a[href]'));

            if (dropdownLinks.length) {
                // Dropdown group: gate each child link by its OWN rule (a
                // child with its own permission in NavConfig -- e.g. each
                // Business Intelligence sub-module -- is shown/hidden
                // independently of its siblings, not as a group). The group
                // itself stays visible as long as at least one child is.
                var anyVisible = false;
                dropdownLinks.forEach(function (a) {
                    var allowed = _ruleAllows(_ruleForLink(a, navMap, linkMap));
                    if (allowed === null) allowed = true; // no rule -- session-only access
                    a.style.display = allowed ? '' : 'none';
                    if (allowed) anyVisible = true;
                });
                li.style.display = anyVisible ? '' : 'none';
                li.style.visibility = anyVisible ? 'visible' : 'hidden';
                return;
            }

            var rule = null;
            var links = Array.from(li.querySelectorAll('a[href]'));
            for (var i = 0; i < links.length; i++) {
                rule = _ruleForLink(links[i], navMap, linkMap);
                if (rule) break;
            }
            if (!rule) {
                li.style.display = '';
                li.style.visibility = 'visible';
                return;
            }

            var allowed = _ruleAllows(rule);
            li.style.display = allowed ? '' : 'none';
            li.style.visibility = allowed ? 'visible' : 'hidden';
        });

        // Legacy: remove old cloak if present from a cached script.
        var cloak = document.getElementById('rbac-nav-cloak');
        if (cloak) cloak.parentNode.removeChild(cloak);
    }

    /** Apply cached permissions to the sidebar (safe to call before fetchMe). */
    function syncNavFromCache() {
        loadFromStorage();
        applyNavVisibility();
    }

    // ── Page guard ────────────────────────────────────────────────────────────

    function _ruleToGuardPermission(rule) {
        if (!rule) return null;
        return rule.type === 'require' ? rule.perm : rule.perms;
    }

    /**
     * Return the permission guard value for a page filename (e.g. 'shop.html').
     * Matches the rule used by applyNavVisibility / getFirstAccessiblePage.
     * @returns {string|string[]|null}
     */
    function getPagePermissions(pageFile) {
        return _ruleToGuardPermission(_getNavMap()[pageFile]);
    }

    function getCurrentPageFile() {
        return window.location.pathname.split('/').pop() || 'index.html';
    }

    /**
     * Apply the page guard for the current URL's filename using NavConfig.
     * Pages without a nav rule pass null (session-only access).
     */
    function applyPageGuardForCurrentPage(superOnly) {
        return applyPageGuard(getPagePermissions(getCurrentPageFile()), superOnly);
    }

    /**
     * Verify the current user has the required permission(s) and redirect if not.
     *
     * Safe to call both synchronously (after loadFromStorage) and again inside
     * fetchMe().then() for a definitive server-fresh check.
     *
     * @param {string|string[]|null} permission
     *   - string  : single required permission
     *   - string[]: any of the listed permissions suffices (requireAny)
     *   - null    : no permission check (everyone with a valid session may access)
     * @param {boolean} [superOnly=false]
     *   When true, only SUPER_ADMIN is allowed (ignores `permission`).
     * @returns {boolean} true if the user is allowed, false + redirect otherwise
     */
    function applyPageGuard(permission, superOnly) {
        // If role hasn't been loaded yet (localStorage was empty / first visit),
        // skip the sync check entirely — fetchMe().then() will call us again.
        if (_role === null) return true;

        var allowed;
        if (superOnly) {
            allowed = isSuperAdmin();
        } else if (!permission) {
            allowed = true;
        } else if (Array.isArray(permission)) {
            allowed = permission.some(function (p) { return can(p); });
        } else {
            allowed = can(permission);
        }

        if (!allowed) {
            // Correct sub-directory detection: only bookings/ pages live one level deep.
            var isSubDir = window.location.pathname.includes('/bookings/');
            var currentFile = window.location.pathname.split('/').pop() || 'index.html';
            var redirect;
            if (isSubDir) {
                redirect = '../index.html';
            } else if (currentFile === 'index.html' || currentFile === '') {
                // Never redirect index.html to itself — use settings as safe fallback.
                redirect = './settings.html';
            } else {
                redirect = './index.html';
            }
            window.location.replace(redirect);
            return false;
        }
        return true;
    }

    // ── Public API ────────────────────────────────────────────────────────────
    var api = {
        hydrate,
        loadFromStorage,
        fetchMe,
        can,
        isSuperAdmin,
        getRole,
        getManagedBranches,
        getManagedBranchIds,
        isManagerScoped,
        applyBranchScope,
        applyBranchScopeMultiSelect,
        scopeBranchId,
        scopeBranchIds,
        filterBranches,
        fetchAcrossScope,
        getFirstAccessiblePage,
        getPermissions,
        getPagePermissions,
        getCurrentPageFile,
        applyNavVisibility,
        syncNavFromCache,
        applyPageGuard,
        applyPageGuardForCurrentPage,
    };

    // Hydrate role + managed branches immediately, independent of the sidebar,
    // so branch scoping (isManagerScoped / scopeBranchId) is correct from the
    // very first request a page makes -- even on a page with no sidebar.
    loadFromStorage();

    // Sidebar may render before or after rbac.js — keep trying until it exists.
    function _bootstrapNav() {
        if (document.getElementById('app-sidebar')) {
            syncNavFromCache();
        }
    }
    _bootstrapNav();
    document.addEventListener('DOMContentLoaded', _bootstrapNav);

    return api;
})();
