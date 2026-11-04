/**
 * Lifecycle Campaigns > SMS consent tab (lifecycle-campaigns.html).
 * SMS campaigns only text people who agreed to SMS. Shows how many have,
 * and lets admins check numbers and turn SMS on (recording how they
 * agreed) or off.
 * Requires: auth.js, rbac.js, api-utils/lifecycle-campaigns.js
 */
const SmsConsentTab = (function () {
    'use strict';

    function $(id) { return document.getElementById(id); }
    function esc(s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    }
    function alertBox(msg, type) {
        $('sc-alert').innerHTML = msg ? '<div class="alert alert-' + type + ' mb-0">' + esc(msg) + '</div>' : '';
    }
    function phones() {
        return $('sc-phones').value.split(/[\n,;]+/).map(function (p) { return p.trim(); }).filter(Boolean);
    }
    function when(iso) {
        return iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
    }

    var _wired = false;
    var _canEdit = false;

    function render(rows) {
        var html = rows.map(function (r) {
            if (!r.valid) return '<tr><td>' + esc(r.input) + '</td><td colspan="3" class="text-danger small">Not a phone number</td></tr>';
            if (!r.matches.length) return '<tr><td>' + esc(r.input) + '</td><td colspan="3" class="text-secondary small">No customer or app user has this number</td></tr>';
            return r.matches.map(function (m, i) {
                var how = m.smsConsent
                    ? esc(m.consentSource || 'Agreed') + (m.consentedAt ? ' <span class="text-secondary">(' + when(m.consentedAt) + ')</span>' : '')
                    : m.optedOutAt ? 'Turned off: ' + esc(m.optedOutReason || '') + ' <span class="text-secondary">(' + when(m.optedOutAt) + ')</span>'
                        : '<span class="text-secondary">Never agreed</span>';
                return '<tr>' +
                    '<td>' + (i === 0 ? esc(r.input) : '') + '</td>' +
                    '<td>' + esc(m.name) + '<div class="small text-secondary">' + (m.type === 'customer' ? 'Customer contact' : 'App user') + ' &middot; ' + esc(m.phone) + '</div></td>' +
                    '<td>' + (m.smsConsent ? '<span class="badge bg-success-lt">On</span>' : '<span class="badge bg-secondary-lt">Off</span>') + '</td>' +
                    '<td class="small">' + how + '</td></tr>';
            }).join('');
        }).join('');
        $('sc-tbody').innerHTML = html || '<tr><td colspan="4" class="text-center text-secondary py-4">Nothing to show.</td></tr>';
    }

    async function loadSummary() {
        try {
            var s = await LifecycleCampaigns.smsConsentSummary();
            $('sc-count-customers').textContent = s.customers;
            $('sc-count-users').textContent = s.users;
        } catch (e) {
            alertBox(e.message, 'danger');
        }
    }

    async function check() {
        var list = phones();
        if (!list.length) { alertBox('Enter at least one phone number.', 'warning'); return; }
        alertBox('', '');
        $('sc-btn-check').disabled = true;
        try {
            render(await LifecycleCampaigns.smsConsentLookup(list));
        } catch (e) {
            alertBox(e.message, 'danger');
        } finally {
            $('sc-btn-check').disabled = false;
        }
    }

    async function set(consent) {
        var list = phones();
        var source = $('sc-source').value.trim();
        if (!list.length) { alertBox('Enter at least one phone number.', 'warning'); return; }
        if (consent && source.length < 3) { alertBox('Say how they agreed to SMS, e.g. "Paper form at Lekki branch".', 'warning'); $('sc-source').focus(); return; }
        var q = consent
            ? 'Turn SMS on for ' + list.length + ' number(s)? Only do this if each person agreed to receive Hairlux texts.'
            : 'Turn SMS off for ' + list.length + ' number(s)? They will stop getting SMS campaigns.';
        if (!confirm(q)) return;
        var btn = $(consent ? 'sc-btn-on' : 'sc-btn-off');
        btn.disabled = true;
        try {
            var res = await LifecycleCampaigns.setSmsConsent(list, consent, source);
            var d = res.data || {};
            var extra = [];
            if (d.notFound && d.notFound.length) extra.push(d.notFound.length + ' number(s) not found');
            if (d.invalid && d.invalid.length) extra.push(d.invalid.length + ' not a phone number');
            alertBox(res.message + (extra.length ? ' ' + extra.join(', ') + '.' : ''), d.updated ? 'success' : 'warning');
            render(d.results || []);
            loadSummary();
        } catch (e) {
            alertBox(e.message, 'danger');
        } finally {
            btn.disabled = false;
        }
    }

    function load() {
        if (!_wired) {
            _wired = true;
            _canEdit = RBAC.can('lifecycle_campaigns:update');
            $('sc-btn-check').addEventListener('click', check);
            $('sc-btn-on').addEventListener('click', function () { set(true); });
            $('sc-btn-off').addEventListener('click', function () { set(false); });
            if (!_canEdit) {
                ['sc-btn-on', 'sc-btn-off', 'sc-source-wrap'].forEach(function (id) { $(id).classList.add('d-none'); });
            }
        }
        loadSummary();
    }

    return { load: load };
})();
