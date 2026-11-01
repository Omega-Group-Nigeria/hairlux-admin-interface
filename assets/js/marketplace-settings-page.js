/**
 * Marketplace Settings page (marketplace-settings.html): vendor sign-ups,
 * review target, agreement, default commission, Pay on Delivery and delivery,
 * vendor payouts (mode, method, hold, minimum) and commission by category.
 * Requires: auth.js, rbac.js, marketplace.js
 */
(function () {
    'use strict';

    function $(id) { return document.getElementById(id); }
    function esc(s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    }
    function alertBox(msg, type) {
        $('page-alert').innerHTML = '<div class="alert alert-' + type + ' alert-dismissible">' + esc(msg) + '<a class="btn-close" data-bs-dismiss="alert"></a></div>';
    }

    function syncDelivery() {
        $('s-pod-percent').disabled = !$('s-pod').checked || !_canEdit;
    }

    var _canEdit = false;

    function fill(s) {
        $('s-accepting').checked = s.acceptingApplications;
        $('s-sla').value = s.reviewSlaHours;
        $('s-agreement-version').value = s.agreementVersion;
        $('s-agreement-url').value = s.agreementUrl || '';
        $('s-commission').value = s.defaultCommissionPercent;
        $('s-pod').checked = s.payOnDeliveryEnabled;
        $('s-pod-percent').value = s.payOnDeliveryDownpaymentPercent;
        $('s-rc-name').value = s.receivingCenterName || '';
        $('s-rc-address').value = s.receivingCenterAddress || '';
        $('s-rc-phone').value = s.receivingCenterPhone || '';
        $('s-rc-hours').value = s.receivingCenterHours || '';
        $('s-low-stock').value = s.lowStockThreshold;
        $('s-payout-mode').value = s.payoutMode;
        $('s-payout-method').value = s.payoutMethod;
        $('s-hold-days').value = s.payoutHoldDays;
        $('s-min-payout').value = s.minPayoutAmount;
        $('s-updated').textContent = 'Last changed ' + new Date(s.updatedAt).toLocaleString('en-GB');
        syncDelivery();
    }

    async function save() {
        var btn = $('btn-save');
        try {
            btn.disabled = true;
            var s = await Marketplace.saveSettings({
                acceptingApplications: $('s-accepting').checked,
                reviewSlaHours: Number($('s-sla').value),
                agreementVersion: $('s-agreement-version').value.trim(),
                agreementUrl: $('s-agreement-url').value.trim() || null,
                defaultCommissionPercent: Number($('s-commission').value),
                payOnDeliveryEnabled: $('s-pod').checked,
                payOnDeliveryDownpaymentPercent: Number($('s-pod-percent').value),
                receivingCenterName: $('s-rc-name').value.trim(),
                receivingCenterAddress: $('s-rc-address').value.trim() || null,
                receivingCenterPhone: $('s-rc-phone').value.trim() || null,
                receivingCenterHours: $('s-rc-hours').value.trim() || null,
                lowStockThreshold: Number($('s-low-stock').value),
                payoutMode: $('s-payout-mode').value,
                payoutMethod: $('s-payout-method').value,
                payoutHoldDays: Number($('s-hold-days').value),
                minPayoutAmount: Number($('s-min-payout').value),
            });
            fill(s);
            alertBox('Settings saved.', 'success');
            loadCategories();
        } catch (e) {
            alertBox(e.message, 'danger');
        } finally {
            btn.disabled = false;
        }
    }

    async function loadCategories() {
        try {
            var cats = await Marketplace.categories();
            $('cat-tbody').innerHTML = cats.length ? cats.map(function (c) {
                var own = c.marketplaceCommissionPercent !== null;
                return '<tr><td>' + esc(c.name) + '</td><td class="text-end">' + c.vendorProducts + '</td>' +
                    '<td><div class="input-group input-group-sm" style="max-width:150px"><input type="number" class="form-control" min="0" max="100" step="0.01" placeholder="Default" data-cat="' + esc(c.id) + '" value="' + (own ? c.marketplaceCommissionPercent : '') + '"' + (_canEdit ? '' : ' disabled') + '><span class="input-group-text">%</span></div></td>' +
                    '<td class="small">' + c.effectivePercent + '%' + (own ? '' : ' <span class="text-secondary">(default)</span>') + '</td>' +
                    '<td class="text-end">' + (_canEdit ? '<button class="btn btn-sm" data-save-cat="' + esc(c.id) + '">Save</button>' : '') + '</td></tr>';
            }).join('') : '<tr><td colspan="5" class="text-center text-secondary py-4">No product categories yet.</td></tr>';
        } catch (e) {
            $('cat-tbody').innerHTML = '<tr><td colspan="5" class="text-center text-danger py-4">' + esc(e.message) + '</td></tr>';
        }
    }

    async function saveCategory(id, btn) {
        var raw = document.querySelector('[data-cat="' + id + '"]').value.trim();
        btn.disabled = true;
        try {
            var c = await Marketplace.setCategoryCommission(id, raw === '' ? null : Number(raw));
            alertBox(c.name + ': commission is now ' + c.effectivePercent + '% for new orders.', 'success');
            loadCategories();
        } catch (e) {
            alertBox(e.message, 'danger');
            btn.disabled = false;
        }
    }

    document.addEventListener('DOMContentLoaded', async function () {
        if (!RBAC.applyPageGuard('marketplace:read')) return;
        _canEdit = RBAC.can('marketplace:manage_settings');
        document.querySelectorAll('.page-body input, .page-body select').forEach(function (el) { el.disabled = !_canEdit; });
        if (_canEdit) $('btn-save').classList.remove('d-none');
        $('s-pod').addEventListener('change', syncDelivery);
        $('btn-save').addEventListener('click', save);
        $('cat-tbody').addEventListener('click', function (e) {
            var b = e.target.closest('[data-save-cat]');
            if (b) saveCategory(b.dataset.saveCat, b);
        });
        loadCategories();
        try {
            fill(await Marketplace.getSettings());
        } catch (e) {
            alertBox(e.message, 'danger');
        }
    });
})();
