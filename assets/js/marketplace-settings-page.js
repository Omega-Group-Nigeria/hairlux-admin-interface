/**
 * Marketplace Settings page (marketplace-settings.html): vendor sign-ups,
 * review target, agreement, default commission, Pay on Delivery and delivery.
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
        var mode = $('s-delivery-mode').value;
        $('s-static-fee-wrap').hidden = mode !== 'STATIC';
        $('s-partner-note').hidden = mode !== 'PARTNER_API';
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
        $('s-delivery-mode').value = s.deliveryMode;
        $('s-static-fee').value = s.staticDeliveryFee === null ? '' : s.staticDeliveryFee;
        $('s-confirm-hours').value = s.vendorConfirmHours;
        $('s-updated').textContent = 'Last changed ' + new Date(s.updatedAt).toLocaleString('en-GB');
        syncDelivery();
    }

    async function save() {
        var btn = $('btn-save');
        try {
            btn.disabled = true;
            var fee = $('s-static-fee').value.trim();
            var s = await Marketplace.saveSettings({
                acceptingApplications: $('s-accepting').checked,
                reviewSlaHours: Number($('s-sla').value),
                agreementVersion: $('s-agreement-version').value.trim(),
                agreementUrl: $('s-agreement-url').value.trim() || null,
                defaultCommissionPercent: Number($('s-commission').value),
                payOnDeliveryEnabled: $('s-pod').checked,
                payOnDeliveryDownpaymentPercent: Number($('s-pod-percent').value),
                deliveryMode: $('s-delivery-mode').value,
                staticDeliveryFee: fee === '' ? null : Number(fee),
                vendorConfirmHours: Number($('s-confirm-hours').value),
            });
            fill(s);
            alertBox('Settings saved.', 'success');
        } catch (e) {
            alertBox(e.message, 'danger');
        } finally {
            btn.disabled = false;
        }
    }

    document.addEventListener('DOMContentLoaded', async function () {
        if (!RBAC.applyPageGuard('marketplace:read')) return;
        _canEdit = RBAC.can('marketplace:manage_settings');
        document.querySelectorAll('.page-body input, .page-body select').forEach(function (el) { el.disabled = !_canEdit; });
        if (_canEdit) $('btn-save').classList.remove('d-none');
        $('s-delivery-mode').addEventListener('change', syncDelivery);
        $('s-pod').addEventListener('change', syncDelivery);
        $('btn-save').addEventListener('click', save);
        try {
            fill(await Marketplace.getSettings());
        } catch (e) {
            alertBox(e.message, 'danger');
        }
    });
})();
