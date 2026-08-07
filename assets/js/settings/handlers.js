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
    var renderBusinessHoursTable = UI.renderBusinessHoursTable;


    // ── Alert helpers ─────────────────────────────────────────────────────

    // ── Section navigation ────────────────────────────────────────────────

    // ── Populate user info in navbar + sidebar + profile header ───────────

    // ── GET /user/profile ─────────────────────────────────────────────────
    async function loadProfile() {
        try {
            var result = await Api.getProfile();
            State.profile = result.data;
            populateUserInfo(State.profile);
            fillProfileForm(State.profile);
        } catch (err) {
            showAlert('danger', 'Failed to load profile: ' + err.message);
        }
    }

    // ── PUT /user/profile ─────────────────────────────────────────────────
    document.getElementById('form-profile').addEventListener('submit', async function (e) {
        e.preventDefault();
        setSpinner('spinner-profile', true);
        this.querySelector('#btn-save-profile').disabled = true;
        try {
            var body = {
                firstName: document.getElementById('input-firstName').value.trim(),
                lastName: document.getElementById('input-lastName').value.trim(),
                phone: document.getElementById('input-phone').value.trim() || undefined,
            };
            var result = await Api.updateProfile(body);
            if (!result.res.ok) throw new Error(result.message || 'Update failed (' + result.res.status + ')');
            State.profile = result.data || State.profile;
            populateUserInfo(State.profile);
            localStorage.setItem('hairlux_user', JSON.stringify(State.profile));
            showAlert('success', 'Profile updated successfully.');
        } catch (err) {
            showAlert('danger', err.message);
        } finally {
            setSpinner('spinner-profile', false);
            document.getElementById('btn-save-profile').disabled = false;
        }
    });
    document.getElementById('btn-reset-profile').addEventListener('click', function () {
        fillProfileForm(State.profile); dismissAlert();
    });

    // ── PUT /user/password ────────────────────────────────────────────────
    document.getElementById('form-password').addEventListener('submit', async function (e) {
        e.preventDefault();
        var newPwd = document.getElementById('input-newPassword').value;
        var confPwd = document.getElementById('input-confirmPassword').value;
        if (newPwd !== confPwd) { showAlert('danger', 'New passwords do not match.'); return; }
        setSpinner('spinner-password', true);
        document.getElementById('btn-save-password').disabled = true;
        try {
            var body = {
                currentPassword: document.getElementById('input-currentPassword').value,
                newPassword: newPwd,
            };
            var result = await Api.changePassword(body);
            if (!result.res.ok) throw new Error(result.message || 'Password change failed (' + result.res.status + ')');
            showAlert('success', 'Password changed successfully.');
            document.getElementById('form-password').reset();
        } catch (err) {
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
            var options = roles.map(function (r) {
                return '<option value="' + _esc(r.id) + '">' + _esc(r.name) + '</option>';
            }).join('');
            if (caEl) caEl.innerHTML = options;
            if (rrEl) rrEl.innerHTML = options;
        } catch (err) {
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
        } catch (err) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center text-danger py-4">' + _esc(err.message) + '</td></tr>';
        }
    }

    // ── Fuzzy search ──────────────────────────────────────────────────────
    /**
     * Simple fuzzy matcher. Returns a score > 0 if query matches str in order.
     * Higher score = better match (exact substring gets highest score).
     */

    function initAdminSearch() {
        var input = document.getElementById('admin-search-input');
        var clearBtn = document.getElementById('admin-search-clear');
        if (!input) return;

        input.addEventListener('input', function () {
            var query = this.value;
            if (clearBtn) clearBtn.classList.toggle('d-none', !query);
            var filtered = filterAdminUsers(query);
            renderAdminTable(filtered);
            updateSearchInfo(filtered.length, State.adminUsers.length, query);
        });

        if (clearBtn) {
            clearBtn.addEventListener('click', function () {
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
        RBAC.fetchMe().then(function () {
            RBAC.applyNavVisibility();
            // Refresh State.isSuperAdmin after server re-hydration and re-apply section visibility
            State.isSuperAdmin = RBAC.isSuperAdmin();
            var navLink = document.getElementById('nav-admin-management');
            if (navLink) navLink.classList.toggle('d-none', !State.isSuperAdmin);
        });
        populateUserInfo(Auth.getUser());
        loadProfile();
        await populateRoleSelects();
        loadBusinessHours();

        // Settings sidebar nav
        document.querySelectorAll('.settings-nav .nav-link').forEach(function (link) {
            link.addEventListener('click', function (e) {
                e.preventDefault();
                var section = this.dataset.section;
                switchSection(section);
                if (section === 'admin-management') {
                    populateRoleSelects().then(function () { renderPermRoleSelector(); });
                    loadAdminUsers();
                    initAdminSearch();
                }
                if (section === 'business-hours') {
                    loadBusinessHours();
                }
            });
        });

        document.getElementById('logout-btn').addEventListener('click', function (e) {
            e.preventDefault(); Auth.logout();
        });

        var saveBizHoursBtn = document.getElementById('btn-save-business-hours');
        if (saveBizHoursBtn) {
            saveBizHoursBtn.addEventListener('click', submitBusinessHours);
        }

        async function loadBusinessHours() {
            try {
                var hours = await Branches.getBusinessHours();
                renderBusinessHoursTable(hours);
            } catch (err) {
                document.getElementById('biz-hours-table').innerHTML =
                    '<div class="text-danger small">' + _esc(err.message || 'Failed to load business hours.') + '</div>';
            }
        }

        async function submitBusinessHours() {
            var hours = [];
            for (var d = 0; d <= 6; d++) {
                var openEl = document.querySelector('.biz-hours-open[data-day="' + d + '"]');
                var openTimeEl = document.querySelector('.biz-hours-open-time[data-day="' + d + '"]');
                var closeTimeEl = document.querySelector('.biz-hours-close-time[data-day="' + d + '"]');
                if (!openEl) continue;
                hours.push({
                    dayOfWeek: d,
                    isOpen: openEl.checked,
                    openTime: openTimeEl.value || '09:00',
                    closeTime: closeTimeEl.value || '17:00',
                });
            }

            setSpinner('spinner-business-hours', true);
            var savedBadge = document.getElementById('biz-hours-saved');
            if (savedBadge) savedBadge.classList.add('d-none');
            try {
                await Branches.setBusinessHours(hours);
                if (savedBadge) {
                    savedBadge.classList.remove('d-none');
                    setTimeout(function () { savedBadge.classList.add('d-none'); }, 2500);
                }
            } catch (err) {
                showAlert('danger', err.message || 'Failed to save business hours.');
            } finally {
                setSpinner('spinner-business-hours', false);
            }
        }

        // Admin inner tabs
        var adminTabNav = document.getElementById('admin-tab-nav');
        if (adminTabNav) {
            adminTabNav.addEventListener('click', function (e) {
                var a = e.target.closest('[data-admin-tab]');
                if (!a) return;
                e.preventDefault();
                document.querySelectorAll('[data-admin-tab]').forEach(function (l) { l.classList.remove('active'); });
                a.classList.add('active');
                document.querySelectorAll('.admin-tab-pane').forEach(function (p) { p.classList.add('d-none'); });
                var pane = document.getElementById('admin-tab-' + a.dataset.adminTab);
                if (pane) pane.classList.remove('d-none');
                if (a.dataset.adminTab === 'audit-log' && typeof loadAuditLog === 'function') loadAuditLog();
            });
        }

        var btnRefreshAuditLog = document.getElementById('btn-refresh-audit-log');
        if (btnRefreshAuditLog) btnRefreshAuditLog.addEventListener('click', function () { loadAuditLog(); });

        async function loadAuditLog() {
            var tbody = document.getElementById('audit-log-tbody');
            if (!tbody) return;
            tbody.innerHTML = '<tr><td colspan="6" class="text-center py-4"><div class="spinner-border spinner-border-sm text-primary"></div></td></tr>';

            try {
                var result = await Roles.getAuditLog({ limit: 50 });
                var entries = result.data || [];

                var actionLabels = {
                    ROLE_CREATED: 'Role created',
                    ROLE_UPDATED: 'Role updated',
                    ROLE_DELETED: 'Role deleted',
                    PERMISSIONS_CHANGED: 'Permissions changed',
                    USER_ROLE_ASSIGNED: 'Primary role assigned',
                    USER_ROLE_ADDED: 'Secondary role added',
                    USER_ROLE_REMOVED: 'Secondary role removed',
                };

                tbody.innerHTML = entries.length
                    ? entries.map(function (e) {
                        var actorName = e.actor ? (e.actor.firstName + ' ' + e.actor.lastName) : '\u2014';
                        var targetName = e.targetUser ? (e.targetUser.firstName + ' ' + e.targetUser.lastName) : '\u2014';
                        var when = new Date(e.createdAt).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'Africa/Lagos' });
                        var details = '';
                        if (e.action === 'PERMISSIONS_CHANGED') {
                            var beforeCount = (e.before || []).length;
                            var afterCount = (e.after || []).length;
                            details = beforeCount + ' \u2192 ' + afterCount + ' permission(s)';
                        } else if (e.action === 'ROLE_UPDATED' && e.before && e.after) {
                            var changes = [];
                            if (e.before.name !== e.after.name) changes.push('name: "' + e.before.name + '" \u2192 "' + e.after.name + '"');
                            if (e.before.isActive !== e.after.isActive) changes.push('active: ' + e.before.isActive + ' \u2192 ' + e.after.isActive);
                            details = changes.join(', ') || '\u2014';
                        } else if (e.action === 'USER_ROLE_ASSIGNED' && e.after) {
                            details = 'Assigned "' + (e.after.name || '') + '"' + (e.before ? ' (was "' + e.before.name + '")' : '');
                        }
                        return '<tr>' +
                            '<td class="text-secondary small">' + when + '</td>' +
                            '<td>' + (actionLabels[e.action] || e.action) + '</td>' +
                            '<td>' + _esc(e.roleName) + '</td>' +
                            '<td>' + _esc(targetName) + '</td>' +
                            '<td>' + _esc(actorName) + '</td>' +
                            '<td class="text-secondary small">' + _esc(details) + '</td>' +
                            '</tr>';
                    }).join('')
                    : '<tr><td colspan="6" class="text-center text-secondary py-4">No changes recorded yet.</td></tr>';
            } catch (err) {
                tbody.innerHTML = '<tr><td colspan="6" class="text-center text-danger py-4">' + _esc(err.message || 'Failed to load.') + '</td></tr>';
            }
        }

        // Open create admin modal
        var btnOpenCreate = document.getElementById('btn-open-create-admin');
        if (btnOpenCreate) {
            btnOpenCreate.addEventListener('click', function () {
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
            formCreateAdmin.addEventListener('submit', async function (e) {
                e.preventDefault();
                var btn = document.getElementById('btn-create-admin');
                var spinner = document.getElementById('spinner-create-admin');
                var alertEl = document.getElementById('modal-create-admin-alert');
                var alertMsg = document.getElementById('modal-create-admin-alert-msg');
                btn.disabled = true;
                if (spinner) spinner.classList.remove('d-none');
                if (alertEl) alertEl.classList.add('d-none');
                try {
                    var data = {
                        firstName: document.getElementById('ca-firstName').value.trim(),
                        lastName: document.getElementById('ca-lastName').value.trim(),
                        email: document.getElementById('ca-email').value.trim(),
                        password: document.getElementById('ca-password').value,
                        adminRoleId: document.getElementById('ca-role').value,
                    };
                    var phone = document.getElementById('ca-phone').value.trim();
                    if (phone) data.phone = phone;
                    await Api.createAdmin(data);
                    bootstrap.Modal.getOrCreateInstance(document.getElementById('modal-create-admin')).hide();
                    this.reset();
                    showAdminAlert('success', 'Admin account created successfully.');
                    loadAdminUsers();
                } catch (err) {
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
            btnConfirmRole.addEventListener('click', async function () {
                var userId = document.getElementById('role-change-user-id').value;
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
                } catch (err) {
                    showAdminAlert('danger', err.message);
                } finally {
                    btn.disabled = false;
                    if (spinner) spinner.classList.add('d-none');
                }
            });
        }

        // View Users button — everyone holding this role, primary or secondary
        var btnViewRoleUsers = document.getElementById('btn-view-role-users');
        if (btnViewRoleUsers) {
            btnViewRoleUsers.addEventListener('click', async function () {
                if (!State.permRole) return;
                var role = State.rolesCache.find(function (r) { return r.id === State.permRole; });
                document.getElementById('vru-role-name').textContent = role ? role.name : '—';
                var contentEl = document.getElementById('vru-content');
                contentEl.innerHTML = '<div class="text-secondary small">Loading…</div>';
                bootstrap.Modal.getOrCreateInstance(document.getElementById('modal-view-role-users')).show();

                try {
                    var data = await Roles.getRoleUsers(State.permRole);
                    var primary = data.primary || [];
                    var secondary = data.secondary || [];

                    if (!primary.length && !secondary.length) {
                        contentEl.innerHTML = '<div class="text-secondary small">No one currently holds this role.</div>';
                        return;
                    }

                    var rows = primary.map(function (u) {
                        return '<tr><td>' + _esc(u.firstName + ' ' + u.lastName) + '</td><td class="text-secondary small">' + _esc(u.email) + '</td><td><span class="badge bg-blue-lt">Primary</span></td></tr>';
                    }).concat(secondary.map(function (u) {
                        return '<tr><td>' + _esc(u.firstName + ' ' + u.lastName) + '</td><td class="text-secondary small">' + _esc(u.email) + '</td><td><span class="badge bg-purple-lt">Secondary</span></td></tr>';
                    })).join('');

                    contentEl.innerHTML = '<div class="table-responsive"><table class="table table-sm table-vcenter mb-0">' +
                        '<thead><tr><th>Name</th><th>Email</th><th>Held As</th></tr></thead>' +
                        '<tbody>' + rows + '</tbody></table></div>';
                } catch (err) {
                    contentEl.innerHTML = '<div class="text-danger small">' + _esc(err.message || 'Failed to load.') + '</div>';
                }
            });
        }

        // ── Secondary roles (multi-role support) ──────────────────────────────

        window.loadSecondaryRoles = async function (userId) {
            var listEl = document.getElementById('secondary-roles-list');
            var selectEl = document.getElementById('secondary-role-select');
            if (!listEl) return;
            listEl.innerHTML = '<div class="text-secondary small">Loading…</div>';

            try {
                var data = await Roles.getUserRoles(userId);
                var additional = data.additional || [];

                listEl.innerHTML = additional.length
                    ? additional.map(function (r) {
                        return '<span class="badge bg-blue-lt me-1 mb-1 d-inline-flex align-items-center">' +
                            _esc(r.name) +
                            '<a href="#" class="ms-2 text-danger" data-remove-secondary-role="' + r.id + '" title="Remove">&times;</a>' +
                            '</span>';
                    }).join('')
                    : '<div class="text-secondary small">No secondary roles.</div>';

                // Populate the "add" dropdown with roles the user doesn't already hold
                var heldIds = additional.map(function (r) { return r.id; });
                if (data.primary) heldIds.push(data.primary.id);
                var available = (State.rolesCache || []).filter(function (r) { return heldIds.indexOf(r.id) === -1; });
                selectEl.innerHTML = '<option value="">Add a secondary role…</option>' +
                    available.map(function (r) { return '<option value="' + r.id + '">' + _esc(r.name) + '</option>'; }).join('');
            } catch (err) {
                listEl.innerHTML = '<div class="text-danger small">' + _esc(err.message || 'Failed to load.') + '</div>';
            }
        };

        var btnAddSecondaryRole = document.getElementById('btn-add-secondary-role');
        if (btnAddSecondaryRole) {
            btnAddSecondaryRole.addEventListener('click', async function () {
                var userId = document.getElementById('role-change-user-id').value;
                var adminRoleId = document.getElementById('secondary-role-select').value;
                if (!adminRoleId) return;
                this.disabled = true;
                try {
                    await Roles.addUserRole(userId, adminRoleId);
                    await window.loadSecondaryRoles(userId);
                } catch (err) {
                    showAdminAlert('danger', err.message);
                } finally {
                    this.disabled = false;
                }
            });
        }

        var secondaryRolesList = document.getElementById('secondary-roles-list');
        if (secondaryRolesList) {
            secondaryRolesList.addEventListener('click', async function (e) {
                var link = e.target.closest('[data-remove-secondary-role]');
                if (!link) return;
                e.preventDefault();
                var userId = document.getElementById('role-change-user-id').value;
                var adminRoleId = link.dataset.removeSecondaryRole;
                try {
                    await Roles.removeUserRole(userId, adminRoleId);
                    await window.loadSecondaryRoles(userId);
                } catch (err) {
                    showAdminAlert('danger', err.message);
                }
            });
        }

        // Open "Assign Role" (staff search) modal
        var btnOpenAssignRole = document.getElementById('btn-open-assign-role');
        if (btnOpenAssignRole) {
            btnOpenAssignRole.addEventListener('click', async function () {
                var errEl = document.getElementById('assign-role-staff-error');
                if (errEl) errEl.classList.add('d-none');
                document.getElementById('assign-role-grant-portal-login').checked = true;
                document.getElementById('assign-role-mode-primary').checked = true;
                document.getElementById('assign-role-current-status').innerHTML = '';
                document.getElementById('assign-role-overwrite-warning').classList.add('d-none');
                updateAssignRolePortalLoginVisibility();

                var staffSelect = document.getElementById('assign-role-staff-select');
                staffSelect.innerHTML = '<option value="">Loading staff…</option>';
                var roleSelect = document.getElementById('assign-role-role-select');
                roleSelect.innerHTML = '<option value="">Loading roles…</option>';

                SearchableSelect.attach('assign-role-staff-select');
                SearchableSelect.attach('assign-role-role-select');
                SearchableSelect.refresh('assign-role-staff-select');
                SearchableSelect.refresh('assign-role-role-select');

                bootstrap.Modal.getOrCreateInstance(document.getElementById('modal-assign-role-staff')).show();

                try {
                    var staffResult = await Staff.getAll({ employmentStatus: 'ACTIVE', limit: 100 });
                    var staffList = staffResult.data || [];
                    staffSelect.innerHTML = staffList.length
                        ? '<option value="">Select a staff member…</option>' + staffList.map(function (s) {
                            return '<option value="' + s.id + '">' + _esc(s.name) + (s.staffCode ? ' (' + _esc(s.staffCode) + ')' : '') + '</option>';
                        }).join('')
                        : '<option value="">No active staff found</option>';
                    SearchableSelect.refresh('assign-role-staff-select');
                } catch (err) {
                    staffSelect.innerHTML = '<option value="">Failed to load staff</option>';
                    SearchableSelect.refresh('assign-role-staff-select');
                }

                try {
                    var roles = State.rolesCache && State.rolesCache.length ? State.rolesCache : await Api.fetchRoles();
                    roleSelect.innerHTML = roles.length
                        ? '<option value="">Select a role…</option>' + roles.map(function (r) {
                            return '<option value="' + _esc(r.id) + '">' + _esc(r.name) + '</option>';
                        }).join('')
                        : '<option value="" disabled selected>No roles yet — create one first</option>';
                    SearchableSelect.refresh('assign-role-role-select');
                } catch (err) {
                    roleSelect.innerHTML = '<option value="">Failed to load roles</option>';
                    SearchableSelect.refresh('assign-role-role-select');
                }
            });
        }

        function updateAssignRolePortalLoginVisibility() {
            var mode = document.querySelector('input[name="assign-role-mode"]:checked');
            var isSecondary = mode && mode.value === 'secondary';
            var wrap = document.getElementById('assign-role-portal-login-wrap');
            var hint = document.getElementById('assign-role-portal-login-hint');
            if (wrap) wrap.classList.toggle('d-none', isSecondary);
            if (hint) hint.classList.toggle('d-none', isSecondary);
        }

        document.querySelectorAll('input[name="assign-role-mode"]').forEach(function (radio) {
            radio.addEventListener('change', function () {
                updateAssignRolePortalLoginVisibility();
                updateAssignRoleOverwriteWarning();
            });
        });

        var _assignRoleCurrentAssignment = null;

        function updateAssignRoleOverwriteWarning() {
            var mode = document.querySelector('input[name="assign-role-mode"]:checked');
            var warnEl = document.getElementById('assign-role-overwrite-warning');
            if (!warnEl) return;
            if (mode && mode.value === 'primary' && _assignRoleCurrentAssignment && _assignRoleCurrentAssignment.adminRoleName) {
                warnEl.textContent = 'This will REPLACE their current primary role ("' + _assignRoleCurrentAssignment.adminRoleName + '") — that role\'s permissions will no longer apply once this is saved.';
                warnEl.classList.remove('d-none');
            } else {
                warnEl.classList.add('d-none');
            }
        }

        var assignRoleStaffSelect = document.getElementById('assign-role-staff-select');
        if (assignRoleStaffSelect) {
            assignRoleStaffSelect.addEventListener('change', async function () {
                var staffId = this.value;
                var statusEl = document.getElementById('assign-role-current-status');
                _assignRoleCurrentAssignment = null;
                if (!staffId) { statusEl.innerHTML = ''; updateAssignRoleOverwriteWarning(); return; }

                statusEl.innerHTML = 'Checking current roles…';
                try {
                    var assignment = await Staff.getRoleAssignment(staffId);
                    _assignRoleCurrentAssignment = assignment;
                    var parts = [];
                    if (assignment.adminRoleName) parts.push(assignment.adminRoleName + ' (primary)');
                    (assignment.secondaryRoles || []).forEach(function (r) { parts.push(r.name + ' (secondary)'); });
                    statusEl.innerHTML = parts.length
                        ? 'Currently has: ' + parts.join(', ') + '.'
                        : 'No role currently assigned.';
                } catch (err) {
                    statusEl.innerHTML = '';
                }
                updateAssignRoleOverwriteWarning();
            });
        }

        // Confirm assign role (staff search)
        var btnConfirmAssignRole = document.getElementById('btn-confirm-assign-role-staff');
        if (btnConfirmAssignRole) {
            btnConfirmAssignRole.addEventListener('click', async function () {
                var errEl = document.getElementById('assign-role-staff-error');
                errEl.classList.add('d-none');

                var staffId = document.getElementById('assign-role-staff-select').value;
                var adminRoleId = document.getElementById('assign-role-role-select').value;
                var grantPortalLogin = document.getElementById('assign-role-grant-portal-login').checked;
                var modeEl = document.querySelector('input[name="assign-role-mode"]:checked');
                var mode = modeEl ? modeEl.value : 'primary';

                if (!staffId) {
                    errEl.textContent = 'Please select a staff member.';
                    errEl.classList.remove('d-none');
                    return;
                }
                if (!adminRoleId) {
                    errEl.textContent = 'Please select a role.';
                    errEl.classList.remove('d-none');
                    return;
                }

                if (mode === 'primary' && _assignRoleCurrentAssignment && _assignRoleCurrentAssignment.adminRoleName) {
                    if (!confirm('This replaces their current role ("' + _assignRoleCurrentAssignment.adminRoleName + '") — continue?')) return;
                }

                var spinner = document.getElementById('spinner-assign-role-staff');
                var btn = this;
                btn.disabled = true;
                if (spinner) spinner.classList.remove('d-none');
                try {
                    await Staff.assignRole(staffId, adminRoleId, grantPortalLogin, mode);
                    bootstrap.Modal.getOrCreateInstance(document.getElementById('modal-assign-role-staff')).hide();
                    await loadAdminUsers();
                    showAdminAlert('success', 'Role assigned successfully.');
                } catch (err) {
                    errEl.textContent = err.message || 'Failed to assign role.';
                    errEl.classList.remove('d-none');
                } finally {
                    btn.disabled = false;
                    if (spinner) spinner.classList.add('d-none');
                }
            });
        }

        // Confirm status toggle
        var btnConfirmStatus = document.getElementById('btn-confirm-toggle-status');
        if (btnConfirmStatus) {
            btnConfirmStatus.addEventListener('click', async function () {
                var userId = document.getElementById('toggle-status-user-id').value;
                var newStatus = document.getElementById('toggle-status-new-status').value;
                var spinner = document.getElementById('spinner-toggle-status');
                var btn = this;
                btn.disabled = true;
                if (spinner) spinner.classList.remove('d-none');
                try {
                    await Api.updateStatus(userId, newStatus);
                    bootstrap.Modal.getOrCreateInstance(document.getElementById('modal-toggle-status')).hide();
                    var u = State.adminUsers.find(function (x) { return x.id === userId; });
                    if (u) u.status = newStatus;
                    renderAdminTable(State.adminUsers);
                    showAdminAlert('success', 'Status updated to ' + newStatus.toLowerCase() + ' successfully.');
                } catch (err) {
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
            formCreateRole.addEventListener('submit', async function (e) {
                e.preventDefault();
                var name = document.getElementById('cr-name').value.trim();
                var description = (document.getElementById('cr-description').value || '').trim();
                var alertEl = document.getElementById('modal-create-role-alert');
                var alertMsg = document.getElementById('modal-create-role-alert-msg');
                var submitBtn = document.getElementById('btn-submit-create-role');
                var spinner = document.getElementById('spinner-create-role');
                if (alertEl) alertEl.classList.add('d-none');
                if (submitBtn) submitBtn.disabled = true;
                if (spinner) spinner.classList.remove('d-none');
                try {
                    var newRole = await Api.createRole(name, description);
                    State.permRole = newRole.id;
                    bootstrap.Modal.getOrCreateInstance(document.getElementById('modal-create-role')).hide();
                    await populateRoleSelects(); // refreshes State.rolesCache
                    await renderPermRoleSelector();
                    updateAdminStats(State.adminUsers);
                    showAdminAlert('success', 'Role "' + newRole.name + '" created. Set its permissions below.');
                } catch (err) {
                    if (alertEl && alertMsg) {
                        alertEl.className = 'alert alert-danger mx-3 mt-3 mb-0 py-2';
                        alertMsg.textContent = err.message;
                        alertEl.classList.remove('d-none');
                    }
                } finally {
                    if (submitBtn) submitBtn.disabled = false;
                    if (spinner) spinner.classList.add('d-none');
                }
            });
        }

        // Delete role button
        var btnDeleteRole = document.getElementById('btn-delete-role');
        if (btnDeleteRole) {
            btnDeleteRole.addEventListener('click', async function () {
                if (!State.permRole) return;
                var roleToDelete = State.rolesCache.find(function (r) { return r.id === State.permRole; });
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
                } catch (err) {
                    showAdminAlert('danger', err.message);
                } finally {
                    btn.disabled = false;
                }
            });
        }

        // Edit role button — opens the modal pre-filled with the currently selected role
        var btnEditRole = document.getElementById('btn-edit-role');
        if (btnEditRole) {
            btnEditRole.addEventListener('click', function () {
                if (!State.permRole) return;
                var role = State.rolesCache.find(function (r) { return r.id === State.permRole; });
                if (!role) return;
                document.getElementById('er-role-id').value = role.id;
                document.getElementById('er-name').value = role.name;
                document.getElementById('er-description').value = role.description || '';
                document.getElementById('er-active').checked = role.isActive !== false;
                var alertEl = document.getElementById('modal-edit-role-alert');
                if (alertEl) alertEl.classList.add('d-none');
                bootstrap.Modal.getOrCreateInstance(document.getElementById('modal-edit-role')).show();
            });
        }

        var formEditRole = document.getElementById('form-edit-role');
        if (formEditRole) {
            formEditRole.addEventListener('submit', async function (e) {
                e.preventDefault();
                var roleId = document.getElementById('er-role-id').value;
                var name = document.getElementById('er-name').value;
                var description = document.getElementById('er-description').value;
                var isActive = document.getElementById('er-active').checked;
                var alertEl = document.getElementById('modal-edit-role-alert');
                var alertMsg = document.getElementById('modal-edit-role-alert-msg');
                var submitBtn = document.getElementById('btn-submit-edit-role');
                var spinner = document.getElementById('spinner-edit-role');

                if (!name || !name.trim()) {
                    if (alertEl && alertMsg) {
                        alertEl.className = 'alert alert-danger mx-3 mt-3 mb-0 py-2';
                        alertMsg.textContent = 'Role name is required.';
                        alertEl.classList.remove('d-none');
                    }
                    return;
                }

                if (submitBtn) submitBtn.disabled = true;
                if (spinner) spinner.classList.remove('d-none');
                try {
                    await Roles.editRole(roleId, { name: name, description: description, isActive: isActive });
                    bootstrap.Modal.getOrCreateInstance(document.getElementById('modal-edit-role')).hide();
                    await populateRoleSelects(); // refreshes State.rolesCache
                    await renderPermRoleSelector();
                    await renderPermMatrix();
                    showAdminAlert('success', 'Role updated successfully.');
                } catch (err) {
                    if (alertEl && alertMsg) {
                        alertEl.className = 'alert alert-danger mx-3 mt-3 mb-0 py-2';
                        alertMsg.textContent = err.message;
                        alertEl.classList.remove('d-none');
                    }
                } finally {
                    if (submitBtn) submitBtn.disabled = false;
                    if (spinner) spinner.classList.add('d-none');
                }
            });
        }

        // Save permissions
        var btnSavePerms = document.getElementById('btn-save-perms');
        if (btnSavePerms) {
            btnSavePerms.addEventListener('click', async function () {
                if (!State.permRole) return;
                var spinner = document.getElementById('spinner-save-perms');
                var btn = this;
                btn.disabled = true;
                if (spinner) spinner.classList.remove('d-none');
                try {
                    var newPerms = [];
                    document.querySelectorAll('#perm-matrix input[type="checkbox"]:not([disabled])').forEach(function (cb) {
                        if (cb.checked) newPerms.push(cb.dataset.permKey);
                    });
                    await Api.setPermissions(State.permRole, newPerms);
                    var savedRole = State.rolesCache.find(function (r) { return r.id === State.permRole; });
                    showAdminAlert('success', (savedRole ? savedRole.name : 'Role') + ' permissions saved.');
                } catch (err) {
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
            populateRoleSelects().then(function () { renderPermRoleSelector(); });
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