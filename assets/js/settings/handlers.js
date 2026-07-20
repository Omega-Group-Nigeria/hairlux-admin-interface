/**
 * settings/handlers.js — profile/password saves, admin management, event binding
 */
(function (global) {
    'use strict';

    var SP = (global.SettingsPage = global.SettingsPage || {});
    var State = SP.State;
    var Utils = SP.Utils;
    var UI = SP.UI;
    var Api = SP.Api;
    var bootstrap = global.tabler && global.tabler.bootstrap;

    var showAlert = Utils.showAlert;
    var dismissAlert = Utils.dismissAlert;
    var setSpinner = Utils.setSpinner;
    var _esc = Utils._esc;
    var showAdminAlert = Utils.showAdminAlert;
    var fuzzyScore = Utils.fuzzyScore;

    var switchSection = UI.switchSection;
    var routeOnLoad = UI.routeOnLoad;
    var populateUserInfo = UI.populateUserInfo;
    var fillProfileForm = UI.fillProfileForm;
    var togglePwd = UI.togglePwd;
    var updateAdminStats = UI.updateAdminStats;
    var renderPermRoleSelector = UI.renderPermRoleSelector;
    var renderAdminTable = UI.renderAdminTable;
    var filterAdminUsers = UI.filterAdminUsers;
    var updateSearchInfo = UI.updateSearchInfo;
    var clearAdminSearch = UI.clearAdminSearch;
    var renderPermMatrix = UI.renderPermMatrix;


// ── Alert helpers ─────────────────────────────────────────────────────

// ── Section navigation ────────────────────────────────────────────────

// ── Populate user info in navbar + sidebar + profile header ───────────

// ── GET /user/profile ─────────────────────────────────────────────────
async function loadProfile() {
    try {
        var res  = await Api.getProfile();
        var raw  = await res.json().catch(function(){ return {}; });
        State.profile = raw.data || raw;
        populateUserInfo(State.profile);
        fillProfileForm(State.profile);
    } catch(err) {
        showAlert('danger', 'Failed to load profile: ' + err.message);
    }
}

// ── PUT /user/profile ─────────────────────────────────────────────────
document.getElementById('form-profile').addEventListener('submit', async function(e) {
    e.preventDefault();
    setSpinner('spinner-profile', true);
    this.querySelector('#btn-save-profile').disabled = true;
    try {
        var body = {
            firstName: document.getElementById('input-firstName').value.trim(),
            lastName:  document.getElementById('input-lastName').value.trim(),
            phone:     document.getElementById('input-phone').value.trim() || undefined,
        };
        var res = await Api.updateProfile(body);
        var raw = await res.json().catch(function(){ return {}; });
        if (!res.ok) throw new Error(raw.message || 'Update failed (' + res.status + ')');
        State.profile = raw.data || State.profile;
        populateUserInfo(State.profile);
        localStorage.setItem('hairlux_user', JSON.stringify(State.profile));
        showAlert('success', 'Profile updated successfully.');
    } catch(err) {
        showAlert('danger', err.message);
    } finally {
        setSpinner('spinner-profile', false);
        document.getElementById('btn-save-profile').disabled = false;
    }
});
document.getElementById('btn-reset-profile').addEventListener('click', function() {
    fillProfileForm(State.profile); dismissAlert();
});

// ── PUT /user/password ────────────────────────────────────────────────
document.getElementById('form-password').addEventListener('submit', async function(e) {
    e.preventDefault();
    var newPwd  = document.getElementById('input-newPassword').value;
    var confPwd = document.getElementById('input-confirmPassword').value;
    if (newPwd !== confPwd) { showAlert('danger', 'New passwords do not match.'); return; }
    setSpinner('spinner-password', true);
    document.getElementById('btn-save-password').disabled = true;
    try {
        var body = {
            currentPassword: document.getElementById('input-currentPassword').value,
            newPassword: newPwd,
        };
        var res = await Api.changePassword(body);
        var raw = await res.json().catch(function(){ return {}; });
        if (!res.ok) throw new Error(raw.message || 'Password change failed (' + res.status + ')');
        showAlert('success', 'Password changed successfully.');
        document.getElementById('form-password').reset();
    } catch(err) {
        showAlert('danger', err.message);
    } finally {
        setSpinner('spinner-password', false);
        document.getElementById('btn-save-password').disabled = false;
    }
});

// ── Password visibility toggle ────────────────────────────────────────

// ── Populate role <select> elements (Create Admin + Change Role modals) ──
async function populateRoleSelects() {
    var caEl = document.getElementById('ca-role');
    var rrEl = document.getElementById('role-change-select');
    try {
        var roles = await Api.fetchRoles();
        State.rolesCache = roles;
        if (!roles.length) {
            var placeholder = '<option value="" disabled selected>No roles yet — create one first</option>';
            if (caEl) caEl.innerHTML = placeholder;
            if (rrEl) rrEl.innerHTML = placeholder;
            return;
        }
        // Both selects use role.id (UUID) → sent as adminRoleId to API
        var options = roles.map(function(r) {
            return '<option value="' + _esc(r.id) + '">' + _esc(r.name) + '</option>';
        }).join('');
        if (caEl) caEl.innerHTML = options;
        if (rrEl) rrEl.innerHTML = options;
    } catch(err) {
        var errOpt = '<option value="" disabled selected>Failed to load roles</option>';
        if (caEl) caEl.innerHTML = errOpt;
        if (rrEl) rrEl.innerHTML = errOpt;
    }
}

// ── Render role selector buttons in the Permissions tab ──────────────

async function loadAdminUsers() {
    var tbody = document.getElementById('admin-users-tbody');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="6" class="text-center text-secondary py-4"><div class="spinner-border spinner-border-sm me-2" role="status"></div>Loading…</td></tr>';
    try {
        // Refresh roles cache so stats and selects are up to date
        if (!State.rolesCache.length) await populateRoleSelects();
        State.adminUsers = await Api.getAdminUsers();
        updateAdminStats(State.adminUsers);
        renderAdminTable(State.adminUsers);
        clearAdminSearch();
    } catch(err) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center text-danger py-4">' + _esc(err.message) + '</td></tr>';
    }
}

// ── Fuzzy search ──────────────────────────────────────────────────────
/**
 * Simple fuzzy matcher. Returns a score > 0 if query matches str in order.
 * Higher score = better match (exact substring gets highest score).
 */

function initAdminSearch() {
    var input     = document.getElementById('admin-search-input');
    var clearBtn  = document.getElementById('admin-search-clear');
    if (!input) return;

    input.addEventListener('input', function() {
        var query = this.value;
        if (clearBtn) clearBtn.classList.toggle('d-none', !query);
        var filtered = filterAdminUsers(query);
        renderAdminTable(filtered);
        updateSearchInfo(filtered.length, State.adminUsers.length, query);
    });

    if (clearBtn) {
        clearBtn.addEventListener('click', function() {
            input.value = '';
            clearBtn.classList.add('d-none');
            renderAdminTable(State.adminUsers.slice());
            updateSearchInfo(0, 0, '');
            input.focus();
        });
    }
}

// ── Permission matrix ─────────────────────────────────────────────────

// ── DOMContentLoaded ─────────────────────────────────────────────────
async function init() {
    RBAC.fetchMe().then(function() {
        RBAC.applyNavVisibility();
        // Refresh State.isSuperAdmin after server re-hydration and re-apply section visibility
        State.isSuperAdmin = RBAC.isSuperAdmin();
        var navLink = document.getElementById('nav-admin-management');
        if (navLink) navLink.classList.toggle('d-none', !State.isSuperAdmin);
    });
    populateUserInfo(Auth.getUser());
    loadProfile();
    await populateRoleSelects();

    // Settings sidebar nav
    document.querySelectorAll('.settings-nav .nav-link').forEach(function(link) {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            var section = this.dataset.section;
            switchSection(section);
            if (section === 'admin-management') {
                populateRoleSelects().then(function() { renderPermRoleSelector(); });
                loadAdminUsers();
                initAdminSearch();
            }
        });
    });

    document.getElementById('logout-btn').addEventListener('click', function(e) {
        e.preventDefault(); Auth.logout();
    });

    // Admin inner tabs
    var adminTabNav = document.getElementById('admin-tab-nav');
    if (adminTabNav) {
        adminTabNav.addEventListener('click', function(e) {
            var a = e.target.closest('[data-admin-tab]');
            if (!a) return;
            e.preventDefault();
            document.querySelectorAll('[data-admin-tab]').forEach(function(l) { l.classList.remove('active'); });
            a.classList.add('active');
            document.querySelectorAll('.admin-tab-pane').forEach(function(p) { p.classList.add('d-none'); });
            var pane = document.getElementById('admin-tab-' + a.dataset.adminTab);
            if (pane) pane.classList.remove('d-none');
        });
    }

    // Open create admin modal
    var btnOpenCreate = document.getElementById('btn-open-create-admin');
    if (btnOpenCreate) {
        btnOpenCreate.addEventListener('click', function() {
            var form = document.getElementById('form-create-admin');
            if (form) form.reset();
            var alertEl = document.getElementById('modal-create-admin-alert');
            if (alertEl) alertEl.classList.add('d-none');
            bootstrap.Modal.getOrCreateInstance(document.getElementById('modal-create-admin')).show();
        });
    }

    // Create admin form submit
    var formCreateAdmin = document.getElementById('form-create-admin');
    if (formCreateAdmin) {
        formCreateAdmin.addEventListener('submit', async function(e) {
            e.preventDefault();
            var btn      = document.getElementById('btn-create-admin');
            var spinner  = document.getElementById('spinner-create-admin');
            var alertEl  = document.getElementById('modal-create-admin-alert');
            var alertMsg = document.getElementById('modal-create-admin-alert-msg');
            btn.disabled = true;
            if (spinner) spinner.classList.remove('d-none');
            if (alertEl) alertEl.classList.add('d-none');
            try {
                var data = {
                    firstName:   document.getElementById('ca-firstName').value.trim(),
                    lastName:    document.getElementById('ca-lastName').value.trim(),
                    email:       document.getElementById('ca-email').value.trim(),
                    password:    document.getElementById('ca-password').value,
                    adminRoleId: document.getElementById('ca-role').value,
                };
                var phone = document.getElementById('ca-phone').value.trim();
                if (phone) data.phone = phone;
                await Api.createAdmin(data);
                bootstrap.Modal.getOrCreateInstance(document.getElementById('modal-create-admin')).hide();
                this.reset();
                showAdminAlert('success', 'Admin account created successfully.');
                loadAdminUsers();
            } catch(err) {
                if (alertEl && alertMsg) {
                    alertEl.className = 'alert alert-danger mx-3 mt-3 mb-0 py-2';
                    alertMsg.textContent = err.message;
                    alertEl.classList.remove('d-none');
                }
            } finally {
                btn.disabled = false;
                if (spinner) spinner.classList.add('d-none');
            }
        });
    }

    // Refresh admin list
    var btnRefresh = document.getElementById('btn-refresh-admins');
    if (btnRefresh) btnRefresh.addEventListener('click', loadAdminUsers);

    // Confirm role change
    var btnConfirmRole = document.getElementById('btn-confirm-role-change');
    if (btnConfirmRole) {
        btnConfirmRole.addEventListener('click', async function() {
            var userId      = document.getElementById('role-change-user-id').value;
            var adminRoleId = document.getElementById('role-change-select').value;
            var spinner = document.getElementById('spinner-role-change');
            var btn = this;
            btn.disabled = true;
            if (spinner) spinner.classList.remove('d-none');
            try {
                await Api.updateRole(userId, adminRoleId);
                bootstrap.Modal.getOrCreateInstance(document.getElementById('modal-change-role')).hide();
                // Refresh to pick up updated role name from API
                await loadAdminUsers();
                showAdminAlert('success', 'Role updated successfully.');
            } catch(err) {
                showAdminAlert('danger', err.message);
            } finally {
                btn.disabled = false;
                if (spinner) spinner.classList.add('d-none');
            }
        });
    }

    // Confirm status toggle
    var btnConfirmStatus = document.getElementById('btn-confirm-toggle-status');
    if (btnConfirmStatus) {
        btnConfirmStatus.addEventListener('click', async function() {
            var userId    = document.getElementById('toggle-status-user-id').value;
            var newStatus = document.getElementById('toggle-status-new-status').value;
            var spinner   = document.getElementById('spinner-toggle-status');
            var btn = this;
            btn.disabled = true;
            if (spinner) spinner.classList.remove('d-none');
            try {
                await Api.updateStatus(userId, newStatus);
                bootstrap.Modal.getOrCreateInstance(document.getElementById('modal-toggle-status')).hide();
                var u = State.adminUsers.find(function(x) { return x.id === userId; });
                if (u) u.status = newStatus;
                renderAdminTable(State.adminUsers);
                showAdminAlert('success', 'Status updated to ' + newStatus.toLowerCase() + ' successfully.');
            } catch(err) {
                showAdminAlert('danger', err.message);
            } finally {
                btn.disabled = false;
                if (spinner) spinner.classList.add('d-none');
            }
        });
    }

    // Create role form
    var formCreateRole = document.getElementById('form-create-role');
    if (formCreateRole) {
        formCreateRole.addEventListener('submit', async function(e) {
            e.preventDefault();
            var name        = document.getElementById('cr-name').value.trim();
            var description = (document.getElementById('cr-description').value || '').trim();
            var alertEl     = document.getElementById('modal-create-role-alert');
            var alertMsg  = document.getElementById('modal-create-role-alert-msg');
            var submitBtn = document.getElementById('btn-submit-create-role');
            var spinner   = document.getElementById('spinner-create-role');
            if (alertEl) alertEl.classList.add('d-none');
            if (submitBtn) submitBtn.disabled = true;
            if (spinner)   spinner.classList.remove('d-none');
            try {
                var newRole = await Api.createRole(name, description);
                State.permRole = newRole.id;
                bootstrap.Modal.getOrCreateInstance(document.getElementById('modal-create-role')).hide();
                await populateRoleSelects(); // refreshes State.rolesCache
                await renderPermRoleSelector();
                updateAdminStats(State.adminUsers);
                showAdminAlert('success', 'Role "' + newRole.name + '" created. Set its permissions below.');
            } catch(err) {
                if (alertEl && alertMsg) {
                    alertEl.className = 'alert alert-danger mx-3 mt-3 mb-0 py-2';
                    alertMsg.textContent = err.message;
                    alertEl.classList.remove('d-none');
                }
            } finally {
                if (submitBtn) submitBtn.disabled = false;
                if (spinner)   spinner.classList.add('d-none');
            }
        });
    }

    // Delete role button
    var btnDeleteRole = document.getElementById('btn-delete-role');
    if (btnDeleteRole) {
        btnDeleteRole.addEventListener('click', async function() {
            if (!State.permRole) return;
            var roleToDelete = State.rolesCache.find(function(r){ return r.id === State.permRole; });
            var label = roleToDelete ? roleToDelete.name : State.permRole;
            if (!confirm('Delete role "' + label + '"? This is blocked server-side if users are still assigned to it.')) return;
            var btn = this;
            btn.disabled = true;
            try {
                await Api.deleteRole(State.permRole);
                State.permRole = null;
                await populateRoleSelects(); // refreshes State.rolesCache
                await renderPermRoleSelector();
                updateAdminStats(State.adminUsers);
                showAdminAlert('success', 'Role "' + label + '" deleted.');
            } catch(err) {
                showAdminAlert('danger', err.message);
            } finally {
                btn.disabled = false;
            }
        });
    }

    // Save permissions
    var btnSavePerms = document.getElementById('btn-save-perms');
    if (btnSavePerms) {
        btnSavePerms.addEventListener('click', async function() {
            if (!State.permRole) return;
            var spinner = document.getElementById('spinner-save-perms');
            var btn = this;
            btn.disabled = true;
            if (spinner) spinner.classList.remove('d-none');
            try {
                var newPerms = [];
                document.querySelectorAll('#perm-matrix input[type="checkbox"]:not([disabled])').forEach(function(cb) {
                    if (cb.checked) newPerms.push(cb.dataset.permKey);
                });
                await Api.setPermissions(State.permRole, newPerms);
                var savedRole = State.rolesCache.find(function(r){ return r.id === State.permRole; });
                showAdminAlert('success', (savedRole ? savedRole.name : 'Role') + ' permissions saved.');
            } catch(err) {
                showAdminAlert('danger', err.message);
            } finally {
                if (spinner) spinner.classList.add('d-none');
                btn.disabled = false;
            }
        });
    }

    // Show admin nav link only for SUPER_ADMIN
    if (RBAC.isSuperAdmin()) {
        var navLink = document.getElementById('nav-admin-management');
        if (navLink) navLink.classList.remove('d-none');
    }

    routeOnLoad();

    // Auto-load when landing directly on admin-management
    var hash = (location.hash || '').replace('#', '');
    if (hash === 'admin-management') {
        populateRoleSelects().then(function() { renderPermRoleSelector(); });
        loadAdminUsers();
        initAdminSearch();
    }
}

    


    SP.Handlers = {
        loadProfile: loadProfile,
        populateRoleSelects: populateRoleSelects,
        loadAdminUsers: loadAdminUsers,
        initAdminSearch: initAdminSearch,
        init: init,
    };
})(window);
