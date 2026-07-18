/**
 * beauticians/handlers.js — page actions, loaders, and event binding
 */
(function (global) {
    'use strict';

    var BP = (global.BeauticiansPage = global.BeauticiansPage || {});
    var State = BP.State;
    var Utils = BP.Utils;
    var UI = BP.UI;
    var Api = BP.Api;
    var bootstrap = global.tabler && global.tabler.bootstrap;

    function getBootstrap() {
        return (global.tabler && global.tabler.bootstrap) || global.bootstrap || bootstrap;
    }

    // Utils aliases (original bare-call style)
    var showAlert = Utils.showAlert;
    var setSaveButtonState = Utils.setSaveButtonState;
    var canAccessSection = Utils.canAccessSection;
    var escHtml = Utils.escHtml;
    var detailField = Utils.detailField;
    var detailHeading = Utils.detailHeading;
    var detailLight = Utils.detailLight;
    var detailHeavy = Utils.detailHeavy;
    var formatCommissionLabel = Utils.formatCommissionLabel;
    var isPdfUrl = Utils.isPdfUrl;
    var commissionRateToPercent = Utils.commissionRateToPercent;
    var commissionPercentToRate = Utils.commissionPercentToRate;
    var formatScoringWeight = Utils.formatScoringWeight;
    var sanitizePercentInputValue = Utils.sanitizePercentInputValue;
    var applyDailyLimitInputs = Utils.applyDailyLimitInputs;
    var onUnlimitedToggle = Utils.onUnlimitedToggle;
    var readDailyLimitFromInputs = Utils.readDailyLimitFromInputs;
    var applyDispatchTierValue = Utils.applyDispatchTierValue;
    var payoutsCountLabel = Utils.payoutsCountLabel;
    var formatEarningsCell = Utils.formatEarningsCell;
    var getServiceCatalogPrice = Utils.getServiceCatalogPrice;
    var svcBeauticianSearchHaystack = Utils.svcBeauticianSearchHaystack;
    var scrServiceSearchHaystack = Utils.scrServiceSearchHaystack;

    // UI aliases
    var initSettingsFieldHints = UI.initSettingsFieldHints;
    var applyTabVisibility = UI.applyTabVisibility;
    var applyPerformanceVisibility = UI.applyPerformanceVisibility;
    var firstAccessibleSection = UI.firstAccessibleSection;
    var renderPagination = UI.renderPagination;
    var renderListTable = UI.renderListTable;
    var openPhotoPreview = UI.openPhotoPreview;
    var setCertPreviewLoading = UI.setCertPreviewLoading;
    var openCertificationPreview = UI.openCertificationPreview;
    var renderProfileReviewer = UI.renderProfileReviewer;
    var renderCertifications = UI.renderCertifications;
    var renderBeauticianBankDetails = UI.renderBeauticianBankDetails;
    var renderBeauticianDetailContent = UI.renderBeauticianDetailContent;
    var updateDetailReviewsPanel = UI.updateDetailReviewsPanel;
    var buildDetailActions = UI.buildDetailActions;
    var renderReviewsTable = UI.renderReviewsTable;
    var getSvcBeauticianId = UI.getSvcBeauticianId;
    var setSvcBeauticianLabel = UI.setSvcBeauticianLabel;
    var setSvcBeauticianSelection = UI.setSvcBeauticianSelection;
    var renderSvcBeauticianPicker = UI.renderSvcBeauticianPicker;
    var updateSvcSelectedCount = UI.updateSvcSelectedCount;
    var showScrDefaultAlert = UI.showScrDefaultAlert;
    var showScrAlert = UI.showScrAlert;
    var renderServiceCommissionRows = UI.renderServiceCommissionRows;
    var getScrServiceId = UI.getScrServiceId;
    var setScrServiceLabel = UI.setScrServiceLabel;
    var setScrServiceSelection = UI.setScrServiceSelection;
    var getScrModalServicePrice = UI.getScrModalServicePrice;
    var updateScrEarningsPreview = UI.updateScrEarningsPreview;
    var getScrAvailableServices = UI.getScrAvailableServices;
    var renderScrServicePicker = UI.renderScrServicePicker;
    var openScrModalForAdd = UI.openScrModalForAdd;
    var openScrModalForEdit = UI.openScrModalForEdit;
    var renderDailyPoolStats = UI.renderDailyPoolStats;



// ── Utility ────────────────────────────────────────────────────────────────

function refreshPage() {
    if (RBAC.can('beauticians:read')) loadPerformance();
    refreshCurrentSection();
}

function refreshCurrentSection() {
    if (State.activeSection === 'list') loadList();
    else if (State.activeSection === 'reviews') loadReviews();
    else if (State.activeSection === 'services') loadBeauticianOptions();
    else if (State.activeSection === 'service-rates') loadServiceCommissionRates();
    else if (State.activeSection === 'settings') loadSettings();
    else if (State.activeSection === 'payouts') loadPayouts();
}

function switchSection(section, updateHash) {
    if (State.VALID_SECTIONS.indexOf(section) === -1) section = firstAccessibleSection();
    if (!canAccessSection(section)) section = firstAccessibleSection();
    State.activeSection = section;
    if (updateHash !== false && window.location.hash.replace(/^#/, '') !== section) {
        history.replaceState(null, '', '#' + section);
    }
    document.querySelectorAll('#section-tabs .nav-link').forEach(function (t) {
        t.classList.toggle('active', t.dataset.section === section);
    });
    State.VALID_SECTIONS.forEach(function (s) {
        var el = document.getElementById('section-' + s);
        if (el) el.classList.toggle('d-none', s !== section);
    });
    refreshCurrentSection();
}

function applySectionFromHash() {
    var hash = (window.location.hash || '').replace(/^#/, '').toLowerCase();
    if (State.VALID_SECTIONS.indexOf(hash) === -1) hash = firstAccessibleSection();
    switchSection(hash, false);
}

// ── Load beautician list ───────────────────────────────────────────────────
async function loadList() {
    var tbody = document.getElementById('list-tbody');
    tbody.innerHTML = '<tr><td colspan="10" class="text-center py-5"><div class="spinner-border text-primary" role="status"></div></td></tr>';
    document.getElementById('list-results-label').textContent = 'Loading…';
    try {
        var result = await Api.listBeauticians({
            page: State.list.page,
            limit: State.list.limit,
            search: State.list.search,
            kycStatus: State.list.kycStatus,
            profileStatus: State.list.profileStatus,
            availabilityStatus: State.list.availabilityStatus,
            ratingMin: State.list.ratingMin,
        });
        var rows = result.data || [];
        var meta = result.meta || {};
        State.list.totalPages = meta.totalPages || 1;
        var count = meta.total ?? rows.length;
        document.getElementById('list-results-label').textContent = count + ' beautician' + (count !== 1 ? 's' : '') + ' found';
        renderListTable(rows, meta);
        renderPagination('list', meta);
    } catch (err) {
        tbody.innerHTML = '<tr><td colspan="10" class="text-center text-danger py-4">' + (err.message || 'Failed to load.') + '</td></tr>';
        document.getElementById('list-results-label').textContent = 'Error';
    }
}

// ── Beautician detail offcanvas ────────────────────────────────────────────
async function openDetail(id) {
    if (!id) return;
    var body = document.getElementById('offcanvas-detail-body');
    var actions = document.getElementById('offcanvas-detail-actions');
    body.innerHTML = '<div class="text-center py-4"><div class="spinner-border text-primary" role="status"></div></div>';
    actions.innerHTML = '';
    var bs = getBootstrap();
    var oc = bs.Offcanvas.getOrCreateInstance(document.getElementById('offcanvas-detail'));
    oc.show();
    try {
        var results = await Promise.all([
            Api.getBeautician(id),
            Api.getHomeServiceSettings().catch(function () { return null; }),
        ]);
        var b = results[0];
        var settings = results[1];
        State.detailReviews.beauticianId = b.id;
        State.detailReviews.page = 1;
        body.innerHTML = renderBeauticianDetailContent(b, settings);
        actions.innerHTML = buildDetailActions(b);
        loadDetailReviews(b.id);
    } catch (err) {
        body.innerHTML = '<div class="alert alert-danger">' + escHtml(err.message || 'Failed to load details.') + '</div>';
    }
}

async function loadDetailReviews(beauticianId) {
    var id = beauticianId || State.detailReviews.beauticianId;
    if (!id) return;
    State.detailReviews.beauticianId = id;
    State.detailReviews.loading = true;
    updateDetailReviewsPanel([], {}, { loading: true });
    try {
        var result = await Api.getBeauticianReviews(id, {
            page: State.detailReviews.page,
            limit: State.detailReviews.limit || 10,
            sortBy: State.detailReviews.sortBy || 'createdAt',
            sortOrder: State.detailReviews.sortOrder || 'desc',
        });
        var rows = result.data || [];
        var meta = result.meta || {};
        // Normalize meta when API omits pagination fields
        var limit = State.detailReviews.limit || 10;
        var page = State.detailReviews.page || 1;
        if (meta.total == null && rows.length < limit && page === 1) {
            meta.total = rows.length;
        }
        if (!meta.limit) meta.limit = limit;
        if (!meta.page) meta.page = page;
        if (!meta.totalPages) {
            meta.totalPages = meta.total != null
                ? Math.max(1, Math.ceil(Number(meta.total) / limit))
                : (rows.length >= limit ? page + 1 : page);
        }
        State.detailReviews.totalPages = meta.totalPages || 1;
        State.detailReviews.total = meta.total != null ? meta.total : State.detailReviews.total;
        State.detailReviews.loading = false;
        updateDetailReviewsPanel(rows, meta);
    } catch (err) {
        State.detailReviews.loading = false;
        updateDetailReviewsPanel([], {}, { error: err.message || 'Failed to load customer reviews.' });
    }
}

var dispatchSuspendTargetId = null;

function getDispatchSuspendMode() {
    var checked = document.querySelector('input[name="dispatch-suspend-mode"]:checked');
    return checked ? checked.value : 'indefinite';
}

function syncDispatchSuspendModeUi() {
    var mode = getDispatchSuspendMode();
    var hoursWrap = document.getElementById('dispatch-suspend-hours-wrap');
    var untilWrap = document.getElementById('dispatch-suspend-until-wrap');
    if (hoursWrap) hoursWrap.classList.toggle('d-none', mode !== 'hours');
    if (untilWrap) untilWrap.classList.toggle('d-none', mode !== 'until');
}

function openDispatchSuspendModal(id) {
    dispatchSuspendTargetId = id;
    document.getElementById('dispatch-suspend-id').value = id;
    document.getElementById('dispatch-suspend-reason').value = '';
    document.getElementById('dispatch-suspend-hours').value = '72';
    document.getElementById('dispatch-suspend-until').value = '';
    document.getElementById('dispatch-suspend-error').classList.add('d-none');
    document.getElementById('dispatch-suspend-error').textContent = '';
    var indefinite = document.querySelector('input[name="dispatch-suspend-mode"][value="indefinite"]');
    if (indefinite) indefinite.checked = true;
    syncDispatchSuspendModeUi();
    var submitBtn = document.getElementById('dispatch-suspend-submit');
    submitBtn.disabled = false;
    submitBtn.textContent = 'Suspend Dispatch Matching';
    getBootstrap().Modal.getOrCreateInstance(document.getElementById('modal-dispatch-suspend')).show();
}

function buildDispatchSuspendPayload() {
    var reason = (document.getElementById('dispatch-suspend-reason').value || '').trim();
    var mode = getDispatchSuspendMode();
    var payload = { suspended: true };
    if (reason) payload.reason = reason;

    if (mode === 'hours') {
        var hours = parseInt(document.getElementById('dispatch-suspend-hours').value, 10);
        if (!hours || hours < 1 || hours > 720) {
            throw new Error('Duration must be between 1 and 720 hours.');
        }
        payload.durationHours = hours;
    } else if (mode === 'until') {
        var untilVal = document.getElementById('dispatch-suspend-until').value;
        if (!untilVal) throw new Error('Choose a date and time for auto-resume.');
        var untilDate = new Date(untilVal);
        if (Number.isNaN(untilDate.getTime())) throw new Error('Invalid date and time.');
        if (untilDate.getTime() <= Date.now()) throw new Error('Resume time must be in the future.');
        payload.until = untilDate.toISOString();
    }
    return payload;
}

async function submitDispatchSuspend() {
    var id = dispatchSuspendTargetId || document.getElementById('dispatch-suspend-id').value;
    if (!id) return;
    var errEl = document.getElementById('dispatch-suspend-error');
    var submitBtn = document.getElementById('dispatch-suspend-submit');
    errEl.classList.add('d-none');
    errEl.textContent = '';

    var payload;
    try {
        payload = buildDispatchSuspendPayload();
    } catch (validationErr) {
        errEl.textContent = validationErr.message || 'Invalid form values.';
        errEl.classList.remove('d-none');
        return;
    }

    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span> Suspending…';
    try {
        await Api.updateDispatch(id, payload);
        getBootstrap().Modal.getOrCreateInstance(document.getElementById('modal-dispatch-suspend')).hide();
        showAlert('Dispatch matching suspended', 'warning');
        openDetail(id);
        loadList();
    } catch (err) {
        errEl.textContent = err.message || 'Failed to suspend dispatch matching.';
        errEl.classList.remove('d-none');
        submitBtn.disabled = false;
        submitBtn.textContent = 'Suspend Dispatch Matching';
    }
}

async function toggleDispatchSuspended(id, isSuspended) {
    var suspended = isSuspended === 'true';
    if (!suspended) {
        openDispatchSuspendModal(id);
        return;
    }
    if (!confirm('Resume this beautician for dispatch matching? Any timed probation will be cancelled.')) return;
    var actions = document.getElementById('offcanvas-detail-actions');
    actions.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span> Updating…';
    try {
        await Api.updateDispatch(id, { suspended: false });
        openDetail(id);
        showAlert('Dispatch matching resumed', 'success');
        loadList();
    } catch (err) {
        actions.innerHTML = '<span class="text-danger small me-auto">' + (err.message || 'Failed.') + '</span><button class="btn btn-link link-secondary" data-bs-dismiss="offcanvas">Close</button>';
    }
}

// ── KYC Action handlers ────────────────────────────────────────────────────
async function handleKycApprove(id) {
    if (!confirm('Approve KYC for this beautician?')) return;
    var actions = document.getElementById('offcanvas-detail-actions');
    actions.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span> Processing…';
    try {
        await Api.approveKyc(id);
        openDetail(id);
        showAlert('KYC approved successfully', 'success');
        loadList();
    } catch (err) {
        actions.innerHTML = '<span class="text-danger small me-auto">' + (err.message || 'Failed.') + '</span><button class="btn btn-link link-secondary" data-bs-dismiss="offcanvas">Close</button>';
    }
}

async function handleKycReject(id) {
    var reason = prompt('Enter rejection reason:');
    if (!reason) return;
    var actions = document.getElementById('offcanvas-detail-actions');
    actions.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span> Processing…';
    try {
        await Api.rejectKyc(id, reason);
        openDetail(id);
        showAlert('KYC rejected', 'warning');
        loadList();
    } catch (err) {
        actions.innerHTML = '<span class="text-danger small me-auto">' + (err.message || 'Failed.') + '</span><button class="btn btn-link link-secondary" data-bs-dismiss="offcanvas">Close</button>';
    }
}

async function handleProfileApprove(id) {
    if (!confirm('Approve professional profile for this beautician?')) return;
    var actions = document.getElementById('offcanvas-detail-actions');
    actions.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span> Processing…';
    try {
        await Api.approveProfile(id);
        openDetail(id);
        showAlert('Profile approved successfully', 'success');
        loadList();
    } catch (err) {
        actions.innerHTML = '<span class="text-danger small me-auto">' + (err.message || 'Failed.') + '</span><button class="btn btn-link link-secondary" data-bs-dismiss="offcanvas">Close</button>';
    }
}

async function handleProfileReject(id) {
    var reason = prompt('Enter rejection reason:');
    if (!reason) return;
    var actions = document.getElementById('offcanvas-detail-actions');
    actions.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span> Processing…';
    try {
        await Api.rejectProfile(id, reason);
        openDetail(id);
        showAlert('Profile rejected', 'warning');
        loadList();
    } catch (err) {
        actions.innerHTML = '<span class="text-danger small me-auto">' + (err.message || 'Failed.') + '</span><button class="btn btn-link link-secondary" data-bs-dismiss="offcanvas">Close</button>';
    }
}

var accountSuspendTargetId = null;
var accountSuspendNewActive = false;

function openSuspendModal(id, isActive) {
    accountSuspendTargetId = id;
    // isActive string reflects current state; action flips it
    var currentlyActive = isActive === 'true';
    accountSuspendNewActive = !currentlyActive;

    document.getElementById('account-suspend-id').value = id;
    document.getElementById('account-suspend-new-active').value = accountSuspendNewActive ? 'true' : 'false';
    document.getElementById('account-suspend-error').classList.add('d-none');
    document.getElementById('account-suspend-error').textContent = '';

    var titleEl = document.getElementById('account-suspend-title');
    var leadEl = document.getElementById('account-suspend-lead');
    var noteEl = document.getElementById('account-suspend-note');
    var submitBtn = document.getElementById('account-suspend-submit');

    if (accountSuspendNewActive) {
        titleEl.textContent = 'Reactivate Account';
        leadEl.textContent = 'Reactivate this beautician account so they can use the app again?';
        noteEl.textContent = 'They can sign in again. To manage job offers only, use Suspend or Resume Dispatch Matching.';
        submitBtn.className = 'btn btn-success';
        submitBtn.disabled = false;
        submitBtn.textContent = 'Reactivate Account';
    } else {
        titleEl.textContent = 'Suspend Account';
        leadEl.textContent = 'Suspend this beautician account? They will be deactivated';
        noteEl.textContent = 'To block job offers without deactivating the account, use Suspend Dispatch Matching instead.';
        submitBtn.className = 'btn btn-danger';
        submitBtn.disabled = false;
        submitBtn.textContent = 'Suspend Account';
    }

    getBootstrap().Modal.getOrCreateInstance(document.getElementById('modal-account-suspend')).show();
}

async function submitAccountSuspend() {
    var id = accountSuspendTargetId || document.getElementById('account-suspend-id').value;
    if (!id) return;
    var newActive = accountSuspendNewActive;
    var errEl = document.getElementById('account-suspend-error');
    var submitBtn = document.getElementById('account-suspend-submit');
    errEl.classList.add('d-none');
    errEl.textContent = '';
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span> Saving…';
    try {
        await Api.updateBeautician(id, { isActive: newActive });
        getBootstrap().Modal.getOrCreateInstance(document.getElementById('modal-account-suspend')).hide();
        showAlert(newActive ? 'Beautician account reactivated' : 'Beautician account suspended', newActive ? 'success' : 'warning');
        loadList();
        openDetail(id);
    } catch (err) {
        errEl.textContent = err.message || 'Failed to update account.';
        errEl.classList.remove('d-none');
        submitBtn.disabled = false;
        submitBtn.textContent = newActive ? 'Reactivate Account' : 'Suspend Account';
    }
}

// ── Load reviews ──────────────────────────────────────────────────────────
async function loadReviews() {
    var tbody = document.getElementById('reviews-tbody');
    tbody.innerHTML = '<tr><td colspan="7" class="text-center py-5"><div class="spinner-border text-primary" role="status"></div></td></tr>';
    try {
        var result = await Api.getPendingProfileReviews({
            page: State.reviews.page,
            limit: State.reviews.limit,
            submittedDaysAgoMin: State.reviews.submittedDaysAgoMin,
        });
        var rows = result.data || [];
        var meta = result.meta || {};
        State.reviews.totalPages = meta.totalPages || 1;
        renderReviewsTable(rows, meta);
        renderPagination('reviews', meta);
    } catch (err) {
        tbody.innerHTML = '<tr><td colspan="8" class="text-center text-danger py-4">' + (err.message || 'Failed to load.') + '</td></tr>';
    }
}

// ── Load performance ──────────────────────────────────────────────────────
async function loadPerformance() {
    var periodDays = document.getElementById('perf-period-days').value;
    try {
        var data = await Api.getPerformance({ periodDays: periodDays });
        document.getElementById('perf-active').textContent = data.activeBeauticians ?? '—';
        document.getElementById('perf-online').textContent = data.onlineBeauticians ?? '—';
        document.getElementById('perf-jobs').textContent = data.completedJobs ?? '—';
        document.getElementById('perf-fill-rate').textContent = (data.fillRatePercent != null ? data.fillRatePercent.toFixed(1) : '—') + '%';
        document.getElementById('perf-avg-rating').textContent = data.avgRating != null ? data.avgRating.toFixed(1) : '—';
        document.getElementById('perf-kyc-rate').textContent = (data.kycPassRatePercent != null ? data.kycPassRatePercent.toFixed(1) : '—') + '%';
        document.getElementById('perf-profile-rate').textContent = (data.profileApprovalRatePercent != null ? data.profileApprovalRatePercent.toFixed(1) : '—') + '%';
    } catch (err) {
        console.warn('Performance load:', err);
    }
}

// ── Load services ─────────────────────────────────────────────────────────

async function loadBeauticianOptions() {
    var toggle = document.getElementById('svc-beautician-toggle');
    var searchInput = document.getElementById('svc-beautician-search');
    if (State.beauticianOptionsLoaded) {
        renderSvcBeauticianPicker(searchInput.value);
        return;
    }
    if (State.svcBeauticianOptionsLoading) return;

    State.svcBeauticianOptionsLoading = true;
    toggle.disabled = true;
    searchInput.disabled = true;
    setSvcBeauticianLabel('Loading beauticians…', true);
    renderSvcBeauticianPicker('');

    try {
        var result = await Api.listBeauticians({ page: 1, limit: 100, profileStatus: 'APPROVED' });
        State.svcBeauticianRows = result.data || [];
        State.beauticianOptionsLoaded = true;
        if (!State.svcBeauticianRows.length) {
            setSvcBeauticianLabel('— No approved beauticians —', true);
        } else {
            setSvcBeauticianSelection(getSvcBeauticianId());
        }
        renderSvcBeauticianPicker(searchInput.value);
    } catch (err) {
        State.svcBeauticianRows = [];
        State.beauticianOptionsLoaded = true;
        setSvcBeauticianLabel('— Failed to load beauticians —', true);
        renderSvcBeauticianPicker('');
        showAlert(err.message || 'Failed to load beautician list', 'danger');
    } finally {
        State.svcBeauticianOptionsLoading = false;
        toggle.disabled = false;
        searchInput.disabled = false;
    }
}

function initSvcBeauticianPicker() {
    var picker = document.getElementById('svc-beautician-picker');
    var toggle = document.getElementById('svc-beautician-toggle');
    var searchInput = document.getElementById('svc-beautician-search');
    var list = document.getElementById('svc-beautician-list');

    picker.addEventListener('shown.bs.dropdown', function () {
        if (!State.beauticianOptionsLoaded && !State.svcBeauticianOptionsLoading) {
            loadBeauticianOptions();
        } else {
            renderSvcBeauticianPicker(searchInput.value);
        }
        searchInput.focus();
        searchInput.select();
    });

    picker.addEventListener('hidden.bs.dropdown', function () {
        searchInput.value = '';
        renderSvcBeauticianPicker('');
    });

    searchInput.addEventListener('input', function () {
        renderSvcBeauticianPicker(this.value);
    });
    searchInput.addEventListener('click', function (e) { e.stopPropagation(); });
    searchInput.addEventListener('keydown', function (e) { e.stopPropagation(); });

    list.addEventListener('click', function (e) {
        var option = e.target.closest('.svc-beautician-option');
        if (!option) return;
        setSvcBeauticianSelection(option.dataset.id);
        renderSvcBeauticianPicker(searchInput.value);
        bootstrap.Dropdown.getOrCreateInstance(toggle).hide();
    });
}

async function loadServicesForBeautician() {
    var bId = getSvcBeauticianId();
    if (!bId) return;
    var area = document.getElementById('svc-assignment-area');
    var list = document.getElementById('svc-catalog-list');
    var selectAllWrap = document.getElementById('svc-select-all-wrap');
    list.innerHTML = '<div class="text-center py-4"><div class="spinner-border text-primary spinner-inline" role="status"></div> Loading…</div>';
    selectAllWrap.classList.add('d-none');
    area.classList.remove('d-none');
    area.classList.add('d-block');

    try {
        var allServices = await Api.getServices({ bookingType: 'HOME_SERVICE', status: 'ACTIVE' });
        var assigned = await Api.listAssignedServices(bId);
        var assignedIds = {};
        (assigned || []).forEach(function (a) {
            var sid = a.serviceId || (a.service && a.service.id);
            if (sid) assignedIds[sid] = true;
        });

        if (!Array.isArray(allServices) || !allServices.length) {
            list.innerHTML = '<div class="text-center text-secondary py-4">No active home-service catalog items available.</div>';
            return;
        }

        list.innerHTML = allServices.map(function (s) {
            var checked = assignedIds[s.id] ? 'checked' : '';
            return '<label class="service-check-label"><input type="checkbox" class="form-check-input svc-checkbox" value="' + s.id + '" ' + checked + '> <span>' + s.name + '</span> <span class="text-secondary ms-auto small">' + Services.formatMoney(s.homeServicePrice || 0) + '</span></label>';
        }).join('');
        selectAllWrap.classList.remove('d-none');
        updateSvcSelectedCount();

        list.querySelectorAll('.svc-checkbox').forEach(function (cb) {
            cb.addEventListener('change', updateSvcSelectedCount);
        });
    } catch (err) {
        list.innerHTML = '<div class="text-center text-danger py-4">' + (err.message || 'Failed to load services.') + '</div>';
    }
}

async function saveServiceAssignments() {
    if (!RBAC.can('beauticians:assign_services')) return;
    var bId = getSvcBeauticianId();
    if (!bId) return;
    var checked = document.querySelectorAll('.svc-checkbox:checked');
    var serviceIds = Array.from(checked).map(function (cb) { return cb.value; });
    var svcBtn = document.getElementById('btn-svc-save');
    setSaveButtonState(svcBtn, true, 'Save Assignments');
    try {
        await Api.assignServices(bId, serviceIds);
        showAlert('Services assigned successfully', 'success');
        loadServicesForBeautician();
    } catch (err) {
        showAlert(err.message || 'Failed to assign services', 'danger');
    } finally {
        setSaveButtonState(svcBtn, false, 'Save Assignments');
    }
}

// ── Load settings ─────────────────────────────────────────────────────────

async function loadDispatchSettings() {
    var canManage = RBAC.can('settings:manage');
    document.getElementById('btn-dispatch-settings-save').classList.toggle('d-none', !canManage);
    document.querySelectorAll('#card-dispatch-settings input:not([readonly]), #card-dispatch-settings select').forEach(function (el) {
        el.disabled = !canManage;
    });
    try {
        var d = await Api.getDispatchSettings();
        var tiers = d.tiers || [];
        applyDispatchTierValue(tiers, 1, 'radius', 'dispatch-tier-1-radius');
        applyDispatchTierValue(tiers, 1, 'ttl', 'dispatch-tier-1-ttl');
        applyDispatchTierValue(tiers, 2, 'radius', 'dispatch-tier-2-radius');
        applyDispatchTierValue(tiers, 2, 'ttl', 'dispatch-tier-2-ttl');
        applyDispatchTierValue(tiers, 3, 'radius', 'dispatch-tier-3-radius');
        applyDispatchTierValue(tiers, 3, 'ttl', 'dispatch-tier-3-ttl');
        document.getElementById('dispatch-inter-tier-delay').value = d.interTierDelaySeconds ?? '';
        document.getElementById('dispatch-location-staleness').value = d.locationStalenessMinutes ?? '';
        document.getElementById('dispatch-location-rematch').value = d.locationRematchMinDistanceM ?? '';
        document.getElementById('dispatch-wake-exhausted').checked = !!d.wakeExhaustedOnOnlineEnabled;
        var weights = d.scoringWeights || {};
        document.getElementById('dispatch-weight-distance').textContent = formatScoringWeight(weights.distance);
        document.getElementById('dispatch-weight-rating').textContent = formatScoringWeight(weights.rating);
        document.getElementById('dispatch-weight-acceptance').textContent = formatScoringWeight(weights.acceptanceRate);
        document.getElementById('dispatch-weight-idle').textContent = formatScoringWeight(weights.idleMinutes);
        var envEl = document.getElementById('dispatch-env-overrides');
        var env = d.envOverrides || {};
        var envParts = [];
        if (env.homeServiceMatchingRadiiKm != null) envParts.push('Radii env override active');
        if (env.dispatchOfferTtlSeconds != null) envParts.push('Offer TTL env override active');
        var envTextEl = document.getElementById('dispatch-env-overrides-text');
        if (envParts.length) {
            if (envTextEl) envTextEl.textContent = envParts.join(' · ');
            envEl.classList.remove('d-none');
        } else {
            if (envTextEl) envTextEl.textContent = '';
            envEl.classList.add('d-none');
        }
    } catch (err) {
        document.getElementById('dispatch-settings-error').textContent = err.message || 'Failed to load dispatch settings';
        document.getElementById('dispatch-settings-error').classList.remove('d-none');
    }
}

async function loadSettings() {
    var canManage = RBAC.can('settings:manage');
    document.getElementById('btn-settings-save').classList.toggle('d-none', !canManage);
    document.querySelectorAll('#card-home-service-settings input, #card-home-service-settings select').forEach(function (el) {
        el.disabled = !canManage;
    });
    document.getElementById('dispatch-settings-success').classList.add('d-none');
    document.getElementById('dispatch-settings-error').classList.add('d-none');
    document.getElementById('settings-success').classList.add('d-none');
    document.getElementById('settings-error').classList.add('d-none');
    try {
        var s = await Api.getHomeServiceSettings();
        document.getElementById('set-arrival-expiry').value = s.arrivalVerificationExpiryMinutes ?? '';
        document.getElementById('set-completion-buffer').value = s.serviceCompletionBufferMinutes ?? '';
        document.getElementById('set-geo-fence').value = s.arrivalGeoFenceMeters ?? '';
        document.getElementById('set-no-show-threshold').value = s.noShowSuspendThreshold ?? '';
        document.getElementById('set-no-show-window').value = s.noShowWindowDays ?? '';
        document.getElementById('set-payout-mode').value = s.payoutMode || 'MANUAL';
        document.getElementById('set-kyc-auto').checked = !!s.kycAutoApprove;
        document.getElementById('set-no-show-penalty').checked = !!s.noShowPenaltyEnabled;
        applyDailyLimitInputs(
            document.getElementById('set-daily-payout-limit'),
            document.getElementById('set-daily-payout-unlimited'),
            s.dailyPayoutLimit,
            canManage
        );
    } catch (err) {
        document.getElementById('settings-error').textContent = err.message || 'Failed to load settings';
        document.getElementById('settings-error').classList.remove('d-none');
    }
    await loadDispatchSettings();
}

/** Sync limit number input + unlimited checkbox from API value (null = unlimited). */

/** Read limit from unlimited checkbox + number input. Returns number|null or throws. */

async function saveDispatchSettings() {
    if (!RBAC.can('settings:manage')) return;
    var btn = document.getElementById('btn-dispatch-settings-save');
    var shouldReload = false;
    setSaveButtonState(btn, true, 'Save Dispatch Settings');
    document.getElementById('dispatch-settings-success').classList.add('d-none');
    document.getElementById('dispatch-settings-error').classList.add('d-none');
    try {
        var payload = {
            tiers: [
                {
                    tier: 1,
                    radiusKm: parseInt(document.getElementById('dispatch-tier-1-radius').value, 10) || undefined,
                    offerTtlSeconds: parseInt(document.getElementById('dispatch-tier-1-ttl').value, 10) || undefined,
                },
                {
                    tier: 2,
                    radiusKm: parseInt(document.getElementById('dispatch-tier-2-radius').value, 10) || undefined,
                    offerTtlSeconds: parseInt(document.getElementById('dispatch-tier-2-ttl').value, 10) || undefined,
                },
                {
                    tier: 3,
                    radiusKm: parseInt(document.getElementById('dispatch-tier-3-radius').value, 10) || undefined,
                    offerTtlSeconds: parseInt(document.getElementById('dispatch-tier-3-ttl').value, 10) || undefined,
                },
            ],
            interTierDelaySeconds: parseInt(document.getElementById('dispatch-inter-tier-delay').value, 10),
            locationStalenessMinutes: parseInt(document.getElementById('dispatch-location-staleness').value, 10),
            locationRematchMinDistanceM: parseInt(document.getElementById('dispatch-location-rematch').value, 10),
            wakeExhaustedOnOnlineEnabled: document.getElementById('dispatch-wake-exhausted').checked,
        };
        await Api.updateDispatchSettings(payload);
        document.getElementById('dispatch-settings-success').textContent = 'Dispatch settings saved successfully';
        document.getElementById('dispatch-settings-success').classList.remove('d-none');
        shouldReload = true;
    } catch (err) {
        document.getElementById('dispatch-settings-error').textContent = err.message || 'Failed to save dispatch settings';
        document.getElementById('dispatch-settings-error').classList.remove('d-none');
    } finally {
        setSaveButtonState(btn, false, 'Save Dispatch Settings');
    }
    if (shouldReload) loadDispatchSettings();
}

async function saveSettings() {
    if (!RBAC.can('settings:manage')) return;
    var btn = document.getElementById('btn-settings-save');
    setSaveButtonState(btn, true, 'Save Home Service Settings');
    document.getElementById('settings-success').classList.add('d-none');
    document.getElementById('settings-error').classList.add('d-none');
    try {
        var dailyPayoutLimit = readDailyLimitFromInputs(
            document.getElementById('set-daily-payout-limit'),
            document.getElementById('set-daily-payout-unlimited')
        );
        var payload = {
            arrivalVerificationExpiryMinutes: parseInt(document.getElementById('set-arrival-expiry').value, 10) || undefined,
            serviceCompletionBufferMinutes: parseInt(document.getElementById('set-completion-buffer').value, 10) || undefined,
            arrivalGeoFenceMeters: parseInt(document.getElementById('set-geo-fence').value, 10) || undefined,
            noShowSuspendThreshold: parseInt(document.getElementById('set-no-show-threshold').value, 10) || undefined,
            noShowWindowDays: parseInt(document.getElementById('set-no-show-window').value, 10) || undefined,
            payoutMode: document.getElementById('set-payout-mode').value,
            dailyPayoutLimit: dailyPayoutLimit,
            kycAutoApprove: document.getElementById('set-kyc-auto').checked,
            noShowPenaltyEnabled: document.getElementById('set-no-show-penalty').checked,
        };
        await Api.updateHomeServiceSettings(payload);
        document.getElementById('settings-success').textContent = 'Settings saved successfully';
        document.getElementById('settings-success').classList.remove('d-none');
        setTimeout(function () { document.getElementById('settings-success').classList.add('d-none'); }, 3000);
    } catch (err) {
        document.getElementById('settings-error').textContent = err.message || 'Failed to save settings';
        document.getElementById('settings-error').classList.remove('d-none');
    } finally {
        setSaveButtonState(btn, false, 'Save Home Service Settings');
    }
}

// ── Service Rates tab (default share + per-service overrides) ────────────

async function loadDefaultBeauticianShare() {
    var canManage = RBAC.can('settings:manage');
    var input = document.getElementById('scr-default-rate');
    var saveBtn = document.getElementById('btn-scr-default-save');
    if (saveBtn) saveBtn.classList.toggle('d-none', !canManage);
    if (input) input.disabled = !canManage;

    document.getElementById('scr-default-success').classList.add('d-none');
    document.getElementById('scr-default-error').classList.add('d-none');

    try {
        var s = await Api.getHomeServiceSettings();
        var rate = s && s.commissionRate;
        State.scr.platformDefaultRate = rate;
        input.value = commissionRateToPercent(rate);
    } catch (err) {
        showScrDefaultAlert('error', err.message || 'Failed to load default beautician share');
    }
}

async function saveDefaultBeauticianShare() {
    if (!RBAC.can('settings:manage')) return;
    var btn = document.getElementById('btn-scr-default-save');
    var pctRaw = document.getElementById('scr-default-rate').value;
    var rate = commissionPercentToRate(pctRaw);

    document.getElementById('scr-default-success').classList.add('d-none');
    document.getElementById('scr-default-error').classList.add('d-none');

    if (rate == null || rate < 0 || rate > 1) {
        showScrDefaultAlert('error', 'Enter a beautician share between 0 and 100%.');
        return;
    }

    setSaveButtonState(btn, true, 'Save Default Share');
    try {
        // Partial update — only commissionRate via home-service settings API
        await Api.updateHomeServiceSettings({ commissionRate: rate });
        State.scr.platformDefaultRate = rate;
        document.getElementById('scr-default-rate').value = commissionRateToPercent(rate);
        showScrDefaultAlert('success', 'Default beautician share saved');
    } catch (err) {
        showScrDefaultAlert('error', err.message || 'Failed to save default share');
    } finally {
        setSaveButtonState(btn, false, 'Save Default Share');
    }
}

async function ensureScrCatalogLoaded() {
    if (State.scr.catalogLoaded) return State.scr.catalogServices || [];
    if (State.scr.catalogLoadPromise) return State.scr.catalogLoadPromise;

    State.scr.catalogLoading = true;
    State.scr.catalogLoadPromise = (async function () {
        try {
            var home = [];
            try {
                home = await Api.getServices({ bookingType: 'HOME_SERVICE', status: 'ACTIVE' });
            } catch (_) { home = []; }
            if (!home || !home.length) {
                home = await Api.getServices({ status: 'ACTIVE' });
            }
            State.scr.catalogServices = Array.isArray(home) ? home : [];
        } catch (_) {
            State.scr.catalogServices = [];
        } finally {
            State.scr.catalogLoaded = true;
            State.scr.catalogLoading = false;
            State.scr.catalogLoadPromise = null;
        }
        return State.scr.catalogServices || [];
    })();

    return State.scr.catalogLoadPromise;
}

async function loadServiceCommissionOverrides() {
    var canManage = RBAC.can('settings:manage');
    var addBtn = document.getElementById('btn-scr-add');
    if (addBtn) addBtn.classList.toggle('d-none', !canManage);

    document.getElementById('scr-success').classList.add('d-none');
    document.getElementById('scr-error').classList.add('d-none');
    document.getElementById('scr-tbody').innerHTML =
        '<tr><td colspan="5" class="text-center text-secondary py-4">' +
        '<span class="spinner-border spinner-border-sm me-2" role="status"></span>Loading…</td></tr>';

    try {
        var results = await Promise.all([
            Api.listServiceCommissionRates(),
            ensureScrCatalogLoaded(),
        ]);
        var list = results[0];
        State.scr.overrides = (list || []).slice().sort(function (a, b) {
            return String(a.serviceName || '').localeCompare(String(b.serviceName || ''));
        });
        renderServiceCommissionRows(State.scr.overrides);
    } catch (err) {
        document.getElementById('scr-tbody').innerHTML =
            '<tr><td colspan="5" class="text-center text-danger py-4">' +
            escHtml(err.message || 'Failed to load overrides') + '</td></tr>';
        showScrAlert('error', err.message || 'Failed to load service commission overrides');
    }
}

/** Load full Service Rates tab: default share + overrides (separate APIs). */
async function loadServiceCommissionRates() {
    await Promise.all([
        loadDefaultBeauticianShare(),
        loadServiceCommissionOverrides(),
    ]);
}

/**
 * Keep percent fields to digits + optional decimal only, capped at 100.
 * @returns {string} sanitized value
 */

function onScrRateInput(e) {
    var el = e.target;
    var start = el.selectionStart;
    var before = el.value;
    var cleaned = sanitizePercentInputValue(before);
    if (cleaned !== before) {
        el.value = cleaned;
        // Best-effort caret restore
        if (typeof start === 'number') {
            var delta = before.length - cleaned.length;
            var pos = Math.max(0, start - delta);
            try { el.setSelectionRange(pos, pos); } catch (_) { /* ignore */ }
        }
    }
    updateScrEarningsPreview();
}

async function loadScrServiceOptions() {
    var toggle = document.getElementById('scr-service-toggle');
    var searchInput = document.getElementById('scr-service-search');
    if (State.scr.catalogLoaded) {
        renderScrServicePicker(searchInput.value);
        return;
    }

    toggle.disabled = true;
    searchInput.disabled = true;
    setScrServiceLabel('Loading services…', true);
    renderScrServicePicker('');

    try {
        await ensureScrCatalogLoaded();
        if (!getScrAvailableServices().length) {
            setScrServiceLabel('— No services available —', true);
        } else {
            setScrServiceSelection(getScrServiceId());
        }
        renderScrServicePicker(searchInput.value);
    } catch (err) {
        setScrServiceLabel('— Failed to load services —', true);
        renderScrServicePicker('');
        var errEl = document.getElementById('scr-modal-error');
        if (errEl) {
            errEl.textContent = err.message || 'Failed to load catalog services';
            errEl.classList.remove('d-none');
        }
    } finally {
        toggle.disabled = false;
        searchInput.disabled = false;
    }
}

function initScrServicePicker() {
    var picker = document.getElementById('scr-service-picker');
    var toggle = document.getElementById('scr-service-toggle');
    var searchInput = document.getElementById('scr-service-search');
    var list = document.getElementById('scr-service-list');
    if (!picker) return;

    picker.addEventListener('shown.bs.dropdown', function () {
        if (!State.scr.catalogLoaded && !State.scr.catalogLoading) {
            loadScrServiceOptions();
        } else {
            renderScrServicePicker(searchInput.value);
        }
        searchInput.focus();
        searchInput.select();
    });

    picker.addEventListener('hidden.bs.dropdown', function () {
        searchInput.value = '';
        renderScrServicePicker('');
    });

    searchInput.addEventListener('input', function () {
        renderScrServicePicker(this.value);
    });
    searchInput.addEventListener('click', function (e) { e.stopPropagation(); });
    searchInput.addEventListener('keydown', function (e) { e.stopPropagation(); });

    list.addEventListener('click', function (e) {
        var option = e.target.closest('.scr-service-option');
        if (!option) return;
        setScrServiceSelection(option.dataset.id);
        renderScrServicePicker(searchInput.value);
        bootstrap.Dropdown.getOrCreateInstance(toggle).hide();
    });
}

async function saveServiceCommissionOverride(e) {
    e.preventDefault();
    if (!RBAC.can('settings:manage')) return;

    var errEl = document.getElementById('scr-modal-error');
    errEl.classList.add('d-none');
    var editId = document.getElementById('scr-edit-service-id').value.trim();
    var serviceId = editId || getScrServiceId().trim();
    var rateEl = document.getElementById('scr-rate-input');
    rateEl.value = sanitizePercentInputValue(rateEl.value);
    var pctRaw = rateEl.value;
    var rate = commissionPercentToRate(pctRaw);

    if (!serviceId) {
        errEl.textContent = 'Select a service.';
        errEl.classList.remove('d-none');
        return;
    }
    if (pctRaw === '' || rate == null || rate < 0 || rate > 1) {
        errEl.textContent = 'Enter a beautician share between 0 and 100%.';
        errEl.classList.remove('d-none');
        return;
    }

    var btn = document.getElementById('btn-scr-save');
    setSaveButtonState(btn, true, 'Save Override');
    try {
        await Api.setServiceCommissionRate(serviceId, rate);
        bootstrap.Modal.getInstance(document.getElementById('modal-service-commission')).hide();
        showScrAlert('success', 'Service commission override saved');
        await loadServiceCommissionOverrides();
    } catch (err) {
        errEl.textContent = err.message || 'Failed to save override';
        errEl.classList.remove('d-none');
    } finally {
        setSaveButtonState(btn, false, 'Save Override');
    }
}

async function removeServiceCommissionOverride(serviceId, serviceName) {
    if (!RBAC.can('settings:manage') || !serviceId) return;
    var label = serviceName || 'this service';
    if (!window.confirm('Remove custom rate for “' + label + '”? It will use the platform default beautician share again.')) {
        return;
    }
    try {
        await Api.deleteServiceCommissionRate(serviceId);
        showScrAlert('success', 'Override removed — service uses platform default');
        await loadServiceCommissionOverrides();
    } catch (err) {
        showScrAlert('error', err.message || 'Failed to remove override');
    }
}

async function loadDailyPayoutPool() {
    document.getElementById('daily-pool-error').classList.add('d-none');
    if (!RBAC.can('beauticians:process_payouts')) {
        document.getElementById('card-daily-payout-pool').classList.add('d-none');
        return;
    }
    document.getElementById('card-daily-payout-pool').classList.remove('d-none');
    try {
        var pool = await Api.getDailyPayoutPool();
        renderDailyPoolStats(pool || {});
    } catch (err) {
        document.getElementById('daily-pool-error').textContent = err.message || 'Failed to load daily payout pool';
        document.getElementById('daily-pool-error').classList.remove('d-none');
        document.getElementById('daily-pool-used').textContent = '—';
        document.getElementById('daily-pool-remaining').textContent = '—';
        document.getElementById('daily-pool-limit').textContent = '—';
        document.getElementById('daily-pool-status-badge').innerHTML =
            '<span class="badge bg-danger-lt">Error</span>';
    }
}

async function saveDailyPayoutLimit() {
    if (!RBAC.can('settings:manage')) return;
    var btn = document.getElementById('btn-daily-pool-save');
    document.getElementById('daily-pool-success').classList.add('d-none');
    document.getElementById('daily-pool-error').classList.add('d-none');
    setSaveButtonState(btn, true, 'Save limit');
    try {
        var dailyPayoutLimit = readDailyLimitFromInputs(
            document.getElementById('pool-limit-input'),
            document.getElementById('pool-limit-unlimited')
        );
        await Api.updateHomeServiceSettings({ dailyPayoutLimit: dailyPayoutLimit });
        document.getElementById('daily-pool-success').textContent =
            dailyPayoutLimit === null
                ? 'Daily payout limit cleared (unlimited).'
                : 'Daily payout limit set to ' + Beauticians.formatMoney(dailyPayoutLimit) + '.';
        document.getElementById('daily-pool-success').classList.remove('d-none');
        setTimeout(function () {
            document.getElementById('daily-pool-success').classList.add('d-none');
        }, 3000);
        await loadDailyPayoutPool();
    } catch (err) {
        document.getElementById('daily-pool-error').textContent = err.message || 'Failed to save daily payout limit';
        document.getElementById('daily-pool-error').classList.remove('d-none');
    } finally {
        setSaveButtonState(btn, false, 'Save limit');
    }
}

// ── Load payouts ──────────────────────────────────────────────────────────
async function loadPayouts() {
    var tbody = document.getElementById('payouts-tbody');
    tbody.innerHTML = '<tr><td colspan="8" class="text-center py-5"><div class="spinner-border text-primary" role="status"></div></td></tr>';
    document.getElementById('payouts-count-label').textContent = 'Loading…';
    loadDailyPayoutPool();
    try {
        var params = {};
        if (State.payouts.status) params.status = State.payouts.status;
        var rows = await Api.listPayouts(params);
        if (!rows.length) {
            var emptyMsg = State.payouts.status
                ? 'No ' + State.payouts.status.toLowerCase().replace(/_/g, ' ') + ' payout requests.'
                : 'No payout requests found.';
            tbody.innerHTML = '<tr><td colspan="8" class="text-center text-secondary py-5">' + emptyMsg + '</td></tr>';
            document.getElementById('payouts-count-label').textContent = payoutsCountLabel(0);
            return;
        }
        document.getElementById('payouts-count-label').textContent = payoutsCountLabel(rows.length);
        tbody.innerHTML = rows.map(function (p, i) {
            var b = p.beautician || {};
            var name = [b.firstName, b.lastName].filter(Boolean).join(' ') || '—';
            var dob = Beauticians.formatDateOfBirth(b);
            var beauticianMeta = [b.email || '', dob !== '—' ? 'Born ' + dob : ''].filter(Boolean).join('<br>');
            var status = (p.status || '').toUpperCase();
            var actionCell = status === 'PENDING' && RBAC.can('beauticians:process_payouts')
                ? '<button class="btn btn-success btn-sm btn-process-payout" data-id="' + p.id + '" data-amount="' + p.amount + '">Process</button>'
                : '<span class="text-secondary small">—</span>';
            return '<tr class="payout-row">' +
                '<td class="text-secondary small">' + (i + 1) + '</td>' +
                '<td><div class="fw-semibold">' + name + '</div><div class="text-secondary small">' + (beauticianMeta || '—') + '</div></td>' +
                '<td class="fw-semibold text-success">' + Beauticians.formatMoney(p.amount) + '</td>' +
                '<td>' + Beauticians.payoutStatusBadge(p.status) + '</td>' +
                '<td>' + (p.bankName || p.bankCode || '—') + '</td>' +
                '<td class="font-monospace small">' + (p.accountNumber || '—') + '<br><span class="text-secondary">' + (p.accountName || '') + '</span></td>' +
                '<td class="text-secondary small">' + Beauticians.formatDateTime(p.createdAt) + '</td>' +
                '<td>' + actionCell + '</td>' +
                '</tr>';
        }).join('');
    } catch (err) {
        tbody.innerHTML = '<tr><td colspan="8" class="text-center text-danger py-4">' + (err.message || 'Failed to load.') + '</td></tr>';
        document.getElementById('payouts-count-label').textContent = 'Error';
    }
}

async function handleProcessPayout(btn, payoutRequestId, amount) {
    if (!RBAC.can('beauticians:process_payouts')) return;
    if (!confirm('Process payout of ' + Beauticians.formatMoney(amount) + '? This will debit the beautician\'s wallet.')) return;
    setSaveButtonState(btn, true, 'Process');
    var responded = false;
    try {
        var result = await Api.processPayout(payoutRequestId);
        responded = true;
        showAlert('Payout processed successfully. Ref: ' + (result.reference || ''), 'success');
    } catch (err) {
        responded = true;
        showAlert(err.message || 'Failed to process payout', 'danger');
    } finally {
        setSaveButtonState(btn, false, 'Process');
    }
    if (responded) await loadPayouts();
}

// ── DOMContentLoaded ──────────────────────────────────────────────────────
function init() {
    RBAC.fetchMe().then(function () {
        RBAC.applyPageGuardForCurrentPage();
        RBAC.applyNavVisibility();
        applyPerformanceVisibility();
        applyTabVisibility();
        if (RBAC.can('beauticians:read')) loadPerformance();
        applySectionFromHash();
    });

    // ── Tab switching ─────────────────────────────────────────────────────
    document.getElementById('section-tabs').addEventListener('click', function (e) {
        e.preventDefault();
        var tab = e.target.closest('a[data-section]');
        if (!tab) return;
        switchSection(tab.dataset.section, true);
    });
    window.addEventListener('hashchange', applySectionFromHash);

    applyPerformanceVisibility();
    applyTabVisibility();
    if (RBAC.can('beauticians:read')) loadPerformance();
    if (!window.location.hash || window.location.hash.replace(/^#/, '').toLowerCase() === 'performance') {
        switchSection(firstAccessibleSection(), true);
    } else {
        applySectionFromHash();
    }

    // ── Refresh button ────────────────────────────────────────────────────
    document.getElementById('btn-refresh').addEventListener('click', refreshPage);

    // ── Beautician list ───────────────────────────────────────────────────
    var listSearchTimer;
    document.getElementById('list-search').addEventListener('input', function () {
        clearTimeout(listSearchTimer);
        var val = this.value.trim();
        listSearchTimer = setTimeout(function () {
            State.list.search = val;
            State.list.page = 1;
            loadList();
        }, 400);
    });
    document.getElementById('list-kyc-status').addEventListener('change', function () {
        State.list.kycStatus = this.value;
        State.list.page = 1;
        loadList();
    });
    document.getElementById('list-profile-status').addEventListener('change', function () {
        State.list.profileStatus = this.value;
        State.list.page = 1;
        loadList();
    });
    document.getElementById('list-avail-status').addEventListener('change', function () {
        State.list.availabilityStatus = this.value;
        State.list.page = 1;
        loadList();
    });
    document.getElementById('list-rating-min').addEventListener('change', function () {
        State.list.ratingMin = this.value;
        State.list.page = 1;
        loadList();
    });
    document.getElementById('btn-list-clear').addEventListener('click', function () {
        document.getElementById('list-search').value = '';
        document.getElementById('list-kyc-status').value = '';
        document.getElementById('list-profile-status').value = '';
        document.getElementById('list-avail-status').value = '';
        document.getElementById('list-rating-min').value = '';
        State.list.search = '';
        State.list.kycStatus = '';
        State.list.profileStatus = '';
        State.list.availabilityStatus = '';
        State.list.ratingMin = '';
        State.list.page = 1;
        loadList();
    });

    // List pagination
    document.getElementById('list-pagination-btns').addEventListener('click', function (e) {
        e.preventDefault();
        var a = e.target.closest('a[data-page]');
        if (!a) return;
        var p = parseInt(a.dataset.page, 10);
        if (p < 1 || p > State.list.totalPages) return;
        State.list.page = p;
        loadList();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    // Profile photo & certification preview (delegated from detail offcanvas)
    document.getElementById('offcanvas-detail-body').addEventListener('click', function (e) {
        var photoBtn = e.target.closest('.btn-view-photo');
        if (photoBtn) {
            e.preventDefault();
            openPhotoPreview(photoBtn.dataset.url, photoBtn.dataset.name);
            return;
        }
        var certBtn = e.target.closest('.btn-view-certification');
        if (certBtn) {
            e.preventDefault();
            openCertificationPreview(certBtn.dataset.url, certBtn.dataset.title);
        }
    });
    document.getElementById('offcanvas-detail-body').addEventListener('keydown', function (e) {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        var photoBtn = e.target.closest('.btn-view-photo');
        if (photoBtn) {
            e.preventDefault();
            openPhotoPreview(photoBtn.dataset.url, photoBtn.dataset.name);
            return;
        }
        var certBtn = e.target.closest('.btn-view-certification');
        if (certBtn) {
            e.preventDefault();
            openCertificationPreview(certBtn.dataset.url, certBtn.dataset.title);
        }
    });

    // List open detail (delegated)
    document.getElementById('list-tbody').addEventListener('click', function (e) {
        var btn = e.target.closest('.open-detail-btn');
        if (btn) {
            e.stopPropagation();
            openDetail(btn.dataset.id);
            return;
        }
        var row = e.target.closest('.beautician-row');
        if (row) openDetail(row.dataset.id);
    });

    // ── Reviews ───────────────────────────────────────────────────────────
    document.getElementById('btn-reviews-apply').addEventListener('click', function () {
        State.reviews.submittedDaysAgoMin = document.getElementById('reviews-days-min').value;
        State.reviews.page = 1;
        loadReviews();
    });

    document.getElementById('reviews-pagination-btns').addEventListener('click', function (e) {
        e.preventDefault();
        var a = e.target.closest('a[data-page]');
        if (!a) return;
        var p = parseInt(a.dataset.page, 10);
        if (p < 1 || p > State.reviews.totalPages) return;
        State.reviews.page = p;
        loadReviews();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    // Reviews open detail
    document.getElementById('reviews-tbody').addEventListener('click', function (e) {
        var btn = e.target.closest('.open-detail-btn');
        if (btn) openDetail(btn.dataset.id);
    });

    // ── Performance ───────────────────────────────────────────────────────
    document.getElementById('perf-period-days').addEventListener('change', loadPerformance);

    // ── Services ──────────────────────────────────────────────────────────
    initSvcBeauticianPicker();
    document.getElementById('btn-svc-load').addEventListener('click', loadServicesForBeautician);
    document.getElementById('btn-svc-save').addEventListener('click', saveServiceAssignments);
    document.getElementById('svc-select-all').addEventListener('change', function () {
        var checked = this.checked;
        document.querySelectorAll('.svc-checkbox').forEach(function (cb) {
            cb.checked = checked;
        });
        updateSvcSelectedCount();
    });
    if (!RBAC.can('beauticians:assign_services')) {
        document.getElementById('btn-svc-save').classList.add('d-none');
    }

    // ── Settings ──────────────────────────────────────────────────────────
    initSettingsFieldHints();
    document.getElementById('btn-settings-save').addEventListener('click', saveSettings);
    document.getElementById('btn-dispatch-settings-save').addEventListener('click', saveDispatchSettings);
    document.getElementById('set-daily-payout-unlimited').addEventListener('change', function () {
        onUnlimitedToggle(
            document.getElementById('set-daily-payout-limit'),
            document.getElementById('set-daily-payout-unlimited')
        );
    });

    // Service Rates tab
    initScrServicePicker();
    document.getElementById('btn-scr-default-save').addEventListener('click', saveDefaultBeauticianShare);
    document.getElementById('scr-rate-input').addEventListener('input', onScrRateInput);
    document.getElementById('scr-rate-input').addEventListener('paste', function (e) {
        e.preventDefault();
        var text = (e.clipboardData || window.clipboardData).getData('text') || '';
        var cleaned = sanitizePercentInputValue(text);
        var el = e.target;
        el.value = cleaned;
        updateScrEarningsPreview();
    });
    // Block non-numeric keystrokes (allow control keys, arrows, one dot)
    document.getElementById('scr-rate-input').addEventListener('keydown', function (e) {
        if (e.ctrlKey || e.metaKey || e.altKey) return;
        var allowed = ['Backspace', 'Delete', 'Tab', 'Escape', 'Enter', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'];
        if (allowed.indexOf(e.key) !== -1) return;
        if (e.key === '.' && e.target.value.indexOf('.') === -1) return;
        if (/^\d$/.test(e.key)) return;
        e.preventDefault();
    });
    document.getElementById('form-service-commission').addEventListener('submit', saveServiceCommissionOverride);
    document.getElementById('modal-service-commission').addEventListener('show.bs.modal', function () {
        if (!document.getElementById('scr-edit-service-id').value) {
            openScrModalForAdd();
            if (!State.scr.catalogLoaded) loadScrServiceOptions();
        }
    });
    document.getElementById('modal-service-commission').addEventListener('hidden.bs.modal', function () {
        document.getElementById('scr-edit-service-id').value = '';
        document.getElementById('scr-modal-error').classList.add('d-none');
        document.getElementById('scr-rate-input').value = '';
        State.scr.editServicePrice = null;
        setScrServiceSelection('');
        document.getElementById('scr-service-search').value = '';
        document.getElementById('scr-earnings-preview').classList.add('d-none');
    });
    document.getElementById('scr-tbody').addEventListener('click', function (e) {
        var editBtn = e.target.closest('.btn-scr-edit');
        if (editBtn) {
            openScrModalForEdit(
                editBtn.dataset.serviceId,
                editBtn.dataset.serviceName,
                editBtn.dataset.rate,
                editBtn.dataset.servicePrice
            );
            bootstrap.Modal.getOrCreateInstance(document.getElementById('modal-service-commission')).show();
            return;
        }
        var removeBtn = e.target.closest('.btn-scr-remove');
        if (removeBtn) {
            removeServiceCommissionOverride(removeBtn.dataset.serviceId, removeBtn.dataset.serviceName);
        }
    });
    document.getElementById('btn-scr-add').addEventListener('click', function () {
        document.getElementById('scr-edit-service-id').value = '';
        openScrModalForAdd();
    });

    // ── Payouts ───────────────────────────────────────────────────────────
    document.getElementById('payouts-status-filter').addEventListener('change', function () {
        State.payouts.status = this.value;
        loadPayouts();
    });
    document.getElementById('payouts-tbody').addEventListener('click', function (e) {
        var btn = e.target.closest('.btn-process-payout');
        if (btn) handleProcessPayout(btn, btn.dataset.id, btn.dataset.amount);
    });
    document.getElementById('btn-daily-pool-refresh').addEventListener('click', loadDailyPayoutPool);
    document.getElementById('btn-daily-pool-save').addEventListener('click', saveDailyPayoutLimit);
    document.getElementById('pool-limit-unlimited').addEventListener('change', function () {
        onUnlimitedToggle(
            document.getElementById('pool-limit-input'),
            document.getElementById('pool-limit-unlimited')
        );
    });

    // ── Dispatch suspend probation modal ──────────────────────────────────
    document.querySelectorAll('input[name="dispatch-suspend-mode"]').forEach(function (radio) {
        radio.addEventListener('change', syncDispatchSuspendModeUi);
    });
    var dispatchSuspendSubmit = document.getElementById('dispatch-suspend-submit');
    if (dispatchSuspendSubmit) {
        dispatchSuspendSubmit.addEventListener('click', submitDispatchSuspend);
    }

    // ── Account suspend modal ─────────────────────────────────────────────
    var accountSuspendSubmit = document.getElementById('account-suspend-submit');
    if (accountSuspendSubmit) {
        accountSuspendSubmit.addEventListener('click', submitAccountSuspend);
    }

    // ── Detail offcanvas: customer reviews controls (delegated) ───────────
    var detailBody = document.getElementById('offcanvas-detail-body');
    if (detailBody) {
        detailBody.addEventListener('change', function (e) {
            if (!e.target || e.target.id !== 'detail-reviews-sort') return;
            var parts = String(e.target.value || 'createdAt:desc').split(':');
            State.detailReviews.sortBy = parts[0] || 'createdAt';
            State.detailReviews.sortOrder = parts[1] || 'desc';
            State.detailReviews.page = 1;
            loadDetailReviews();
        });
        detailBody.addEventListener('click', function (e) {
            var refreshBtn = e.target.closest('#detail-reviews-refresh');
            if (refreshBtn) {
                e.preventDefault();
                loadDetailReviews();
                return;
            }
            var pageLink = e.target.closest('a[data-detail-reviews-page]');
            if (pageLink) {
                e.preventDefault();
                if (pageLink.closest('.disabled') || pageLink.closest('.page-item.disabled')) return;
                var page = parseInt(pageLink.getAttribute('data-detail-reviews-page'), 10);
                if (!page || page < 1) return;
                var maxPage = State.detailReviews.totalPages || 1;
                if (page > maxPage) return;
                State.detailReviews.page = page;
                loadDetailReviews();
            }
        });
    }
}

    


    BP.Handlers = {
        refreshPage: refreshPage,
        refreshCurrentSection: refreshCurrentSection,
        switchSection: switchSection,
        applySectionFromHash: applySectionFromHash,
        loadList: loadList,
        openDetail: openDetail,
        loadDetailReviews: loadDetailReviews,
        toggleDispatchSuspended: toggleDispatchSuspended,
        openDispatchSuspendModal: openDispatchSuspendModal,
        submitDispatchSuspend: submitDispatchSuspend,
        syncDispatchSuspendModeUi: syncDispatchSuspendModeUi,
        handleKycApprove: handleKycApprove,
        handleKycReject: handleKycReject,
        handleProfileApprove: handleProfileApprove,
        handleProfileReject: handleProfileReject,
        openSuspendModal: openSuspendModal,
        submitAccountSuspend: submitAccountSuspend,
        loadReviews: loadReviews,
        loadPerformance: loadPerformance,
        loadBeauticianOptions: loadBeauticianOptions,
        initSvcBeauticianPicker: initSvcBeauticianPicker,
        loadServicesForBeautician: loadServicesForBeautician,
        saveServiceAssignments: saveServiceAssignments,
        loadDispatchSettings: loadDispatchSettings,
        loadSettings: loadSettings,
        saveDispatchSettings: saveDispatchSettings,
        saveSettings: saveSettings,
        loadDefaultBeauticianShare: loadDefaultBeauticianShare,
        saveDefaultBeauticianShare: saveDefaultBeauticianShare,
        ensureScrCatalogLoaded: ensureScrCatalogLoaded,
        loadServiceCommissionOverrides: loadServiceCommissionOverrides,
        loadServiceCommissionRates: loadServiceCommissionRates,
        onScrRateInput: onScrRateInput,
        loadScrServiceOptions: loadScrServiceOptions,
        initScrServicePicker: initScrServicePicker,
        saveServiceCommissionOverride: saveServiceCommissionOverride,
        removeServiceCommissionOverride: removeServiceCommissionOverride,
        loadDailyPayoutPool: loadDailyPayoutPool,
        saveDailyPayoutLimit: saveDailyPayoutLimit,
        loadPayouts: loadPayouts,
        handleProcessPayout: handleProcessPayout,
        init: init
    };

    // Detail action buttons use inline onclick="…" — expose handlers on window
    global.handleKycApprove = handleKycApprove;
    global.handleKycReject = handleKycReject;
    global.handleProfileApprove = handleProfileApprove;
    global.handleProfileReject = handleProfileReject;
    global.openSuspendModal = openSuspendModal;
    global.submitAccountSuspend = submitAccountSuspend;
    global.toggleDispatchSuspended = toggleDispatchSuspended;
    global.openDispatchSuspendModal = openDispatchSuspendModal;
    global.submitDispatchSuspend = submitDispatchSuspend;
    global.loadDetailReviews = loadDetailReviews;
})(window);
