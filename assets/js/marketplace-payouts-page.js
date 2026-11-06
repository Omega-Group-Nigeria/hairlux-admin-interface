/**
 * Marketplace Vendor Payouts page (marketplace-payouts.html).
 * Balances: what each vendor can be paid now and why not. Payout runs: one
 * admin prepares, a different admin approves (maker-checker). Payouts: vendor
 * requests to approve, manual payouts to mark paid, Paystack transfers to check.
 * Requires: auth.js, rbac.js, marketplace.js, tabler.min.js
 */
(function () {
    'use strict';

    var bootstrap = window.tabler.bootstrap;
    var P = {
        read: 'marketplace:read',
        prepare: 'marketplace:prepare_payouts',
        approve: 'marketplace:approve_payouts',
    };
    var PAYOUT = {
        PENDING: { label: 'Waiting for approval', cls: 'bg-yellow-lt' },
        PROCESSING: { label: 'Being paid', cls: 'bg-blue-lt' },
        PAID: { label: 'Paid', cls: 'bg-green-lt' },
        FAILED: { label: 'Failed', cls: 'bg-red-lt' },
        CANCELLED: { label: 'Cancelled', cls: 'bg-secondary-lt' },
    };
    var RUN = {
        DRAFT: { label: 'Waiting for approval', cls: 'bg-yellow-lt' },
        APPROVED: { label: 'Approved, paying', cls: 'bg-blue-lt' },
        COMPLETED: { label: 'Completed', cls: 'bg-green-lt' },
        CANCELLED: { label: 'Cancelled', cls: 'bg-secondary-lt' },
    };
    var ENTRY = {
        EARNING: { label: 'Earning', cls: 'bg-green-lt' },
        RETURN: { label: 'Return', cls: 'bg-red-lt' },
        PAYOUT: { label: 'Payout', cls: 'bg-blue-lt' },
        PAYOUT_REVERSAL: { label: 'Payout failed', cls: 'bg-orange-lt' },
        ADJUSTMENT: { label: 'Adjustment', cls: 'bg-secondary-lt' },
    };

    var _tab = 'balances';
    var _pStatus = '';
    var _page = 1;
    var _meta = null;
    var _searchTimer = null;
    var _settings = null;
    var _ledgerSeller = null;
    var _prompt = null;
    var _me = (typeof Auth !== 'undefined' && Auth.getUser && Auth.getUser()) || {};

    function $(id) { return document.getElementById(id); }
    function esc(s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    }
    function badge(map, key) {
        var m = map[key] || { label: key, cls: 'bg-secondary-lt' };
        return '<span class="badge ' + m.cls + '">' + esc(m.label) + '</span>';
    }
    function ngn(n) {
        if (n === null || n === undefined) return '-';
        var v = Number(n);
        var d = v % 1 ? 2 : 0;
        return (v < 0 ? '-' : '') + '₦' + Math.abs(v).toLocaleString('en-NG', { minimumFractionDigits: d, maximumFractionDigits: 2 });
    }
    function fmtDate(v) { return v ? new Date(v).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '-'; }
    function fmtDateTime(v) { return v ? new Date(v).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '-'; }
    function vendorName(s) { return s ? (s.tradingName || s.legalName) : '-'; }
    function alertBox(msg, type) {
        $('page-alert').innerHTML = '<div class="alert alert-' + (type || 'success') + ' alert-dismissible">' + esc(msg) + '<a class="btn-close" data-bs-dismiss="alert"></a></div>';
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    // ------------------------------------------------------------- summary

    async function loadSummary() {
        try {
            var res = await Promise.all([Marketplace.payoutSummary(), Marketplace.balances({ payableOnly: false })]);
            var s = res[0], b = res[1].totals;
            $('c-payable').textContent = ngn(b.payable);
            $('c-payable-n').textContent = b.payableCount + ' vendor' + (b.payableCount === 1 ? '' : 's');
            $('c-pending').textContent = ngn(b.pending);
            $('c-approve').textContent = s.requests + s.drafts;
            $('c-paying').textContent = s.manualToPay + s.transfersInProgress;
            $('c-paying-n').textContent = s.manualToPay ? s.manualToPay + ' manual to pay' : '';
        } catch (e) { /* cards stay "-" */ }
    }

    function modeNote() {
        if (!_settings) return;
        var mode = _settings.payoutMode === 'VENDOR_REQUEST'
            ? 'Vendors request payouts; approve them under Payouts.'
            : 'Prepare a payout run (for example weekly); a different admin approves it.';
        var how = _settings.payoutMethod === 'MANUAL'
            ? 'Approved payouts are paid manually from the bank, then marked paid here.'
            : 'Approved payouts are sent by Paystack transfer straight away.';
        $('mode-note').innerHTML = '<div>' + esc(mode) + ' ' + esc(how) + ' Earnings are held ' + _settings.payoutHoldDays +
            ' day' + (_settings.payoutHoldDays === 1 ? '' : 's') + ' after delivery; the minimum payout is ' + ngn(_settings.minPayoutAmount) +
            '. <a href="marketplace-settings.html">Change in Settings</a></div>';
        $('btn-prepare').classList.toggle('d-none', !(_settings.payoutMode === 'PAYOUT_RUN' && RBAC.can(P.prepare)));
    }

    // ------------------------------------------------------------- balances

    async function loadBalances() {
        $('bal-tbody').innerHTML = '<tr><td colspan="6" class="text-center text-secondary py-5">Loading...</td></tr>';
        try {
            var res = await Marketplace.balances({ search: $('f-search').value.trim() || undefined, payableOnly: $('f-payable').checked ? 'true' : undefined });
            $('bal-tbody').innerHTML = res.data.length ? res.data.map(function (r) {
                var next = r.openPayout
                    ? badge(PAYOUT, r.openPayout.status) + ' <span class="small">' + ngn(r.openPayout.amount) + '</span>'
                    : r.canBePaid
                        ? '<span class="badge bg-green-lt">Can be paid</span>'
                        : '<div class="small text-secondary">' + esc(r.blockers.join('; ')) + '</div>';
                var acct = r.payoutAccount ? '<div class="small">' + esc(r.payoutAccount.bankName) + ' ' + esc(r.payoutAccount.accountNumber) + '</div><div class="small text-secondary">' + esc(r.payoutAccount.accountName) + '</div>' : '<span class="text-danger small">None</span>';
                return '<tr><td><a href="marketplace-vendors.html?vendor=' + esc(r.sellerId) + '">' + esc(r.tradingName || r.legalName) + '</a>' +
                    (r.status !== 'APPROVED' ? ' <span class="badge bg-red-lt">' + esc(r.status) + '</span>' : '') + '</td>' +
                    '<td class="text-end fw-semibold' + (r.available < 0 ? ' text-danger' : '') + '">' + ngn(r.available) + '</td>' +
                    '<td class="text-end text-secondary">' + ngn(r.pending) + '</td><td>' + acct + '</td><td>' + next + '</td>' +
                    '<td class="text-end"><button class="btn btn-sm" data-ledger="' + esc(r.sellerId) + '">Ledger</button></td></tr>';
            }).join('') : '<tr><td colspan="6" class="text-center text-secondary py-5">No vendor earnings yet. They appear when vendor orders are delivered.</td></tr>';
        } catch (e) {
            $('bal-tbody').innerHTML = '<tr><td colspan="6" class="text-center text-danger py-4">' + esc(e.message) + '</td></tr>';
        }
    }

    // ------------------------------------------------------------- runs

    async function loadRuns() {
        $('runs-tbody').innerHTML = '<tr><td colspan="7" class="text-center text-secondary py-5">Loading...</td></tr>';
        try {
            var res = await Marketplace.listRuns({ limit: 50 });
            $('runs-tbody').innerHTML = res.data.length ? res.data.map(function (r) {
                return '<tr><td class="fw-semibold">' + esc(r.code) + (r.note ? '<div class="small text-secondary">' + esc(r.note) + '</div>' : '') + '</td>' +
                    '<td>' + badge(RUN, r.status) + '</td><td class="text-end">' + r.payoutCount + '</td><td class="text-end">' + ngn(r.totalAmount) + '</td>' +
                    '<td class="small">' + esc(r.preparedBy || '-') + '<div class="text-secondary">' + fmtDateTime(r.preparedAt) + '</div></td>' +
                    '<td class="small">' + (r.approvedAt ? esc(r.approvedBy || '-') + '<div class="text-secondary">' + fmtDateTime(r.approvedAt) + '</div>' : '-') + '</td>' +
                    '<td class="text-end"><button class="btn btn-sm' + (r.status === 'DRAFT' ? ' btn-primary' : '') + '" data-run="' + esc(r.id) + '">' + (r.status === 'DRAFT' ? 'Review' : 'View') + '</button></td></tr>';
            }).join('') : '<tr><td colspan="7" class="text-center text-secondary py-5">No payout runs yet.</td></tr>';
        } catch (e) {
            $('runs-tbody').innerHTML = '<tr><td colspan="7" class="text-center text-danger py-4">' + esc(e.message) + '</td></tr>';
        }
    }

    function renderRun(r) {
        $('run-title').textContent = 'Payout run ' + r.code;
        var draft = r.status === 'DRAFT';
        var mine = r.preparedById && r.preparedById === _me.id;
        $('run-body').innerHTML =
            '<div class="d-flex justify-content-between mb-3"><div>' + badge(RUN, r.status) +
            '<div class="small text-secondary mt-1">Prepared by ' + esc(r.preparedBy || '-') + ' on ' + fmtDateTime(r.preparedAt) +
            (r.approvedAt ? '. Approved by ' + esc(r.approvedBy || '-') + ' on ' + fmtDateTime(r.approvedAt) : '') +
            (r.cancelledAt ? '. Cancelled by ' + esc(r.cancelledBy || '-') + ' on ' + fmtDateTime(r.cancelledAt) : '') + '.</div></div>' +
            '<div class="text-end"><div class="h2 mb-0">' + ngn(r.totalAmount) + '</div><div class="small text-secondary">' + r.payoutCount + ' vendor' + (r.payoutCount === 1 ? '' : 's') + '</div></div></div>' +
            (draft ? '<div class="alert alert-info">Approving re-checks every vendor, pays the lower of this amount and what is available then, and ' +
                (_settings && _settings.payoutMethod === 'MANUAL' ? 'leaves each payout for you to pay from the bank and mark paid.' : 'sends the money by Paystack straight away.') +
                (mine ? ' <strong>You prepared this run, so a different admin must approve it.</strong>' : '') + '</div>' : '') +
            '<div class="table-responsive"><table class="table table-sm"><thead><tr><th>Vendor</th><th>To</th><th class="text-end">Amount</th><th>Status</th><th></th></tr></thead><tbody>' +
            r.payouts.map(function (p) {
                return '<tr><td>' + esc(vendorName(p.seller)) + '</td><td class="small">' + esc([p.bankName, p.accountNumber].filter(Boolean).join(' ') || 'Copied at approval') + '</td>' +
                    '<td class="text-end">' + ngn(p.amount) + '</td><td>' + badge(PAYOUT, p.status) + (p.failureReason ? '<div class="small text-secondary">' + esc(p.failureReason) + '</div>' : '') + '</td>' +
                    '<td class="text-end">' + payoutActions(p, true) + '</td></tr>';
            }).join('') + '</tbody></table></div>';
        var foot = '<button class="btn btn-link link-secondary me-auto" data-bs-dismiss="modal">Close</button>';
        if (draft && RBAC.can(P.prepare)) foot += '<button class="btn btn-outline-danger" id="btn-run-cancel">Cancel run</button>';
        if (draft && RBAC.can(P.approve)) foot += '<button class="btn btn-primary" id="btn-run-approve"' + (mine ? ' disabled title="A different admin must approve"' : '') + '>Approve and pay ' + ngn(r.totalAmount) + '</button>';
        $('run-footer').innerHTML = foot;
        var a = $('btn-run-approve');
        if (a) a.addEventListener('click', function () { approveRun(r, a); });
        var c = $('btn-run-cancel');
        if (c) c.addEventListener('click', function () { cancelRun(r, c); });
    }

    async function openRun(id) {
        $('run-body').innerHTML = '<div class="text-center py-5"><div class="spinner-border text-primary"></div></div>';
        $('run-footer').innerHTML = '';
        bootstrap.Modal.getOrCreateInstance($('modal-run')).show();
        try { renderRun(await Marketplace.getRun(id)); }
        catch (e) { $('run-body').innerHTML = '<div class="alert alert-danger">' + esc(e.message) + '</div>'; }
    }

    async function prepareRun() {
        var btn = $('btn-prepare');
        btn.disabled = true;
        try {
            var r = await Marketplace.prepareRun();
            alertBox('Run ' + r.code + ' prepared: ' + r.payoutCount + ' vendor' + (r.payoutCount === 1 ? '' : 's') + ', ' + ngn(r.totalAmount) + '. A different admin must approve it.');
            refreshAll();
            switchTab('runs');
            renderRunModal(r);
        } catch (e) { alertBox(e.message, 'danger'); }
        finally { btn.disabled = false; }
    }
    function renderRunModal(r) { bootstrap.Modal.getOrCreateInstance($('modal-run')).show(); renderRun(r); }

    async function approveRun(r, btn) {
        if (!confirm('Approve run ' + r.code + ' and pay ' + ngn(r.totalAmount) + '?')) return;
        btn.disabled = true;
        try {
            var res = await Marketplace.approveRun(r.id);
            renderRun(res);
            var c = res.statusCounts || {};
            alertBox('Run ' + res.code + ' approved. Paid: ' + (c.PAID || 0) + ', being paid: ' + (c.PROCESSING || 0) + ', failed: ' + (c.FAILED || 0) + ', not paid: ' + (c.CANCELLED || 0) + '.');
            refreshAll();
        } catch (e) { alert(e.message); btn.disabled = false; }
    }

    async function cancelRun(r, btn) {
        if (!confirm('Cancel run ' + r.code + '? Nobody is paid and the balances stay as they are.')) return;
        btn.disabled = true;
        try {
            renderRun(await Marketplace.cancelRun(r.id));
            alertBox('Run ' + r.code + ' cancelled.');
            refreshAll();
        } catch (e) { alert(e.message); btn.disabled = false; }
    }

    // ------------------------------------------------------------- payouts

    function payoutActions(p, inRun) {
        var b = [];
        if (p.status === 'PENDING' && p.source === 'REQUEST' && RBAC.can(P.approve)) b.push('<button class="btn btn-sm btn-primary" data-act="approve" data-id="' + esc(p.id) + '">Approve</button>');
        if (p.status === 'PENDING' && RBAC.can(P.prepare)) b.push('<button class="btn btn-sm btn-outline-danger" data-act="reject" data-id="' + esc(p.id) + '">' + (p.source === 'REQUEST' ? 'Decline' : 'Remove') + '</button>');
        if (p.status === 'PROCESSING' && p.method === 'MANUAL' && RBAC.can(P.prepare)) {
            b.push('<button class="btn btn-sm btn-primary" data-act="paid" data-id="' + esc(p.id) + '">Mark paid</button>');
            b.push('<button class="btn btn-sm btn-outline-danger" data-act="failed" data-id="' + esc(p.id) + '">Failed</button>');
        }
        if (p.status === 'PROCESSING' && p.method === 'PAYSTACK_TRANSFER') b.push('<button class="btn btn-sm" data-act="check" data-id="' + esc(p.id) + '">Check status</button>');
        return b.length ? '<div class="btn-list justify-content-end flex-nowrap">' + b.join('') + '</div>' : '';
    }

    async function loadPayouts() {
        $('pay-tbody').innerHTML = '<tr><td colspan="7" class="text-center text-secondary py-5">Loading...</td></tr>';
        try {
            var res = await Marketplace.listPayouts({ status: _pStatus || undefined, page: _page });
            _meta = res.meta;
            document.querySelectorAll('[data-pc]').forEach(function (el) { var n = (res.counts || {})[el.dataset.pc] || 0; el.textContent = n || ''; el.hidden = !n; });
            $('page-label').textContent = _meta.totalPages > 1 ? 'Page ' + _meta.page + ' of ' + _meta.totalPages : '';
            $('btn-prev').disabled = _meta.page <= 1;
            $('btn-next').disabled = _meta.page >= _meta.totalPages;
            $('pay-tbody').innerHTML = res.data.length ? res.data.map(function (p) {
                return '<tr><td>' + esc(vendorName(p.seller)) + '</td><td class="text-end fw-semibold">' + ngn(p.amount) + '</td>' +
                    '<td class="small">' + (p.source === 'REQUEST' ? 'Vendor request' : 'Run ' + esc(p.runCode || '')) + '<div class="text-secondary">' + (p.method === 'MANUAL' ? 'Manual' : 'Paystack') + '</div></td>' +
                    '<td>' + badge(PAYOUT, p.status) + (p.failureReason ? '<div class="small text-secondary">' + esc(p.failureReason) + '</div>' : '') +
                    (p.manualReference ? '<div class="small text-secondary">Ref ' + esc(p.manualReference) + '</div>' : '') + '</td>' +
                    '<td class="small">' + esc([p.bankName, p.accountNumber].filter(Boolean).join(' ') || '-') + '</td>' +
                    '<td class="small text-secondary">' + fmtDateTime(p.paidAt || p.failedAt || p.approvedAt || p.createdAt) + '</td>' +
                    '<td class="text-end">' + payoutActions(p, false) + '</td></tr>';
            }).join('') : '<tr><td colspan="7" class="text-center text-secondary py-5">No payouts here.</td></tr>';
        } catch (e) {
            $('pay-tbody').innerHTML = '<tr><td colspan="7" class="text-center text-danger py-4">' + esc(e.message) + '</td></tr>';
        }
    }

    function askText(opts) {
        _prompt = opts;
        $('prompt-title').textContent = opts.title;
        $('prompt-text').textContent = opts.text || '';
        $('prompt-label').textContent = opts.label;
        $('prompt-input').value = '';
        $('prompt-input').placeholder = opts.placeholder || '';
        $('prompt-input').classList.remove('is-invalid');
        $('btn-prompt-ok').textContent = opts.ok;
        bootstrap.Modal.getOrCreateInstance($('modal-prompt')).show();
    }

    async function promptOk() {
        var v = $('prompt-input').value.trim();
        if (v.length < 3) { $('prompt-input').classList.add('is-invalid'); return; }
        var btn = $('btn-prompt-ok');
        btn.disabled = true;
        try {
            await _prompt.run(v);
            bootstrap.Modal.getInstance($('modal-prompt')).hide();
        } catch (e) { alert(e.message); }
        finally { btn.disabled = false; }
    }

    async function payoutAction(act, id, btn) {
        var after = function (p, msg) {
            alertBox(msg);
            refreshAll();
            if ($('modal-run').classList.contains('show') && p.runId) openRun(p.runId);
        };
        if (act === 'approve') {
            if (!confirm('Approve this payout request and pay it?')) return;
            btn.disabled = true;
            try { var p = await Marketplace.approvePayout(id); after(p, 'Payout ' + PAYOUT[p.status].label.toLowerCase() + ': ' + ngn(p.amount) + ' to ' + vendorName(p.seller) + (p.failureReason ? ' (' + p.failureReason + ')' : '') + '.'); }
            catch (e) { alert(e.message); btn.disabled = false; }
        } else if (act === 'check') {
            btn.disabled = true;
            try { var c = await Marketplace.checkPayout(id); after(c, 'Paystack says: ' + PAYOUT[c.status].label + '.'); }
            catch (e) { alert(e.message); btn.disabled = false; }
        } else if (act === 'reject') {
            askText({
                title: 'Remove this payout', label: 'Reason', ok: 'Remove payout', placeholder: 'e.g. Confirm bank details with the vendor first',
                text: 'Nothing is paid and the money stays on the vendor balance. A vendor who requested it is emailed your reason.',
                run: async function (reason) { var r = await Marketplace.rejectPayout(id, reason); after(r, 'Payout removed.'); },
            });
        } else if (act === 'paid') {
            askText({
                title: 'Mark as paid', label: 'Bank transfer reference', ok: 'Mark paid', placeholder: 'e.g. FT26295ABCD',
                text: 'Only after the money has left the Hairlux bank account. This records the payment in Finance and emails the vendor.',
                run: async function (ref) { var r = await Marketplace.markPaid(id, ref); after(r, 'Payout of ' + ngn(r.amount) + ' marked paid.'); },
            });
        } else if (act === 'failed') {
            askText({
                title: 'Payment could not be made', label: 'Reason', ok: 'Mark failed', placeholder: 'e.g. Account closed',
                text: 'The money goes back on the vendor balance for the next payout, and the vendor is emailed.',
                run: async function (reason) { var r = await Marketplace.markFailed(id, reason); after(r, 'Payout marked failed. The money is back on the vendor balance.'); },
            });
        }
    }

    // ------------------------------------------------------------- ledger

    async function openLedger(sellerId) {
        _ledgerSeller = sellerId;
        $('ledger-body').innerHTML = '<div class="text-center py-5"><div class="spinner-border text-primary"></div></div>';
        $('ledger-adjust').classList.toggle('d-none', !RBAC.can(P.approve));
        bootstrap.Modal.getOrCreateInstance($('modal-ledger')).show();
        try {
            var d = await Marketplace.vendorLedger(sellerId, { limit: 100 });
            var b = d.balance;
            $('ledger-title').textContent = vendorName(d.seller);
            $('ledger-body').innerHTML =
                '<div class="row g-2 mb-3">' +
                [['Available', b.available], ['In hold', b.pending], ['Earned', b.earned], ['Returns', -b.returned], ['Paid out', b.paidOut], ['Adjustments', b.adjustments]].map(function (x) {
                    return '<div class="col-4 col-md-2"><div class="subheader">' + x[0] + '</div><div class="fw-semibold">' + ngn(x[1]) + '</div></div>';
                }).join('') + '</div>' +
                '<div class="table-responsive"><table class="table table-sm"><thead><tr><th>Date</th><th>Type</th><th>Detail</th><th class="text-end">Amount</th><th>Payable from</th></tr></thead><tbody>' +
                (d.data.length ? d.data.map(function (e) {
                    return '<tr><td class="small">' + fmtDateTime(e.createdAt) + '</td><td>' + badge(ENTRY, e.type) + '</td>' +
                        '<td class="small">' + esc(e.note || '') + (e.sellerOrderId ? ' <a href="marketplace-orders.html?id=' + esc(e.sellerOrderId) + '">Order</a>' : '') + '</td>' +
                        '<td class="text-end' + (e.amount < 0 ? ' text-danger' : '') + '">' + ngn(e.amount) + '</td>' +
                        '<td class="small' + (e.isAvailable ? ' text-secondary' : '') + '">' + (e.isAvailable ? 'Now' : fmtDate(e.availableAt)) + '</td></tr>';
                }).join('') : '<tr><td colspan="5" class="text-secondary text-center py-3">No entries.</td></tr>') + '</tbody></table></div>' +
                (d.meta.total > d.data.length ? '<div class="small text-secondary">Showing the latest ' + d.data.length + ' of ' + d.meta.total + '.</div>' : '');
        } catch (e) {
            $('ledger-body').innerHTML = '<div class="alert alert-danger">' + esc(e.message) + '</div>';
        }
    }

    async function adjust() {
        var amount = Number($('adj-amount').value);
        var note = $('adj-note').value.trim();
        if (!amount) { $('adj-amount').classList.add('is-invalid'); return; }
        if (note.length < 3) { $('adj-note').classList.add('is-invalid'); return; }
        $('adj-amount').classList.remove('is-invalid'); $('adj-note').classList.remove('is-invalid');
        if (!confirm((amount > 0 ? 'Add ' : 'Take off ') + ngn(Math.abs(amount)) + (amount > 0 ? ' to' : ' from') + ' this vendor balance?')) return;
        var btn = $('btn-adjust');
        btn.disabled = true;
        try {
            await Marketplace.adjustBalance(_ledgerSeller, amount, note);
            $('adj-amount').value = ''; $('adj-note').value = '';
            openLedger(_ledgerSeller);
            refreshAll();
        } catch (e) { alert(e.message); }
        finally { btn.disabled = false; }
    }

    // ------------------------------------------------------------- wiring

    function switchTab(tab) {
        _tab = tab;
        document.querySelectorAll('#tabs .nav-link').forEach(function (x) { x.classList.toggle('active', x.dataset.tab === tab); });
        document.querySelectorAll('[data-pane]').forEach(function (p) { p.hidden = p.dataset.pane !== tab; });
        history.replaceState(null, '', '#' + tab);
        if (tab === 'balances') loadBalances();
        else if (tab === 'runs') loadRuns();
        else loadPayouts();
    }

    function refreshAll() {
        loadSummary();
        switchTab(_tab);
    }

    document.addEventListener('DOMContentLoaded', async function () {
        if (!RBAC.applyPageGuard(P.read)) return;
        document.querySelectorAll('#tabs [data-tab]').forEach(function (a) {
            a.addEventListener('click', function (e) { e.preventDefault(); switchTab(a.dataset.tab); });
        });
        document.querySelectorAll('#p-status [data-status]').forEach(function (b) {
            b.addEventListener('click', function () {
                document.querySelectorAll('#p-status .btn').forEach(function (x) { x.classList.toggle('active', x === b); });
                _pStatus = b.dataset.status;
                _page = 1;
                loadPayouts();
            });
        });
        $('f-search').addEventListener('input', function () {
            clearTimeout(_searchTimer);
            _searchTimer = setTimeout(loadBalances, 300);
        });
        $('f-payable').addEventListener('change', loadBalances);
        $('btn-prev').addEventListener('click', function () { if (_page > 1) { _page--; loadPayouts(); } });
        $('btn-next').addEventListener('click', function () { if (_meta && _page < _meta.totalPages) { _page++; loadPayouts(); } });
        $('btn-prepare').addEventListener('click', prepareRun);
        $('btn-prompt-ok').addEventListener('click', promptOk);
        $('btn-adjust').addEventListener('click', adjust);
        document.addEventListener('click', function (e) {
            var l = e.target.closest('[data-ledger]');
            if (l) return openLedger(l.dataset.ledger);
            var r = e.target.closest('[data-run]');
            if (r) return openRun(r.dataset.run);
            var a = e.target.closest('[data-act]');
            if (a) return payoutAction(a.dataset.act, a.dataset.id, a);
        });
        try {
            _settings = await Marketplace.getSettings();
            modeNote();
        } catch (e) { /* page still works */ }
        loadSummary();
        var hash = (location.hash || '').replace('#', '');
        switchTab(['balances', 'runs', 'payouts'].indexOf(hash) >= 0 ? hash : (_settings && _settings.payoutMode === 'VENDOR_REQUEST' ? 'payouts' : 'balances'));
    });
})();
