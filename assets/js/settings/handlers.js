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
    var showHomeServiceAlert = Utils.showHomeServiceAlert;
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
    var renderServiceableAreas = UI.renderServiceableAreas;
    var populateAddAreaState = UI.populateAddAreaState;
    var populateAddAreaCity = UI.populateAddAreaCity;
    var updateDraftBanner = UI.updateDraftBanner;
    var renderAddAreaPreview = UI.renderAddAreaPreview;
    var renderCancellationPolicy = UI.renderCancellationPolicy;
    var collectCancellationPolicyRules = UI.collectCancellationPolicyRules;
    var wireCancellationPolicyInputs = UI.wireCancellationPolicyInputs;


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

    async function loadCancellationPolicy() {
        var walkTbody = document.getElementById('cancellation-policy-walkin-tbody');
        var homeTbody = document.getElementById('cancellation-policy-home-tbody');
        if (walkTbody) walkTbody.innerHTML = '<tr><td colspan="6" class="text-center text-secondary py-4"><div class="spinner-border spinner-border-sm"></div></td></tr>';
        if (homeTbody) homeTbody.innerHTML = '<tr><td colspan="6" class="text-center text-secondary py-4"><div class="spinner-border spinner-border-sm"></div></td></tr>';
        try {
            var data = await Bookings.getCancellationPolicy();
            State.cancellationPolicy = data;
            State.cancellationPolicyDirty = false;
            renderCancellationPolicy(State.cancellationPolicy);
            var savedEl = document.getElementById('cancellation-policy-saved');
            if (savedEl) savedEl.classList.add('d-none');
        } catch (err) {
            showCancellationPolicyAlert('danger', 'Failed to load cancellation policy: ' + err.message);
            if (walkTbody) walkTbody.innerHTML = '<tr><td colspan="6" class="text-center text-danger py-4">' + _esc(err.message) + '</td></tr>';
            if (homeTbody) homeTbody.innerHTML = '<tr><td colspan="6" class="text-center text-danger py-4">' + _esc(err.message) + '</td></tr>';
        }
    }

    async function saveCancellationPolicy() {
        if (!RBAC.can('settings:manage')) return;
        var walkRules = collectCancellationPolicyRules('walkInBranch');
        var homeRules = collectCancellationPolicyRules('homeService');
        var walkErr = Bookings.validateCancellationRules(walkRules);
        if (walkErr) {
            showCancellationPolicyAlert('danger', walkErr);
            return;
        }
        var homeErr = Bookings.validateCancellationRules(homeRules);
        if (homeErr) {
            showCancellationPolicyAlert('danger', homeErr);
            return;
        }
        var btn = document.getElementById('btn-save-cancellation-policy');
        if (btn) btn.disabled = true;
        setSpinner('spinner-cancellation-policy', true);
        try {
            var data = await Bookings.updateCancellationPolicy({
                walkInBranch: walkRules,
                homeService: homeRules,
            });
            State.cancellationPolicy = data;
            State.cancellationPolicyDirty = false;
            renderCancellationPolicy(State.cancellationPolicy);
            showCancellationPolicyAlert('success', 'Cancellation policy saved.');
            var savedEl = document.getElementById('cancellation-policy-saved');
            if (savedEl) {
                savedEl.classList.remove('d-none');
                setTimeout(function () { savedEl.classList.add('d-none'); }, 3000);
            }
        } catch (err) {
            showCancellationPolicyAlert('danger', err.message);
        } finally {
            setSpinner('spinner-cancellation-policy', false);
            if (btn) btn.disabled = false;
        }
    }

    function showCancellationPolicyAlert(type, message) {
        var alertEl = document.getElementById('cancellation-policy-alert');
        var msgEl = document.getElementById('cancellation-policy-alert-msg');
        if (!alertEl || !msgEl) return;
        alertEl.className = 'alert alert-' + type + ' mb-3';
        msgEl.textContent = message;
    }

    // ── GET /admin/settings/home-service ──────────────────────────────────
    async function loadHomeService() {
        try {
            var result = await Api.getHomeService();
            State.homeService = result.data || {};
            State.serviceableAreas = (State.homeService.serviceableAreas || []).map(function (a) {
                return { state: String(a.state || '').trim(), city: String(a.city || '').trim() };
            });
            State.serviceableAreasDirty = false;
            renderServiceableAreas(State.serviceableAreas);
            var savedEl = document.getElementById('home-service-saved');
            if (savedEl) savedEl.classList.add('d-none');
        } catch (err) {
            showHomeServiceAlert('danger', 'Failed to load home service settings: ' + err.message);
            var tbody = document.getElementById('home-service-tbody');
            if (tbody) tbody.innerHTML = '<tr><td colspan="3" class="text-center text-danger py-4">' + _esc(err.message) + '</td></tr>';
        }
    }

    // ── PUT /admin/settings/home-service ──────────────────────────────────
    async function saveHomeService(btn) {
        var btnEl = btn || document.getElementById('btn-save-serviceable-areas');
        var spinnerId = btnEl && btnEl.closest('#home-service-draft-banner')
            ? 'spinner-serviceable-areas-banner'
            : 'spinner-serviceable-areas';
        if (btnEl) btnEl.disabled = true;
        setSpinner(spinnerId, true);
        try {
            var result = await Api.updateHomeService({ serviceableAreas: State.serviceableAreas });
            if (!result.res.ok) throw new Error(result.message || 'Update failed (' + result.res.status + ')');
            State.homeService = result.data || State.homeService;
            State.serviceableAreas = (State.homeService.serviceableAreas || []).map(function (a) {
                return { state: String(a.state || '').trim(), city: String(a.city || '').trim() };
            });
            State.serviceableAreasDirty = false;
            renderServiceableAreas(State.serviceableAreas);
            showHomeServiceAlert('success', 'Home service areas saved. Changes are now live.');
            var savedEl = document.getElementById('home-service-saved');
            if (savedEl) {
                savedEl.classList.remove('d-none');
                setTimeout(function () { savedEl.classList.add('d-none'); }, 3000);
            }
        } catch (err) {
            showHomeServiceAlert('danger', err.message);
        } finally {
            setSpinner(spinnerId, false);
            if (btnEl) btnEl.disabled = false;
        }
    }

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
            var cancelNav = document.getElementById('nav-cancellation-policy');
            if (cancelNav) cancelNav.classList.toggle('d-none', !RBAC.can('settings:read') && !RBAC.can('settings:manage'));
        });
        populateUserInfo(Auth.getUser());
        loadProfile();
        await populateRoleSelects();
        loadBusinessHours();
        loadHomeService();
        wireCancellationPolicyInputs();

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
                if (section === 'home-service') {
                    loadHomeService();
                }
                if (section === 'cancellation-policy') {
                    loadCancellationPolicy();
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

        // ── Home service: add-area modal wiring ────────────────────────
        MultiSelect.attach('add-area-city');

        var btnAddArea = document.getElementById('btn-add-serviceable-area');
        if (btnAddArea) {
            btnAddArea.addEventListener('click', function () {
                var alertEl = document.getElementById('modal-add-area-alert');
                if (alertEl) {
                    alertEl.className = 'alert d-none mx-3 mt-3 mb-0 py-2';
                    alertEl.classList.add('d-none');
                }
                document.getElementById('modal-add-area-note').textContent = '';
                populateAddAreaState();
                populateAddAreaCity('');
                MultiSelect.clear('add-area-city');
                renderAddAreaPreview();
                bootstrap.Modal.getOrCreateInstance(document.getElementById('modal-add-serviceable-area')).show();
            });
        }

        var stateSel = document.getElementById('add-area-state');
        if (stateSel) {
            stateSel.addEventListener('change', function () {
                populateAddAreaCity(this.value);
                renderAddAreaPreview();
            });
        }

        var citySel = document.getElementById('add-area-city');
        if (citySel) {
            citySel.addEventListener('change', function () {
                renderAddAreaPreview();
            });
        }

        // Preview: per-chip remove + clear all
        var previewEl = document.getElementById('home-service-add-preview');
        if (previewEl) {
            previewEl.addEventListener('click', function (e) {
                var removeBtn = e.target.closest('[data-preview-remove]');
                var clearBtn = e.target.closest('#btn-preview-clear-all');
                if (removeBtn) {
                    var city = removeBtn.getAttribute('data-preview-remove');
                    var opt = Array.from(citySel.options).find(function (o) { return o.value === city; });
                    if (opt) opt.selected = false;
                    MultiSelect.refresh('add-area-city');
                    renderAddAreaPreview();
                } else if (clearBtn) {
                    MultiSelect.clear('add-area-city');
                    renderAddAreaPreview();
                }
            });
        }

        var btnConfirmAddArea = document.getElementById('btn-confirm-add-area');
        if (btnConfirmAddArea) {
            btnConfirmAddArea.addEventListener('click', function () {
                var alertEl = document.getElementById('modal-add-area-alert');
                var alertMsg = document.getElementById('modal-add-area-alert-msg');
                var state = document.getElementById('add-area-state').value;
                if (!state) {
                    if (alertEl && alertMsg) {
                        alertEl.className = 'alert alert-danger mx-3 mt-3 mb-0 py-2';
                        alertMsg.textContent = 'Please select a state.';
                        alertEl.classList.remove('d-none');
                    }
                    return;
                }
                var cityOpts = Array.from(document.getElementById('add-area-city').selectedOptions);
                if (!cityOpts.length) {
                    if (alertEl && alertMsg) {
                        alertEl.className = 'alert alert-danger mx-3 mt-3 mb-0 py-2';
                        alertMsg.textContent = 'Please pick at least one city (or All Cities).';
                        alertEl.classList.remove('d-none');
                    }
                    return;
                }
                var added = [];
                cityOpts.forEach(function (opt) {
                    if (!opt.value) return;
                    var city = opt.value.trim();
                    if (!city) return;
                    var dup = State.serviceableAreas.some(function (a) {
                        return a.state.toLowerCase() === state.toLowerCase() &&
                            a.city.toLowerCase() === city.toLowerCase();
                    });
                    if (!dup) added.push({ state: state, city: city });
                });
                if (!added.length) {
                    if (alertEl && alertMsg) {
                        alertEl.className = 'alert alert-warning mx-3 mt-3 mb-0 py-2';
                        alertMsg.textContent = 'All selected cities are already in the list.';
                        alertEl.classList.remove('d-none');
                    }
                    return;
                }
                State.serviceableAreas = State.serviceableAreas.concat(added);
                State.serviceableAreasDirty = true;
                renderServiceableAreas(State.serviceableAreas);
                updateDraftBanner();
                // Keep the modal open so more states can be queued up before saving once.
                var savedBadge = document.getElementById('home-service-saved');
                if (savedBadge) savedBadge.classList.add('d-none');
                MultiSelect.clear('add-area-city');
                renderAddAreaPreview();
                document.getElementById('modal-add-area-note').textContent =
                    added.length + ' area(s) added to draft (' + State.serviceableAreas.length + ' total). Close and hit Save Areas when done.';
            });
        }

        var btnSaveAreas = document.getElementById('btn-save-serviceable-areas');
        if (btnSaveAreas) {
            btnSaveAreas.addEventListener('click', function () {
                saveHomeService(this);
            });
        }

        var btnSaveAreasBanner = document.getElementById('btn-save-areas-banner');
        if (btnSaveAreasBanner) {
            btnSaveAreasBanner.addEventListener('click', function () {
                saveHomeService(this);
            });
        }

        var btnSaveCancellationPolicy = document.getElementById('btn-save-cancellation-policy');
        if (btnSaveCancellationPolicy) {
            btnSaveCancellationPolicy.addEventListener('click', function () {
                saveCancellationPolicy();
            });
        }

        var cancelPolicyTabs = document.getElementById('cancellation-policy-tabs');
        if (cancelPolicyTabs) {
            cancelPolicyTabs.addEventListener('click', function (e) {
                var link = e.target.closest('[data-cancel-tab]');
                if (!link) return;
                e.preventDefault();
                cancelPolicyTabs.querySelectorAll('.nav-link').forEach(function (el) { el.classList.remove('active'); });
                link.classList.add('active');
                var tab = link.dataset.cancelTab;
                var walk = document.getElementById('cancellation-tab-walkin');
                var home = document.getElementById('cancellation-tab-home');
                if (walk) walk.classList.toggle('d-none', tab !== 'walkin');
                if (home) home.classList.toggle('d-none', tab !== 'home');
            });
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
            });
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

        // Open "Assign Role" (staff search) modal
        var btnOpenAssignRole = document.getElementById('btn-open-assign-role');
        if (btnOpenAssignRole) {
            btnOpenAssignRole.addEventListener('click', async function () {
                var errEl = document.getElementById('assign-role-staff-error');
                if (errEl) errEl.classList.add('d-none');
                document.getElementById('assign-role-grant-portal-login').checked = true;

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
                    var staffResult = await Staff.getAll({ employmentStatus: 'ACTIVE', limit: 200 });
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

        // Confirm assign role (staff search)
        var btnConfirmAssignRole = document.getElementById('btn-confirm-assign-role-staff');
        if (btnConfirmAssignRole) {
            btnConfirmAssignRole.addEventListener('click', async function () {
                var errEl = document.getElementById('assign-role-staff-error');
                errEl.classList.add('d-none');

                var staffId = document.getElementById('assign-role-staff-select').value;
                var adminRoleId = document.getElementById('assign-role-role-select').value;
                var grantPortalLogin = document.getElementById('assign-role-grant-portal-login').checked;

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

                var spinner = document.getElementById('spinner-assign-role-staff');
                var btn = this;
                btn.disabled = true;
                if (spinner) spinner.classList.remove('d-none');
                try {
                    await Staff.assignRole(staffId, adminRoleId, grantPortalLogin);
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

        // Auto-load when landing directly on home-service / admin-management
        var hash = (location.hash || '').replace('#', '');
        if (hash === 'home-service') {
            loadHomeService();
        }
        if (hash === 'cancellation-policy') {
            loadCancellationPolicy();
        }
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
        loadHomeService: loadHomeService,
        saveHomeService: saveHomeService,
        init: init,
    };
})(window);