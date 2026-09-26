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
    var mergeServiceableAreas = Utils.mergeServiceableAreas;
    var dedupeServiceableAreas = Utils.dedupeServiceableAreas;

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
    var filterPermMatrix = UI.filterPermMatrix;
    var renderBusinessHoursTable = UI.renderBusinessHoursTable;
    var renderServiceableAreas = UI.renderServiceableAreas;
    var populateAddAreaState = UI.populateAddAreaState;
    var populateAddAreaCity = UI.populateAddAreaCity;
    var updateAddAreaCityNotice = UI.updateAddAreaCityNotice;
    var reconcileCityPickerSelection = UI.reconcileCityPickerSelection;
    var removeWildcardForState = UI.removeWildcardForState;
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
            if (tbody) tbody.innerHTML = '<tr><td colspan="4" class="text-center text-danger py-4">' + _esc(err.message) + '</td></tr>';
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
            var cleaned = dedupeServiceableAreas(State.serviceableAreas);
            if (cleaned.length !== State.serviceableAreas.length) {
                State.serviceableAreas = cleaned;
                State.serviceableAreasDirty = true;
                renderServiceableAreas(State.serviceableAreas);
            }
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
                if (section === 'customer-classification') {
                    loadCustomerClassificationSettings();
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

        var saveCustomerClassificationBtn = document.getElementById('btn-save-customer-classification');
        if (saveCustomerClassificationBtn) {
            saveCustomerClassificationBtn.addEventListener('click', submitCustomerClassificationSettings);
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

        async function loadCustomerClassificationSettings() {
            var errEl = document.getElementById('cc-settings-error');
            if (errEl) errEl.classList.add('d-none');
            try {
                var s = await SalonBookings.getCustomerClassificationSettings();
                document.getElementById('cc-premium-spend').value = s.premiumSpendThreshold;
                document.getElementById('cc-vip-spend').value = s.vipSpendThreshold;
                document.getElementById('cc-new-age').value = s.newAccountAgeDays;
                document.getElementById('cc-new-visits').value = s.newVisitCountThreshold;
                document.getElementById('cc-active-days').value = s.activeDaysThreshold;
                document.getElementById('cc-at-risk-days').value = s.atRiskDaysThreshold;
                document.getElementById('cc-dormant-days').value = s.dormantDaysThreshold;
            } catch (err) {
                if (errEl) {
                    errEl.textContent = err.message || 'Failed to load classification settings.';
                    errEl.classList.remove('d-none');
                }
            }
        }

        async function submitCustomerClassificationSettings() {
            var errEl = document.getElementById('cc-settings-error');
            errEl.classList.add('d-none');

            var payload = {
                premiumSpendThreshold: Number(document.getElementById('cc-premium-spend').value),
                vipSpendThreshold: Number(document.getElementById('cc-vip-spend').value),
                newAccountAgeDays: Number(document.getElementById('cc-new-age').value),
                newVisitCountThreshold: Number(document.getElementById('cc-new-visits').value),
                activeDaysThreshold: Number(document.getElementById('cc-active-days').value),
                atRiskDaysThreshold: Number(document.getElementById('cc-at-risk-days').value),
                dormantDaysThreshold: Number(document.getElementById('cc-dormant-days').value),
            };

            if (payload.vipSpendThreshold <= payload.premiumSpendThreshold) {
                errEl.textContent = 'VIP threshold must be greater than the Premium threshold.';
                errEl.classList.remove('d-none');
                return;
            }
            if (payload.atRiskDaysThreshold <= payload.activeDaysThreshold || payload.dormantDaysThreshold <= payload.atRiskDaysThreshold) {
                errEl.textContent = 'Each lifecycle day threshold must be greater than the one before it (Active < At Risk < Dormant).';
                errEl.classList.remove('d-none');
                return;
            }

            setSpinner('spinner-customer-classification', true);
            try {
                await SalonBookings.updateCustomerClassificationSettings(payload);
                var savedBadge = document.getElementById('cc-settings-saved');
                if (savedBadge) {
                    savedBadge.classList.remove('d-none');
                    setTimeout(function () { savedBadge.classList.add('d-none'); }, 2500);
                }
            } catch (err) {
                errEl.textContent = err.message || 'Failed to save classification settings.';
                errEl.classList.remove('d-none');
            } finally {
                setSpinner('spinner-customer-classification', false);
            }
        }

        // ── Home service: add-area modal wiring ────────────────────────
        MultiSelect.attach('add-area-city');
        var prevCitySelection = [];

        var btnAddArea = document.getElementById('btn-add-serviceable-area');
        if (btnAddArea) {
            btnAddArea.addEventListener('click', function () {
                var alertEl = document.getElementById('modal-add-area-alert');
                if (alertEl) {
                    alertEl.className = 'alert d-none mx-3 mt-3 mb-0 py-2';
                    alertEl.classList.add('d-none');
                }
                document.getElementById('modal-add-area-note').textContent = '';
                State.addAreaCityOverride = null;
                prevCitySelection = [];
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
                State.addAreaCityOverride = null;
                prevCitySelection = [];
                populateAddAreaCity(this.value);
                renderAddAreaPreview();
            });
        }

        document.addEventListener('hairlux:add-area-override', function () {
            prevCitySelection = [];
        });

        var cityNotice = document.getElementById('add-area-city-notice');
        if (cityNotice) {
            cityNotice.addEventListener('click', function (e) {
                var btn = e.target.closest('#btn-override-all-cities');
                if (!btn) return;
                var state = document.getElementById('add-area-state').value;
                if (!state) return;
                removeWildcardForState(state);
                prevCitySelection = [];
                populateAddAreaCity(state);
                updateAddAreaCityNotice(state);
                renderAddAreaPreview();
            });
        }

        var citySel = document.getElementById('add-area-city');
        if (citySel) {
            citySel.addEventListener('change', function () {
                var state = document.getElementById('add-area-state').value;
                var selected = Array.from(citySel.selectedOptions)
                    .map(function (o) { return o.value; })
                    .filter(Boolean);
                var added = selected.filter(function (v) { return prevCitySelection.indexOf(v) === -1; });

                if (added.indexOf('*') !== -1 && selected.length > 1) {
                    Array.from(citySel.options).forEach(function (opt) {
                        if (opt.value && opt.value !== '*') opt.selected = false;
                    });
                    MultiSelect.refresh('add-area-city');
                    selected = ['*'];
                } else if (prevCitySelection.indexOf('*') !== -1 && added.length && added.indexOf('*') === -1) {
                    reconcileCityPickerSelection(state);
                    selected = Array.from(citySel.selectedOptions)
                        .map(function (o) { return o.value; })
                        .filter(Boolean);
                }

                prevCitySelection = selected.slice();
                updateAddAreaCityNotice(state);
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
                    prevCitySelection = Array.from(citySel.selectedOptions)
                        .map(function (o) { return o.value; })
                        .filter(Boolean);
                    renderAddAreaPreview();
                } else if (clearBtn) {
                    MultiSelect.clear('add-area-city');
                    prevCitySelection = [];
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
                var toAdd = [];
                cityOpts.forEach(function (opt) {
                    if (!opt.value) return;
                    var city = opt.value.trim();
                    if (!city) return;
                    toAdd.push({ state: state, city: city });
                });
                var mergeResult = mergeServiceableAreas(State.serviceableAreas, toAdd);
                if (!mergeResult.added.length) {
                    if (alertEl && alertMsg) {
                        alertEl.className = 'alert alert-warning mx-3 mt-3 mb-0 py-2';
                        alertMsg.textContent = mergeResult.skipped.length === 1
                            ? 'That area is already covered by an existing entry.'
                            : 'All selected areas are already covered by existing entries.';
                        alertEl.classList.remove('d-none');
                    }
                    return;
                }
                State.serviceableAreas = mergeResult.areas;
                State.serviceableAreasDirty = true;
                renderServiceableAreas(State.serviceableAreas);
                updateDraftBanner();
                var savedBadge = document.getElementById('home-service-saved');
                if (savedBadge) savedBadge.classList.add('d-none');
                MultiSelect.clear('add-area-city');
                populateAddAreaCity(state);
                renderAddAreaPreview();
                var noteParts = [mergeResult.added.length + ' area(s) added to draft'];
                if (mergeResult.replaced > 0) {
                    noteParts.push(mergeResult.replaced + ' specific city entries replaced by All Cities');
                }
                if (mergeResult.skipped.length > 0) {
                    noteParts.push(mergeResult.skipped.length + ' skipped (already covered)');
                }
                document.getElementById('modal-add-area-note').textContent =
                    noteParts.join('. ') + ' (' + State.serviceableAreas.length + ' total). Close and hit Save Areas when done.';
            });
        }

        var btnCleanupRedundant = document.getElementById('btn-cleanup-redundant-areas');
        if (btnCleanupRedundant) {
            btnCleanupRedundant.addEventListener('click', function () {
                var before = State.serviceableAreas.length;
                var cleaned = dedupeServiceableAreas(State.serviceableAreas);
                if (cleaned.length === before) {
                    showHomeServiceAlert('info', 'No redundant areas to remove.');
                    return;
                }
                State.serviceableAreas = cleaned;
                State.serviceableAreasDirty = true;
                renderServiceableAreas(State.serviceableAreas);
                updateDraftBanner();
                showHomeServiceAlert('success', 'Removed ' + (before - cleaned.length) + ' redundant area(s). Save to publish.');
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
        // Dev Feedback Round 4, item #30: permission search
        var permSearchInput = document.getElementById('perm-search');
        if (permSearchInput) {
            permSearchInput.addEventListener('input', filterPermMatrix);
        }

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
        if (hash === 'customer-classification') {
            loadCustomerClassificationSettings();
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