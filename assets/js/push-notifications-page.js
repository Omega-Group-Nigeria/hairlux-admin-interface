/**
 * Push Notifications page (push-notifications.html).
 * Send a notification to the customer or beautician app now, or schedule it;
 * see what was sent and its results; cancel or send early a scheduled one.
 * Requires: auth.js, rbac.js, push-campaigns.js, tabler.min.js
 */
(function () {
    'use strict';

    var bootstrap = window.tabler.bootstrap;
    var P = { read: 'push_campaigns:read', send: 'push_campaigns:send' };
    var AUDIENCE = { CUSTOMERS: 'Customer app', BEAUTICIANS: 'Beautician app', ALL: 'Both apps' };
    var PLATFORM = { ALL: 'iPhone and Android', IOS: 'iPhone only', ANDROID: 'Android only' };
    var STATUS = {
        SCHEDULED: { label: 'Scheduled', cls: 'bg-blue-lt' },
        SENDING: { label: 'Sending...', cls: 'bg-yellow-lt' },
        SENT: { label: 'Sent', cls: 'bg-green-lt' },
        CANCELLED: { label: 'Cancelled', cls: 'bg-secondary-lt' },
        FAILED: { label: 'Failed', cls: 'bg-red-lt' },
    };

    var _status = '';
    var _page = 1;
    var _meta = null;
    var _pending = null;      // payload waiting for the confirm button
    var _confirmAction = null;
    var _refreshTimer = null;
    var _sizeTimer = null;

    function $(id) { return document.getElementById(id); }
    function esc(s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    }
    function fmt(v) { return v ? new Date(v).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-'; }
    function plural(n, word) { return n + ' ' + word + (n === 1 ? '' : 's'); }
    function showAlert(msg, type) {
        $('page-alert').innerHTML = '<div class="alert alert-' + type + ' alert-dismissible" role="alert">' + esc(msg) +
            '<a class="btn-close" data-bs-dismiss="alert" aria-label="close"></a></div>';
        if (type === 'success') setTimeout(function () { $('page-alert').innerHTML = ''; }, 6000);
    }
    function when() { return document.querySelector('input[name="f-when"]:checked').value; }

    // ── Compose ─────────────────────────────────────────────────────────

    function updatePreview() {
        var t = $('f-title').value, b = $('f-body').value;
        $('pv-title').textContent = t || 'Title';
        $('pv-body').textContent = b || 'Message';
        $('title-count').textContent = t.length + '/80';
        $('body-count').textContent = b.length + '/300';
    }

    function updateWhen() {
        var later = when() === 'later';
        $('f-at').classList.toggle('d-none', !later);
        $('at-hint').classList.toggle('d-none', !later);
        $('btn-send').textContent = later ? 'Schedule' : 'Send now';
        if (later && !$('f-at').value) {
            var d = new Date(Date.now() + 60 * 60 * 1000);
            d.setMinutes(0, 0, 0);
            $('f-at').value = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
        }
    }

    var _size = null;
    function loadSize() {
        clearTimeout(_sizeTimer);
        $('audience-size').textContent = 'Counting...';
        _sizeTimer = setTimeout(async function () {
            try {
                var s = await PushCampaigns.audience($('f-audience').value, $('f-platform').value);
                _size = s;
                $('audience-size').innerHTML = s.devices
                    ? 'Reaches <strong>' + plural(s.people, 'person').replace('persons', 'people') + '</strong> on ' + plural(s.devices, 'device') + ' right now.'
                    : '<span class="text-warning">Nobody in this group has the app with notifications on yet.</span>';
                $('push-not-ready').innerHTML = s.pushReady ? '' :
                    '<div class="alert alert-warning">Push notifications are not set up on the server (Firebase), so nothing can be sent now. You can still schedule notifications.</div>';
            } catch (e) {
                $('audience-size').textContent = e.message;
            }
        }, 150);
    }

    function readForm() {
        var payload = {
            audience: $('f-audience').value,
            platform: $('f-platform').value,
            title: $('f-title').value.trim(),
            body: $('f-body').value.trim(),
            link: $('f-link').value.trim() || undefined,
        };
        if (!payload.title) throw new Error('Give the notification a title.');
        if (!payload.body) throw new Error('Write the message.');
        if (payload.link && !/^(https:\/\/\S+|[a-z][a-z0-9+.-]*:\/\/\S+|\/\S*)$/i.test(payload.link)) {
            throw new Error('The link must start with https://, an app link (hairlux://...) or /.');
        }
        if (when() === 'later') {
            if (!$('f-at').value) throw new Error('Choose when to send it.');
            var at = new Date($('f-at').value);
            if (isNaN(at.getTime())) throw new Error('Choose a valid date and time.');
            if (at.getTime() < Date.now() + 60000) throw new Error('Choose a time at least a minute from now, or send it now.');
            payload.scheduledFor = at.toISOString();
        }
        return payload;
    }

    function askToSend() {
        $('f-error').hidden = true;
        try {
            _pending = readForm();
        } catch (e) {
            $('f-error').textContent = e.message;
            $('f-error').hidden = false;
            return;
        }
        var who = AUDIENCE[_pending.audience] + ' users (' + PLATFORM[_pending.platform] + ')';
        var reach = _size && _size.audience === _pending.audience && _size.platform === _pending.platform
            ? ', about ' + plural(_size.people, 'person').replace('persons', 'people') : '';
        $('confirm-title').textContent = _pending.scheduledFor ? 'Schedule this notification?' : 'Send this notification now?';
        $('confirm-text').innerHTML = '<p class="mb-1"><strong>' + esc(_pending.title) + '</strong></p><p class="text-secondary">' + esc(_pending.body) + '</p>' +
            '<p class="mb-0">To ' + esc(who) + esc(reach) + (_pending.scheduledFor ? ', on <strong>' + esc(fmt(_pending.scheduledFor)) + '</strong>' : ', <strong>now</strong>') + '.' +
            (_pending.scheduledFor ? '' : ' This cannot be undone.') + '</p>';
        $('btn-confirm').textContent = _pending.scheduledFor ? 'Schedule' : 'Send';
        _confirmAction = sendPending;
        bootstrap.Modal.getOrCreateInstance($('modal-confirm')).show();
    }

    async function sendPending() {
        var r = await PushCampaigns.create(_pending);
        ['f-title', 'f-body', 'f-link'].forEach(function (id) { $(id).value = ''; });
        updatePreview();
        showAlert(r.status === 'SCHEDULED' ? 'Scheduled for ' + fmt(r.scheduledFor) + '.' : 'Sending now. The results appear below in a moment.', 'success');
    }

    // ── History ─────────────────────────────────────────────────────────

    function results(c) {
        if (c.status === 'SENT') {
            if (!c.devices) return '<span class="text-warning">' + esc(c.error || 'Nobody to send to') + '</span>';
            return plural(c.recipients, 'person').replace('persons', 'people') + ' · ' + c.delivered + ' of ' + plural(c.devices, 'device') + ' delivered' +
                (c.failed ? ' <span class="text-secondary">(' + c.failed + ' not delivered)</span>' : '');
        }
        if (c.status === 'FAILED') return '<span class="text-danger">' + esc(c.error || 'Failed') + '</span>';
        if (c.status === 'CANCELLED') return 'Cancelled' + (c.cancelledBy ? ' by ' + esc(c.cancelledBy) : '') + ' ' + esc(fmt(c.cancelledAt));
        if (c.status === 'SCHEDULED') return 'Goes out ' + esc(fmt(c.scheduledFor));
        return 'Sending...';
    }

    async function load() {
        clearTimeout(_refreshTimer);
        try {
            var res = await PushCampaigns.list({ status: _status || undefined, page: _page });
            _meta = res.meta;
            $('scheduled-count').textContent = _meta.scheduled || '';
            $('page-label').textContent = _meta.total ? plural(_meta.total, 'notification') + (_meta.totalPages > 1 ? ' · page ' + _meta.page + ' of ' + _meta.totalPages : '') : '';
            $('btn-prev').disabled = _meta.page <= 1;
            $('btn-next').disabled = _meta.page >= _meta.totalPages;
            var canSend = RBAC.can(P.send);
            $('campaign-list').innerHTML = res.data.length ? res.data.map(function (c) {
                var st = STATUS[c.status] || { label: c.status, cls: 'bg-secondary-lt' };
                var actions = c.status === 'SCHEDULED' && canSend
                    ? '<div class="btn-list mt-2"><button class="btn btn-sm btn-outline-primary" data-send-now="' + esc(c.id) + '">Send now</button>' +
                      '<button class="btn btn-sm btn-outline-danger" data-cancel="' + esc(c.id) + '">Cancel</button></div>'
                    : '';
                return '<div class="list-group-item">' +
                    '<div class="d-flex justify-content-between gap-2"><div style="min-width:0"><div class="fw-semibold">' + esc(c.title) + '</div>' +
                    '<div class="text-secondary small">' + esc(c.body) + '</div>' +
                    (c.link ? '<div class="small text-truncate">Link: ' + esc(c.link) + '</div>' : '') + '</div>' +
                    '<span class="badge ' + st.cls + ' align-self-start">' + esc(st.label) + '</span></div>' +
                    '<div class="small mt-1">' + esc(AUDIENCE[c.audience] || c.audience) + ', ' + esc(PLATFORM[c.platform] || c.platform) + ' · ' + results(c) + '</div>' +
                    '<div class="small text-secondary">' + (c.status === 'SCHEDULED' ? 'Scheduled' : 'Created') + ' by ' + esc(c.createdBy || 'an admin') + ' · ' + esc(fmt(c.createdAt)) +
                    (c.sentAt ? ' · sent ' + esc(fmt(c.sentAt)) : '') + '</div>' + actions + '</div>';
            }).join('') : '<div class="list-group-item text-center text-secondary py-5">No notifications here yet.</div>';
            // Keep "Sending..." up to date until it finishes.
            if (res.data.some(function (c) { return c.status === 'SENDING'; })) _refreshTimer = setTimeout(load, 4000);
        } catch (e) {
            $('campaign-list').innerHTML = '<div class="list-group-item text-center text-danger py-5">' + esc(e.message) + '</div>';
        }
    }

    function askToCancel(id) {
        $('confirm-title').textContent = 'Cancel this scheduled notification?';
        $('confirm-text').textContent = 'It will not be sent. You can create it again later.';
        $('btn-confirm').textContent = 'Cancel it';
        _confirmAction = async function () { await PushCampaigns.cancel(id); showAlert('Scheduled notification cancelled.', 'success'); };
        bootstrap.Modal.getOrCreateInstance($('modal-confirm')).show();
    }

    function askToSendNow(id) {
        $('confirm-title').textContent = 'Send it now instead?';
        $('confirm-text').textContent = 'The scheduled notification goes out straight away. This cannot be undone.';
        $('btn-confirm').textContent = 'Send now';
        _confirmAction = async function () { await PushCampaigns.sendNow(id); showAlert('Sending now. The results appear below in a moment.', 'success'); };
        bootstrap.Modal.getOrCreateInstance($('modal-confirm')).show();
    }

    document.addEventListener('DOMContentLoaded', function () {
        if (!RBAC.applyPageGuard(P.read)) return;
        if (RBAC.can(P.send)) {
            $('compose-col').classList.remove('d-none');
            $('list-col').classList.replace('col-12', 'col-lg-7');
            ['f-title', 'f-body'].forEach(function (id) { $(id).addEventListener('input', updatePreview); });
            ['f-audience', 'f-platform'].forEach(function (id) { $(id).addEventListener('change', loadSize); });
            document.querySelectorAll('input[name="f-when"]').forEach(function (r) { r.addEventListener('change', updateWhen); });
            $('btn-send').addEventListener('click', askToSend);
            updatePreview();
            loadSize();
        }
        $('btn-confirm').addEventListener('click', async function () {
            var btn = $('btn-confirm');
            btn.disabled = true;
            try {
                await _confirmAction();
                bootstrap.Modal.getOrCreateInstance($('modal-confirm')).hide();
                load();
            } catch (e) {
                bootstrap.Modal.getOrCreateInstance($('modal-confirm')).hide();
                showAlert(e.message, 'danger');
            } finally {
                btn.disabled = false;
            }
        });
        document.querySelectorAll('#status-tabs [data-status]').forEach(function (a) {
            a.addEventListener('click', function (e) {
                e.preventDefault();
                document.querySelectorAll('#status-tabs .nav-link').forEach(function (x) { x.classList.remove('active'); });
                a.classList.add('active');
                _status = a.dataset.status;
                _page = 1;
                load();
            });
        });
        $('campaign-list').addEventListener('click', function (e) {
            var c = e.target.closest('[data-cancel]');
            if (c) return askToCancel(c.dataset.cancel);
            var s = e.target.closest('[data-send-now]');
            if (s) askToSendNow(s.dataset.sendNow);
        });
        $('btn-prev').addEventListener('click', function () { if (_page > 1) { _page--; load(); } });
        $('btn-next').addEventListener('click', function () { if (_meta && _page < _meta.totalPages) { _page++; load(); } });
        load();
    });
})();
