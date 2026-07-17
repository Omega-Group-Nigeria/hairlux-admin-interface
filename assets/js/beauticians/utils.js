/**
 * beauticians/utils.js — pure helpers (escape, format, commission math, alerts)
 */
(function (global) {
    'use strict';

    var BP = (global.BeauticiansPage = global.BeauticiansPage || {});
    var State = BP.State;

function showAlert(msg, type) {
    var el = document.getElementById('page-alert');
    if (!msg) { el.classList.add('d-none'); return; }
    el.textContent = msg;
    el.className = 'alert alert-' + (type || 'danger') + ' mb-3';
    el.classList.remove('d-none');
    setTimeout(function () { el.classList.add('d-none'); }, 5000);
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
    return '<div class="' + (colClass || 'col-sm-6 col-lg-4') + '">' +
        '<div class="text-secondary small mb-1">' + escHtml(label) + '</div><div>' + valueHtml + '</div></div>';
}

function detailHeading(title, count) {
    var countHtml = count != null
        ? ' <span class="detail-count text-secondary">(' + escHtml(count) + ')</span>'
        : '';
    return '<div class="detail-section-heading">' + escHtml(title) + countHtml + '</div>';
}

function detailLight(title, innerHtml) {
    return '<div class="detail-subsection">' + detailHeading(title) + innerHtml + '</div>';
}

function detailHeavy(title, innerHtml, count) {
    return '<div class="detail-subsection">' + detailHeading(title, count) +
        '<div class="detail-heavy-box">' + innerHtml + '</div></div>';
}

function formatCommissionLabel(rate) {
    var pct = commissionRateToPercent(rate);
    return pct === '' ? null : pct;
}

function isPdfUrl(url) {
    return /\.pdf(\?|#|$)/i.test(String(url || ''));
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
        setSaveButtonState: setSaveButtonState,
        canAccessSection: canAccessSection,
        escHtml: escHtml,
        detailField: detailField,
        detailHeading: detailHeading,
        detailLight: detailLight,
        detailHeavy: detailHeavy,
        formatCommissionLabel: formatCommissionLabel,
        isPdfUrl: isPdfUrl,
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
