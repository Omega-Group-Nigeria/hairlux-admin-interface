/**
 * settings/ui.js — section navigation, forms, tables, permission matrix
 */
(function (global) {
    'use strict';

    var SP = (global.SettingsPage = global.SettingsPage || {});
    var State = SP.State;
    var Utils = SP.Utils;
    var Api = SP.Api;
    var bootstrap = global.tabler && global.tabler.bootstrap;

    var showAlert = Utils.showAlert;
    var dismissAlert = Utils.dismissAlert;
    var setSpinner = Utils.setSpinner;
    var _esc = Utils._esc;
    var showAdminAlert = Utils.showAdminAlert;
    var fuzzyScore = Utils.fuzzyScore;

    function switchSection(sectionId) {
        document.querySelectorAll('.settings-section').forEach(function (el) { el.classList.remove('active'); });
        document.querySelectorAll('.settings-nav .nav-link').forEach(function (el) { el.classList.remove('active'); });
        var sec = document.getElementById('section-' + sectionId);
        if (sec) sec.classList.add('active');
        var link = document.querySelector('.settings-nav .nav-link[data-section="' + sectionId + '"]');
        if (link) link.classList.add('active');
        history.replaceState(null, '', '#' + sectionId);
    }

    function routeOnLoad() {
        var hash = (location.hash || '#profile').replace('#', '');
        var valid = ['profile', 'security', 'admin-management', 'business-hours'];
        switchSection(valid.indexOf(hash) !== -1 ? hash : 'profile');
    }

    function populateUserInfo(user) {
        if (!user) return;
        var initials = ((user.firstName || '')[0] || '') + ((user.lastName || '')[0] || '');
        initials = initials.toUpperCase() || 'A';
        var fullName = [user.firstName, user.lastName].filter(Boolean).join(' ') || 'Admin';
        // Prefer the custom role name (e.g. "ACCOUNTANT") over the base role string ("ADMIN")
        var roleDisplayName = (user.adminRole && user.adminRole.name) || user.role || '';
        var role = roleDisplayName.replace(/_/g, ' ');
        var email = user.email || '';
        function set(id, val) { var el = document.getElementById(id); if (el) el.textContent = val; }
        set('navbar-user-avatar', initials);
        set('navbar-user-name', fullName);
        set('navbar-user-role', role);
        set('dropdown-user-name', fullName);
        set('dropdown-user-email', email);
        set('sidebar-avatar', initials);
        set('sidebar-name', fullName);
        set('sidebar-email', email);
        set('profile-avatar-lg', initials);
        set('profile-fullname', fullName);
        var roleBadge = document.getElementById('profile-role-badge');
        if (roleBadge) {
            var color = Roles.getRoleColor(roleDisplayName) || 'secondary';
            roleBadge.innerHTML = '<span class="badge bg-' + color + '-lt">' + role + '</span>';
        }
        var sinceEl = document.getElementById('profile-since');
        if (sinceEl && user.createdAt) {
            var since = new Date(user.createdAt).toLocaleDateString('en-NG', { day: '2-digit', month: 'long', year: 'numeric' });
            sinceEl.textContent = 'Member since ' + since;
        }
    }

    function fillProfileForm(u) {
        if (!u) return;
        function setVal(id, val) { var el = document.getElementById(id); if (el) el.value = val || ''; }
        setVal('input-firstName', u.firstName);
        setVal('input-lastName', u.lastName);
        setVal('input-email', u.email);
        setVal('input-phone', u.phone);
    }

    function togglePwd(inputId, btn) {
        var input = document.getElementById(inputId);
        if (!input) return;
        var show = input.type === 'password';
        input.type = show ? 'text' : 'password';
        btn.innerHTML = show
            ? '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon icon-1"><path d="M3 3l18 18"/><path d="M10.584 10.587a2 2 0 0 0 2.828 2.83"/><path d="M9.363 5.365a9.466 9.466 0 0 1 2.637-.365c3.6 0 6.6 2 9 6c-.818 1.374-1.698 2.545-2.636 3.5"/><path d="M20.297 17.32c-1.477 1.146-3.046 1.68-4.297 1.68"/><path d="M3 12c.816-1.374 1.696-2.545 2.636-3.5"/></svg>'
            : '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon icon-1"><path d="M10 12a2 2 0 1 0 4 0a2 2 0 0 0 -4 0"/><path d="M21 12c-2.4 4-5.4 6-9 6c-3.6 0-6.6-2-9-6c2.4-4 5.4-6 9-6c3.6 0 6.6 2 9 6"/></svg>';
    }

    function updateAdminStats(users) {
        var superCount = users.filter(function (u) { return u.role === 'SUPER_ADMIN'; }).length;
        var el = document.getElementById('stat-admin-total'); if (el) el.textContent = users.length;
        var se = document.getElementById('stat-admin-super'); if (se) se.textContent = superCount;
        // Dynamic per-role pill breakdown
        var breakdown = document.getElementById('stat-roles-breakdown');
        if (breakdown) {
            breakdown.innerHTML = State.rolesCache.map(function (r) {
                var count = users.filter(function (u) { return u.role === r.name; }).length;
                return '<span class="badge bg-' + r.color + '-lt px-3 py-2"><span>' + count + '</span> ' + _esc(r.name) + '</span>';
            }).join('');
        }
    }

    async function renderPermRoleSelector() {
        var sel = document.getElementById('perm-role-selector');
        if (!sel) return;
        // Ensure roles are loaded
        if (!State.rolesCache.length) {
            try { State.rolesCache = await Api.fetchRoles(); } catch (e) { }
        }
        var roles = State.rolesCache;
        // Keep State.permRole (UUID) valid
        if (State.permRole && !roles.find(function (r) { return r.id === State.permRole; }))
            State.permRole = roles.length ? roles[0].id : null;
        if (!State.permRole && roles.length) State.permRole = roles[0].id;

        var addBtn = '<button type="button" class="btn btn-sm btn-outline-secondary" id="btn-open-create-role">' +
            '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" ' +
            'stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="icon me-1">' +
            '<path d="M12 5l0 14"/><path d="M5 12l14 0"/></svg>New Role</button>';

        if (!roles.length) {
            sel.innerHTML = '<span class="text-secondary small fst-italic me-2">No roles defined.</span>' + addBtn;
            var deleteBtn = document.getElementById('btn-delete-role');
            var saveBtn = document.getElementById('btn-save-perms');
            if (deleteBtn) deleteBtn.classList.add('d-none');
            if (saveBtn) saveBtn.classList.add('d-none');
        } else {
            sel.innerHTML = roles.map(function (r) {
                var active = (r.id === State.permRole) ? ' active' : '';
                return '<button type="button" class="btn btn-sm btn-outline-' + _esc(r.color) + active +
                    '" data-perm-role="' + _esc(r.id) + '">' + _esc(r.name) + '</button>';
            }).join('') + addBtn;
            var deleteBtn = document.getElementById('btn-delete-role');
            var saveBtn = document.getElementById('btn-save-perms');
            if (deleteBtn) deleteBtn.classList.remove('d-none');
            if (saveBtn) saveBtn.classList.remove('d-none');
        }

        // Attach click handler (innerHTML replaced old listeners)
        sel.onclick = function (e) {
            var roleBtn = e.target.closest('[data-perm-role]');
            if (roleBtn) {
                State.permRole = roleBtn.dataset.permRole;
                renderPermRoleSelector();
                return;
            }
            var newRoleBtn = e.target.closest('#btn-open-create-role');
            if (newRoleBtn) {
                var form = document.getElementById('form-create-role');
                if (form) form.reset();
                var alertEl = document.getElementById('modal-create-role-alert');
                if (alertEl) alertEl.classList.add('d-none');
                bootstrap.Modal.getOrCreateInstance(document.getElementById('modal-create-role')).show();
            }
        };
        renderPermMatrix();
    }

    function renderAdminTable(users) {
        var tbody = document.getElementById('admin-users-tbody');
        if (!tbody) return;
        if (!users.length) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center text-secondary py-4">No admin users found.</td></tr>';
            return;
        }
        var currentUserId = Auth.getUser() ? Auth.getUser().id : null;
        tbody.innerHTML = users.map(function (u) {
            var name = _esc([u.firstName, u.lastName].filter(Boolean).join(' ') || '—');
            var email = _esc(u.email || '—');
            var roleBadge = Roles.roleBadge(u.role);
            var status = u.status || (u.isActive ? 'ACTIVE' : 'INACTIVE');
            var isActive = (status === 'ACTIVE');
            var statusBadge = '<span class="badge bg-' + (isActive ? 'success' : 'secondary') + '-lt">' + (isActive ? 'Active' : 'Inactive') + '</span>';
            var joined = u.createdAt ? new Date(u.createdAt).toLocaleDateString('en-NG', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
            var isSuperAdmin = (u.role === 'SUPER_ADMIN');
            var isSelf = (u.id === currentUserId);
            var dropItems = '';
            if (!isSuperAdmin && !isSelf) {
                dropItems += '<a class="dropdown-item" href="#" data-action="change-role" data-uid="' + _esc(u.id) + '" data-uname="' + name + '" data-role="' + _esc(u.role) + '">' +
                    '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon me-2"><path d="M12 3a12 12 0 0 0 8.5 3a12 12 0 0 1 -8.5 15a12 12 0 0 1 -8.5 -15a12 12 0 0 0 8.5 -3"/></svg>Change Role</a>';
                var toggleLabel = isActive ? 'Deactivate' : 'Activate';
                var toggleStatus = isActive ? 'INACTIVE' : 'ACTIVE';
                dropItems += '<a class="dropdown-item ' + (isActive ? 'text-danger' : 'text-success') + '" href="#" data-action="toggle-status" data-uid="' + _esc(u.id) + '" data-uname="' + name + '" data-new-status="' + toggleStatus + '">' +
                    '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon me-2"><path d="M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0 -18 0"/>' + (isActive ? '<path d="M9 12l2 2l4 -4"/>' : '<path d="M10 14l4 -4"/><path d="M14 14l-4 -4"/>') + '</svg>' + toggleLabel + '</a>';
            } else {
                dropItems += '<span class="dropdown-item text-secondary disabled small">No actions available</span>';
            }
            return '<tr>' +
                '<td class="fw-medium">' + name + '</td>' +
                '<td class="text-secondary small">' + email + '</td>' +
                '<td>' + roleBadge + '</td>' +
                '<td>' + statusBadge + '</td>' +
                '<td class="text-secondary">' + joined + '</td>' +
                '<td><div class="dropdown">' +
                '<button class="btn btn-sm btn-ghost-secondary" data-bs-toggle="dropdown" data-bs-boundary="window" aria-expanded="false">' +
                '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon"><path d="M12 12m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0"/><path d="M12 19m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0"/><path d="M12 5m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0"/></svg>' +
                '</button>' +
                '<div class="dropdown-menu dropdown-menu-end">' + dropItems + '</div>' +
                '</div></td>' +
                '</tr>';
        }).join('');

        // Re-init each dropdown with Popper fixed strategy so it escapes the
        // table-responsive overflow:auto clipping context and renders over the table.
        tbody.querySelectorAll('[data-bs-toggle="dropdown"]').forEach(function (el) {
            bootstrap.Dropdown.getOrCreateInstance(el, {
                popperConfig: { strategy: 'fixed' }
            });
        });

        // Event delegation for action links
        tbody.onclick = function (e) {
            var el = e.target.closest('[data-action]');
            if (!el) return;
            e.preventDefault();
            var action = el.dataset.action;
            var uid = el.dataset.uid;
            var uname = el.dataset.uname;
            if (action === 'change-role') {
                document.getElementById('role-change-user-id').value = uid;
                document.getElementById('role-change-user-name').textContent = uname;
                var sel = document.getElementById('role-change-select');
                // Pre-select the user's current role by matching name → UUID
                if (sel) {
                    var currentRoleName = el.dataset.role;
                    var matchedRole = State.rolesCache.find(function (r) { return r.name === currentRoleName; });
                    if (matchedRole) sel.value = matchedRole.id;
                }
                bootstrap.Modal.getOrCreateInstance(document.getElementById('modal-change-role')).show();
            } else if (action === 'toggle-status') {
                var newStatus = el.dataset.newStatus;
                var activating = (newStatus === 'ACTIVE');
                document.getElementById('toggle-status-user-id').value = uid;
                document.getElementById('toggle-status-new-status').value = newStatus;
                document.getElementById('toggle-status-title').textContent = activating ? 'Activate Account' : 'Deactivate Account';
                document.getElementById('toggle-status-body').textContent = 'Are you sure you want to ' + (activating ? 'activate' : 'deactivate') + ' ' + uname + '\u2019s account?';
                var confirmBtn = document.getElementById('btn-confirm-toggle-status');
                if (confirmBtn) confirmBtn.className = 'btn ' + (activating ? 'btn-success' : 'btn-danger');
                bootstrap.Modal.getOrCreateInstance(document.getElementById('modal-toggle-status')).show();
            }
        };
    }

    function filterAdminUsers(query) {
        if (!query || !query.trim()) return State.adminUsers.slice();
        var q = query.trim();
        var scored = State.adminUsers.map(function (u) {
            var name = [u.firstName, u.lastName].filter(Boolean).join(' ') || '';
            var email = u.email || '';
            var role = u.role || '';
            var sName = fuzzyScore(name, q);
            var sEmail = fuzzyScore(email, q);
            var sRole = fuzzyScore(role, q);
            var best = Math.max(sName, sEmail, sRole);
            return { user: u, score: best };
        }).filter(function (item) { return item.score > 0; });
        // Sort by descending score
        scored.sort(function (a, b) { return b.score - a.score; });
        return scored.map(function (item) { return item.user; });
    }

    function updateSearchInfo(filteredCount, totalCount, query) {
        var infoEl = document.getElementById('admin-search-results-info');
        if (!infoEl) return;
        if (!query || !query.trim()) {
            infoEl.classList.add('d-none');
            return;
        }
        infoEl.classList.remove('d-none');
        if (filteredCount === 0) {
            infoEl.textContent = 'No results for "' + query.trim() + '"';
        } else {
            infoEl.textContent = 'Showing ' + filteredCount + ' of ' + totalCount + ' admin' + (totalCount === 1 ? '' : 's');
        }
    }

    function clearAdminSearch() {
        var input = document.getElementById('admin-search-input');
        var clearBtn = document.getElementById('admin-search-clear');
        if (input) input.value = '';
        if (clearBtn) clearBtn.classList.add('d-none');
        updateSearchInfo(0, 0, '');
    }

    async function renderPermMatrix() {
        var container = document.getElementById('perm-matrix');
        if (!container) return;
        if (!State.permRole) {
            container.innerHTML =
                '<div class="text-center py-5">' +
                '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" ' +
                'stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" ' +
                'class="icon mb-3 text-secondary" style="opacity:.4">' +
                '<path d="M12 3a12 12 0 0 0 8.5 3a12 12 0 0 1 -8.5 15a12 12 0 0 1 -8.5 -15a12 12 0 0 0 8.5 -3"/>' +
                '</svg>' +
                '<p class="text-secondary mb-3">No roles defined yet.<br>Create your first role to start configuring permissions.</p>' +
                '<button type="button" class="btn btn-primary btn-sm" id="btn-empty-create-role">' +
                '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" ' +
                'stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="icon me-1">' +
                '<path d="M12 5l0 14"/><path d="M5 12l14 0"/></svg>Create First Role</button>' +
                '</div>';
            var emptyBtn = document.getElementById('btn-empty-create-role');
            if (emptyBtn) {
                emptyBtn.onclick = function () {
                    var form = document.getElementById('form-create-role');
                    if (form) form.reset();
                    var alertEl = document.getElementById('modal-create-role-alert');
                    if (alertEl) alertEl.classList.add('d-none');
                    bootstrap.Modal.getOrCreateInstance(document.getElementById('modal-create-role')).show();
                };
            }
            return;
        }
        // Show spinner while fetching from API
        container.innerHTML = '<div class="py-5 text-center text-secondary"><div class="spinner-border spinner-border-sm"></div></div>';
        try {
            var results = await Promise.all([
                Api.fetchPermissionCatalogue(),
                Api.fetchRole(State.permRole),
            ]);
            var catalogue = results[0];
            var roleData = results[1];
            var perms = roleData.permissions || [];
            var roleColor = Roles.getRoleColor(roleData.name);
            var roleLabel = Roles.getRoleLabel(roleData.name);
            var html = '<div class="table-responsive">' +
                '<table class="table table-sm table-bordered mb-0">' +
                '<thead><tr>' +
                '<th style="width:58%">Permission</th>' +
                '<th class="text-center" style="width:21%"><span class="badge bg-danger-lt">Super Admin</span></th>' +
                '<th class="text-center" style="width:21%"><span class="badge bg-' + roleColor + '-lt">' + _esc(roleLabel) + '</span></th>' +
                '</tr></thead><tbody>';
            catalogue.groups.forEach(function (group) {
                html += '<tr>' +
                    '<td colspan="3" class="fw-semibold text-secondary small py-1 ps-2" style="background:var(--tblr-bg-surface-secondary)">' + _esc(group.group) + '</td>' +
                    '</tr>';
                group.permissions.forEach(function (perm) {
                    var hasIt = perms.indexOf(perm.key) !== -1;
                    html += '<tr>' +
                        '<td class="ps-4 small">' + _esc(perm.label) +
                        ' <code class="text-secondary ms-1" style="font-size:.7em">' + _esc(perm.key) + '</code></td>' +
                        '<td class="text-center"><input type="checkbox" class="form-check-input" checked disabled title="Super Admin always has this" /></td>' +
                        '<td class="text-center"><input type="checkbox" class="form-check-input" data-perm-key="' + _esc(perm.key) + '"' + (hasIt ? ' checked' : '') + ' /></td>' +
                        '</tr>';
                });
            });
            html += '</tbody></table></div>';
            container.innerHTML = html;
        } catch (err) {
            container.innerHTML = '<div class="text-center text-danger py-4">' +
                '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon me-2">' +
                '<path d="M3 12a9 9 0 1 0 18 0a9 9 0 0 0 -18 0"/><path d="M12 8v4"/><path d="M12 16h.01"/></svg>' +
                _esc(err.message) + '</div>';
        }
    }

    var DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

    function renderBusinessHoursTable(hours) {
        var byDay = {};
        (hours || []).forEach(function (h) { byDay[h.dayOfWeek] = h; });

        var rows = '<div class="table-responsive"><table class="table table-vcenter">' +
            '<thead><tr><th>Day</th><th>Open</th><th>Opens</th><th>Closes</th></tr></thead><tbody>';
        for (var d = 0; d <= 6; d++) {
            var h = byDay[d] || {};
            var isOpen = h.isOpen !== false;
            rows +=
                '<tr>' +
                '<td>' + DAY_NAMES[d] + '</td>' +
                '<td><div class="form-check form-switch mb-0">' +
                '<input class="form-check-input biz-hours-open" type="checkbox" data-day="' + d + '"' + (isOpen ? ' checked' : '') + '>' +
                '</div></td>' +
                '<td><input type="time" class="form-control form-control-sm biz-hours-open-time" data-day="' + d + '" value="' + (h.openTime || '09:00') + '"' + (isOpen ? '' : ' disabled') + ' style="max-width:130px"></td>' +
                '<td><input type="time" class="form-control form-control-sm biz-hours-close-time" data-day="' + d + '" value="' + (h.closeTime || '17:00') + '"' + (isOpen ? '' : ' disabled') + ' style="max-width:130px"></td>' +
                '</tr>';
        }
        rows += '</tbody></table></div>';
        document.getElementById('biz-hours-table').innerHTML = rows;

        document.querySelectorAll('.biz-hours-open').forEach(function (cb) {
            cb.addEventListener('change', function () {
                var day = this.dataset.day;
                document.querySelector('.biz-hours-open-time[data-day="' + day + '"]').disabled = !this.checked;
                document.querySelector('.biz-hours-close-time[data-day="' + day + '"]').disabled = !this.checked;
            });
        });
    }

    SP.UI = {
        switchSection: switchSection,
        routeOnLoad: routeOnLoad,
        populateUserInfo: populateUserInfo,
        fillProfileForm: fillProfileForm,
        togglePwd: togglePwd,
        updateAdminStats: updateAdminStats,
        renderPermRoleSelector: renderPermRoleSelector,
        renderAdminTable: renderAdminTable,
        filterAdminUsers: filterAdminUsers,
        updateSearchInfo: updateSearchInfo,
        clearAdminSearch: clearAdminSearch,
        renderPermMatrix: renderPermMatrix,
        renderBusinessHoursTable: renderBusinessHoursTable,
    };
})(window);