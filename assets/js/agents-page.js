/**
 * Field Agents page (agents.html).
 * Overview, agents (applications, status, detail), earnings approval,
 * withdrawals, credited customers and leads (disputes), reports with Excel
 * and PDF download, alerts, and settings.
 * Requires: auth.js, rbac.js, agents.js, tabler.min.js
 */
(function () {
    'use strict';

    var bootstrap = window.tabler.bootstrap;
    var P = {
        read: 'agents:read',
        manage: 'agents:manage',
        earnings: 'agents:approve_earnings',
        withdrawals: 'agents:approve_withdrawals',
        settings: 'agents:manage_settings',
    };
    var TABS = ['overview', 'agents', 'earnings', 'withdrawals', 'customers', 'reports', 'alerts', 'settings'];
    var AGENT = {
        PENDING: { label: 'Applied', cls: 'bg-yellow-lt' },
        APPROVED: { label: 'Approved, terms not accepted', cls: 'bg-azure-lt' },
        ACTIVE: { label: 'Active', cls: 'bg-green-lt' },
        SUSPENDED: { label: 'Suspended', cls: 'bg-red-lt' },
        REJECTED: { label: 'Rejected', cls: 'bg-secondary-lt' },
        DEACTIVATED: { label: 'Deactivated', cls: 'bg-secondary-lt' },
    };
    var DAY = {
        OPEN: { label: 'Today', cls: 'bg-secondary-lt' },
        NOT_QUALIFIED: { label: 'Did not qualify', cls: 'bg-secondary-lt' },
        AWAITING_APPROVAL: { label: 'Waiting for approval', cls: 'bg-yellow-lt' },
        APPROVED: { label: 'Paid', cls: 'bg-green-lt' },
        REJECTED: { label: 'Rejected', cls: 'bg-red-lt' },
    };
    var WD = {
        PENDING: { label: 'Waiting for approval', cls: 'bg-yellow-lt' },
        APPROVED: { label: 'Approved, to pay', cls: 'bg-blue-lt' },
        PROCESSING: { label: 'Being paid', cls: 'bg-blue-lt' },
        PAID: { label: 'Paid', cls: 'bg-green-lt' },
        FAILED: { label: 'Failed', cls: 'bg-red-lt' },
        REJECTED: { label: 'Rejected', cls: 'bg-red-lt' },
        CANCELLED: { label: 'Cancelled', cls: 'bg-secondary-lt' },
    };
    var CUST = {
        REGISTERED: { label: 'Signed up', cls: 'bg-azure-lt' },
        QUALIFIED: { label: 'Paid booking counted', cls: 'bg-green-lt' },
        DISQUALIFIED: { label: 'Ruled out', cls: 'bg-red-lt' },
    };
    var SOURCE = { CODE: 'Agent code', LINK: 'Link or QR', LEAD: 'Matched a lead', ADMIN: 'Set by admin' };
    var LEAD = {
        NEW: { label: 'New', cls: 'bg-secondary-lt' },
        CONTACTED: { label: 'Contacted', cls: 'bg-azure-lt' },
        INTERESTED: { label: 'Interested', cls: 'bg-blue-lt' },
        REGISTERED: { label: 'Signed up', cls: 'bg-cyan-lt' },
        BOOKING_PENDING: { label: 'Booking pending', cls: 'bg-yellow-lt' },
        PAID_BOOKING: { label: 'Paid booking', cls: 'bg-green-lt' },
        NOT_CONVERTED: { label: 'Not converted', cls: 'bg-red-lt' },
    };
    var ENTRY = {
        DAILY_EARNING: { label: 'Daily earning', cls: 'bg-green-lt' },
        MONTHLY_BONUS: { label: 'Monthly bonus', cls: 'bg-green-lt' },
        INCENTIVE: { label: 'Incentive', cls: 'bg-teal-lt' },
        WITHDRAWAL: { label: 'Withdrawal', cls: 'bg-blue-lt' },
        WITHDRAWAL_REVERSAL: { label: 'Withdrawal returned', cls: 'bg-orange-lt' },
        ADJUSTMENT: { label: 'Adjustment', cls: 'bg-secondary-lt' },
    };
    var ALERT_KIND = {
        NEW_APPLICATION: 'New application',
        WITHDRAWAL_REQUEST: 'Withdrawal request',
        WITHDRAWAL_FAILED: 'Failed payment',
        BONUS_QUALIFIED: 'Bonus reached',
        EARNINGS_AWAITING_APPROVAL: 'Earnings to approve',
        SELF_REFERRAL: 'Own code used',
        BANK_NAME_MISMATCH: 'Bank name differs',
        CANCELLED_AFTER_CLOSE: 'Booking cancelled after payout',
    };

    var _tab = 'overview';
    var _pages = { agents: 1, earnings: 1, withdrawals: 1, customers: 1, alerts: 1 };
    var _meta = {};
    var _f = { aStatus: '', eStatus: 'AWAITING_APPROVAL', wStatus: '', cSub: 'credited' };
    var _timers = {};
    var _settings = null;
    var _agentId = null;
    var _prompt = null;
    var _report = null;
    var _agentOptions = null;

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
        if (n === null || n === undefined || n === '') return '-';
        var v = Number(n);
        var d = v % 1 ? 2 : 0;
        return (v < 0 ? '-' : '') + '₦' + Math.abs(v).toLocaleString('en-NG', { minimumFractionDigits: d, maximumFractionDigits: 2 });
    }
    function num(n) { return Number(n || 0).toLocaleString('en-NG'); }
    function fmtDate(v) { return v ? new Date(v).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '-'; }
    function fmtDay(d) { return d ? new Date(d + 'T12:00:00Z').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) : '-'; }
    function fmtDateTime(v) { return v ? new Date(v).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '-'; }
    function personName(u) { return u ? (u.firstName + ' ' + u.lastName).trim() : '-'; }
    function agentCell(a) {
        if (!a) return '-';
        return '<a href="#" data-agent="' + esc(a.id) + '">' + esc(personName(a.user)) + '</a><div class="small text-secondary">' + esc(a.agentNumber) + '</div>';
    }
    function loadingRow(cols) { return '<tr><td colspan="' + cols + '" class="text-center text-secondary py-5">Loading...</td></tr>'; }
    function emptyRow(cols, text) { return '<tr><td colspan="' + cols + '" class="text-center text-secondary py-5">' + esc(text) + '</td></tr>'; }
    function errorRow(cols, e) { return '<tr><td colspan="' + cols + '" class="text-center text-danger py-4">' + esc(e.message) + '</td></tr>'; }
    function alertBox(msg, type) {
        $('page-alert').innerHTML = '<div class="alert alert-' + (type || 'success') + ' alert-dismissible">' + esc(msg) + '<a class="btn-close" data-bs-dismiss="alert"></a></div>';
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    function lagosToday() { return new Date(Date.now() + 3600000).toISOString().slice(0, 10); }
    function setPager(key, meta) {
        _meta[key] = meta;
        var label = document.querySelector('[data-pager-label="' + key + '"]');
        if (label) label.textContent = meta && meta.totalPages > 1 ? 'Page ' + meta.page + ' of ' + meta.totalPages + ' (' + num(meta.total) + ')' : (meta ? num(meta.total) + ' in total' : '');
        var prev = document.querySelector('[data-pager-prev="' + key + '"]');
        var next = document.querySelector('[data-pager-next="' + key + '"]');
        if (prev) prev.disabled = !meta || meta.page <= 1;
        if (next) next.disabled = !meta || meta.page >= meta.totalPages;
    }
    function setCount(id, n) { var el = $(id); if (!el) return; el.textContent = n > 99 ? '99+' : String(n || ''); el.hidden = !n; }

    // ------------------------------------------------------------- overview

    async function loadOverview() {
        $('ov-cards').innerHTML = '<div class="text-center text-secondary py-4">Loading...</div>';
        try {
            var d = await Agents.overview();
            var a = d.agents || {};
            setCount('tab-pending', a.PENDING || 0);
            setCount('tab-days', d.daysAwaitingApproval || 0);
            setCount('tab-wd', d.pendingWithdrawals.count || 0);
            setCount('tab-alerts', d.unreadAlerts || 0);
            var card = function (label, value, sub, cls, go) {
                return '<div class="col-6 col-lg-3"><div class="card card-sm' + (go ? ' card-link" role="button" data-goto="' + go : '') + '"><div class="card-body"><div class="subheader">' + esc(label) + '</div>' +
                    '<div class="h1 mb-0 ' + (cls || '') + '">' + value + '</div>' + (sub ? '<div class="small text-secondary">' + sub + '</div>' : '') + '</div></div></div>';
            };
            $('ov-cards').innerHTML =
                card('Active agents', num(a.ACTIVE || 0), num(a.SUSPENDED || 0) + ' suspended', '', 'agents') +
                card('Applications to review', num(a.PENDING || 0), num(a.APPROVED || 0) + ' approved, terms not accepted', a.PENDING ? 'text-warning' : '', 'agents') +
                card('Withdrawals to approve', num(d.pendingWithdrawals.count), ngn(d.pendingWithdrawals.amount), d.pendingWithdrawals.count ? 'text-warning' : '', 'withdrawals') +
                card('Owed to agents', ngn(d.outstandingLiability), num(d.daysAwaitingApproval) + ' day' + (d.daysAwaitingApproval === 1 ? '' : 's') + ' waiting for approval', '', d.daysAwaitingApproval ? 'earnings' : null);
            var t = d.today || {};
            var mini = function (label, v) { return '<div class="col-6 col-sm-4"><div class="subheader">' + esc(label) + '</div><div class="fw-semibold">' + v + '</div></div>'; };
            $('ov-today').innerHTML = mini('Engagements', num(t.engagements)) + mini('Leads', num(t.leads)) + mini('Downloads', num(t.downloads)) +
                mini('Sign-ups', num(t.registrations)) + mini('Paid bookings', num(t.paidBookings)) + mini('Agents with results', num(t.agentsWithResults));
            var leaders = (d.leaderboard || []).filter(function (r) { return r.paidBookings || r.registrations; });
            $('ov-leaders').innerHTML = leaders.length ? leaders.map(function (r) {
                return '<tr><td>' + r.rank + '</td><td><a href="#" data-agent="' + esc(r.agentId) + '">' + esc(r.name) + '</a><div class="small text-secondary">' + esc(r.agentNumber) + '</div></td>' +
                    '<td class="small">' + esc(r.territory) + '</td><td class="text-end">' + r.registrations + '</td><td class="text-end fw-semibold">' + r.paidBookings + '</td></tr>';
            }).join('') : emptyRow(5, 'No sign-ups or paid bookings yet today.');
        } catch (e) {
            $('ov-cards').innerHTML = '<div class="alert alert-danger">' + esc(e.message) + '</div>';
        }
        try {
            var al = await Agents.alerts({ limit: 6 });
            $('ov-alerts').innerHTML = al.data.length ? al.data.map(alertItem).join('') : '<div class="text-secondary py-3">No alerts yet.</div>';
        } catch (e) { $('ov-alerts').innerHTML = ''; }
    }

    // ------------------------------------------------------------- agents

    async function loadAgents() {
        $('a-tbody').innerHTML = loadingRow(8);
        try {
            var res = await Agents.list({ status: _f.aStatus || undefined, search: $('a-search').value.trim() || undefined, territory: $('a-territory').value.trim() || undefined, page: _pages.agents });
            setPager('agents', res.meta);
            document.querySelectorAll('[data-ac]').forEach(function (el) { var n = (res.counts || {})[el.dataset.ac] || 0; el.textContent = n || ''; el.hidden = !n; });
            setCount('tab-pending', (res.counts || {}).PENDING || 0);
            $('a-tbody').innerHTML = res.data.length ? res.data.map(function (a) {
                return '<tr><td>' + agentCell({ id: a.id, agentNumber: a.agentNumber + ' · ' + a.referralCode, user: a.user }) +
                    '<div class="small text-secondary">' + esc(a.user.phone || '') + '</div></td>' +
                    '<td class="small">' + esc(a.territory) + (a.state ? '<div class="text-secondary">' + esc(a.state) + '</div>' : '') + '</td>' +
                    '<td>' + badge(AGENT, a.status) + (a.withdrawalsLocked ? '<div><span class="badge bg-orange-lt mt-1">Withdrawals held</span></div>' : '') + '</td>' +
                    '<td class="text-end">' + a.monthPaidBookings + '</td>' +
                    '<td class="text-end">' + ngn(a.balance ? a.balance.available : 0) + '</td>' +
                    '<td class="text-end text-secondary">' + ngn(a.balance ? a.balance.pending : 0) + '</td>' +
                    '<td class="small text-secondary">' + fmtDate(a.createdAt) + '</td>' +
                    '<td class="text-end"><button class="btn btn-sm' + (a.status === 'PENDING' ? ' btn-primary' : '') + '" data-agent="' + esc(a.id) + '">' + (a.status === 'PENDING' ? 'Review' : 'View') + '</button></td></tr>';
            }).join('') : emptyRow(8, _f.aStatus === 'PENDING' ? 'No applications waiting.' : 'No agents here yet.');
        } catch (e) { $('a-tbody').innerHTML = errorRow(8, e); }
    }

    function statusButtons(a) {
        if (!RBAC.can(P.manage)) return '';
        var b = [];
        if (a.status === 'PENDING' || a.status === 'REJECTED') b.push('<button class="btn btn-success" data-status-act="approve">Approve</button>');
        if (a.status === 'PENDING') b.push('<button class="btn btn-outline-danger" data-status-act="reject">Reject</button>');
        if (a.status === 'APPROVED' || a.status === 'ACTIVE') b.push('<button class="btn btn-outline-warning" data-status-act="suspend">Suspend</button>');
        if (a.status === 'SUSPENDED' || a.status === 'DEACTIVATED') b.push('<button class="btn btn-success" data-status-act="reactivate">Reactivate</button>');
        if (['PENDING', 'APPROVED', 'ACTIVE', 'SUSPENDED'].indexOf(a.status) >= 0) b.push('<button class="btn btn-outline-danger" data-status-act="deactivate">Deactivate</button>');
        return b.join('');
    }

    async function openAgent(id) {
        _agentId = id;
        $('agent-title').textContent = 'Agent';
        $('agent-body').innerHTML = '<div class="text-center py-5"><div class="spinner-border text-primary"></div></div>';
        $('agent-footer').innerHTML = '';
        bootstrap.Modal.getOrCreateInstance($('modal-agent')).show();
        try {
            var res = await Promise.all([Agents.get(id), Agents.transactions(id, { limit: 15 })]);
            renderAgent(res[0], res[1]);
        } catch (e) { $('agent-body').innerHTML = '<div class="alert alert-danger">' + esc(e.message) + '</div>'; }
    }

    function renderAgent(a, tx) {
        var u = a.user || {};
        $('agent-title').innerHTML = esc(personName(u)) + ' <span class="text-secondary fw-normal ms-1">' + esc(a.agentNumber) + '</span> ' + badge(AGENT, a.status);
        var b = a.balance || {};
        var perf = a.performance;
        var bank = a.bankFull;
        var html = '';
        if (a.statusReason) html += '<div class="alert alert-secondary py-2">' + esc(a.statusReason) + '</div>';
        html += '<div class="row g-4">';
        // Profile
        html += '<div class="col-lg-4"><div class="d-flex align-items-center gap-3 mb-3">' +
            (a.photoUrl ? '<a href="' + esc(a.photoUrl) + '" target="_blank" rel="noopener"><img class="agent-photo" src="' + esc(a.photoUrl) + '" alt=""></a>' : '<div class="agent-photo d-flex align-items-center justify-content-center text-secondary small">No photo</div>') +
            '<div><div class="fw-semibold">' + esc(personName(u)) + '</div><div class="small text-secondary">Code <strong>' + esc(a.referralCode) + '</strong></div>' +
            '<div class="small"><a href="' + esc(a.referralLink) + '" target="_blank" rel="noopener">Sign-up link</a></div></div></div>' +
            '<dl class="kv">' +
            '<dt>Email</dt><dd>' + esc(u.email) + (u.emailVerified ? '' : ' <span class="badge bg-yellow-lt">not verified</span>') + '</dd>' +
            '<dt>Phone</dt><dd>' + esc(u.phone || '-') + '</dd>' +
            '<dt>Address</dt><dd>' + esc(a.address) + '</dd>' +
            '<dt>Territory</dt><dd>' + esc(a.territory) + (a.state && a.territory.toLowerCase().indexOf(a.state.toLowerCase()) < 0 ? ', ' + esc(a.state) : '') + (RBAC.can(P.manage) ? ' <a href="#" class="small ms-1" data-edit-territory>Change</a>' : '') + '</dd>' +
            '<dt>Emergency contact</dt><dd>' + esc([a.emergencyContactName, a.emergencyContactPhone].filter(Boolean).join(', ') || '-') + '</dd>' +
            '<dt>Bank account</dt><dd>' + (bank ? esc(bank.bankName || bank.bankCode) + ' ' + esc(bank.accountNumber) + '<div class="small text-secondary">' + esc(bank.accountName) + (bank.verifiedAt ? ', checked with Paystack' : '') + '</div>' : '<span class="text-secondary">Not added</span>') + '</dd>' +
            '<dt>Applied</dt><dd>' + fmtDateTime(a.createdAt) + '</dd>' +
            (a.approvedAt ? '<dt>Approved</dt><dd>' + fmtDateTime(a.approvedAt) + '</dd>' : '') +
            (a.activatedAt ? '<dt>Started (terms accepted)</dt><dd>' + fmtDateTime(a.activatedAt) + ' · terms v' + esc(a.termsVersion) + '</dd>' : '') +
            '</dl></div>';
        // Money + performance
        html += '<div class="col-lg-8">';
        html += '<div class="row g-2 mb-3">' + [
            ['Available', b.available], ['Pending', b.pending], ['Daily earnings', b.dailyEarnings], ['Bonuses', b.monthlyBonuses], ['Incentives', b.incentives], ['Withdrawn', b.totalWithdrawn],
        ].map(function (x) { return '<div class="col-4 col-md-2"><div class="subheader">' + x[0] + '</div><div class="fw-semibold">' + ngn(x[1]) + '</div></div>'; }).join('') + '</div>';
        if (a.withdrawalsLocked) html += '<div class="alert alert-warning py-2">Withdrawals are on hold for this agent.</div>';
        if (perf) {
            var m = perf.month;
            html += '<div class="subheader mb-1">This month</div><div class="mb-2">' + num(m.counts.paidBookings) + ' of ' + num(m.paidBookingsTarget) + ' paid bookings · ' +
                num(m.counts.registrations) + ' sign-ups · ' + num(m.counts.leads) + ' leads · earned ' + ngn(m.earned.daily + m.earned.bonuses + m.earned.incentives) + '</div>' +
                '<div class="progress mb-3"><div class="progress-bar" style="width:' + Math.min(100, m.paidBookingsProgress) + '%"></div></div>';
            html += '<div class="subheader mb-1">Recent days</div><div class="table-responsive mb-3"><table class="table table-sm"><thead><tr><th>Day</th><th class="text-end">Sign-ups</th><th class="text-end">Paid</th><th class="text-end">Leads</th><th>Result</th><th class="text-end">Earning</th></tr></thead><tbody>' +
                (perf.recentDays.length ? perf.recentDays.map(function (d) {
                    return '<tr><td class="small">' + fmtDay(d.day) + '</td><td class="text-end">' + d.registrations + '</td><td class="text-end">' + d.paidBookings + '</td><td class="text-end">' + d.leads + '</td><td>' + badge(DAY, d.status) + '</td><td class="text-end">' + ngn(d.earning) + '</td></tr>';
                }).join('') : '<tr><td colspan="6" class="text-secondary text-center">No closed days yet.</td></tr>') + '</tbody></table></div>';
        }
        var cc = a.customers || {};
        html += '<div class="mb-3 small">Customers credited: <strong>' + num((cc.REGISTERED || 0) + (cc.QUALIFIED || 0)) + '</strong> (' + num(cc.QUALIFIED || 0) + ' with a counted paid booking' + (cc.DISQUALIFIED ? ', ' + num(cc.DISQUALIFIED) + ' ruled out' : '') + '). ' +
            '<a href="#" data-agent-customers="' + esc(a.id) + '">See customers</a> · <a href="#" data-agent-withdrawals="' + esc(a.id) + '">See withdrawals</a></div>';
        if (RBAC.can(P.earnings) && ['APPROVED', 'ACTIVE', 'SUSPENDED'].indexOf(a.status) >= 0) {
            html += '<div class="card card-sm mb-3"><div class="card-body"><div class="subheader mb-2">Add an incentive or adjustment</div><div class="row g-2">' +
                '<div class="col-sm-3"><select class="form-select" id="cr-type"><option value="INCENTIVE">Incentive</option><option value="ADJUSTMENT">Adjustment (+/-)</option></select></div>' +
                '<div class="col-sm-3"><div class="input-group"><span class="input-group-text">₦</span><input type="number" step="0.01" class="form-control" id="cr-amount"></div></div>' +
                '<div class="col-sm-4"><input class="form-control" id="cr-note" maxlength="300" placeholder="Reason (the agent sees it)"></div>' +
                '<div class="col-sm-2"><button class="btn btn-outline-primary w-100" id="btn-credit">Add</button></div></div>' +
                '<div class="form-hint">Incentives wait for the usual earnings hold before they can be withdrawn; adjustments apply at once.</div></div></div>';
        }
        html += '<div class="subheader mb-1">Wallet history</div><div class="table-responsive mb-3"><table class="table table-sm"><thead><tr><th>Date</th><th>Type</th><th>Detail</th><th class="text-end">Amount</th><th>Can withdraw</th></tr></thead><tbody>' +
            (tx.data.length ? tx.data.map(function (e) {
                return '<tr><td class="small">' + fmtDateTime(e.createdAt) + '</td><td>' + badge(ENTRY, e.type) + '</td><td class="small">' + esc(e.note || '') + '<div class="text-secondary">' + esc(e.reference) + '</div></td>' +
                    '<td class="text-end' + (e.amount < 0 ? ' text-danger' : '') + '">' + ngn(e.amount) + '</td><td class="small">' + (e.isAvailable ? 'Yes' : fmtDateTime(e.availableAt)) + '</td></tr>';
            }).join('') : '<tr><td colspan="5" class="text-secondary text-center">No entries yet.</td></tr>') + '</tbody></table></div>';
        html += '<div class="subheader mb-1">History</div><ul class="list-unstyled small mb-0">' +
            (a.events || []).slice(0, 20).map(function (ev) {
                return '<li class="mb-1"><span class="text-secondary">' + fmtDateTime(ev.createdAt) + '</span> ' + esc(ev.action.replace(/_/g, ' ').toLowerCase()) + (ev.note ? ': ' + esc(ev.note) : '') + '</li>';
            }).join('') + '</ul>';
        html += '</div></div>';
        $('agent-body').innerHTML = html;

        var foot = '<button class="btn btn-link link-secondary me-auto" data-bs-dismiss="modal">Close</button>';
        if (RBAC.can(P.manage) && ['APPROVED', 'ACTIVE', 'SUSPENDED'].indexOf(a.status) >= 0) {
            foot += '<button class="btn" data-lock="' + (a.withdrawalsLocked ? '0' : '1') + '">' + (a.withdrawalsLocked ? 'Allow withdrawals' : 'Hold withdrawals') + '</button>';
        }
        foot += statusButtons(a);
        $('agent-footer').innerHTML = foot;
        var credit = $('btn-credit');
        if (credit) credit.addEventListener('click', function () { addCredit(a, credit); });
    }

    var STATUS_COPY = {
        approve: { title: 'Approve this agent', text: 'They can sign in, accept the agent terms and start. They are emailed.', reason: false, ok: 'Approve' },
        reject: { title: 'Reject this application', text: 'The applicant is emailed your reason.', reason: true, ok: 'Reject' },
        suspend: { title: 'Suspend this agent', text: 'They earn nothing and cannot withdraw while suspended. Their balance stays.', reason: true, ok: 'Suspend' },
        reactivate: { title: 'Reactivate this agent', text: 'They can work and earn again.', reason: false, ok: 'Reactivate' },
        deactivate: { title: 'Deactivate this agent', text: 'They can no longer sign in. Pay out or settle any money left in their wallet.', reason: true, ok: 'Deactivate' },
    };

    function changeStatus(act) {
        var c = STATUS_COPY[act];
        askText({
            title: c.title, text: c.text, label: c.reason ? 'Reason' : 'Note (optional)', ok: c.ok, optional: !c.reason,
            run: async function (reason) {
                var a = await Agents.setStatus(_agentId, act, reason);
                var tx = await Agents.transactions(_agentId, { limit: 15 });
                renderAgent(a, tx);
                alertBox(personName(a.user) + ': ' + AGENT[a.status].label.toLowerCase() + '.');
                refreshCurrent();
            },
        });
    }

    async function toggleLock(lock) {
        if (!confirm(lock ? 'Hold withdrawals for this agent? Their balance stays.' : 'Allow this agent to withdraw again?')) return;
        try {
            var a = await Agents.update(_agentId, { withdrawalsLocked: lock });
            renderAgent(a, await Agents.transactions(_agentId, { limit: 15 }));
        } catch (e) { alert(e.message); }
    }

    function editTerritory() {
        askText({
            title: 'Change territory', label: 'Territory', ok: 'Save', initial: '',
            text: 'The area this agent works, e.g. "Lekki, Lagos". It shows in reports and announcements can target it.',
            run: async function (v) {
                var a = await Agents.update(_agentId, { territory: v });
                renderAgent(a, await Agents.transactions(_agentId, { limit: 15 }));
                refreshCurrent();
            },
        });
    }

    async function addCredit(a, btn) {
        var type = $('cr-type').value;
        var amount = Number($('cr-amount').value);
        var note = $('cr-note').value.trim();
        if (!amount || (type === 'INCENTIVE' && amount <= 0)) { $('cr-amount').classList.add('is-invalid'); return; }
        if (note.length < 3) { $('cr-note').classList.add('is-invalid'); return; }
        if (!confirm((amount > 0 ? 'Add ' : 'Take off ') + ngn(Math.abs(amount)) + (amount > 0 ? ' to ' : ' from ') + personName(a.user) + "'s wallet?")) return;
        btn.disabled = true;
        try {
            await Agents.credit(a.id, { type: type, amount: amount, note: note });
            var res = await Promise.all([Agents.get(a.id), Agents.transactions(a.id, { limit: 15 })]);
            renderAgent(res[0], res[1]);
        } catch (e) { alert(e.message); btn.disabled = false; }
    }

    // ------------------------------------------------------------- earnings approval

    async function loadEarnings() {
        $('e-tbody').innerHTML = loadingRow(9);
        try {
            var res = await Agents.days({ status: _f.eStatus || undefined, page: _pages.earnings });
            setPager('earnings', res.meta);
            if (_f.eStatus === 'AWAITING_APPROVAL') setCount('tab-days', res.meta.total);
            $('e-tbody').innerHTML = res.data.length ? res.data.map(function (d) {
                var act = d.status === 'AWAITING_APPROVAL' && RBAC.can(P.earnings)
                    ? '<div class="btn-list justify-content-end flex-nowrap"><button class="btn btn-sm btn-primary" data-day="approve" data-id="' + esc(d.id) + '">Approve</button><button class="btn btn-sm btn-outline-danger" data-day="reject" data-id="' + esc(d.id) + '">Reject</button></div>'
                    : '';
                return '<tr><td class="small">' + fmtDay(d.day) + '</td><td>' + agentCell(d.agent) + '</td>' +
                    '<td class="text-end">' + d.registrations + '</td><td class="text-end">' + d.paidBookings + '</td><td class="text-end">' + d.leads + '</td><td class="text-end text-secondary">' + d.engagements + '</td>' +
                    '<td>' + badge(DAY, d.status) + (d.note ? '<div class="small text-secondary">' + esc(d.note) + '</div>' : '') + '</td>' +
                    '<td class="text-end fw-semibold">' + ngn(d.earning) + (d.releaseAt && d.status === 'APPROVED' ? '<div class="small text-secondary fw-normal">from ' + fmtDateTime(d.releaseAt) + '</div>' : '') + '</td>' +
                    '<td class="text-end">' + act + '</td></tr>';
            }).join('') : emptyRow(9, _f.eStatus === 'AWAITING_APPROVAL' ? 'Nothing waiting for approval.' : 'No days here.');
        } catch (e) { $('e-tbody').innerHTML = errorRow(9, e); }
    }

    function reviewDay(action, id) {
        askText({
            title: action === 'approve' ? 'Approve this earning' : 'Reject this earning',
            text: action === 'approve' ? 'The daily earning goes on the agent wallet and can be withdrawn after the hold.' : 'The agent is told it was not approved, with your reason.',
            label: action === 'approve' ? 'Note (optional)' : 'Reason', ok: action === 'approve' ? 'Approve' : 'Reject', optional: action === 'approve',
            run: async function (note) {
                await Agents.reviewDay(id, action, note);
                alertBox(action === 'approve' ? 'Earning approved.' : 'Earning rejected.');
                loadEarnings();
            },
        });
    }

    // ------------------------------------------------------------- withdrawals

    async function loadWithdrawals() {
        $('w-tbody').innerHTML = loadingRow(8);
        try {
            var res = await Agents.withdrawals({ status: _f.wStatus || undefined, agentId: _f.wAgent || undefined, page: _pages.withdrawals });
            setPager('withdrawals', res.meta);
            document.querySelectorAll('[data-wc]').forEach(function (el) { var n = (res.counts || {})[el.dataset.wc] || 0; el.textContent = n || ''; el.hidden = !n; });
            if (!_f.wAgent) setCount('tab-wd', (res.counts || {}).PENDING || 0);
            $('w-tbody').innerHTML = res.data.length ? res.data.map(function (w) {
                return '<tr><td>' + agentCell(w.agent) + '</td><td class="text-end fw-semibold">' + ngn(w.amount) + '</td><td class="text-end text-secondary">' + ngn(w.fee) + '</td><td class="text-end">' + ngn(w.netAmount) + '</td>' +
                    '<td class="small">' + esc(w.bankName || '') + ' ' + esc(w.accountNumber) + '<div class="text-secondary">' + esc(w.accountName) + '</div></td>' +
                    '<td>' + badge(WD, w.status) + '<div class="small text-secondary">' + (w.method === 'MANUAL' ? 'Manual' : 'Paystack') + '</div>' +
                    (w.failureReason ? '<div class="small text-danger">' + esc(w.failureReason) + '</div>' : '') + (w.rejectedReason ? '<div class="small text-secondary">' + esc(w.rejectedReason) + '</div>' : '') +
                    (w.manualReference ? '<div class="small text-secondary">Ref ' + esc(w.manualReference) + '</div>' : '') + '</td>' +
                    '<td class="small text-secondary">' + fmtDateTime(w.paidAt || w.failedAt || w.approvedAt || w.createdAt) + '<div>' + esc(w.reference) + '</div></td>' +
                    '<td class="text-end">' + wdActions(w) + '</td></tr>';
            }).join('') : emptyRow(8, 'No withdrawals here.');
        } catch (e) { $('w-tbody').innerHTML = errorRow(8, e); }
    }

    function wdActions(w) {
        if (!RBAC.can(P.withdrawals)) return '';
        var b = [];
        if (w.status === 'PENDING') {
            b.push('<button class="btn btn-sm btn-primary" data-wd="approve" data-id="' + esc(w.id) + '">Approve</button>');
            b.push('<button class="btn btn-sm btn-outline-danger" data-wd="reject" data-id="' + esc(w.id) + '">Reject</button>');
        }
        if (w.status === 'APPROVED' && w.method === 'MANUAL') {
            b.push('<button class="btn btn-sm btn-primary" data-wd="paid" data-id="' + esc(w.id) + '">Mark paid</button>');
            b.push('<button class="btn btn-sm btn-outline-danger" data-wd="failed" data-id="' + esc(w.id) + '">Failed</button>');
            b.push('<button class="btn btn-sm btn-outline-secondary" data-wd="reject" data-id="' + esc(w.id) + '">Reject</button>');
        }
        if (w.status === 'PROCESSING') b.push('<button class="btn btn-sm" data-wd="check" data-id="' + esc(w.id) + '">Check status</button>');
        return b.length ? '<div class="btn-list justify-content-end flex-nowrap">' + b.join('') + '</div>' : '';
    }

    async function wdAction(act, id, btn) {
        var done = function (msg) { alertBox(msg); loadWithdrawals(); };
        if (act === 'approve') {
            var how = _settings && _settings.payoutMethod === 'MANUAL' ? 'You then pay it from the bank and mark it paid.' : 'The money is sent by Paystack straight away.';
            if (!confirm('Approve this withdrawal? ' + how)) return;
            btn.disabled = true;
            try { var w = await Agents.approveWithdrawal(id); done('Withdrawal ' + WD[w.status].label.toLowerCase() + ': ' + ngn(w.netAmount) + ' to ' + personName(w.agent.user) + (w.failureReason ? ' (' + w.failureReason + ')' : '') + '.'); }
            catch (e) { alert(e.message); btn.disabled = false; }
        } else if (act === 'check') {
            btn.disabled = true;
            try { var c = await Agents.resync(id); done('Paystack says: ' + WD[c.status].label + '.'); }
            catch (e) { alert(e.message); btn.disabled = false; }
        } else if (act === 'reject') {
            askText({ title: 'Reject this withdrawal', label: 'Reason', ok: 'Reject', text: 'The money goes back to the agent wallet and the agent is told your reason.',
                run: async function (r) { await Agents.rejectWithdrawal(id, r); done('Withdrawal rejected. The money is back in the agent wallet.'); } });
        } else if (act === 'paid') {
            askText({ title: 'Mark as paid', label: 'Bank transfer reference', ok: 'Mark paid', text: 'Only after the money has left the Hairlux bank account. This records it in Finance and tells the agent.',
                run: async function (r) { var w = await Agents.markPaid(id, r); done('Withdrawal of ' + ngn(w.netAmount) + ' marked paid.'); } });
        } else if (act === 'failed') {
            askText({ title: 'Payment could not be made', label: 'Reason', ok: 'Mark failed', text: 'The money goes back to the agent wallet and the agent is told.',
                run: async function (r) { await Agents.markFailed(id, r); done('Withdrawal marked failed. The money is back in the agent wallet.'); } });
        }
    }

    // ------------------------------------------------------------- customers & leads

    async function agentOptions() {
        if (_agentOptions) return _agentOptions;
        var all = [];
        for (var page = 1; page <= 5; page++) {
            var res = await Agents.list({ limit: 100, page: page });
            all = all.concat(res.data);
            if (page >= res.meta.totalPages) break;
        }
        _agentOptions = all.map(function (a) { return { id: a.id, label: personName(a.user) + ' (' + a.agentNumber + ')', status: a.status }; })
            .sort(function (x, y) { return x.label.localeCompare(y.label); });
        return _agentOptions;
    }

    async function fillAgentSelect(sel, firstLabel, activeOnly, exceptId) {
        var opts = await agentOptions();
        sel.innerHTML = '<option value="">' + esc(firstLabel) + '</option>' + opts.filter(function (o) { return (!activeOnly || o.status === 'ACTIVE') && o.id !== exceptId; })
            .map(function (o) { return '<option value="' + esc(o.id) + '">' + esc(o.label) + '</option>'; }).join('');
    }

    function setCustomerSub(sub) {
        _f.cSub = sub;
        document.querySelectorAll('#c-sub .nav-link').forEach(function (x) { x.classList.toggle('active', x.dataset.sub === sub); });
        document.querySelectorAll('[data-only]').forEach(function (el) { el.hidden = el.dataset.only !== sub; });
        var map = sub === 'credited' ? CUST : LEAD;
        $('c-status').innerHTML = '<option value="">All statuses</option>' + Object.keys(map).map(function (k) { return '<option value="' + k + '">' + esc(map[k].label) + '</option>'; }).join('');
        $('c-thead').innerHTML = sub === 'credited'
            ? '<tr><th>Customer</th><th>Agent</th><th>How</th><th>Signed up</th><th>Status</th><th>Counted on</th><th class="text-end">Booking</th><th></th></tr>'
            : '<tr><th>Lead</th><th>Agent</th><th>Interest</th><th>Location</th><th>Status</th><th>Follow up</th><th>Logged</th></tr>';
        _pages.customers = 1;
        loadCustomers();
    }

    async function loadCustomers() {
        var cols = _f.cSub === 'credited' ? 8 : 7;
        $('c-tbody').innerHTML = loadingRow(cols);
        var params = { agentId: $('c-agent').value || undefined, status: $('c-status').value || undefined, search: $('c-search').value.trim() || undefined, page: _pages.customers };
        try {
            if (_f.cSub === 'credited') {
                var res = await Agents.customers(params);
                setPager('customers', res.meta);
                $('c-tbody').innerHTML = res.data.length ? res.data.map(function (r) {
                    var c = r.customer || {};
                    var acts = RBAC.can(P.manage)
                        ? '<div class="btn-list justify-content-end flex-nowrap">' +
                          '<button class="btn btn-sm" data-cust="reassign" data-id="' + esc(r.id) + '" data-current="' + esc(r.agentId) + '">Reassign</button>' +
                          (r.status === 'DISQUALIFIED'
                              ? '<button class="btn btn-sm" data-cust="restore" data-id="' + esc(r.id) + '">Restore</button>'
                              : '<button class="btn btn-sm btn-outline-danger" data-cust="disqualify" data-id="' + esc(r.id) + '">Rule out</button>') +
                          '</div>'
                        : '';
                    return '<tr><td>' + esc(personName(c)) + '<div class="small text-secondary">' + esc(c.email || '') + ' · ' + esc(c.phone || '') + '</div>' +
                        (c.emailVerified ? '' : '<span class="badge bg-yellow-lt">email not verified</span>') + '</td>' +
                        '<td>' + agentCell(r.agent) + '</td><td class="small">' + esc(SOURCE[r.source] || r.source) + '</td>' +
                        '<td class="small">' + fmtDate(r.registeredAt) + '</td><td>' + badge(CUST, r.status) + (r.note ? '<div class="small text-secondary">' + esc(r.note) + '</div>' : '') + '</td>' +
                        '<td class="small">' + (r.qualifiedDay ? fmtDay(String(r.qualifiedDay).slice(0, 10)) : '-') + '</td>' +
                        '<td class="text-end">' + ngn(r.bookingAmount) + '</td><td class="text-end">' + acts + '</td></tr>';
                }).join('') : emptyRow(cols, 'No credited customers here.');
            } else {
                var l = await Agents.leads(params);
                setPager('customers', l.meta);
                $('c-tbody').innerHTML = l.data.length ? l.data.map(function (r) {
                    return '<tr><td>' + esc(r.name) + '<div class="small text-secondary">' + esc(r.phone) + (r.email ? ' · ' + esc(r.email) : '') + '</div></td>' +
                        '<td>' + agentCell(r.agent) + '</td><td class="small">' + esc(r.serviceInterest || '-') + (r.source ? '<div class="text-secondary">' + esc(r.source) + '</div>' : '') + '</td>' +
                        '<td class="small">' + esc(r.location || '-') + '</td><td>' + badge(LEAD, r.status) + '</td>' +
                        '<td class="small">' + fmtDate(r.followUpAt) + '</td><td class="small text-secondary">' + fmtDateTime(r.createdAt) + '</td></tr>';
                }).join('') : emptyRow(cols, 'No leads here.');
            }
        } catch (e) { $('c-tbody').innerHTML = errorRow(cols, e); }
    }

    async function customerAction(act, id, currentAgentId) {
        var copy = {
            reassign: { title: 'Give this customer to another agent', text: 'Use this when two agents disagree about who brought the customer in. Days already closed are not changed.', ok: 'Reassign' },
            disqualify: { title: 'Rule this customer out', text: 'They stop counting for the agent (for example a duplicate or fake sign-up). Days already closed are not changed.', ok: 'Rule out' },
            restore: { title: 'Count this customer again', text: 'They count for the agent again from now on.', ok: 'Restore' },
        }[act];
        var extra = '';
        if (act === 'reassign') extra = '<label class="form-label required" for="pr-agent">Agent who should get the credit</label><select class="form-select mb-3" id="pr-agent"><option>Loading...</option></select>';
        askText({
            title: copy.title, text: copy.text, label: 'Reason', ok: copy.ok, extra: extra,
            run: async function (reason) {
                var payload = { action: act, reason: reason };
                if (act === 'reassign') {
                    payload.agentId = $('pr-agent').value;
                    if (!payload.agentId) throw new Error('Choose the agent.');
                }
                await Agents.customerAction(id, payload);
                alertBox('Credit updated.');
                loadCustomers();
            },
        });
        if (act === 'reassign') { try { await fillAgentSelect($('pr-agent'), 'Choose an agent', false, currentAgentId); } catch (e) { /* stays "Loading" */ } }
    }

    async function assignCustomer() {
        askText({
            title: 'Credit a customer to an agent',
            text: 'For a customer who signed up without the agent code. Copy the customer ID from Users. Their first paid booking from now on counts.',
            label: 'Reason', ok: 'Credit customer',
            extra: '<label class="form-label required" for="pr-customer">Customer ID</label><input class="form-control mb-3" id="pr-customer" placeholder="e.g. 3f1c...">' +
                '<label class="form-label required" for="pr-agent">Agent</label><select class="form-select mb-3" id="pr-agent"><option>Loading...</option></select>',
            run: async function (reason) {
                var customerUserId = $('pr-customer').value.trim();
                var agentId = $('pr-agent').value;
                if (!customerUserId || !agentId) throw new Error('Enter the customer ID and choose the agent.');
                await Agents.assignCustomer({ customerUserId: customerUserId, agentId: agentId, reason: reason });
                alertBox('Customer credited.');
                loadCustomers();
            },
        });
        try { await fillAgentSelect($('pr-agent'), 'Choose an agent', true); } catch (e) { /* stays "Loading" */ }
    }

    // ------------------------------------------------------------- reports

    var REPORT_COLS = [
        ['rank', '#'], ['agentNumber', 'Agent ID'], ['name', 'Agent'], ['territory', 'Territory'], ['engagements', 'Engagements'], ['leads', 'Leads'],
        ['downloads', 'Downloads'], ['registrations', 'Sign-ups'], ['paidBookings', 'Paid bookings'], ['conversionRate', 'Conversion %'],
        ['daysQualified', 'Days qualified'], ['targetAchievement', 'Target %'], ['dailyEarnings', 'Daily earnings'], ['bonuses', 'Bonuses'], ['incentives', 'Incentives'],
        ['withdrawalsPaid', 'Withdrawals paid'],
    ];
    var MONEY = ['dailyEarnings', 'bonuses', 'incentives', 'withdrawalsPaid', 'bookingValue', 'withdrawalsRequested', 'totalEarnings', 'outstandingLiability'];
    var SUMMARY = [
        ['activeAgents', 'Active agents'], ['agentsWithResults', 'Agents with results'], ['engagements', 'Engagements'], ['leads', 'Leads'], ['downloads', 'Downloads'],
        ['registrations', 'Sign-ups'], ['paidBookings', 'Paid bookings'], ['bookingValue', 'Booking value'], ['conversionRate', 'Conversion %'],
        ['targetAchievement', 'Target achievement %'], ['daysQualified', 'Days qualified'], ['dailyEarnings', 'Daily earnings'], ['bonuses', 'Bonuses'],
        ['incentives', 'Incentives'], ['totalEarnings', 'Total earnings'], ['withdrawalRequests', 'Withdrawal requests'], ['withdrawalsRequested', 'Amount requested'],
        ['withdrawalsPaid', 'Withdrawals paid'], ['bonusEligibleAgents', 'Agents reaching a bonus'], ['outstandingLiability', 'Owed to agents (end of period)'],
    ];
    function cellValue(key, v) { return MONEY.indexOf(key) >= 0 ? ngn(v) : (v === null || v === undefined ? '-' : (typeof v === 'number' ? num(v) : v)); }

    async function loadReport() {
        var btn = $('btn-report');
        btn.disabled = true;
        $('r-body').innerHTML = '<div class="text-center py-5"><div class="spinner-border text-primary"></div></div>';
        try {
            var r = await Agents.report($('r-period').value, $('r-date').value || undefined);
            _report = r;
            var s = r.summary;
            var html = '<h3 class="mb-1">' + esc(r.title) + '</h3><div class="small text-secondary mb-3">' + esc(r.note) + '</div>' +
                '<div class="row g-2 mb-4">' + SUMMARY.filter(function (x) { return s[x[0]] !== null && s[x[0]] !== undefined; }).map(function (x) {
                    return '<div class="col-6 col-md-3 col-xl-2"><div class="subheader">' + esc(x[1]) + '</div><div class="fw-semibold">' + cellValue(x[0], s[x[0]]) + '</div></div>';
                }).join('') + '</div>';
            var list = function (title, rows) {
                return '<div class="col-md-6"><div class="subheader mb-1">' + title + '</div>' + (rows.length ? '<ol class="mb-0 small">' + rows.map(function (x) {
                    return '<li>' + esc(x.name) + ' (' + esc(x.agentNumber) + '): ' + x.paidBookings + ' paid bookings, ' + x.registrations + ' sign-ups, ' + x.targetAchievement + '% of target</li>';
                }).join('') + '</ol>' : '<div class="small text-secondary">None.</div>') + '</div>';
            };
            html += '<div class="row g-3 mb-4">' + list('Top agents', r.top) + list('Underperforming agents (under 50% of target)', r.underperforming) + '</div>';
            html += '<div class="table-responsive"><table class="table table-sm table-vcenter"><thead><tr>' + REPORT_COLS.map(function (c) { return '<th' + (c[0] === 'name' || c[0] === 'territory' || c[0] === 'agentNumber' ? '' : ' class="text-end"') + '>' + esc(c[1]) + '</th>'; }).join('') +
                (r.period === 'monthly' ? '<th>Bonus</th>' : '') + '</tr></thead><tbody>' +
                (r.rows.length ? r.rows.map(function (row) {
                    return '<tr>' + REPORT_COLS.map(function (c) {
                        return '<td' + (c[0] === 'name' || c[0] === 'territory' || c[0] === 'agentNumber' ? '' : ' class="text-end"') + '>' + (c[0] === 'name' ? '<a href="#" data-agent="' + esc(row.agentId) + '">' + esc(row.name) + '</a>' : esc(cellValue(c[0], row[c[0]]))) + '</td>';
                    }).join('') + (r.period === 'monthly' ? '<td>' + (row.bonusEligible ? '<span class="badge bg-green-lt">Yes</span>' : '') + '</td>' : '') + '</tr>';
                }).join('') : '<tr><td colspan="' + (REPORT_COLS.length + 1) + '" class="text-secondary text-center py-3">No agents in this period.</td></tr>') + '</tbody></table></div>';
            $('r-body').innerHTML = html;
            $('btn-xlsx').disabled = false;
            $('btn-pdf').disabled = false;
        } catch (e) {
            $('r-body').innerHTML = '<div class="alert alert-danger">' + esc(e.message) + '</div>';
        } finally { btn.disabled = false; }
    }

    function loadScript(src) {
        return new Promise(function (resolve, reject) {
            if (document.querySelector('script[src="' + src + '"]')) return resolve();
            var s = document.createElement('script');
            s.src = src; s.onload = resolve; s.onerror = function () { reject(new Error('Could not load the export tool. Check your connection and try again.')); };
            document.head.appendChild(s);
        });
    }
    function plainRows() {
        return _report.rows.map(function (row) {
            var o = {};
            REPORT_COLS.forEach(function (c) { o[c[1]] = row[c[0]]; });
            o.Status = row.status;
            if (_report.period === 'monthly') o['Bonus reached'] = row.bonusEligible ? 'Yes' : 'No';
            return o;
        });
    }
    function fileBase() { return 'agent-' + _report.period + '-report-' + _report.from + (_report.to !== _report.from ? '-to-' + _report.to : ''); }

    async function downloadExcel() {
        if (!_report) return;
        var btn = $('btn-xlsx');
        btn.disabled = true;
        try {
            await loadScript('https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js');
            var XLSX = window.XLSX;
            var wb = XLSX.utils.book_new();
            var summary = [[_report.title], ['Generated', new Date(_report.generatedAt).toLocaleString('en-GB')], [_report.note], []]
                .concat(SUMMARY.filter(function (x) { return _report.summary[x[0]] !== null && _report.summary[x[0]] !== undefined; }).map(function (x) { return [x[1], _report.summary[x[0]]]; }));
            XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summary), 'Summary');
            XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(plainRows()), 'Agents');
            XLSX.writeFile(wb, fileBase() + '.xlsx');
        } catch (e) { alert(e.message); }
        finally { btn.disabled = false; }
    }

    async function downloadPdf() {
        if (!_report) return;
        var btn = $('btn-pdf');
        btn.disabled = true;
        try {
            await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');
            await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js');
            var doc = new window.jspdf.jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
            var money = function (v) { return 'NGN ' + Number(v || 0).toLocaleString('en-NG', { maximumFractionDigits: 2 }); };
            var val = function (k, v) { return MONEY.indexOf(k) >= 0 ? money(v) : (v === null || v === undefined ? '-' : String(v)); };
            doc.setFontSize(16); doc.text('Hairlux ' + _report.title, 40, 40);
            doc.setFontSize(9); doc.text('Generated ' + new Date(_report.generatedAt).toLocaleString('en-GB') + '. ' + _report.note.replace(/₦/g, 'NGN '), 40, 56, { maxWidth: 760 });
            var sum = SUMMARY.filter(function (x) { return _report.summary[x[0]] !== null && _report.summary[x[0]] !== undefined; }).map(function (x) { return [x[1], val(x[0], _report.summary[x[0]])]; });
            var half = Math.ceil(sum.length / 2);
            doc.autoTable({ startY: 76, theme: 'plain', styles: { fontSize: 9, cellPadding: 2 }, body: sum.slice(0, half).map(function (r, i) { return r.concat(sum[half + i] || ['', '']); }),
                columnStyles: { 0: { fontStyle: 'bold' }, 2: { fontStyle: 'bold' } } });
            doc.autoTable({
                startY: doc.lastAutoTable.finalY + 14,
                head: [REPORT_COLS.map(function (c) { return c[1]; })],
                body: _report.rows.map(function (row) { return REPORT_COLS.map(function (c) { return val(c[0], row[c[0]]); }); }),
                styles: { fontSize: 7.5, cellPadding: 3 }, headStyles: { fillColor: [24, 36, 51] },
            });
            doc.save(fileBase() + '.pdf');
        } catch (e) { alert(e.message); }
        finally { btn.disabled = false; }
    }

    // ------------------------------------------------------------- alerts

    function alertItem(a) {
        return '<div class="list-group-item' + (a.readAt ? '' : ' bg-yellow-lt') + '"><div class="d-flex"><div><span class="badge bg-secondary-lt me-1">' + esc(ALERT_KIND[a.kind] || a.kind) + '</span>' +
            '<strong>' + esc(a.title) + '</strong><div class="small text-secondary">' + esc(a.body) + '</div></div>' +
            '<div class="ms-auto ps-2 text-end small text-secondary text-nowrap">' + fmtDateTime(a.createdAt) +
            (a.agentId ? '<div><a href="#" data-agent="' + esc(a.agentId) + '">Agent</a></div>' : '') +
            (!a.readAt ? '<div><a href="#" data-read-alert="' + esc(a.id) + '">Mark read</a></div>' : '') + '</div></div></div>';
    }

    async function loadAlerts() {
        $('al-list').innerHTML = '<div class="text-center text-secondary py-5">Loading...</div>';
        try {
            var res = await Agents.alerts({ unread: $('al-unread').checked ? 'true' : undefined, page: _pages.alerts });
            setPager('alerts', res.meta);
            setCount('tab-alerts', res.unread);
            $('al-list').innerHTML = res.data.length ? res.data.map(alertItem).join('') : '<div class="text-center text-secondary py-5">No alerts.</div>';
        } catch (e) { $('al-list').innerHTML = '<div class="alert alert-danger m-3">' + esc(e.message) + '</div>'; }
    }

    async function readAlerts(ids) {
        try { await Agents.readAlerts(ids); } catch (e) { alert(e.message); }
        if (_tab === 'alerts') loadAlerts(); else loadOverview();
    }

    // ------------------------------------------------------------- settings

    var NUM_FIELDS = ['targetEngagements', 'targetLeads', 'targetRegistrations', 'targetPaidBookings', 'targetMonthlyPaidBookings', 'qualifyRegistrations', 'qualifyPaidBookings',
        'dailyEarningAmount', 'earningHoldHours', 'extraBookingReward', 'qualifyWithinDays', 'leadMatchDays', 'minWithdrawal', 'withdrawalFee', 'withdrawalIntervalDays'];
    var BOOL_FIELDS = ['acceptingApplications', 'earningsNeedApproval', 'dailyEarningsAfterMonthlyTarget', 'autoApproveWithdrawals'];
    var SELECT_FIELDS = ['bookingRule', 'payoutMethod'];

    function levelRow(l) {
        return '<tr><td><input type="number" min="1" class="form-control form-control-sm" data-lv="bookings" value="' + esc(l ? l.bookings : '') + '"></td>' +
            '<td><div class="input-group input-group-sm"><span class="input-group-text">₦</span><input type="number" min="1" step="0.01" class="form-control" data-lv="amount" value="' + esc(l ? l.amount : '') + '"></div></td>' +
            '<td class="text-end"><button type="button" class="btn btn-sm btn-ghost-danger" data-del-level>Remove</button></td></tr>';
    }

    function renderSettings(s) {
        _settings = s;
        NUM_FIELDS.forEach(function (k) { $('s-' + k).value = s[k]; });
        BOOL_FIELDS.forEach(function (k) { $('s-' + k).checked = !!s[k]; });
        SELECT_FIELDS.forEach(function (k) { $('s-' + k).value = s[k]; });
        $('s-termsText').value = s.termsText || '';
        $('s-terms-hint').textContent = 'Version ' + s.termsVersion + '. Changing the terms makes every agent accept them again.';
        $('s-alertEmails').value = (s.alertEmails || []).join(', ');
        $('s-levels').innerHTML = (s.bonusLevels || []).map(levelRow).join('');
        $('e-note').textContent = 'Each finished day is checked against the qualifying condition: ' + s.qualifyRegistrations + ' verified sign-ups and ' + s.qualifyPaidBookings +
            ' paid bookings. Qualifying days earn ' + ngn(s.dailyEarningAmount) + ', withdrawable ' + s.earningHoldHours + ' hours after the day ends' +
            (s.earningsNeedApproval ? ', once approved here.' : '. Approval is switched off in Settings, so they are paid automatically.');
    }

    async function loadSettings() {
        try { renderSettings(await Agents.getSettings()); }
        catch (e) { alertBox(e.message, 'danger'); }
    }

    async function saveSettings(ev) {
        ev.preventDefault();
        var payload = {};
        var bad = false;
        NUM_FIELDS.forEach(function (k) {
            var el = $('s-' + k);
            el.classList.remove('is-invalid');
            if (el.value === '') { el.classList.add('is-invalid'); bad = true; return; }
            payload[k] = Number(el.value);
        });
        BOOL_FIELDS.forEach(function (k) { payload[k] = $('s-' + k).checked; });
        SELECT_FIELDS.forEach(function (k) { payload[k] = $('s-' + k).value; });
        if (payload.dailyEarningAmount > 10000) { $('s-dailyEarningAmount').classList.add('is-invalid'); bad = true; }
        payload.bonusLevels = [];
        document.querySelectorAll('#s-levels tr').forEach(function (tr) {
            var b = tr.querySelector('[data-lv="bookings"]'); var a = tr.querySelector('[data-lv="amount"]');
            if (!b.value && !a.value) return;
            if (!(Number(b.value) > 0) || !(Number(a.value) > 0)) { b.classList.add('is-invalid'); a.classList.add('is-invalid'); bad = true; return; }
            payload.bonusLevels.push({ bookings: Number(b.value), amount: Number(a.value) });
        });
        payload.termsText = $('s-termsText').value;
        payload.alertEmails = $('s-alertEmails').value.split(/[,;\s]+/).map(function (x) { return x.trim(); }).filter(Boolean);
        if (bad) { alertBox('Check the highlighted fields.', 'danger'); return; }
        var termsChanged = (payload.termsText || '').trim() !== ((_settings && _settings.termsText) || '').trim();
        if (termsChanged && !confirm('You changed the agent terms. Every agent will have to accept them again. Save?')) return;
        var btn = $('btn-save-settings');
        btn.disabled = true;
        try {
            renderSettings(await Agents.saveSettings(payload));
            alertBox('Settings saved.');
        } catch (e) { alertBox(e.message, 'danger'); }
        finally { btn.disabled = false; }
    }

    // ------------------------------------------------------------- prompt and announcement

    function askText(opts) {
        _prompt = opts;
        $('prompt-title').textContent = opts.title;
        $('prompt-text').textContent = opts.text || '';
        $('prompt-extra').innerHTML = opts.extra || '';
        $('prompt-label').textContent = opts.label;
        $('prompt-label').classList.toggle('required', !opts.optional);
        $('prompt-input').value = opts.initial || '';
        $('prompt-input').classList.remove('is-invalid');
        $('btn-prompt-ok').textContent = opts.ok;
        bootstrap.Modal.getOrCreateInstance($('modal-prompt')).show();
    }

    async function promptOk() {
        var v = $('prompt-input').value.trim();
        if (!_prompt.optional && v.length < 3) { $('prompt-input').classList.add('is-invalid'); return; }
        var btn = $('btn-prompt-ok');
        btn.disabled = true;
        try {
            await _prompt.run(v);
            bootstrap.Modal.getInstance($('modal-prompt')).hide();
        } catch (e) { alert(e.message); }
        finally { btn.disabled = false; }
    }

    async function sendAnnouncement() {
        var title = $('an-title').value.trim();
        var message = $('an-message').value.trim();
        if (title.length < 3) { $('an-title').classList.add('is-invalid'); return; }
        if (message.length < 3) { $('an-message').classList.add('is-invalid'); return; }
        var btn = $('btn-announce-send');
        btn.disabled = true;
        try {
            var r = await Agents.announce({ title: title, message: message, territory: $('an-territory').value.trim() || undefined, email: $('an-email').checked });
            bootstrap.Modal.getInstance($('modal-announce')).hide();
            $('an-title').value = ''; $('an-message').value = ''; $('an-territory').value = ''; $('an-email').checked = true;
            alertBox('Announcement sent to ' + r.sent + ' agent' + (r.sent === 1 ? '' : 's') + (typeof r.emailed === 'number' ? ', ' + r.emailed + ' by email' : '') + '.');
        } catch (e) { alert(e.message); }
        finally { btn.disabled = false; }
    }

    // ------------------------------------------------------------- wiring

    function switchTab(tab) {
        _tab = tab;
        document.querySelectorAll('#tabs .nav-link').forEach(function (x) { x.classList.toggle('active', x.dataset.tab === tab); });
        document.querySelectorAll('[data-pane]').forEach(function (p) { p.hidden = p.dataset.pane !== tab; });
        if (location.hash !== '#' + tab) history.replaceState(null, '', '#' + tab);
        refreshCurrent();
    }

    function refreshCurrent() {
        if (_tab === 'overview') loadOverview();
        else if (_tab === 'agents') loadAgents();
        else if (_tab === 'earnings') loadEarnings();
        else if (_tab === 'withdrawals') loadWithdrawals();
        else if (_tab === 'customers') loadCustomers();
        else if (_tab === 'alerts') loadAlerts();
        else if (_tab === 'settings') loadSettings();
    }

    function wireStatusGroup(groupId, key, pageKey, load) {
        document.querySelectorAll('#' + groupId + ' [data-status]').forEach(function (b) {
            b.addEventListener('click', function () {
                document.querySelectorAll('#' + groupId + ' .btn').forEach(function (x) { x.classList.toggle('active', x === b); });
                _f[key] = b.dataset.status;
                _pages[pageKey] = 1;
                load();
            });
        });
    }

    function debounce(key, fn) { clearTimeout(_timers[key]); _timers[key] = setTimeout(fn, 300); }

    var LOADERS = { agents: loadAgents, earnings: loadEarnings, withdrawals: loadWithdrawals, customers: loadCustomers, alerts: loadAlerts };

    document.addEventListener('DOMContentLoaded', async function () {
        if (!RBAC.applyPageGuard(P.read)) return;
        $('btn-announce').classList.toggle('d-none', !RBAC.can(P.manage));
        $('btn-assign').classList.toggle('d-none', !RBAC.can(P.manage));
        $('btn-save-settings').classList.toggle('d-none', !RBAC.can(P.settings));
        $('s-fields').disabled = !RBAC.can(P.settings);
        $('r-date').value = new Date(Date.now() + 3600000 - 86400000).toISOString().slice(0, 10);

        document.querySelectorAll('#tabs [data-tab]').forEach(function (a) {
            a.addEventListener('click', function (e) { e.preventDefault(); switchTab(a.dataset.tab); });
        });
        wireStatusGroup('a-status', 'aStatus', 'agents', loadAgents);
        wireStatusGroup('e-status', 'eStatus', 'earnings', loadEarnings);
        wireStatusGroup('w-status', 'wStatus', 'withdrawals', function () { _f.wAgent = null; loadWithdrawals(); });
        $('a-search').addEventListener('input', function () { _pages.agents = 1; debounce('a', loadAgents); });
        $('a-territory').addEventListener('input', function () { _pages.agents = 1; debounce('a', loadAgents); });
        $('c-search').addEventListener('input', function () { _pages.customers = 1; debounce('c', loadCustomers); });
        $('c-agent').addEventListener('change', function () { _pages.customers = 1; loadCustomers(); });
        $('c-status').addEventListener('change', function () { _pages.customers = 1; loadCustomers(); });
        document.querySelectorAll('#c-sub [data-sub]').forEach(function (a) { a.addEventListener('click', function (e) { e.preventDefault(); setCustomerSub(a.dataset.sub); }); });
        $('al-unread').addEventListener('change', function () { _pages.alerts = 1; loadAlerts(); });
        $('btn-read-all').addEventListener('click', function () { readAlerts(); });
        $('btn-report').addEventListener('click', loadReport);
        $('btn-xlsx').addEventListener('click', downloadExcel);
        $('btn-pdf').addEventListener('click', downloadPdf);
        $('btn-prompt-ok').addEventListener('click', promptOk);
        $('btn-announce').addEventListener('click', function () { bootstrap.Modal.getOrCreateInstance($('modal-announce')).show(); });
        $('btn-announce-send').addEventListener('click', sendAnnouncement);
        $('btn-assign').addEventListener('click', assignCustomer);
        $('s-form').addEventListener('submit', saveSettings);
        $('btn-add-level').addEventListener('click', function () { $('s-levels').insertAdjacentHTML('beforeend', levelRow(null)); });
        Object.keys(LOADERS).forEach(function (k) {
            var prev = document.querySelector('[data-pager-prev="' + k + '"]');
            var next = document.querySelector('[data-pager-next="' + k + '"]');
            if (prev) prev.addEventListener('click', function () { if (_pages[k] > 1) { _pages[k]--; LOADERS[k](); } });
            if (next) next.addEventListener('click', function () { if (_meta[k] && _pages[k] < _meta[k].totalPages) { _pages[k]++; LOADERS[k](); } });
        });

        document.addEventListener('click', function (e) {
            var t;
            if ((t = e.target.closest('[data-agent]'))) { e.preventDefault(); return openAgent(t.dataset.agent); }
            if ((t = e.target.closest('[data-goto]'))) { e.preventDefault(); return switchTab(t.dataset.goto); }
            if ((t = e.target.closest('[data-status-act]'))) return changeStatus(t.dataset.statusAct);
            if ((t = e.target.closest('[data-lock]'))) return toggleLock(t.dataset.lock === '1');
            if ((t = e.target.closest('[data-edit-territory]'))) { e.preventDefault(); return editTerritory(); }
            if ((t = e.target.closest('[data-day]'))) return reviewDay(t.dataset.day, t.dataset.id);
            if ((t = e.target.closest('[data-wd]'))) return wdAction(t.dataset.wd, t.dataset.id, t);
            if ((t = e.target.closest('[data-cust]'))) return customerAction(t.dataset.cust, t.dataset.id, t.dataset.current);
            if ((t = e.target.closest('[data-read-alert]'))) { e.preventDefault(); return readAlerts([t.dataset.readAlert]); }
            if ((t = e.target.closest('[data-del-level]'))) return t.closest('tr').remove();
            if ((t = e.target.closest('[data-agent-customers]'))) {
                e.preventDefault();
                bootstrap.Modal.getInstance($('modal-agent')).hide();
                switchTab('customers');
                setCustomerSub('credited');
                $('c-agent').value = t.dataset.agentCustomers;
                return loadCustomers();
            }
            if ((t = e.target.closest('[data-agent-withdrawals]'))) {
                e.preventDefault();
                bootstrap.Modal.getInstance($('modal-agent')).hide();
                _f.wAgent = t.dataset.agentWithdrawals;
                _pages.withdrawals = 1;
                return switchTab('withdrawals');
            }
        });
        window.addEventListener('hashchange', function () {
            var h = (location.hash || '').replace('#', '');
            if (TABS.indexOf(h) >= 0 && h !== _tab) switchTab(h);
        });

        try { renderSettings(await Agents.getSettings()); } catch (e) { /* the settings tab shows the error */ }
        setCustomerSub('credited');
        fillAgentSelect($('c-agent'), 'All agents', false).catch(function () { /* filter stays "All agents" */ });
        var hash = (location.hash || '').replace('#', '');
        switchTab(TABS.indexOf(hash) >= 0 ? hash : 'overview');
        if (_tab !== 'overview') loadOverview(); // tab counts
    });
})();
