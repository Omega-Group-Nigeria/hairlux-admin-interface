/**
 * Email & SMS Broadcasts page (broadcasts.html).
 * Compose an email or SMS to customers or beauticians, send now or schedule,
 * and see past broadcasts with how many were sent and failed.
 * Requires: auth.js, rbac.js, api-utils/broadcasts.js, tabler.min.js
 */
(function () {
    'use strict';

    var bootstrap = window.tabler.bootstrap;
    var P = { read: 'broadcasts:read', send: 'broadcasts:send' };
    var AUDIENCE = {
        ALL_CUSTOMERS: 'All customers',
        CUSTOMERS: 'Customers with an account',
        SALON_CUSTOMERS: 'Salon customers without an account',
        BEAUTICIANS: 'Beauticians',
    };
    var CHANNEL = { EMAIL: 'Email', SMS: 'SMS' };
    var STATUS = {
        SCHEDULED: { label: 'Scheduled', cls: 'bg-blue-lt' },
        SENDING: { label: 'Sending...', cls: 'bg-yellow-lt' },
        SENT: { label: 'Sent', cls: 'bg-green-lt' },
        CANCELLED: { label: 'Cancelled', cls: 'bg-secondary-lt' },
        FAILED: { label: 'Failed', cls: 'bg-red-lt' },
    };
    var SMS_MAX = 612; // 4 texts

    var _status = '';
    var _channelFilter = '';
    var _page = 1;
    var _meta = null;
    var _pending = null;
    var _confirmAction = null;
    var _refreshTimer = null;
    var _sizeTimer = null;
    var _size = null;

    function $(id) { return document.getElementById(id); }
    function esc(s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    }
    function fmt(v) { return v ? new Date(v).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-'; }
    function plural(n, word) { return n + ' ' + word + (n === 1 ? '' : 's'); }
    function people(n) { return plural(n, 'person').replace('persons', 'people'); }
    function showAlert(msg, type) {
        $('page-alert').innerHTML = '<div class="alert alert-' + type + ' alert-dismissible" role="alert">' + esc(msg) +
            '<a class="btn-close" data-bs-dismiss="alert" aria-label="close"></a></div>';
        if (type === 'success') setTimeout(function () { $('page-alert').innerHTML = ''; }, 6000);
    }
    function when() { return document.querySelector('input[name="f-when"]:checked').value; }
    function channel() { return document.querySelector('input[name="f-channel"]:checked').value; }

    /** Characters outside the basic SMS alphabet (e.g. the naira sign, emoji) make each text much shorter. */
    function smsParts(text) {
        var unicode = /[^\n\r\x20-\x7E£¥èéùìòÇØøÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ¡ÄÖÑÜ§¿äöñüà€]/.test(text);
        var single = unicode ? 70 : 160, multi = unicode ? 67 : 153;
        var n = text.length;
        return { unicode: unicode, parts: n === 0 ? 0 : n <= single ? 1 : Math.ceil(n / multi) };
    }

    // ── Compose ─────────────────────────────────────────────────────────

    function updateCounts() {
        var isSms = channel() === 'SMS';
        var body = $('f-body').value;
        $('subject-wrap').classList.toggle('d-none', isSms);
        $('subject-count').textContent = $('f-subject').value.length + '/150';
        if (isSms) {
            var s = smsParts(body);
            $('body-count').textContent = body.length + '/' + SMS_MAX + (s.parts ? ' · ' + plural(s.parts, 'text') + ' per person' : '');
            $('body-hint').innerHTML = 'Each person is charged as ' + (s.parts || 1) + ' text' + (s.parts > 1 ? 's' : '') + '. ' +
                (s.unicode ? '<span class="text-warning">Special characters (like ₦ or emoji) make each text shorter; write NGN instead of ₦.</span> ' : '') +
                'Write <code>{{firstName}}</code> to use each person\'s first name.';
        } else {
            $('body-count').textContent = '';
            $('body-hint').innerHTML = 'Plain text. Leave a blank line between paragraphs. Write <code>{{firstName}}</code> to use each person\'s first name. ' +
                'The email uses the HairLux design and ends with an unsubscribe link.';
        }
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

    function loadSize() {
        clearTimeout(_sizeTimer);
        $('audience-size').textContent = 'Counting...';
        _sizeTimer = setTimeout(async function () {
            try {
                var s = await Broadcasts.audience(channel(), $('f-audience').value);
                _size = s;
                $('audience-size').innerHTML = s.people
                    ? 'Reaches <strong>' + people(s.people) + '</strong> right now' + (s.channel === 'SMS' ? ' (people who agreed to marketing texts).' : ' (after unsubscribes).')
                    : '<span class="text-warning">' + (s.channel === 'SMS' ? 'Nobody in this group has agreed to marketing texts yet.' : 'Nobody in this group can get marketing emails.') + '</span>';
            } catch (e) {
                $('audience-size').textContent = e.message;
            }
        }, 150);
    }

    function readForm() {
        var payload = { channel: channel(), audience: $('f-audience').value, body: $('f-body').value.trim() };
        if (payload.channel === 'EMAIL') {
            payload.subject = $('f-subject').value.trim();
            if (!payload.subject) throw new Error('Give the email a subject.');
        }
        if (!payload.body) throw new Error('Write the message.');
        if (payload.channel === 'SMS' && payload.body.length > SMS_MAX) throw new Error('An SMS can be at most ' + SMS_MAX + ' characters (4 texts).');
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
        var reach = _size && _size.channel === _pending.channel && _size.audience === _pending.audience ? ', about ' + people(_size.people) : '';
        var cost = '';
        if (_pending.channel === 'SMS' && _size && _size.channel === 'SMS' && _size.audience === _pending.audience) {
            var parts = smsParts(_pending.body).parts;
            cost = '<p class="mb-0 mt-2 text-secondary small">About ' + (parts * _size.people).toLocaleString() + ' texts in total (' + plural(parts, 'text') + ' per person).</p>';
        }
        $('confirm-title').textContent = (_pending.scheduledFor ? 'Schedule this ' : 'Send this ') + (_pending.channel === 'SMS' ? 'SMS' : 'email') + (_pending.scheduledFor ? '?' : ' now?');
        $('confirm-text').innerHTML =
            (_pending.subject ? '<p class="mb-1"><strong>' + esc(_pending.subject) + '</strong></p>' : '') +
            '<div class="text-secondary border rounded p-2 mb-2" style="white-space:pre-wrap;max-height:220px;overflow:auto">' + esc(_pending.body) + '</div>' +
            '<p class="mb-0">To ' + esc(AUDIENCE[_pending.audience]) + esc(reach) + (_pending.scheduledFor ? ', on <strong>' + esc(fmt(_pending.scheduledFor)) + '</strong>' : ', <strong>now</strong>') + '.' +
            (_pending.scheduledFor ? '' : ' This cannot be undone.') + '</p>' + cost;
        $('btn-confirm').textContent = _pending.scheduledFor ? 'Schedule' : 'Send';
        _confirmAction = sendPending;
        bootstrap.Modal.getOrCreateInstance($('modal-confirm')).show();
    }

    async function sendPending() {
        var r = await Broadcasts.create(_pending);
        ['f-subject', 'f-body'].forEach(function (id) { $(id).value = ''; });
        updateCounts();
        showAlert(r.status === 'SCHEDULED' ? 'Scheduled for ' + fmt(r.scheduledFor) + '.' : 'Sending now. The results appear below as it goes.', 'success');
    }

    // ── History ─────────────────────────────────────────────────────────

    function results(b) {
        var unit = b.channel === 'SMS' ? 'text' : 'email';
        if (b.status === 'SENT') {
            if (!b.recipients) return '<span class="text-warning">' + esc(b.error || 'Nobody to send to') + '</span>';
            return plural(b.sent, unit) + ' sent to ' + people(b.recipients) +
                (b.failed ? ' <span class="text-danger">(' + b.failed + ' not sent)</span>' : '');
        }
        if (b.status === 'SENDING') {
            return 'Sending... ' + (b.recipients ? (b.sent + b.failed) + ' of ' + b.recipients + ' done' : '');
        }
        if (b.status === 'FAILED') return '<span class="text-danger">' + esc(b.error || 'Failed') + '</span>' +
            (b.sent ? ' · ' + plural(b.sent, unit) + ' had gone out' : '');
        if (b.status === 'CANCELLED') return 'Cancelled' + (b.cancelledBy ? ' by ' + esc(b.cancelledBy) : '') + ' ' + esc(fmt(b.cancelledAt));
        if (b.status === 'SCHEDULED') return 'Goes out ' + esc(fmt(b.scheduledFor));
        return '';
    }

    async function load() {
        clearTimeout(_refreshTimer);
        try {
            var res = await Broadcasts.list({ status: _status || undefined, channel: _channelFilter || undefined, page: _page });
            _meta = res.meta;
            $('scheduled-count').textContent = _meta.scheduled || '';
            $('page-label').textContent = _meta.total ? plural(_meta.total, 'broadcast') + (_meta.totalPages > 1 ? ' · page ' + _meta.page + ' of ' + _meta.totalPages : '') : '';
            $('btn-prev').disabled = _meta.page <= 1;
            $('btn-next').disabled = _meta.page >= _meta.totalPages;
            var canSend = RBAC.can(P.send);
            $('broadcast-list').innerHTML = res.data.length ? res.data.map(function (b) {
                var st = STATUS[b.status] || { label: b.status, cls: 'bg-secondary-lt' };
                var actions = b.status === 'SCHEDULED' && canSend
                    ? '<div class="btn-list mt-2"><button class="btn btn-sm btn-outline-primary" data-send-now="' + esc(b.id) + '">Send now</button>' +
                      '<button class="btn btn-sm btn-outline-danger" data-cancel="' + esc(b.id) + '">Cancel</button></div>'
                    : '';
                return '<div class="list-group-item">' +
                    '<div class="d-flex justify-content-between gap-2"><div style="min-width:0">' +
                    '<span class="badge ' + (b.channel === 'SMS' ? 'bg-purple-lt' : 'bg-azure-lt') + ' me-1">' + esc(CHANNEL[b.channel] || b.channel) + '</span>' +
                    '<span class="fw-semibold">' + esc(b.subject || b.body.slice(0, 60) + (b.body.length > 60 ? '...' : '')) + '</span>' +
                    '<div class="text-secondary small text-truncate">' + esc(b.body) + '</div></div>' +
                    '<span class="badge ' + st.cls + ' align-self-start">' + esc(st.label) + '</span></div>' +
                    '<div class="small mt-1">' + esc(AUDIENCE[b.audience] || b.audience) + ' · ' + results(b) + '</div>' +
                    '<div class="small text-secondary mt-1">' + (b.status === 'SCHEDULED' ? 'Scheduled' : 'Created') + ' by ' + esc(b.createdBy || 'an admin') + ' · ' + esc(fmt(b.createdAt)) +
                    (b.sentAt ? ' · finished ' + esc(fmt(b.sentAt)) : '') + '</div>' + actions + '</div>';
            }).join('') : '<div class="list-group-item text-center text-secondary py-5">No broadcasts here yet.</div>';
            if (res.data.some(function (b) { return b.status === 'SENDING'; })) _refreshTimer = setTimeout(load, 4000);
        } catch (e) {
            $('broadcast-list').innerHTML = '<div class="list-group-item text-center text-danger py-5">' + esc(e.message) + '</div>';
        }
    }

    function askToCancel(id) {
        $('confirm-title').textContent = 'Cancel this scheduled broadcast?';
        $('confirm-text').textContent = 'It will not be sent. You can create it again later.';
        $('btn-confirm').textContent = 'Cancel it';
        _confirmAction = async function () { await Broadcasts.cancel(id); showAlert('Scheduled broadcast cancelled.', 'success'); };
        bootstrap.Modal.getOrCreateInstance($('modal-confirm')).show();
    }

    function askToSendNow(id) {
        $('confirm-title').textContent = 'Send it now instead?';
        $('confirm-text').textContent = 'The scheduled broadcast goes out straight away. This cannot be undone.';
        $('btn-confirm').textContent = 'Send now';
        _confirmAction = async function () { await Broadcasts.sendNow(id); showAlert('Sending now. The results appear below as it goes.', 'success'); };
        bootstrap.Modal.getOrCreateInstance($('modal-confirm')).show();
    }

    document.addEventListener('DOMContentLoaded', function () {
        if (!RBAC.applyPageGuard(P.read)) return;
        if (RBAC.can(P.send)) {
            $('compose-col').classList.remove('d-none');
            $('list-col').classList.replace('col-12', 'col-lg-7');
            ['f-subject', 'f-body'].forEach(function (id) { $(id).addEventListener('input', updateCounts); });
            document.querySelectorAll('input[name="f-channel"]').forEach(function (r) { r.addEventListener('change', function () { updateCounts(); loadSize(); }); });
            $('f-audience').addEventListener('change', loadSize);
            document.querySelectorAll('input[name="f-when"]').forEach(function (r) { r.addEventListener('change', updateWhen); });
            $('btn-send').addEventListener('click', askToSend);
            updateCounts();
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
        $('filter-channel').addEventListener('change', function () { _channelFilter = this.value; _page = 1; load(); });
        $('broadcast-list').addEventListener('click', function (e) {
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
