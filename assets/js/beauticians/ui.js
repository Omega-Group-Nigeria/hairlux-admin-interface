/**
 * beauticians/ui.js — DOM rendering and presentation helpers
 */
(function (global) {
    'use strict';

    var BP = (global.BeauticiansPage = global.BeauticiansPage || {});
    var State = BP.State;
    var Utils = BP.Utils;
    var bootstrap = global.tabler && global.tabler.bootstrap;

    // Local aliases so extracted functions keep their original bare call style
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

function initSettingsFieldHints() {
    document.querySelectorAll('#section-settings [data-field-hint], #section-service-rates [data-field-hint]').forEach(function (el) {
        if (el.dataset.hintReady === '1') return;
        var hint = State.SETTINGS_FIELD_HINTS[el.dataset.fieldHint];
        if (!hint) return;

        if (el.classList.contains('form-check-label')) {
            el.classList.add('d-inline-flex', 'align-items-center', 'gap-1', 'flex-wrap');
        } else if (el.classList.contains('form-label') || el.classList.contains('settings-scoring-label')) {
            el.classList.add('d-flex', 'align-items-center', 'gap-1');
        }

        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'btn btn-link btn-sm p-0 lh-1 settings-hint-btn';
        btn.setAttribute('aria-label', 'Show field hint');
        btn.innerHTML = State.SETTINGS_HINT_ICON;
        el.appendChild(btn);

        bootstrap.Popover.getOrCreateInstance(btn, {
            trigger: 'focus',
            placement: 'top',
            container: 'body',
            customClass: 'settings-field-popover',
            content: hint,
            sanitize: true,
        });

        el.dataset.hintReady = '1';
    });
}
function applyTabVisibility() {
    document.querySelectorAll('#section-tabs .nav-item').forEach(function (li) {
        var tab = li.querySelector('a[data-section]');
        if (!tab) return;
        li.style.display = canAccessSection(tab.dataset.section) ? '' : 'none';
    });
}
function applyPerformanceVisibility() {
    var el = document.getElementById('perf-summary');
    if (!el) return;
    el.classList.toggle('d-none', !RBAC.can('beauticians:read'));
}
function firstAccessibleSection() {
    for (var i = 0; i < State.VALID_SECTIONS.length; i++) {
        if (canAccessSection(State.VALID_SECTIONS[i])) return State.VALID_SECTIONS[i];
    }
    return 'list';
}
function renderPagination(prefix, meta) {
    var total = meta.total || 0;
    var page = meta.page || 1;
    var limit = meta.limit || 20;
    var pages = meta.totalPages || 1;
    var from = total ? (page - 1) * limit + 1 : 0;
    var to = Math.min(page * limit, total);
    document.getElementById(prefix + '-pagination-info').textContent = total ? 'Showing ' + from + '–' + to + ' of ' + total : 'No results';
    var ul = document.getElementById(prefix + '-pagination-btns');
    ul.innerHTML = '';
    ul.insertAdjacentHTML('beforeend',
        '<li class="page-item ' + (page <= 1 ? 'disabled' : '') + '"><a class="page-link" href="#" data-page="' + (page - 1) + '">«</a></li>');
    var start = Math.max(1, page - 2), end = Math.min(pages, start + 4);
    for (var p = start; p <= end; p++) {
        ul.insertAdjacentHTML('beforeend',
            '<li class="page-item ' + (p === page ? 'active' : '') + '"><a class="page-link" href="#" data-page="' + p + '">' + p + '</a></li>');
    }
    ul.insertAdjacentHTML('beforeend',
        '<li class="page-item ' + (page >= pages ? 'disabled' : '') + '"><a class="page-link" href="#" data-page="' + (page + 1) + '">»</a></li>');
}
function renderListTable(rows, meta) {
    var tbody = document.getElementById('list-tbody');
    if (!rows.length) {
        tbody.innerHTML = '<tr><td colspan="10" class="text-center text-secondary py-5">No beauticians found.</td></tr>';
        return;
    }
    tbody.innerHTML = rows.map(function (b, i) {
        var name = Beauticians.fullName(b);
        var email = (b.user && b.user.email) || '';
        var phone = (b.user && b.user.phone) || '';
        var dob = Beauticians.formatDateOfBirth(b);
        var contactMeta = [email, phone, dob !== '—' ? dob : ''].filter(Boolean).join(' · ');
        var rating = b.ratingAverage != null ? b.ratingAverage.toFixed(1) : '—';
        var jobs = b.totalJobsCompleted ?? '—';
        var earnings = Beauticians.formatMoney(b.totalEarnings);
        return '<tr class="beautician-row" data-id="' + b.id + '">' +
            '<td class="text-secondary small">' + ((State.list.page - 1) * State.list.limit + i + 1) + '</td>' +
            '<td><div class="fw-semibold">' + name + '</div><div class="text-secondary small">' + (contactMeta || '—') + '</div></td>' +
            '<td>' + Beauticians.kycBadge(b.kycStatus) + '</td>' +
            '<td>' + Beauticians.profileBadge(b.profileStatus) + '</td>' +
            '<td>' + Beauticians.availabilityBadge(b.availabilityStatus) + '</td>' +
            '<td class="fw-semibold">' + rating + '</td>' +
            '<td>' + jobs + '</td>' +
            '<td class="fw-semibold text-success">' + earnings + '</td>' +
            '<td>' + Beauticians.statusBadge(b.isActive) + '</td>' +
            '<td><button class="btn btn-sm btn-ghost-secondary px-2 open-detail-btn" data-id="' + b.id + '" title="View details">' +
            '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon"><path d="M10 12a2 2 0 1 0 4 0a2 2 0 0 0 -4 0"/><path d="M21 12c-2.4 4 -5.4 6 -9 6c-3.6 0 -6.6 -2 -9 -6c2.4 -4 5.4 -6 9 -6c3.6 0 6.6 2 9 6"/></svg>' +
            '</button></td>' +
            '</tr>';
    }).join('');
}
function openPhotoPreview(url, name) {
    if (!url) return;
    document.getElementById('modal-photo-img').src = url;
    document.getElementById('modal-photo-img').alt = name || 'Profile photo';
    document.getElementById('modal-photo-title').textContent = (name || 'Beautician') + ' — Profile Photo';
    document.getElementById('modal-photo-open').href = url;
    bootstrap.Modal.getOrCreateInstance(document.getElementById('modal-photo-preview')).show();
}
function setCertPreviewLoading(loading) {
    var loadingEl = document.getElementById('modal-cert-loading');
    var img = document.getElementById('modal-cert-img');
    var frame = document.getElementById('modal-cert-frame');
    if (loading) {
        loadingEl.classList.remove('d-none');
        img.classList.add('d-none');
        frame.classList.add('d-none');
    } else {
        loadingEl.classList.add('d-none');
    }
}
function openCertificationPreview(url, title) {
    if (!url) return;
    var img = document.getElementById('modal-cert-img');
    var frame = document.getElementById('modal-cert-frame');
    var modalEl = document.getElementById('modal-cert-preview');
    document.getElementById('modal-cert-title').textContent = title || 'Certification';
    document.getElementById('modal-cert-open').href = url;

    img.onload = null;
    img.onerror = null;
    frame.onload = null;
    setCertPreviewLoading(true);

    function revealPreview(showEl) {
        setCertPreviewLoading(false);
        if (showEl) showEl.classList.remove('d-none');
    }

    if (isPdfUrl(url)) {
        frame.onload = function () {
            if (frame.getAttribute('src') !== url) return;
            frame.onload = null;
            revealPreview(frame);
        };
        frame.setAttribute('src', url);
    } else {
        img.onload = function () {
            img.onload = null;
            revealPreview(img);
        };
        img.onerror = function () {
            img.onerror = null;
            revealPreview(img);
        };
        img.alt = title || 'Certification';
        img.src = url;
    }

    bootstrap.Modal.getOrCreateInstance(modalEl).show();
}
function renderProfileReviewer(reviewer) {
    if (!reviewer || typeof reviewer !== 'object') {
        return '<span class="text-secondary">—</span>';
    }
    var name = [reviewer.firstName, reviewer.lastName].filter(Boolean).join(' ');
    var parts = [];
    if (name) parts.push('<div class="fw-semibold">' + escHtml(name) + '</div>');
    if (reviewer.email) parts.push('<div class="text-secondary small">' + escHtml(reviewer.email) + '</div>');
    return parts.length ? parts.join('') : '<span class="text-secondary">—</span>';
}
function renderCertifications(certifications) {
    if (!Array.isArray(certifications) || !certifications.length) {
        return '<div class="text-secondary small">No certifications uploaded</div>';
    }
    return '<div class="detail-cert-list">' + certifications.map(function (url, index) {
        var safeUrl = escHtml(url);
        var title = 'Certification ' + (index + 1);
        return '<button type="button" class="btn btn-sm btn-outline-secondary btn-view-certification" ' +
            'data-url="' + safeUrl + '" data-title="' + escHtml(title) + '">' + escHtml(title) + '</button>';
    }).join('') + '</div>';
}
function renderBeauticianBankDetails(b) {
    var bank = b.payoutBankAccount || b.bankAccount || b.payoutDetails || {};
    var bankName = b.bankName || bank.bankName || b.bankCode || bank.bankCode || '';
    var accountNumber = b.accountNumber || bank.accountNumber || '';
    var accountName = b.accountName || bank.accountName || '';
    if (!bankName && !accountNumber && !accountName) {
        return '<div class="text-secondary small">No payout bank details on file</div>';
    }
    return '<div class="row g-3">' +
        detailField('Bank', escHtml(bankName || '—'), 'col-sm-6') +
        detailField('Account Number', '<span class="font-monospace">' + escHtml(accountNumber || '—') + '</span>', 'col-sm-6') +
        detailField('Account Name', escHtml(accountName || '—'), 'col-sm-12') +
        '</div>';
}
function renderBeauticianDetailContent(b, settings) {
    var user = b.user || {};
    var name = Beauticians.fullName(b);
    var email = user.email || '—';
    var phone = user.phone || '—';
    var dateOfBirth = Beauticians.formatDateOfBirth(b);
    var walletBalance = b.walletBalance != null ? Beauticians.formatMoney(b.walletBalance) : '—';
    var totalEarnings = b.totalEarnings != null ? Beauticians.formatMoney(b.totalEarnings) : '—';
    var ratingAverage = b.ratingAverage != null ? Number(b.ratingAverage).toFixed(1) : '—';
    var reviewNotes = b.reviewNotes ? escHtml(b.reviewNotes) : '<span class="text-secondary">No review notes</span>';
    var platformCommission = settings ? formatCommissionLabel(settings.commissionRate) : null;
    // Per-beautician commissionRateOverride is no longer applied to job offers / payouts / wallet credit.
    // Pay is platform default + per-service overrides (Beauticians → Settings).
    var commissionDisplay = platformCommission
        ? platformCommission + '% <span class="text-secondary small fw-normal">(platform default; per-service overrides may apply)</span>'
        : '—';
    var payoutMode = settings && settings.payoutMode
        ? escHtml(String(settings.payoutMode).replace(/_/g, ' '))
        : '—';

    var specialties = Array.isArray(b.specialties) && b.specialties.length
        ? b.specialties.map(function (s) { return '<span class="badge bg-azure-lt me-1 mb-1">' + escHtml(s) + '</span>'; }).join('')
        : '<span class="text-secondary">None listed</span>';

    var assignedSvc = Array.isArray(b.assignedServices) && b.assignedServices.length
        ? b.assignedServices.map(function (as) {
            var svc = as.service || {};
            return '<div class="service-row d-flex justify-content-between align-items-start gap-3 py-1 border-bottom">' +
                '<span>' + escHtml(svc.name || 'Service') + '</span>' +
                '<span class="text-secondary text-nowrap">' + Beauticians.formatMoney(svc.homeServicePrice) + '</span></div>';
        }).join('')
        : '<div class="text-secondary py-2">No services assigned</div>';

    var assignedCount = Array.isArray(b.assignedServices) ? b.assignedServices.length : 0;
    var recentCount = Array.isArray(b.recentJobs) ? b.recentJobs.length : 0;

    var recentJobsHtml = recentCount
        ? b.recentJobs.slice(0, 5).map(function (j) {
            return '<div class="detail-job-row d-flex justify-content-between align-items-start gap-2 py-2 border-bottom small">' +
                '<span class="font-monospace">' + escHtml(j.reservationCode || '—') + '</span>' +
                '<span class="text-secondary">' + escHtml(Beauticians.formatDate(j.bookingDate)) + '</span>' +
                '<span class="text-nowrap">' + Beauticians.formatMoney(j.totalAmount) + '</span></div>';
        }).join('')
        : '<div class="text-secondary small py-2">No recent jobs</div>';

    var photoUrl = b.profilePhotoUrl || '';
    var initials = ((user.firstName || '?')[0] + (user.lastName || '')[0]).toUpperCase() || '?';
    var safePhotoUrl = escHtml(photoUrl);
    var safeName = escHtml(name);
    var avatarHtml = photoUrl
        ? '<span class="avatar avatar-lg rounded btn-view-photo-avatar btn-view-photo" role="button" tabindex="0" title="View photo" data-url="' + safePhotoUrl + '" data-name="' + safeName + '"><img src="' + safePhotoUrl + '" alt="' + safeName + '"></span>'
        : '<span class="avatar avatar-lg rounded-circle bg-primary-lt fw-bold fs-4">' + escHtml(initials) + '</span>';
    var viewPhotoHtml = photoUrl
        ? '<button type="button" class="btn btn-sm btn-ghost-primary px-0 mt-1 btn-view-photo" data-url="' + safePhotoUrl + '" data-name="' + safeName + '">View photo</button>'
        : '';

    var profileReviewerHtml =
        '<div class="mt-3 pt-3 border-top">' +
        '<div class="text-secondary small mb-2">Profile Reviewed By</div>' +
        '<div>' + renderProfileReviewer(b.profileReviewedBy) + '</div>' +
        (b.profileReviewedAt
            ? '<div class="text-secondary small mt-2">Reviewed ' + escHtml(Beauticians.formatDateTime(b.profileReviewedAt)) + '</div>'
            : '') +
        '</div>';

    var statusSection = detailLight('Account Status',
        '<div class="row g-3">' +
        detailField('KYC', Beauticians.kycBadge(b.kycStatus)) +
        detailField('Profile', Beauticians.profileBadge(b.profileStatus)) +
        detailField('Availability', Beauticians.availabilityBadge(b.availabilityStatus)) +
        detailField('Dispatch', Beauticians.dispatchSuspendedBadge(!!b.dispatchSuspended)) +
        detailField('Account', Beauticians.statusBadge(b.isActive)) +
        (b.yearsOfExperience != null ? detailField('Experience', escHtml(b.yearsOfExperience) + ' yrs') : '') +
        '</div>' + profileReviewerHtml);

    var reviewsSection = detailLight('Reviews & Ratings',
        '<div class="row g-3">' +
        detailField('Average Rating', '<span class="fw-semibold fs-4">' + escHtml(ratingAverage) + '</span>', 'col-sm-6') +
        detailField('Jobs Completed', escHtml(b.totalJobsCompleted != null ? b.totalJobsCompleted : '—'), 'col-sm-6') +
        '</div>') +
        detailHeavy('Review Notes', '<div class="detail-prose">' + reviewNotes + '</div>');

    var earningsSection = detailLight('Earnings & Wallet',
        '<div class="row g-3">' +
        detailField('Wallet Balance', '<span class="fw-semibold text-success fs-4">' + escHtml(walletBalance) + '</span>', 'col-sm-6') +
        detailField('Total Earnings', '<span class="fw-semibold">' + escHtml(totalEarnings) + '</span>', 'col-sm-6') +
        '</div>');

    var payoutSection = detailLight('Payout Details',
        '<div class="row g-3 mb-3">' +
        detailField('Beautician Share', commissionDisplay, 'col-sm-6') +
        detailField('Platform Payout Mode', payoutMode, 'col-sm-6') +
        '</div>' +
        '<div class="text-secondary small mb-2">Payout Bank Details</div>' +
        renderBeauticianBankDetails(b));

    var assignedSection = detailHeavy('Assigned Services',
        '<div class="detail-services-scroll">' + assignedSvc + '</div>', assignedCount);
    var recentSection = detailHeavy('Recent Jobs', recentJobsHtml, recentCount);

    var kycSection = b.kycReferences ? detailLight('KYC References',
        '<dl class="row g-2 small mb-0">' +
        '<dt class="col-sm-5 text-secondary fw-normal">QoreID Customer</dt><dd class="col-sm-7 mb-0 font-monospace">' + escHtml(b.kycReferences.qoreIdCustomerId || '—') + '</dd>' +
        '<dt class="col-sm-5 text-secondary fw-normal">QoreID Session</dt><dd class="col-sm-7 mb-0 font-monospace">' + escHtml(b.kycReferences.qoreIdSessionId || '—') + '</dd>' +
        '</dl>') : '';

    return '' +
        '<div class="offcanvas-detail-hero">' + avatarHtml +
        '<div class="flex-grow-1"><div class="fw-bold fs-3">' + escHtml(name) + '</div>' +
        '<div class="text-secondary">' + escHtml(email) + '</div>' +
        '<div class="text-secondary">' + escHtml(phone) + '</div>' +
        '<div class="text-secondary">Born ' + escHtml(dateOfBirth) + '</div>' +
        viewPhotoHtml + '</div>' +
        '<div class="text-end align-self-start">' +
        '<div class="text-secondary small mb-1">Profile ID</div>' +
        '<div class="font-monospace text-secondary small">' + escHtml(b.id) + '</div>' +
        '</div></div>' +

        '<div class="row g-4">' +
        '<div class="col-lg-6">' + statusSection +
        (b.bio ? detailHeavy('Bio', '<div class="detail-prose">' + escHtml(b.bio) + '</div>') : '') +
        detailLight('Specialties', '<div>' + specialties + '</div>') +
        detailLight('Certifications', renderCertifications(b.certifications)) +
        '</div>' +
        '<div class="col-lg-6">' + reviewsSection + earningsSection + payoutSection + '</div>' +
        '</div>' +

        '<div class="row g-4 mt-1">' +
        '<div class="col-lg-6">' + assignedSection + '</div>' +
        '<div class="col-lg-6">' + recentSection + '</div>' +
        '</div>' +
        (kycSection ? '<div class="row g-4 mt-1"><div class="col-lg-6">' + kycSection + '</div></div>' : '') ;
}
function buildDetailActions(b) {
    var html = '<button class="btn btn-link link-secondary me-auto" data-bs-dismiss="offcanvas">Close</button>';
    var id = (b.id || '').replace(/'/g, "\\'");
    var kyc = (b.kycStatus || '').toUpperCase();
    var profile = (b.profileStatus || '').toUpperCase();

    if (RBAC.can('beauticians:review') && (kyc === 'NEEDS_REVIEW' || kyc === 'PENDING')) {
        html += '<button class="btn btn-success btn-sm" onclick="handleKycApprove(\'' + id + '\')">Approve KYC</button>';
        html += '<button class="btn btn-danger btn-sm" onclick="handleKycReject(\'' + id + '\')">Reject KYC</button>';
    }
    if (RBAC.can('beauticians:review') && profile === 'PENDING_REVIEW' && kyc === 'VERIFIED') {
        html += '<button class="btn btn-success btn-sm" onclick="handleProfileApprove(\'' + id + '\')">Approve Profile</button>';
        html += '<button class="btn btn-danger btn-sm" onclick="handleProfileReject(\'' + id + '\')">Reject Profile</button>';
    }
    if (RBAC.can('beauticians:manage')) {
        html += '<button class="btn btn-outline-secondary btn-sm" onclick="openSuspendModal(\'' + id + '\',\'' + (b.isActive ? 'true' : 'false') + '\')">' + (b.isActive ? 'Suspend' : 'Reactivate') + '</button>';
        var dispatchSuspended = b.dispatchSuspended ? 'true' : 'false';
        html += '<button class="btn btn-outline-warning btn-sm" onclick="toggleDispatchSuspended(\'' + id + '\',\'' + dispatchSuspended + '\')">' +
            (b.dispatchSuspended ? 'Resume Dispatch' : 'Suspend Dispatch') + '</button>';
    }
    return html;
}
function renderReviewsTable(rows, meta) {
    var tbody = document.getElementById('reviews-tbody');
    if (!rows.length) {
        tbody.innerHTML = '<tr><td colspan="8" class="text-center text-secondary py-5">No pending profile reviews.</td></tr>';
        return;
    }
    tbody.innerHTML = rows.map(function (b, i) {
        var name = Beauticians.fullName(b);
        var dob = Beauticians.formatDateOfBirth(b);
        var specs = Array.isArray(b.specialties) ? b.specialties.join(', ') : '—';
        var exp = b.yearsOfExperience ? b.yearsOfExperience + ' yrs' : '—';
        var submitted = Beauticians.formatDateTime(b.updatedAt || b.createdAt);
        return '<tr>' +
            '<td class="text-secondary small">' + ((State.reviews.page - 1) * State.reviews.limit + i + 1) + '</td>' +
            '<td><div class="fw-semibold">' + name + '</div></td>' +
            '<td class="text-secondary small">' + dob + '</td>' +
            '<td class="text-secondary small">' + specs + '</td>' +
            '<td>' + exp + '</td>' +
            '<td>' + Beauticians.kycBadge(b.kycStatus) + '</td>' +
            '<td class="text-secondary small">' + submitted + '</td>' +
            '<td><button class="btn btn-sm btn-ghost-primary open-detail-btn" data-id="' + b.id + '" title="View beautician information">View information</button></td>' +
            '</tr>';
    }).join('');
}
function getSvcBeauticianId() {
    return document.getElementById('svc-beautician-select').value;
}
function setSvcBeauticianLabel(text, isPlaceholder) {
    var label = document.getElementById('svc-beautician-label');
    label.textContent = text;
    label.classList.toggle('text-secondary', !!isPlaceholder);
    label.classList.toggle('text-body', !isPlaceholder);
}
function setSvcBeauticianSelection(id) {
    document.getElementById('svc-beautician-select').value = id || '';
    if (!id) {
        setSvcBeauticianLabel('— Select a beautician —', true);
        return;
    }
    var row = State.svcBeauticianRows.find(function (b) { return b.id === id; });
    setSvcBeauticianLabel(row ? Beauticians.fullName(row) : '— Select a beautician —', !row);
}
function renderSvcBeauticianPicker(query) {
    var list = document.getElementById('svc-beautician-list');
    var selected = getSvcBeauticianId();
    var q = String(query || '').trim().toLowerCase();

    if (State.svcBeauticianOptionsLoading) {
        list.innerHTML = '<div class="text-center py-3"><div class="spinner-border spinner-border-sm text-primary" role="status"></div></div>';
        return;
    }
    if (!State.beauticianOptionsLoaded) {
        list.innerHTML = '<div class="text-center text-secondary py-3 small">Loading beauticians…</div>';
        return;
    }
    if (!State.svcBeauticianRows.length) {
        list.innerHTML = '<div class="text-center text-secondary py-3 small">No approved beauticians</div>';
        return;
    }

    var filtered = q
        ? State.svcBeauticianRows.filter(function (b) { return svcBeauticianSearchHaystack(b).indexOf(q) !== -1; })
        : State.svcBeauticianRows.slice();

    if (!filtered.length) {
        list.innerHTML = '<div class="text-center text-secondary py-3 small">No beauticians match your search</div>';
        return;
    }

    list.innerHTML = filtered.map(function (b) {
        var user = b.user || {};
        var dob = Beauticians.formatDateOfBirth(b);
        var metaParts = [user.email, user.phone];
        if (dob !== '—') metaParts.push('Born ' + dob);
        var meta = metaParts.filter(Boolean).join(' · ');
        var active = b.id === selected ? ' active' : '';
        return '<button type="button" class="dropdown-item svc-beautician-option' + active + '" data-id="' + escHtml(b.id) + '">' +
            '<div class="fw-medium">' + escHtml(Beauticians.fullName(b)) + '</div>' +
            (meta ? '<div class="option-meta">' + escHtml(meta) + '</div>' : '') +
            '</button>';
    }).join('');
}
function updateSvcSelectedCount() {
    var checkboxes = document.querySelectorAll('.svc-checkbox');
    var count = document.querySelectorAll('.svc-checkbox:checked').length;
    document.getElementById('svc-count-label').textContent = count + ' selected';
    var selectAll = document.getElementById('svc-select-all');
    if (selectAll) {
        var total = checkboxes.length;
        selectAll.checked = total > 0 && count === total;
        selectAll.indeterminate = count > 0 && count < total;
    }
}
function showScrDefaultAlert(type, message) {
    var ok = document.getElementById('scr-default-success');
    var err = document.getElementById('scr-default-error');
    ok.classList.add('d-none');
    err.classList.add('d-none');
    if (!message) return;
    var el = type === 'success' ? ok : err;
    el.textContent = message;
    el.classList.remove('d-none');
    if (type === 'success') {
        setTimeout(function () { ok.classList.add('d-none'); }, 3000);
    }
}
function showScrAlert(type, message) {
    var ok = document.getElementById('scr-success');
    var err = document.getElementById('scr-error');
    ok.classList.add('d-none');
    err.classList.add('d-none');
    if (!message) return;
    var el = type === 'success' ? ok : err;
    el.textContent = message;
    el.classList.remove('d-none');
    if (type === 'success') {
        setTimeout(function () { ok.classList.add('d-none'); }, 3000);
    }
}
function renderServiceCommissionRows(rows) {
    var tbody = document.getElementById('scr-tbody');
    var canManage = RBAC.can('settings:manage');
    if (!rows || !rows.length) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center text-secondary py-4">' +
            'No overrides yet. All services use the platform default beautician share.</td></tr>';
        return;
    }
    tbody.innerHTML = rows.map(function (row) {
        var pct = formatCommissionLabel(row.commissionRate);
        var pctLabel = pct != null ? pct + '%' : '—';
        var updated = row.updatedAt ? Beauticians.formatDateTime(row.updatedAt) : '—';
        var price = getServiceCatalogPrice(row.serviceId);
        var actions = canManage
            ? '<div class="btn-list flex-nowrap justify-content-end">' +
                '<button type="button" class="btn btn-sm btn-ghost-primary btn-scr-edit"' +
                ' data-service-id="' + escHtml(row.serviceId) + '"' +
                ' data-service-name="' + escHtml(row.serviceName || '') + '"' +
                ' data-rate="' + escHtml(String(row.commissionRate)) + '"' +
                (price != null ? ' data-service-price="' + escHtml(String(price)) + '"' : '') +
                '>Edit</button>' +
                '<button type="button" class="btn btn-sm btn-ghost-danger btn-scr-remove" data-service-id="' + escHtml(row.serviceId) + '" data-service-name="' + escHtml(row.serviceName || '') + '">Remove</button>' +
              '</div>'
            : '';
        return '<tr data-service-id="' + escHtml(row.serviceId) + '">' +
            '<td><div class="fw-semibold">' + escHtml(row.serviceName || '—') + '</div></td>' +
            '<td class="text-nowrap"><span class="badge bg-azure-lt">' + escHtml(pctLabel) + '</span></td>' +
            '<td>' + formatEarningsCell(price, row.commissionRate) + '</td>' +
            '<td class="text-secondary text-nowrap small">' + escHtml(updated) + '</td>' +
            '<td class="text-end">' + actions + '</td></tr>';
    }).join('');
}
function getScrServiceId() {
    return document.getElementById('scr-service-select').value;
}
function setScrServiceLabel(text, isPlaceholder) {
    var label = document.getElementById('scr-service-label');
    label.textContent = text;
    label.classList.toggle('text-secondary', !!isPlaceholder);
    label.classList.toggle('text-body', !isPlaceholder);
}
function setScrServiceSelection(id) {
    document.getElementById('scr-service-select').value = id || '';
    if (!id) {
        setScrServiceLabel('— Select a service —', true);
        updateScrEarningsPreview();
        return;
    }
    var row = (State.scr.catalogServices || []).find(function (s) { return s.id === id; });
    setScrServiceLabel(row ? (row.name || id) : '— Select a service —', !row);
    updateScrEarningsPreview();
}
function getScrModalServicePrice() {
    var editId = document.getElementById('scr-edit-service-id').value.trim();
    var serviceId = editId || getScrServiceId();
    if (!serviceId) return null;
    // Prefer catalog lookup
    var catalogPrice = getServiceCatalogPrice(serviceId);
    if (catalogPrice != null) return catalogPrice;
    // Fallback from edit button data stored on modal open
    if (State.scr.editServicePrice != null) return State.scr.editServicePrice;
    return null;
}
function updateScrEarningsPreview() {
    var box = document.getElementById('scr-earnings-preview');
    var amountEl = document.getElementById('scr-preview-amount');
    var earnEl = document.getElementById('scr-preview-earn');
    var pctEl = document.getElementById('scr-preview-pct');
    if (!box) return;

    var price = getScrModalServicePrice();
    var pctRaw = document.getElementById('scr-rate-input').value;
    var rate = commissionPercentToRate(pctRaw);
    var hasPct = pctRaw !== '' && rate != null;

    if (price == null && !hasPct) {
        box.classList.add('d-none');
        return;
    }

    box.classList.remove('d-none');
    amountEl.textContent = price != null ? Services.formatMoney(price) : '— (select a service)';
    if (price != null && hasPct && rate >= 0 && rate <= 1) {
        var earn = Math.round(price * rate * 100) / 100;
        earnEl.textContent = Services.formatMoney(earn);
        var pctLabel = formatCommissionLabel(rate);
        pctEl.textContent = pctLabel != null ? ' (' + pctLabel + '%)' : '';
    } else if (hasPct && price == null) {
        earnEl.textContent = '—';
        pctEl.textContent = ' (select a service)';
    } else {
        earnEl.textContent = '—';
        pctEl.textContent = '';
    }
}
function getScrAvailableServices() {
    var overridden = {};
    (State.scr.overrides || []).forEach(function (r) { overridden[r.serviceId] = true; });
    return (State.scr.catalogServices || []).filter(function (s) {
        return s && s.id && !overridden[s.id];
    });
}
function renderScrServicePicker(query) {
    var list = document.getElementById('scr-service-list');
    var selected = getScrServiceId();
    var q = String(query || '').trim().toLowerCase();

    if (State.scr.catalogLoading) {
        list.innerHTML = '<div class="text-center py-3"><div class="spinner-border spinner-border-sm text-primary" role="status"></div></div>';
        return;
    }
    if (!State.scr.catalogLoaded) {
        list.innerHTML = '<div class="text-center text-secondary py-3 small">Loading services…</div>';
        return;
    }

    var available = getScrAvailableServices();
    if (!available.length) {
        list.innerHTML = '<div class="text-center text-secondary py-3 small">All services already have overrides</div>';
        return;
    }

    var filtered = q
        ? available.filter(function (s) { return scrServiceSearchHaystack(s).indexOf(q) !== -1; })
        : available.slice();

    if (!filtered.length) {
        list.innerHTML = '<div class="text-center text-secondary py-3 small">No services match your search</div>';
        return;
    }

    list.innerHTML = filtered.map(function (s) {
        var metaParts = [];
        if (s.homeServicePrice != null) metaParts.push(Services.formatMoney(s.homeServicePrice));
        if (s.category && s.category.name) metaParts.push(s.category.name);
        var meta = metaParts.join(' · ');
        var active = s.id === selected ? ' active' : '';
        return '<button type="button" class="dropdown-item scr-service-option' + active + '" data-id="' + escHtml(s.id) + '">' +
            '<div class="fw-medium">' + escHtml(s.name || s.id) + '</div>' +
            (meta ? '<div class="option-meta">' + escHtml(meta) + '</div>' : '') +
            '</button>';
    }).join('');
}
function openScrModalForAdd() {
    document.getElementById('scr-modal-title').textContent = 'Add Service Override';
    document.getElementById('scr-edit-service-id').value = '';
    document.getElementById('scr-rate-input').value = '';
    document.getElementById('scr-modal-error').classList.add('d-none');
    document.getElementById('scr-service-select-wrap').classList.remove('d-none');
    document.getElementById('scr-service-name-wrap').classList.add('d-none');
    State.scr.editServicePrice = null;
    setScrServiceSelection('');
    document.getElementById('scr-service-search').value = '';
    // Force refresh of available list against current overrides
    if (State.scr.catalogLoaded) renderScrServicePicker('');
    updateScrEarningsPreview();
}
function openScrModalForEdit(serviceId, serviceName, rate, servicePrice) {
    document.getElementById('scr-modal-title').textContent = 'Edit Service Override';
    document.getElementById('scr-edit-service-id').value = serviceId || '';
    document.getElementById('scr-rate-input').value = sanitizePercentInputValue(String(commissionRateToPercent(rate)));
    document.getElementById('scr-modal-error').classList.add('d-none');
    document.getElementById('scr-service-select-wrap').classList.add('d-none');
    document.getElementById('scr-service-name-wrap').classList.remove('d-none');
    document.getElementById('scr-service-name-display').textContent = serviceName || serviceId || '—';
    document.getElementById('scr-service-select').value = '';
    var price = servicePrice != null && servicePrice !== ''
        ? Number(servicePrice)
        : getServiceCatalogPrice(serviceId);
    State.scr.editServicePrice = Number.isFinite(price) ? price : null;
    updateScrEarningsPreview();
}
function renderDailyPoolStats(pool) {
    var unlimited = !!(pool.unlimited || pool.limit === null || pool.limit === undefined);
    var used = Number(pool.used) || 0;
    var limit = unlimited ? null : Number(pool.limit);
    var remaining = unlimited ? null : (pool.remaining === null || pool.remaining === undefined
        ? Math.max(0, (limit || 0) - used)
        : Number(pool.remaining));

    document.getElementById('daily-pool-used').textContent = Beauticians.formatMoney(used);

    if (unlimited) {
        document.getElementById('daily-pool-remaining').textContent = 'Unlimited';
        document.getElementById('daily-pool-remaining').className = 'stat-value text-success';
        document.getElementById('daily-pool-limit').textContent = 'No cap';
        document.getElementById('daily-pool-status-badge').innerHTML =
            '<span class="badge bg-success-lt">Unlimited</span>';
        document.getElementById('daily-pool-progress-wrap').classList.remove('near-cap', 'at-cap');
        document.getElementById('daily-pool-progress-bar').style.width = '0%';
        document.getElementById('daily-pool-progress-wrap').setAttribute('aria-valuenow', '0');
    } else {
        document.getElementById('daily-pool-remaining').textContent = Beauticians.formatMoney(remaining);
        document.getElementById('daily-pool-remaining').className =
            remaining <= 0 ? 'stat-value text-danger' : 'stat-value text-success';
        document.getElementById('daily-pool-limit').textContent = Beauticians.formatMoney(limit);

        var pct = limit > 0
            ? Math.min(100, Math.round((used / limit) * 100))
            : (remaining <= 0 ? 100 : 0);
        var wrap = document.getElementById('daily-pool-progress-wrap');
        wrap.classList.remove('near-cap', 'at-cap');
        if (remaining <= 0 || pct >= 100) {
            wrap.classList.add('at-cap');
            document.getElementById('daily-pool-status-badge').innerHTML =
                '<span class="badge bg-danger-lt">Cap reached</span>';
            pct = 100;
        } else if (pct >= 80) {
            wrap.classList.add('near-cap');
            document.getElementById('daily-pool-status-badge').innerHTML =
                '<span class="badge bg-warning-lt">' + pct + '% used</span>';
        } else {
            document.getElementById('daily-pool-status-badge').innerHTML =
                '<span class="badge bg-primary-lt">' + pct + '% used</span>';
        }
        document.getElementById('daily-pool-progress-bar').style.width = pct + '%';
        wrap.setAttribute('aria-valuenow', String(pct));
    }

    var dayMeta = 'Timezone: ' + (pool.timezone || 'Africa/Lagos');
    if (pool.dayStartsAt) {
        dayMeta += ' · Day started ' + Beauticians.formatDateTime(pool.dayStartsAt);
    }
    document.getElementById('daily-pool-day-meta').textContent = dayMeta;

    var canManage = RBAC.can('settings:manage');
    var manageEl = document.getElementById('daily-pool-manage');
    manageEl.classList.toggle('d-none', !canManage);
    if (canManage) {
        var inputEl = document.getElementById('pool-limit-input');
        var unlimitedEl = document.getElementById('pool-limit-unlimited');
        unlimitedEl.disabled = false;
        applyDailyLimitInputs(inputEl, unlimitedEl, unlimited ? null : limit, true);
    }
}

    BP.UI = {
        initSettingsFieldHints: initSettingsFieldHints,
        applyTabVisibility: applyTabVisibility,
        applyPerformanceVisibility: applyPerformanceVisibility,
        firstAccessibleSection: firstAccessibleSection,
        renderPagination: renderPagination,
        renderListTable: renderListTable,
        openPhotoPreview: openPhotoPreview,
        setCertPreviewLoading: setCertPreviewLoading,
        openCertificationPreview: openCertificationPreview,
        renderProfileReviewer: renderProfileReviewer,
        renderCertifications: renderCertifications,
        renderBeauticianBankDetails: renderBeauticianBankDetails,
        renderBeauticianDetailContent: renderBeauticianDetailContent,
        buildDetailActions: buildDetailActions,
        renderReviewsTable: renderReviewsTable,
        getSvcBeauticianId: getSvcBeauticianId,
        setSvcBeauticianLabel: setSvcBeauticianLabel,
        setSvcBeauticianSelection: setSvcBeauticianSelection,
        renderSvcBeauticianPicker: renderSvcBeauticianPicker,
        updateSvcSelectedCount: updateSvcSelectedCount,
        showScrDefaultAlert: showScrDefaultAlert,
        showScrAlert: showScrAlert,
        renderServiceCommissionRows: renderServiceCommissionRows,
        getScrServiceId: getScrServiceId,
        setScrServiceLabel: setScrServiceLabel,
        setScrServiceSelection: setScrServiceSelection,
        getScrModalServicePrice: getScrModalServicePrice,
        updateScrEarningsPreview: updateScrEarningsPreview,
        getScrAvailableServices: getScrAvailableServices,
        renderScrServicePicker: renderScrServicePicker,
        openScrModalForAdd: openScrModalForAdd,
        openScrModalForEdit: openScrModalForEdit,
        renderDailyPoolStats: renderDailyPoolStats
    };
})(window);
