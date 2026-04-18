/**
 * rbac.js — Hairlux Admin
 * Role-Based Access Control helper.
 *
 * Depends on auth.js being loaded first (uses Auth.fetch).
 * Load after auth.js on every protected page.
 *
 * Usage in every protected page:
 *
 *   // 1. Outside DOMContentLoaded — sync guard from localStorage
 *   RBAC.loadFromStorage();
 *   RBAC.applyPageGuard('bookings:read'); // or array / null / true for superOnly
 *
 *   // 2. Inside DOMContentLoaded — re-hydrate from server then apply nav
 *   RBAC.fetchMe().then(function() { RBAC.applyNavVisibility(); });
 */
const RBAC = (() => {

    // ── Hide nav immediately to prevent permission flash ──────────────────────
    // Injected as early as possible (when rbac.js is parsed). Removed only
    // after applyNavVisibility() has applied the correct show/hide state.
    (function () {
        var s = document.createElement('style');
        s.id = 'rbac-nav-cloak';
        s.textContent = '.navbar-nav > .nav-item { visibility: hidden !important; }';
        var target = document.head || document.documentElement;
        if (target) {
            target.appendChild(s);
        } else {
            document.addEventListener('DOMContentLoaded', function () {
                (document.head || document.documentElement).appendChild(s);
            });
        }
    }());

    // ── In-memory state (re-seeded on every page) ─────────────────────────────
    let _role        = null;   // 'ADMIN' | 'SUPER_ADMIN' | null
    let _permissions = [];     // string[]

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
        _role        = userData.role || null;
        // Permissions may come as a flat array on the user object (current API shape)
        // or nested inside adminRole (legacy / login response shape)
        if (Array.isArray(userData.permissions)) {
            _permissions = userData.permissions;
        } else if (userData.adminRole && Array.isArray(userData.adminRole.permissions)) {
            _permissions = userData.adminRole.permissions;
        } else {
            _permissions = [];
        }
        try { localStorage.setItem('hairlux_user', JSON.stringify(userData)); } catch (_) {}
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
        } catch (_) {}
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

    /** Return a copy of the current permissions array. */
    function getPermissions() { return _permissions.slice(); }

    // ── Nav visibility ────────────────────────────────────────────────────────

    /**
     * Maps a page filename (e.g. "bookings.html") to a visibility rule.
     *   require    — user must have the single permission
     *   requireAny — user must have at least one of the listed permissions
     *
     * This covers the canonical nav order:
     *   Dashboard → Bookings → Payments → Users → Services → Referrals → Discounts → Careers → Staff
     */
    const _NAV_MAP = {
        'index.html':     { type: 'require',    perm:  'analytics:read' },
        'bookings.html':  { type: 'require',    perm:  'bookings:read' },
        'payments.html':  { type: 'require',    perm:  'users:view_wallet' },
        'users.html':     { type: 'require',    perm:  'users:read' },
        'services.html':  { type: 'requireAny', perms: ['services:create', 'services:update', 'services:toggle_status', 'services:delete', 'services:manage_categories'] },
        'referrals.html': { type: 'require',    perm:  'referrals:read' },
        'referral-campaigns.html': { type: 'require', perm: 'referrals:read' },
        'discounts.html': { type: 'require',    perm:  'discounts:read' },
        'careers.html':   { type: 'require',    perm:  'jobs:read' },
        'staff.html':     { type: 'requireAny', perms: ['staff:read', 'staff:create', 'staff:update', 'staff:archive', 'staff:manage_status', 'staff:manage_locations'] },
    };

    /**
     * Returns the filename of the first page in the nav order that the current
     * user is allowed to access (skipping index.html itself).
     * Falls back to 'settings.html' if nothing matches.
     */
    function getFirstAccessiblePage() {
        var order = ['bookings.html', 'payments.html', 'users.html', 'services.html', 'referrals.html', 'discounts.html', 'careers.html', 'staff.html'];
        for (var i = 0; i < order.length; i++) {
            var rule = _NAV_MAP[order[i]];
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
    function applyNavVisibility() {
        document.querySelectorAll('.navbar-nav > .nav-item').forEach(function (li) {
            // Collect all hrefs inside this nav item (covers dropdown children too).
            var hrefs = Array.from(li.querySelectorAll('a[href]'))
                .map(function (a) { return a.getAttribute('href') || ''; });

            // Normalise: strip leading "./" or "../" and keep just the filename.
            var pages = hrefs
                .map(function (h) { return h.replace(/^(\.\.\/|\.\/)+/, ''); })
                .filter(Boolean);

            // Find the first matching rule.
            var rule = null;
            for (var i = 0; i < pages.length; i++) {
                if (_NAV_MAP[pages[i]]) { rule = _NAV_MAP[pages[i]]; break; }
            }
            if (!rule) return; // no rule → always visible (e.g. settings link)

            var allowed = rule.type === 'require'
                ? can(rule.perm)
                : rule.perms.some(function (p) { return can(p); });

            li.style.display = allowed ? '' : 'none';
        });

        // Remove the cloak so the now-correct nav becomes visible all at once.
        var cloak = document.getElementById('rbac-nav-cloak');
        if (cloak) cloak.parentNode.removeChild(cloak);
    }

    // ── Page guard ────────────────────────────────────────────────────────────

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
    return {
        hydrate,
        loadFromStorage,
        fetchMe,
        can,
        isSuperAdmin,
        getRole,
        getFirstAccessiblePage,
        getPermissions,
        applyNavVisibility,
        applyPageGuard,
    };
})();
