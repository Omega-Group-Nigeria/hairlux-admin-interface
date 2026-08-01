/**
 * beauticians/utils.js — pure helpers (escape, format, commission math, alerts)
 */
(function (global) {
    'use strict';

    var BP = (global.BeauticiansPage = global.BeauticiansPage || {});
    var State = BP.State;

function isDetailOffcanvasOpen() {
    var oc = document.getElementById('offcanvas-detail');
    return !!(oc && oc.classList.contains('show'));
}

/**
 * Toast/banner for the page. When the beautician detail offcanvas is open,
 * messages surface inside the offcanvas (not under the backdrop on the page).
 */
function showAlert(msg, type) {
    if (isDetailOffcanvasOpen()) {
        showOffcanvasAlert(msg, type);
        return;
    }
    var el = document.getElementById('page-alert');
    if (!el) return;
    if (!msg) {
        el.classList.add('d-none');
        return;
    }
    el.textContent = msg;
    el.className = 'alert alert-' + (type || 'danger') + ' mb-3';
    el.classList.remove('d-none');
    setTimeout(function () {
        el.classList.add('d-none');
    }, 5000);
}

function showOffcanvasAlert(msg, type) {
    var wrap = document.getElementById('offcanvas-detail-alert-wrap');
    var el = document.getElementById('offcanvas-detail-alert');
    if (!wrap || !el) {
        // Fallback if markup missing
        var pageEl = document.getElementById('page-alert');
        if (!pageEl) return;
        if (!msg) {
            pageEl.classList.add('d-none');
            return;
        }
        pageEl.textContent = msg;
        pageEl.className = 'alert alert-' + (type || 'danger') + ' mb-3';
        pageEl.classList.remove('d-none');
        return;
    }
    if (!msg) {
        wrap.classList.add('d-none');
        el.textContent = '';
        return;
    }
    el.textContent = msg;
    el.className = 'alert alert-' + (type || 'danger') + ' mb-0 py-2';
    wrap.classList.remove('d-none');
    // Scroll alert into view within offcanvas
    try {
        wrap.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    } catch (e) { /* ignore */ }
    window.clearTimeout(showOffcanvasAlert._timer);
    showOffcanvasAlert._timer = window.setTimeout(function () {
        wrap.classList.add('d-none');
    }, 6000);
}

function clearOffcanvasAlert() {
    showOffcanvasAlert('', 'danger');
}

function setSaveButtonState(btn, isSaving, label) {
    if (!btn) return;
    btn.disabled = !!isSaving;
    btn.innerHTML = isSaving
        ? '<span class="spinner-border spinner-border-sm me-1"></span> Saving…'
        : label;
}

function canAccessSection(section) {
    if (section === 'list') return RBAC.can('beauticians:read');
    if (section === 'reviews') return RBAC.can('beauticians:review');
    if (section === 'services') return RBAC.can('beauticians:assign_services');
    if (section === 'service-rates') return RBAC.can('settings:read') || RBAC.can('settings:manage');
    if (section === 'settings') return RBAC.can('settings:read') || RBAC.can('settings:manage');
    if (section === 'payouts') return RBAC.can('beauticians:process_payouts');
    return true;
}

function escHtml(value) {
    return String(value == null ? '' : value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function detailField(label, valueHtml, colClass) {
    return '<div class="' + (colClass || 'col-sm-6') + '">' +
        '<div class="detail-field-label">' + escHtml(label) + '</div>' +
        '<div class="detail-field-value">' + valueHtml + '</div></div>';
}

function detailHeading(title, count) {
    var countHtml = count != null
        ? ' <span class="detail-count text-secondary">(' + escHtml(count) + ')</span>'
        : '';
    return '<div class="detail-section-heading">' + escHtml(title) + countHtml + '</div>';
}

/** Distinct card container for offcanvas hierarchy */
function detailCard(title, innerHtml, opts) {
    opts = opts || {};
    var countHtml = opts.count != null
        ? ' <span class="detail-count">(' + escHtml(opts.count) + ')</span>'
        : '';
    var level = opts.level || 'primary'; // primary | secondary
    var extraClass = opts.className ? ' ' + opts.className : '';
    var headerExtra = opts.headerHtml || '';
    return '<section class="detail-card detail-card-' + level + extraClass + '">' +
        (title
            ? '<div class="detail-card-header">' +
                '<div class="detail-card-title">' + escHtml(title) + countHtml + '</div>' +
                headerExtra +
              '</div>'
            : '') +
        '<div class="detail-card-body">' + innerHtml + '</div>' +
        '</section>';
}

function detailLight(title, innerHtml) {
    return detailCard(title, innerHtml, { level: 'secondary' });
}

function detailHeavy(title, innerHtml, count) {
    return detailCard(title, innerHtml, { level: 'primary', count: count });
}

function formatCommissionLabel(rate) {
    var pct = commissionRateToPercent(rate);
    return pct === '' ? null : pct;
}

function isPdfUrl(url) {
    return /\.pdf(\?|#|$)/i.test(String(url || ''));
}

/**
 * Portfolio links are untrusted external content from the beautician app.
 * Only https URLs are linkified; always open in a new tab (never iframe).
 */
function renderPortfolioUrl(url) {
    if (url == null || String(url).trim() === '') {
        return '<span class="text-secondary">—</span>';
    }
    var raw = String(url).trim();
    var safeHref = null;
    try {
        var parsed = new URL(raw);
        if (parsed.protocol === 'https:' && !parsed.username && !parsed.password) {
            safeHref = parsed.href;
        }
    } catch (e) {
        safeHref = null;
    }
    if (!safeHref) {
        return '<span class="text-secondary text-break" title="Invalid or non-https URL">' + escHtml(raw) + '</span>';
    }
    return '<a href="' + escHtml(safeHref) + '" target="_blank" rel="noopener noreferrer" class="text-break">' +
        escHtml(raw) +
        ' <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon icon-inline opacity-75" aria-hidden="true"><path d="M12 6h-6a2 2 0 0 0 -2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2 -2v-6"/><path d="M11 13l9 -9"/><path d="M15 4h5v5"/></svg>' +
        '</a>';
}

function commissionRateToPercent(rate) {
    if (rate == null || rate === '') return '';
    var num = parseFloat(rate);
    if (Number.isNaN(num)) return '';
    return Math.round(num * 10000) / 100;
}

function commissionPercentToRate(percent) {
    if (percent == null || percent === '') return undefined;
    var num = parseFloat(percent);
    if (Number.isNaN(num)) return undefined;
    return Math.round(num * 100) / 10000;
}

function formatScoringWeight(value) {
    if (value == null || value === '') return '—';
    var num = typeof value === 'number' ? value : parseFloat(value);
    if (Number.isNaN(num)) return '—';
    return String(num);
}

function sanitizePercentInputValue(raw) {
    var v = String(raw == null ? '' : raw);
    v = v.replace(/[^\d.]/g, '');
    var firstDot = v.indexOf('.');
    if (firstDot !== -1) {
        v = v.slice(0, firstDot + 1) + v.slice(firstDot + 1).replace(/\./g, '');
    }
    // At most 2 decimal places
    if (firstDot !== -1) {
        var parts = v.split('.');
        if (parts[1] && parts[1].length > 2) {
            v = parts[0] + '.' + parts[1].slice(0, 2);
        }
    }
    if (v !== '' && v !== '.') {
        var num = parseFloat(v);
        if (!Number.isNaN(num) && num > 100) v = '100';
    }
    return v;
}

function applyDailyLimitInputs(inputEl, unlimitedEl, limit, canEdit) {
    var editable = canEdit !== false && !unlimitedEl.disabled;
    var unlimited = limit === null || limit === undefined;
    unlimitedEl.checked = unlimited;
    if (unlimited) {
        inputEl.value = '';
        inputEl.disabled = true;
        inputEl.placeholder = 'Unlimited';
    } else {
        inputEl.value = limit;
        inputEl.disabled = !editable;
        inputEl.placeholder = 'e.g. 500000';
    }
}

function onUnlimitedToggle(inputEl, unlimitedEl) {
    if (unlimitedEl.checked) {
        inputEl.value = '';
        inputEl.disabled = true;
        inputEl.placeholder = 'Unlimited';
    } else {
        inputEl.disabled = unlimitedEl.disabled;
        inputEl.placeholder = 'e.g. 500000';
        if (!inputEl.disabled && inputEl.value === '') inputEl.focus();
    }
}

function readDailyLimitFromInputs(inputEl, unlimitedEl) {
    if (unlimitedEl.checked) return null;
    var raw = inputEl.value.trim();
    if (raw === '') throw new Error('Enter a daily payout limit, or enable Unlimited.');
    var num = Number(raw);
    if (!Number.isFinite(num) || num < 0) throw new Error('Daily payout limit must be a number ≥ 0.');
    return num;
}

function applyDispatchTierValue(tiers, tier, field, elementId) {
    var row = (tiers || []).find(function (t) { return t.tier === tier; });
    var el = document.getElementById(elementId);
    if (!el || !row) return;
    if (field === 'radius') el.value = row.radiusKm ?? '';
    if (field === 'ttl') el.value = row.offerTtlSeconds ?? '';
}

function payoutsCountLabel(count) {
    var status = State.payouts.status;
    if (!status) return count + ' payout' + (count === 1 ? '' : 's');
    return count + ' ' + status.toLowerCase().replace(/_/g, ' ');
}

function formatEarningsCell(serviceAmount, rate) {
    if (serviceAmount == null) {
        return '<span class="text-secondary">—</span>';
    }
    var amountHtml = '<div class="fw-semibold text-nowrap">' + escHtml(Services.formatMoney(serviceAmount)) + '</div>';
    if (rate == null || rate === '' || Number.isNaN(Number(rate))) {
        return amountHtml + '<div class="text-secondary small">Earns —</div>';
    }
    var earn = Math.round(serviceAmount * Number(rate) * 100) / 100;
    return amountHtml +
        '<div class="text-success small text-nowrap">Earns ' + escHtml(Services.formatMoney(earn)) + '</div>';
}

function getServiceCatalogPrice(serviceId) {
    if (!serviceId) return null;
    var row = (State.scr.catalogServices || []).find(function (s) { return s.id === serviceId; });
    if (!row) return null;
    var price = row.homeServicePrice;
    if (price == null || price === '') return null;
    var num = Number(price);
    return Number.isFinite(num) ? num : null;
}

function svcBeauticianSearchHaystack(b) {
    var user = b.user || {};
    var dob = Beauticians.dateOfBirth(b);
    return [Beauticians.fullName(b), user.email, user.phone, dob, Beauticians.formatDateOfBirth(b), b.id]
        .filter(Boolean).join(' ').toLowerCase();
}

function scrServiceSearchHaystack(s) {
    return [s.name, s.id, s.description, s.category && s.category.name]
        .filter(Boolean).join(' ').toLowerCase();
}

    BP.Utils = {
        showAlert: showAlert,
        showOffcanvasAlert: showOffcanvasAlert,
        clearOffcanvasAlert: clearOffcanvasAlert,
        isDetailOffcanvasOpen: isDetailOffcanvasOpen,
        setSaveButtonState: setSaveButtonState,
        canAccessSection: canAccessSection,
        escHtml: escHtml,
        detailField: detailField,
        detailHeading: detailHeading,
        detailCard: detailCard,
        detailLight: detailLight,
        detailHeavy: detailHeavy,
        formatCommissionLabel: formatCommissionLabel,
        isPdfUrl: isPdfUrl,
        renderPortfolioUrl: renderPortfolioUrl,
        commissionRateToPercent: commissionRateToPercent,
        commissionPercentToRate: commissionPercentToRate,
        formatScoringWeight: formatScoringWeight,
        sanitizePercentInputValue: sanitizePercentInputValue,
        applyDailyLimitInputs: applyDailyLimitInputs,
        onUnlimitedToggle: onUnlimitedToggle,
        readDailyLimitFromInputs: readDailyLimitFromInputs,
        applyDispatchTierValue: applyDispatchTierValue,
        payoutsCountLabel: payoutsCountLabel,
        formatEarningsCell: formatEarningsCell,
        getServiceCatalogPrice: getServiceCatalogPrice,
        svcBeauticianSearchHaystack: svcBeauticianSearchHaystack,
        scrServiceSearchHaystack: scrServiceSearchHaystack
    };
})(window);
