/**
 * Lifecycle Campaigns > Thank-you message tab (lifecycle-campaigns.html).
 * The message customers get after a completed branch visit or home-service
 * booking: on/off, which services, delay, and the email / SMS / push wording.
 * API: /admin/thank-you-message. Requires: auth.js, rbac.js
 */
const ThankYouTab = (function () {
    'use strict';

    function $(id) { return document.getElementById(id); }
    function esc(s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    }
    async function api(path, options) {
        var res = await Auth.fetch(path, options || {});
        var raw = await res.json().catch(function () { return {}; });
        if (!res.ok) throw new Error(Array.isArray(raw.message) ? raw.message.join(' ') : (raw.message || 'Request failed (' + res.status + ')'));
        return raw.data !== undefined ? raw.data : raw;
    }
    function jsonBody(method, body) {
        return { method: method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
    }
    function alertBox(id, msg, type) {
        $(id).innerHTML = msg ? '<div class="alert alert-' + type + ' mb-0">' + esc(msg) + '</div>' : '';
    }

    var SAMPLE = { firstName: 'Ada', customerName: 'Ada Obi', serviceName: 'Knotless Braids', branchName: 'Lekki', bookingCode: 'HLB-001234' };
    function fill(t) {
        return String(t || '').replace(/\{\{\s*(\w+)\s*\}\}/g, function (_m, k) { return SAMPLE[k] != null ? SAMPLE[k] : ''; }).replace(/[ \t]{2,}/g, ' ').trim();
    }

    var _wired = false;
    var _canEdit = false;
    var _page = 1;

    var CHECKS = ['isEnabled', 'forSalonVisits', 'forHomeService', 'emailEnabled', 'smsEnabled', 'pushEnabled'];
    var TEXTS = ['emailSubject', 'emailBody', 'smsBody', 'pushTitle', 'pushBody'];

    function formValues() {
        var v = {};
        CHECKS.forEach(function (k) { v[k] = $('ty-' + k).checked; });
        TEXTS.forEach(function (k) { v[k] = $('ty-' + k).value; });
        var amount = Math.max(0, parseInt($('ty-delayAmount').value, 10) || 0);
        v.delayMinutes = Math.min(10080, amount * parseInt($('ty-delayUnit').value, 10));
        return v;
    }

    function setForm(s) {
        CHECKS.forEach(function (k) { $('ty-' + k).checked = !!s[k]; });
        TEXTS.forEach(function (k) { $('ty-' + k).value = s[k] || ''; });
        var m = s.delayMinutes || 0;
        var unit = m && m % 1440 === 0 ? 1440 : m && m % 60 === 0 ? 60 : 1;
        $('ty-delayUnit').value = String(unit);
        $('ty-delayAmount').value = String(m / unit);
        sync();
    }

    function smsPages(n) { return n <= 160 ? 1 : Math.ceil(n / 153); }

    /** Shows/hides channel fields and refreshes the previews. */
    function sync() {
        var v = formValues();
        $('ty-email-fields').style.display = v.emailEnabled ? '' : 'none';
        $('ty-sms-fields').style.display = v.smsEnabled ? '' : 'none';
        $('ty-push-fields').style.display = v.pushEnabled ? '' : 'none';
        $('ty-options').style.opacity = v.isEnabled ? '1' : '0.55';
        var sms = fill(v.smsBody);
        $('ty-sms-preview').textContent = sms;
        $('ty-sms-count').textContent = sms.length + ' characters with sample values, about ' + smsPages(sms.length) + ' SMS page(s)';
        $('ty-push-preview').innerHTML = '<strong>' + esc(fill(v.pushTitle)) + '</strong><br>' + esc(fill(v.pushBody));
        $('ty-email-preview').innerHTML = '<strong>' + esc(fill(v.emailSubject)) + '</strong><br>' + esc(fill(v.emailBody)).replace(/\n/g, '<br>');
    }

    async function load() {
        if (!_wired) wire();
        alertBox('ty-alert', '', '');
        try {
            setForm(await api('/admin/thank-you-message/settings'));
        } catch (e) {
            alertBox('ty-alert', e.message, 'danger');
        }
        loadHistory(1);
    }

    async function save() {
        var v = formValues();
        $('ty-btn-save').disabled = true;
        try {
            setForm(await api('/admin/thank-you-message/settings', jsonBody('PUT', v)));
            alertBox('ty-alert', v.isEnabled ? 'Saved. Customers will get this after each completed service.' : 'Saved. The thank-you message is off.', 'success');
        } catch (e) {
            alertBox('ty-alert', e.message, 'danger');
        } finally {
            $('ty-btn-save').disabled = false;
        }
    }

    async function test(channel) {
        var to = $('ty-test-to').value.trim();
        if (!to) { alertBox('ty-test-alert', channel === 'EMAIL' ? 'Enter an email address for the test.' : 'Enter a phone number for the test.', 'warning'); return; }
        var v = formValues();
        var draft = {};
        TEXTS.forEach(function (k) { draft[k] = v[k]; });
        try {
            var r = await api('/admin/thank-you-message/test', jsonBody('POST', { channel: channel, to: to, draft: draft }));
            alertBox('ty-test-alert', r.sent ? 'Test sent to ' + to + ' (sample values: Ada, Knotless Braids, Lekki).' : 'The test could not be sent. Check the email/SMS settings on the server.', r.sent ? 'success' : 'warning');
        } catch (e) {
            alertBox('ty-test-alert', e.message, 'danger');
        }
    }

    var STATUS_BADGE = { SENT: 'bg-success-lt', SKIPPED: 'bg-secondary-lt', FAILED: 'bg-danger-lt', PENDING: 'bg-warning-lt', SENDING: 'bg-warning-lt' };
    var CHANNEL = { EMAIL: 'Email', SMS: 'SMS', PUSH: 'Push' };

    async function loadHistory(page) {
        _page = page;
        var q = '?page=' + page + '&limit=15' + ($('ty-h-status').value ? '&status=' + $('ty-h-status').value : '');
        try {
            var r = await api('/admin/thank-you-message/history' + q);
            var c = (r.meta && r.meta.last30Days) || {};
            $('ty-h-summary').textContent = 'Last 30 days: ' + (c.SENT || 0) + ' sent, ' + (c.SKIPPED || 0) + ' skipped, ' + (c.FAILED || 0) + ' failed' + (c.PENDING ? ', ' + c.PENDING + ' waiting' : '');
            $('ty-h-tbody').innerHTML = (r.data || []).map(function (x) {
                var when = new Date(x.sentAt || x.sendAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
                return '<tr><td class="small">' + esc(when) + '</td>' +
                    '<td>' + esc(CHANNEL[x.channel] || x.channel) + '</td>' +
                    '<td class="small">' + (x.bookingType === 'SALON' ? 'Branch visit' : 'Home service') + '</td>' +
                    '<td class="small">' + esc(x.recipient || '') + '</td>' +
                    '<td><span class="badge ' + (STATUS_BADGE[x.status] || '') + '">' + esc(x.status) + '</span>' +
                    (x.reason ? '<div class="small text-secondary">' + esc(x.reason) + '</div>' : '') + '</td></tr>';
            }).join('') || '<tr><td colspan="5" class="text-center text-secondary py-4">No thank-you messages yet.</td></tr>';
            var pages = (r.meta && r.meta.totalPages) || 1;
            $('ty-h-prev').disabled = page <= 1;
            $('ty-h-next').disabled = page >= pages;
            $('ty-h-page').textContent = 'Page ' + page + ' of ' + pages;
        } catch (e) {
            $('ty-h-tbody').innerHTML = '<tr><td colspan="5" class="text-danger small">' + esc(e.message) + '</td></tr>';
        }
    }

    function wire() {
        _wired = true;
        _canEdit = RBAC.can('lifecycle_campaigns:update');
        $('tab-thank-you').addEventListener('input', sync);
        $('tab-thank-you').addEventListener('change', sync);
        $('ty-btn-save').addEventListener('click', save);
        $('ty-btn-test-email').addEventListener('click', function () { test('EMAIL'); });
        $('ty-btn-test-sms').addEventListener('click', function () { test('SMS'); });
        $('ty-h-status').addEventListener('change', function () { loadHistory(1); });
        $('ty-h-prev').addEventListener('click', function () { loadHistory(_page - 1); });
        $('ty-h-next').addEventListener('click', function () { loadHistory(_page + 1); });
        if (!_canEdit) {
            $('ty-actions').classList.add('d-none');
            $('ty-test-card').classList.add('d-none');
            $('tab-thank-you').querySelectorAll('input, textarea, select').forEach(function (el) {
                if (el.id !== 'ty-h-status') el.disabled = true;
            });
        }
    }

    return { load: load };
})();
