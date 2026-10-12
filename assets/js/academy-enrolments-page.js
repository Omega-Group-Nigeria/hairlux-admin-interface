/**
 * Academy Enrolments page (academy-enrolments.html).
 * Funnel and money for enrolments from the public Academy pages (landing
 * page programmes.html, form enrol-now.html): checkouts started vs paid,
 * what was collected (online and balances), balances still owed, results by
 * campaign / channel / programme / branch, and the list of checkouts (unpaid
 * ones are leads to follow up; owing ones can have a branch payment recorded).
 * Settings (on/off, deposit %, minimum deposit, deposit cut-off, Meta Pixel)
 * for those with academy_enrolments:manage_settings, and a UTM link builder.
 */
(function () {
    'use strict';

    var P = {
        read: 'academy_enrolments:read',
        manage: 'academy_enrolments:manage_settings',
        recordBalance: 'academy_training:record_balance_payment',
    };
    var ACADEMY_SITE = 'https://academy.hairlux.com.ng/';
    var LIMIT = 25;
    var _summary = null;
    var _group = 'byCampaign';
    var _page = 1;
    var _totalPages = 1;
    var _chart = null;
    var _config = null;
    var _settings = null;
    var _rows = [];
    var _searchTimer = null;
    var _intentTimer = null;
    var _reloadTimer = null;

    var GROUP_HEAD = { byCampaign: 'Campaign', byChannel: 'Channel', byProgramme: 'Programme', byBranch: 'Branch' };
    var STATUS_BADGE = {
        ENROLLED: ['bg-green-lt', 'Enrolled'],
        PENDING: ['bg-yellow-lt', 'Pending payment'],
        EXPIRED: ['bg-secondary-lt', 'Unpaid (expired)'],
        FAILED: ['bg-red-lt', 'Failed'],
    };

    // ── Helpers ─────────────────────────────────────────────────────────────

    function $(id) { return document.getElementById(id); }

    function esc(s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    }

    function can(p) { return RBAC.can(p); }

    function modal(id) {
        var bs = window.bootstrap || (window.tabler && window.tabler.bootstrap);
        return bs.Modal.getOrCreateInstance($(id));
    }

    function ngn(v) {
        return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(Number(v || 0));
    }

    function pct(v) { return (Number(v) || 0).toFixed(1).replace(/\.0$/, '') + '%'; }
    function isoDate(d) { return d.toISOString().slice(0, 10); }
    function lagosToday() { return isoDate(new Date(Date.now() + 3600000)); }
    function addDays(str, n) {
        var d = new Date(str + 'T00:00:00Z');
        d.setUTCDate(d.getUTCDate() + n);
        return isoDate(d);
    }
    function fmtDate(v) {
        if (!v) return '-';
        return new Date(v).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Africa/Lagos' });
    }
    function fmtDay(str) {
        return new Date(String(str).slice(0, 10) + 'T00:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
    }
    function fmtDateTime(iso) {
        if (!iso) return '-';
        return new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'Africa/Lagos' });
    }

    function showAlert(type, msg) {
        $('page-alert').innerHTML = msg
            ? '<div class="alert alert-' + type + ' alert-dismissible"><div>' + esc(msg) + '</div><a class="btn-close" data-bs-dismiss="alert"></a></div>'
            : '';
    }

    function filters() {
        return {
            from: $('f-from').value || undefined,
            to: $('f-to').value || undefined,
            programType: $('f-type').value || undefined,
            branchId: $('f-branch').value || undefined,
            campaign: $('f-campaign').value || undefined,
        };
    }

    // ── Summary ─────────────────────────────────────────────────────────────

    function fillSelect(sel, all, names) {
        var current = sel.value;
        if (current && names.indexOf(current) === -1) names.push(current);
        sel.innerHTML = '<option value="">' + all + '</option>' + names.sort().map(function (n) {
            return '<option value="' + esc(n) + '"' + (n === current ? ' selected' : '') + '>' + esc(n) + '</option>';
        }).join('');
    }

    async function loadSummary() {
        try {
            _summary = await AcademyEnrolments.summary(filters());
        } catch (e) {
            showAlert('danger', e.message || 'Could not load the summary.');
            return;
        }
        var t = _summary.totals;
        $('kpi-started').textContent = t.started.toLocaleString();
        $('kpi-started-sub').textContent = fmtDay(_summary.from) + ' to ' + fmtDay(_summary.to);
        $('kpi-enrolled').textContent = t.enrolled.toLocaleString();
        $('kpi-enrolled-sub').textContent = pct(t.conversionRate) + ' of checkouts paid';
        $('kpi-collected').textContent = ngn(t.collected + t.balanceCollected);
        $('kpi-collected-sub').textContent = ngn(t.collected) + ' at enrolment + ' + ngn(t.balanceCollected) + ' balances';
        $('kpi-outstanding').textContent = ngn(t.balanceOutstanding);

        $('o-kinds').textContent = t.trainings + ' / ' + t.courses;
        $('o-split').textContent = t.depositPayments + ' / ' + t.fullPayments;
        $('o-value').textContent = ngn(t.enrolledValue);
        $('o-discounts').textContent = ngn(t.discounts);
        $('o-accounts').textContent = t.newAccounts;
        $('o-unpaid').textContent = t.pending + t.expired;
        $('o-paidfailed').textContent = t.paidNotEnrolled;
        $('o-paidfailed').classList.toggle('text-danger', t.paidNotEnrolled > 0);

        fillSelect($('f-campaign'), 'All campaigns', _summary.byCampaign.map(function (r) { return r.key; }));
        fillSelect($('i-channel'), 'All sources', _summary.byChannel.map(function (r) { return r.key; }));
        renderBreakdown();
        renderTrend();
    }

    function renderBreakdown() {
        $('breakdown-head').textContent = GROUP_HEAD[_group];
        var rows = (_summary && _summary[_group]) || [];
        $('breakdown-body').innerHTML = rows.length ? rows.map(function (r) {
            return '<tr>' +
                '<td>' + esc(r.key) + '</td>' +
                '<td class="text-end">' + r.started + '</td>' +
                '<td class="text-end">' + r.enrolled + '</td>' +
                '<td class="text-end">' + pct(r.conversionRate) + '</td>' +
                '<td class="text-end">' + ngn(r.value) + '</td>' +
                '<td class="text-end">' + ngn(r.collected) + '</td>' +
                '</tr>';
        }).join('') : '<tr><td colspan="6" class="text-secondary text-center py-4">No enrolments in this period.</td></tr>';
    }

    function renderTrend() {
        var trend = _summary.trend || [];
        var opts = {
            chart: { type: 'bar', height: 260, toolbar: { show: false }, fontFamily: 'inherit', parentHeightOffset: 0 },
            series: [
                { name: 'Checkouts started', data: trend.map(function (d) { return d.started; }) },
                { name: 'Enrolled (paid)', data: trend.map(function (d) { return d.enrolled; }) },
            ],
            xaxis: {
                categories: trend.map(function (d) { return d.date; }),
                labels: {
                    formatter: function (v) { return v ? new Date(v + 'T00:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' }) : v; },
                    rotate: 0,
                    hideOverlappingLabels: true,
                },
                tickAmount: Math.min(10, trend.length),
            },
            yaxis: { labels: { formatter: function (v) { return Math.round(v); } }, forceNiceScale: true, min: 0 },
            colors: ['#c9a872', '#2fb344'],
            plotOptions: { bar: { columnWidth: '60%', borderRadius: 2 } },
            dataLabels: { enabled: false },
            legend: { position: 'top', horizontalAlign: 'left' },
            grid: { strokeDashArray: 4 },
            tooltip: { theme: document.body.getAttribute('data-bs-theme') === 'dark' ? 'dark' : 'light' },
        };
        if (_chart) { _chart.destroy(); _chart = null; }
        if (window.ApexCharts) {
            _chart = new ApexCharts($('chart-trend'), opts);
            _chart.render();
        }
    }

    // ── Checkouts ───────────────────────────────────────────────────────────

    function checkoutFilters() {
        var pay = $('i-pay').value;
        return {
            from: $('i-from').value || undefined,
            to: $('i-to').value || undefined,
            programType: $('f-type').value || undefined,
            branchId: $('f-branch').value || undefined,
            campaign: $('f-campaign').value || undefined,
            channel: $('i-channel').value || undefined,
            paymentPlan: pay === 'DEPOSIT' || pay === 'FULL' ? pay : undefined,
            balance: pay === 'owing' ? 'owing' : undefined,
            status: $('i-status').value || undefined,
            search: $('i-search').value.trim() || undefined,
        };
    }

    function listParams(extra) {
        return Object.assign({}, checkoutFilters(), { page: _page, limit: LIMIT }, extra || {});
    }

    function renderFilterNote() {
        var notes = [];
        if ($('f-type').value) notes.push('Programme type at the top applies.');
        if ($('f-branch').value) notes.push('Branch at the top applies.');
        if ($('f-campaign').value) notes.push('Campaign at the top applies: ' + $('f-campaign').value + '.');
        $('i-filter-note').textContent = notes.join(' ');
    }

    function reloadIntents() {
        var from = $('i-from').value, to = $('i-to').value;
        renderFilterNote();
        if (from && to && from > to) {
            $('intents-body').innerHTML = '<tr><td colspan="7" class="text-warning text-center py-4">"From" must be on or before "To".</td></tr>';
            $('intents-info').textContent = '';
            $('i-prev').disabled = true;
            $('i-next').disabled = true;
            return;
        }
        _page = 1;
        loadIntents();
    }

    function resetCheckoutFilters() {
        $('i-from').value = $('f-from').value;
        $('i-to').value = $('f-to').value;
        $('i-channel').value = '';
        $('i-pay').value = '';
        $('i-status').value = '';
        $('i-search').value = '';
        reloadIntents();
    }

    function sourceCell(it) {
        var main = it.acquisitionChannel || 'Unknown';
        var sub = [it.utmCampaign, it.utmContent].filter(Boolean).join(' · ');
        return esc(main) + (sub ? '<div class="text-secondary small">' + esc(sub) + '</div>' : '');
    }

    function programmeCell(it) {
        var kind = it.programType === 'TRAINING' ? 'In-branch' : 'Online course';
        var training = it.programType === 'TRAINING' && it.cohort;
        // programName is "Training (class, branch)": the class and branch go on the second line.
        var name = training ? it.programName.replace(/\s*\([^)]*\)$/, '') : it.programName;
        var sub = training
            ? esc(it.cohort.name) + ', ' + esc(it.branch ? it.branch.name : '-') + ' · starts ' + fmtDate(it.cohort.startDate)
            : kind;
        return '<div>' + esc(name) + '</div><div class="text-secondary small">' + sub +
            (it.discountCode ? ' · code ' + esc(it.discountCode) : '') + '</div>';
    }

    function statusCell(it) {
        var b = STATUS_BADGE[it.status] || ['bg-secondary-lt', it.status];
        var html = '<span class="badge ' + b[0] + '">' + b[1] + '</span>';
        var code = it.registration ? it.registration.registrationCode : it.orderCode;
        if (code && it.status === 'ENROLLED') html += '<div class="small mt-1 font-monospace">' + esc(code) + '</div>';
        if (it.failureReason && it.status !== 'ENROLLED') html += '<div class="text-danger small mt-1">' + esc(it.failureReason) + '</div>';
        return html;
    }

    function balanceCell(it, index) {
        if (it.status !== 'ENROLLED') return '<span class="text-secondary">' + ngn(it.totalAmount) + ' total</span>';
        var reg = it.registration;
        if (!reg || it.paymentPlan !== 'DEPOSIT') return ngn(0);
        if (!(reg.balanceDue > 0)) {
            return ngn(0) + '<div class="text-secondary small">' + ngn(it.totalAmount - it.amountToPay) + ' paid' + (reg.balancePaidAt ? ' ' + fmtDate(reg.balancePaidAt) : '') + '</div>';
        }
        return '<strong class="text-danger">' + ngn(reg.balanceDue) + '</strong>' +
            '<div class="text-secondary small">before ' + fmtDate(reg.balanceDueAt) + '</div>' +
            (can(P.recordBalance) ? '<button class="btn btn-sm btn-outline-primary mt-1" data-record="' + index + '">Record payment</button>' : '');
    }

    async function loadIntents() {
        var body = $('intents-body');
        body.innerHTML = '<tr><td colspan="7" class="text-secondary text-center py-4">Loading&hellip;</td></tr>';
        var data;
        try {
            data = await AcademyEnrolments.list(listParams());
        } catch (e) {
            body.innerHTML = '<tr><td colspan="7" class="text-danger text-center py-4">' + esc(e.message) + '</td></tr>';
            return;
        }
        _rows = data.items;
        _totalPages = data.pagination.totalPages;
        body.innerHTML = _rows.length ? _rows.map(function (it, i) {
            return '<tr>' +
                '<td class="text-nowrap">' + fmtDateTime(it.createdAt) + '</td>' +
                '<td><div>' + esc(it.fullName) + (it.accountCreated ? ' <span class="badge bg-blue-lt" title="Account created by this enrolment">New</span>' : '') + '</div>' +
                '<div class="text-secondary small"><a href="tel:' + esc(it.phone) + '" class="text-reset">' + esc(it.phone) + '</a> · ' +
                '<a href="mailto:' + esc(it.email) + '" class="text-reset">' + esc(it.email) + '</a></div></td>' +
                '<td>' + programmeCell(it) + '</td>' +
                '<td>' + sourceCell(it) + '</td>' +
                '<td class="text-end">' + (it.status === 'ENROLLED' ? ngn(it.amountToPay) : '<span class="text-secondary">' + ngn(0) + '</span>') +
                '<div class="text-secondary small">' + (it.paymentPlan === 'DEPOSIT' ? 'Deposit' : 'Full fee') + '</div></td>' +
                '<td class="text-end">' + balanceCell(it, i) + '</td>' +
                '<td>' + statusCell(it) + '</td>' +
                '</tr>';
        }).join('') : '<tr><td colspan="7" class="text-secondary text-center py-4">No checkouts match these filters.</td></tr>';

        var start = data.pagination.total ? (data.pagination.page - 1) * LIMIT + 1 : 0;
        var end = Math.min(data.pagination.page * LIMIT, data.pagination.total);
        $('intents-info').textContent = data.pagination.total ? 'Showing ' + start + ' to ' + end + ' of ' + data.pagination.total : '';
        $('i-prev').disabled = _page <= 1;
        $('i-next').disabled = _page >= _totalPages;
    }

    async function exportCsv() {
        var btn = $('btn-export');
        btn.disabled = true;
        try {
            var rows = [];
            for (var page = 1; page <= 20; page++) {
                var data = await AcademyEnrolments.list(listParams({ page: page, limit: 500 }));
                rows = rows.concat(data.items);
                if (page >= data.pagination.totalPages) break;
            }
            if (!rows.length) { showAlert('warning', 'Nothing to export for these filters.'); return; }
            CsvExport.download('academy-enrolments-' + ($('i-from').value || 'all') + '-to-' + ($('i-to').value || lagosToday()) + '.csv', [
                { label: 'Started', get: function (r) { return fmtDateTime(r.createdAt); } },
                { label: 'Status', get: function (r) { return (STATUS_BADGE[r.status] || [0, r.status])[1]; } },
                { label: 'Reference', get: function (r) { return r.reference; } },
                { label: 'Registration or order code', get: function (r) { return r.registration ? r.registration.registrationCode : (r.orderCode || ''); } },
                { label: 'Name', get: function (r) { return r.fullName; } },
                { label: 'Phone', get: function (r) { return r.phone; } },
                { label: 'Email', get: function (r) { return r.email; } },
                { label: 'Type', get: function (r) { return r.programType === 'TRAINING' ? 'In-branch training' : 'Online course'; } },
                { label: 'Programme', get: function (r) { return r.programName; } },
                { label: 'Branch', get: function (r) { return r.branch ? r.branch.name : ''; } },
                { label: 'Class starts', get: function (r) { return r.cohort ? fmtDate(r.cohort.startDate) : ''; } },
                { label: 'Payment', get: function (r) { return r.paymentPlan === 'DEPOSIT' ? 'Deposit' : 'Full fee'; } },
                { label: 'Fee', get: function (r) { return r.listPrice; } },
                { label: 'Discount code', get: function (r) { return r.discountCode || ''; } },
                { label: 'Discount', get: function (r) { return r.discountAmount; } },
                { label: 'Total', get: function (r) { return r.totalAmount; } },
                { label: 'Paid at enrolment', get: function (r) { return r.status === 'ENROLLED' ? r.amountToPay : 0; } },
                { label: 'Balance owed', get: function (r) { return r.registration ? r.registration.balanceDue : ''; } },
                { label: 'Channel', get: function (r) { return r.acquisitionChannel || ''; } },
                { label: 'utm_source', get: function (r) { return r.utmSource || ''; } },
                { label: 'utm_medium', get: function (r) { return r.utmMedium || ''; } },
                { label: 'utm_campaign', get: function (r) { return r.utmCampaign || ''; } },
                { label: 'utm_content', get: function (r) { return r.utmContent || ''; } },
                { label: 'New account', get: function (r) { return r.accountCreated ? 'Yes' : 'No'; } },
                { label: 'Problem', get: function (r) { return r.status === 'ENROLLED' ? '' : (r.failureReason || ''); } },
            ], rows);
        } catch (e) {
            showAlert('danger', e.message || 'Export failed.');
        } finally {
            btn.disabled = false;
        }
    }

    // ── Settings ────────────────────────────────────────────────────────────

    function depositExample() {
        var on = $('s-deposit').checked;
        $('s-deposit-fields').classList.toggle('opacity-50', !on);
        ['s-percent', 's-min', 's-cutoff'].forEach(function (id) { $(id).disabled = !on; });
        if (!on) { $('s-example').textContent = 'In-branch training is paid in full at enrolment.'; return; }
        var pctV = Number($('s-percent').value) || 0;
        var min = Number($('s-min').value) || 0;
        var ex = [50000, 150000, 300000].map(function (fee) {
            var dep = Math.min(fee, Math.max(Math.ceil(fee * pctV / 100), Math.round(min)));
            return ngn(fee) + ' fee: ' + ngn(dep) + ' deposit';
        });
        $('s-example').textContent = 'For example, ' + ex.join('; ') + '. The balance is due before the class starts; classes starting sooner than ' +
            (Number($('s-cutoff').value) || 0) + ' days are paid in full.';
    }

    async function openSettings() {
        $('settings-error').classList.add('d-none');
        try {
            _settings = await AcademyEnrolments.getSettings();
        } catch (e) {
            showAlert('danger', e.message);
            return;
        }
        var s = _settings;
        $('s-enabled').checked = s.enrolmentEnabled;
        $('s-deposit').checked = s.depositEnabled;
        $('s-percent').value = s.depositPercent;
        $('s-min').value = s.minDepositAmount;
        $('s-cutoff').value = s.depositCutoffDays;
        $('s-pixel').value = s.metaPixelId || '';
        $('s-updated').textContent = s.updatedAt ? 'Last changed ' + fmtDateTime(s.updatedAt) : '';
        depositExample();
        modal('modal-settings').show();
    }

    async function saveSettings() {
        var err = $('settings-error');
        err.classList.add('d-none');
        var payload = {
            enrolmentEnabled: $('s-enabled').checked,
            depositEnabled: $('s-deposit').checked,
            depositPercent: Number($('s-percent').value),
            minDepositAmount: Number($('s-min').value) || 0,
            depositCutoffDays: Number($('s-cutoff').value) || 0,
            metaPixelId: $('s-pixel').value.trim(),
        };
        if (!(payload.depositPercent >= 1 && payload.depositPercent <= 99)) {
            err.textContent = 'The deposit must be between 1% and 99% of the fee.';
            err.classList.remove('d-none');
            return;
        }
        if (payload.metaPixelId && !/^\d{5,20}$/.test(payload.metaPixelId)) {
            err.textContent = 'A Meta Pixel ID is digits only.';
            err.classList.remove('d-none');
            return;
        }
        var btn = $('btn-save-settings');
        btn.disabled = true;
        try {
            _settings = await AcademyEnrolments.saveSettings(payload);
            modal('modal-settings').hide();
            showAlert('success', 'Settings saved. The Academy pages use them within a minute.');
        } catch (e) {
            err.textContent = e.message;
            err.classList.remove('d-none');
        } finally {
            btn.disabled = false;
        }
    }

    // ── Link builder ────────────────────────────────────────────────────────

    function slug(v) {
        return String(v || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    }

    function buildLink() {
        var base = $('l-base').value.trim() || ACADEMY_SITE + 'programmes.html';
        var q = new URLSearchParams();
        q.set('utm_source', $('l-source').value);
        q.set('utm_medium', $('l-medium').value);
        if (slug($('l-campaign').value)) q.set('utm_campaign', slug($('l-campaign').value));
        if (slug($('l-content').value)) q.set('utm_content', slug($('l-content').value));
        var pick = $('l-pick').value;
        if (pick && /enrol-now\.html/.test(base)) {
            var parts = pick.split(':');
            q.set(parts[0], parts[1]);
        }
        $('l-output').value = base + (base.indexOf('?') === -1 ? '?' : '&') + q.toString();
    }

    function openLinks() {
        if (!$('l-base').value) $('l-base').value = ACADEMY_SITE + 'programmes.html';
        if (_config) {
            var opts = ['<option value="">Nothing</option>'];
            _config.trainings.forEach(function (t) {
                opts.push('<option value="training:' + esc(t.id) + '">Training: ' + esc(t.name) + '</option>');
                t.cohorts.forEach(function (c) {
                    opts.push('<option value="cohort:' + esc(c.id) + '">&nbsp;&nbsp;Class: ' + esc(t.name) + ', ' + esc(c.branch.name) + ', ' + fmtDate(c.startDate) + '</option>');
                });
            });
            _config.courses.forEach(function (c) {
                opts.push('<option value="course:' + esc(c.id) + '">Online course: ' + esc(c.title) + '</option>');
            });
            $('l-pick').innerHTML = opts.join('');
        }
        buildLink();
        modal('modal-links').show();
    }

    // ── Start ───────────────────────────────────────────────────────────────

    function setRange(r) {
        var to = lagosToday();
        $('f-to').value = to;
        $('f-from').value = r === 'month' ? to.slice(0, 8) + '01' : addDays(to, -(Number(r) - 1));
    }

    function reloadAll() {
        var from = $('f-from').value, to = $('f-to').value;
        if (from && to && from > to) {
            showAlert('warning', '"From" must be on or before "To".');
            return;
        }
        showAlert('', '');
        $('i-from').value = from;
        $('i-to').value = to;
        loadSummary();
        reloadIntents();
    }

    function wireEvents() {
        ['f-from', 'f-to'].forEach(function (id) {
            $(id).addEventListener('change', function () {
                clearTimeout(_reloadTimer);
                _reloadTimer = setTimeout(reloadAll, 400);
            });
        });
        ['f-type', 'f-branch', 'f-campaign'].forEach(function (id) { $(id).addEventListener('change', reloadAll); });
        $('quick-ranges').addEventListener('click', function (e) {
            var b = e.target.closest('[data-range]');
            if (!b) return;
            setRange(b.getAttribute('data-range'));
            reloadAll();
        });
        $('breakdown-tabs').addEventListener('click', function (e) {
            var a = e.target.closest('[data-group]');
            if (!a) return;
            e.preventDefault();
            _group = a.getAttribute('data-group');
            Array.prototype.forEach.call(document.querySelectorAll('#breakdown-tabs .nav-link'), function (l) {
                l.classList.toggle('active', l === a);
            });
            renderBreakdown();
        });
        ['i-channel', 'i-pay', 'i-status'].forEach(function (id) { $(id).addEventListener('change', reloadIntents); });
        ['i-from', 'i-to'].forEach(function (id) {
            $(id).addEventListener('change', function () {
                clearTimeout(_intentTimer);
                _intentTimer = setTimeout(reloadIntents, 400);
            });
        });
        $('i-search').addEventListener('input', function () {
            clearTimeout(_searchTimer);
            _searchTimer = setTimeout(reloadIntents, 350);
        });
        $('i-reset').addEventListener('click', resetCheckoutFilters);
        $('i-prev').addEventListener('click', function () { if (_page > 1) { _page--; loadIntents(); } });
        $('i-next').addEventListener('click', function () { if (_page < _totalPages) { _page++; loadIntents(); } });
        $('kpi-owing-link').addEventListener('click', function (e) {
            e.preventDefault();
            $('i-pay').value = 'owing';
            $('i-status').value = '';
            reloadIntents();
            $('checkouts-card').scrollIntoView({ behavior: 'smooth' });
        });
        $('intents-body').addEventListener('click', function (e) {
            var b = e.target.closest('[data-record]');
            if (!b) return;
            var it = _rows[Number(b.getAttribute('data-record'))];
            if (!it || !it.registration) return;
            AcademyBalanceModal.open({
                id: it.registration.id,
                registrationCode: it.registration.registrationCode,
                name: it.fullName,
                balanceDue: it.registration.balanceDue,
            }, function (res) {
                showAlert('success', ngn(res.amount) + ' recorded for ' + it.registration.registrationCode + (res.registration.balanceDue > 0
                    ? '. ' + ngn(res.registration.balanceDue) + ' is still owed.'
                    : '. The balance is cleared.'));
                loadSummary();
                loadIntents();
            });
        });
        $('btn-export').addEventListener('click', exportCsv);
        $('btn-settings').addEventListener('click', openSettings);
        $('btn-save-settings').addEventListener('click', saveSettings);
        ['s-deposit', 's-percent', 's-min', 's-cutoff'].forEach(function (id) {
            $(id).addEventListener('input', depositExample);
            $(id).addEventListener('change', depositExample);
        });
        $('btn-link-builder').addEventListener('click', openLinks);
        $('l-dest').addEventListener('change', function () { $('l-base').value = ACADEMY_SITE + this.value; buildLink(); });
        ['l-base', 'l-source', 'l-medium', 'l-campaign', 'l-content', 'l-pick'].forEach(function (id) {
            $(id).addEventListener('input', buildLink);
            $(id).addEventListener('change', buildLink);
        });
        $('btn-copy-link').addEventListener('click', function () {
            var out = $('l-output');
            out.select();
            var done = function () { $('btn-copy-link').textContent = 'Copied'; setTimeout(function () { $('btn-copy-link').textContent = 'Copy'; }, 1500); };
            if (navigator.clipboard) navigator.clipboard.writeText(out.value).then(done, function () { document.execCommand('copy'); done(); });
            else { document.execCommand('copy'); done(); }
        });
    }

    function applyPermissions() {
        $('btn-settings').classList.toggle('d-none', !can(P.manage));
    }

    document.addEventListener('DOMContentLoaded', async function () {
        RBAC.loadFromStorage();
        RBAC.applyPageGuard(P.read);
        wireEvents();
        applyPermissions();
        document.addEventListener('rbac:updated', applyPermissions);

        $('landing-link').href = ACADEMY_SITE + 'programmes.html';
        setRange(30);

        try {
            _config = await AcademyEnrolments.publicConfig();
            var managed = (RBAC.isManagerScoped && RBAC.isManagerScoped()) ? RBAC.getManagedBranchIds() : null;
            $('f-branch').innerHTML = (managed ? '' : '<option value="">All branches</option>') + _config.branches
                .filter(function (b) { return !managed || managed.indexOf(b.id) !== -1; })
                .map(function (b) { return '<option value="' + esc(b.id) + '">' + esc(b.name) + '</option>'; }).join('');
        } catch (e) { /* filters still work without branch names */ }

        reloadAll();
    });
})();
