/**
 * Software Costs page (software-costs.html).
 * Paid services that run the software, their payments, reminders and a cost
 * overview. Each payment is posted (by the API) to the finance ledger as a
 * Software & Technology expense, so it reaches Finance and BI.
 * Requires: auth.js, rbac.js, software-costs.js, multi-select-dropdown.js,
 * csv-export.js, apexcharts.min.js, tabler.min.js
 */
(function () {
    'use strict';

    var bootstrap = window.tabler.bootstrap;

    var P = {
        read: 'software_costs:read',
        manage: 'software_costs:manage',
        pay: 'software_costs:record_payment',
        del: 'software_costs:delete',
    };

    var _opts = null;
    var _services = [];          // every service, any status (filtered on the client)
    var _summary = null;
    var _recipientOpts = null;
    var _editingServiceId = null;
    var _payCtx = null;          // { mode: 'create' | 'edit', serviceId, payment }
    var _detailId = null;
    var _detail = null;
    var _payments = null;
    var _paymentsLoaded = false;
    var _receiptTargetId = null;
    var _chart = null;
    var _searchTimer = null;

    var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    // ── Helpers ─────────────────────────────────────────────────────────────

    function $(id) { return document.getElementById(id); }

    function esc(s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    }

    function can(p) { return RBAC.can(p); }

    function money(amount, currency) {
        if (amount === null || amount === undefined || amount === '') return '-';
        try {
            return new Intl.NumberFormat('en-NG', { style: 'currency', currency: currency || 'NGN', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(amount));
        } catch (e) {
            return (currency || 'NGN') + ' ' + Number(amount).toFixed(2);
        }
    }

    function ngn(amount) { return money(amount || 0, 'NGN'); }

    function ngnShort(amount) {
        var n = Number(amount || 0);
        if (Math.abs(n) >= 1e6) return '₦' + (n / 1e6).toFixed(n >= 1e7 ? 1 : 2) + 'M';
        if (Math.abs(n) >= 1e3) return '₦' + Math.round(n / 1e3) + 'k';
        return '₦' + Math.round(n);
    }

    function toUtcDate(str) { return new Date(String(str).slice(0, 10) + 'T00:00:00Z'); }

    function fmtDate(str) {
        if (!str) return '-';
        return toUtcDate(str).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
    }

    function isoDate(d) { return d.toISOString().slice(0, 10); }

    function today() { return (_opts && _opts.today) || isoDate(new Date()); }

    function daysBetween(fromStr, toStr) { return Math.round((toUtcDate(toStr) - toUtcDate(fromStr)) / 86400000); }

    function addDays(str, n) { var d = toUtcDate(str); d.setUTCDate(d.getUTCDate() + n); return isoDate(d); }

    function cycleMonths(cycle) { return { MONTHLY: 1, QUARTERLY: 3, ANNUALLY: 12 }[cycle] || 0; }

    /** Same rule as the API: keep the billing day, clamp to the month's last day. */
    function addMonths(str, months, anchorDay) {
        var d = toUtcDate(str);
        var day = anchorDay || d.getUTCDate();
        var idx = d.getUTCMonth() + months;
        var year = d.getUTCFullYear() + Math.floor(idx / 12);
        var month = ((idx % 12) + 12) % 12;
        var last = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
        return isoDate(new Date(Date.UTC(year, month, Math.min(day, last))));
    }

    /** Same rule as the API: the due date's day, unless it was clamped to a month end from a later start day. */
    function anchorDayOf(s) {
        var start = s.startDate ? toUtcDate(s.startDate).getUTCDate() : null;
        if (!s.nextDueDate) return start;
        var due = toUtcDate(s.nextDueDate);
        var day = due.getUTCDate();
        var lastDay = new Date(Date.UTC(due.getUTCFullYear(), due.getUTCMonth() + 1, 0)).getUTCDate();
        return start && start > day && day === lastDay ? start : day;
    }

    /** [30, 7, 1, 0] -> "30, 7 and 1 days before, and on the day" */
    function daysLabel(days) {
        var before = (days || []).filter(function (d) { return d > 0; }).sort(function (a, b) { return b - a; });
        var parts = [];
        if (before.length) {
            var list = before.length > 1 ? before.slice(0, -1).join(', ') + ' and ' + before[before.length - 1] : String(before[0]);
            parts.push(list + (before.length === 1 && before[0] === 1 ? ' day' : ' days') + ' before');
        }
        if ((days || []).indexOf(0) !== -1) parts.push('on the day');
        return parts.join(', and ');
    }

    function dueText(days) {
        if (days === null || days === undefined) return '';
        if (days > 1) return 'in ' + days + ' days';
        if (days === 1) return 'tomorrow';
        if (days === 0) return 'today';
        return (-days) + ' day' + (days === -1 ? '' : 's') + ' overdue';
    }

    function dueBadge(s) {
        if (s.status !== 'ACTIVE' || !s.nextDueDate) return '';
        var d = s.daysUntilDue;
        var cls = d < 0 ? 'bg-red-lt' : d <= 7 ? 'bg-yellow-lt' : 'bg-secondary-lt';
        return '<span class="badge ' + cls + '">' + esc(dueText(d)) + '</span>';
    }

    function statusBadge(status) {
        if (status === 'ACTIVE') return '<span class="badge bg-green-lt">Active</span>';
        if (status === 'PAUSED') return '<span class="badge bg-yellow-lt">Paused</span>';
        return '<span class="badge bg-secondary-lt">Cancelled</span>';
    }

    function showAlert(type, msg) {
        $('page-alert').innerHTML = '<div class="alert alert-' + type + ' alert-dismissible" role="alert">' + esc(msg) +
            '<a class="btn-close" data-bs-dismiss="alert" aria-label="close"></a></div>';
        if (type === 'success') setTimeout(function () { $('page-alert').innerHTML = ''; }, 5000);
    }

    function formError(id, msg) {
        var el = $(id);
        if (!msg) { el.classList.add('d-none'); return; }
        el.textContent = msg;
        el.classList.remove('d-none');
        el.scrollIntoView({ block: 'nearest' });
    }

    function modal(id) { return bootstrap.Modal.getOrCreateInstance($(id)); }

    function serviceById(id) { return _services.find(function (s) { return s.id === id; }) || null; }

    function fillSelect(id, items, first) {
        $(id).innerHTML = (first ? '<option value="">' + esc(first) + '</option>' : '') + items.map(function (i) {
            return '<option value="' + esc(i.value) + '">' + esc(i.label) + '</option>';
        }).join('');
    }

    // ── Start ───────────────────────────────────────────────────────────────

    document.addEventListener('DOMContentLoaded', async function () {
        RBAC.loadFromStorage();
        RBAC.applyPageGuard(P.read);
        wireEvents();
        applyPermissions();
        document.addEventListener('rbac:updated', function () { applyPermissions(); renderServices(); });

        try {
            _opts = await SoftwareCosts.options();
        } catch (e) {
            showAlert('danger', e.message || 'Could not load the page.');
            return;
        }
        fillSelect('f-category', _opts.categories, 'All categories');
        fillSelect('p-category', _opts.categories, 'All categories');
        fillSelect('s-category', _opts.categories);
        fillSelect('s-cycle', _opts.billingCycles);
        fillSelect('s-amount-type', _opts.amountTypes);
        fillSelect('s-currency', _opts.currencies.map(function (c) { return { value: c, label: c }; }));
        fillSelect('pay-currency', _opts.currencies.map(function (c) { return { value: c, label: c }; }));

        var year = Number(today().slice(0, 4));
        var years = [];
        for (var y = year; y >= Math.min(2024, year); y--) years.push({ value: String(y), label: String(y) });
        fillSelect('year-select', years);
        $('p-from').value = year + '-01-01';
        $('p-to').value = today();

        await Promise.all([loadSummary(), loadServices()]);

        var deepLink = new URLSearchParams(location.search).get('service');
        if (deepLink && serviceById(deepLink)) openDetail(deepLink);
    });

    function applyPermissions() {
        $('btn-add-service').classList.toggle('d-none', !can(P.manage));
        $('btn-record-any').classList.toggle('d-none', !can(P.pay));
    }

    function wireEvents() {
        $('btn-add-service').addEventListener('click', function () { openServiceForm(null); });
        $('btn-record-any').addEventListener('click', function () { openPaymentForm(null); });
        $('year-select').addEventListener('change', loadSummary);
        $('f-status').addEventListener('change', renderServices);
        $('f-category').addEventListener('change', renderServices);
        $('f-search').addEventListener('input', function () {
            clearTimeout(_searchTimer);
            _searchTimer = setTimeout(renderServices, 200);
        });
        $('btn-export-services').addEventListener('click', exportServices);
        $('btn-export-payments').addEventListener('click', exportPayments);

        $('tab-payments-link').addEventListener('shown.bs.tab', function () { if (!_paymentsLoaded) loadPayments(); });
        ['p-from', 'p-to', 'p-service', 'p-category'].forEach(function (id) { $(id).addEventListener('change', loadPayments); });

        $('btn-save-service').addEventListener('click', saveService);
        $('s-reminder').addEventListener('change', syncServiceForm);
        $('s-cycle').addEventListener('change', syncServiceForm);
        $('s-amount-type').addEventListener('change', syncServiceForm);

        $('btn-save-payment').addEventListener('click', savePayment);
        $('pay-service').addEventListener('change', function () { preparePaymentForService($('pay-service').value); });
        $('pay-currency').addEventListener('change', syncPaymentForm);
        $('pay-amount').addEventListener('input', syncRateHint);
        $('pay-ngn').addEventListener('input', syncRateHint);
        $('pay-date').addEventListener('change', syncAdvance);

        $('receipt-picker').addEventListener('change', onReceiptPicked);

        // Actions inside rendered tables and lists.
        document.body.addEventListener('click', function (ev) {
            var btn = ev.target.closest('[data-act]');
            if (!btn) return;
            ev.preventDefault();
            var id = btn.getAttribute('data-id');
            var act = btn.getAttribute('data-act');
            var handlers = {
                view: function () { openDetail(id); },
                pay: function () { openPaymentForm(id); },
                edit: function () { openServiceForm(id); },
                test: function () { sendTest(id); },
                pause: function () { changeStatus(id, 'PAUSED'); },
                activate: function () { changeStatus(id, 'ACTIVE'); },
                cancel: function () { changeStatus(id, 'CANCELLED'); },
                'delete-service': function () { deleteService(id); },
                'edit-payment': function () { openPaymentEdit(id); },
                'delete-payment': function () { deletePayment(id); },
                'view-receipt': function () { viewReceipt(id); },
                'upload-receipt': function () { pickReceipt(id); },
                'remove-receipt': function () { removeReceipt(id); },
            };
            if (handlers[act]) handlers[act]();
        });
    }

    async function refreshAll() {
        var jobs = [loadSummary(), loadServices()];
        if (_paymentsLoaded) jobs.push(loadPayments());
        await Promise.all(jobs);
        if (_detailId && $('modal-detail').classList.contains('show')) await loadDetail(_detailId);
    }

    // ── Summary ─────────────────────────────────────────────────────────────

    async function loadSummary() {
        try {
            _summary = await SoftwareCosts.summary($('year-select').value);
            renderSummary();
        } catch (e) {
            showAlert('danger', e.message || 'Failed to load the summary.');
        }
    }

    function currencyLine(map, suffix) {
        var parts = Object.keys(map || {}).filter(function (c) { return map[c]; }).map(function (c) { return money(map[c], c); });
        return parts.length ? parts.join(' + ') + (suffix || '') : '';
    }

    function renderSummary() {
        var s = _summary;
        var rr = s.runRate;
        $('kpi-runrate').textContent = ngn(rr.monthlyNgnEstimate);
        var rrSub = currencyLine(rr.monthlyByCurrency, ' a month') || 'No active services with an amount yet';
        if (rr.currenciesWithoutRate.length) {
            rrSub += '. ' + rr.currenciesWithoutRate.join(', ') + ' not in the naira figure yet: record a payment with its naira cost to set the rate';
        }
        $('kpi-runrate-sub').textContent = rrSub;

        $('kpi-annual').textContent = ngn(rr.annualNgnEstimate);
        var annualSub = s.counts.active + ' active service' + (s.counts.active === 1 ? '' : 's');
        if (rr.servicesWithoutAmount) annualSub += ', ' + rr.servicesWithoutAmount + ' without an amount';
        var rates = Object.keys(rr.ratesUsed || {}).map(function (c) { return c + ' at ' + ngn(rr.ratesUsed[c].rate); });
        if (rates.length) annualSub += '. Rate: ' + rates.join(', ');
        $('kpi-annual-sub').textContent = annualSub;

        $('kpi-month').textContent = ngn(s.spend.thisMonthNgn);
        $('kpi-month-sub').textContent = 'Last month ' + ngn(s.spend.lastMonthNgn);

        $('kpi-year').textContent = ngn(s.spend.yearNgn);
        var foreign = {};
        Object.keys(s.spend.yearByCurrency || {}).forEach(function (c) { if (c !== 'NGN') foreign[c] = s.spend.yearByCurrency[c]; });
        var yearSub = currencyLine(foreign) ? 'Includes ' + currencyLine(foreign) : 'All in naira';
        var unconv = currencyLine(s.spend.yearUnconverted);
        if (unconv) yearSub += '. Not converted: ' + unconv;
        $('kpi-year-sub').textContent = yearSub;

        var badges = '';
        if (s.counts.overdue) badges += '<span class="badge bg-red text-red-fg me-1">' + s.counts.overdue + ' overdue</span>';
        if (s.counts.dueIn7Days) badges += '<span class="badge bg-yellow text-yellow-fg">' + s.counts.dueIn7Days + ' this week</span>';
        $('due-badges').innerHTML = badges;

        $('upcoming-list').innerHTML = s.upcoming.length ? s.upcoming.map(function (u) {
            var cls = u.daysUntilDue < 0 ? 'text-danger' : u.daysUntilDue <= 7 ? 'text-warning' : 'text-secondary';
            var amount = u.expectedAmount === null ? 'Amount varies' : (u.amountType === 'VARIABLE' ? 'About ' : '') + money(u.expectedAmount, u.currency);
            return '<div class="list-group-item"><div class="row align-items-center g-2">' +
                '<div class="col text-truncate">' +
                '<a href="#" class="fw-semibold text-reset" data-act="view" data-id="' + u.id + '">' + esc(u.name) + '</a>' +
                '<div class="small ' + cls + '">' + fmtDate(u.nextDueDate) + ' (' + esc(dueText(u.daysUntilDue)) + ')' +
                (u.autoRenew ? ' <span class="text-secondary">auto-renews</span>' : '') + '</div></div>' +
                '<div class="col-auto text-end"><div class="fw-semibold">' + esc(amount) + '</div>' +
                (can(P.pay) ? '<a href="#" class="small" data-act="pay" data-id="' + u.id + '">Record payment</a>' : '') +
                '</div></div></div>';
        }).join('') : '<div class="list-group-item text-center text-secondary py-4">Nothing due in the next 30 days.</div>';

        $('chart-year-label').textContent = s.year;
        renderChart(s.spend.byMonth);

        var total = s.spend.byCategory.reduce(function (sum, c) { return sum + c.ngn; }, 0);
        $('category-breakdown').innerHTML = s.spend.byCategory.length ? s.spend.byCategory.slice(0, 6).map(function (c) {
            var pct = total ? Math.round((c.ngn / total) * 100) : 0;
            return '<div class="col-md-6 mb-2"><div class="d-flex small"><span class="text-truncate">' + esc(c.label) + '</span>' +
                '<span class="ms-auto fw-semibold">' + ngn(c.ngn) + '</span></div>' +
                '<div class="progress progress-sm"><div class="progress-bar" style="width:' + pct + '%"></div></div></div>';
        }).join('') : '<div class="col-12 text-secondary small">No payments recorded for ' + s.year + ' yet.</div>';
    }

    function renderChart(byMonth) {
        var el = $('chart-months');
        if (typeof ApexCharts === 'undefined') { el.innerHTML = ''; return; }
        var options = {
            chart: { type: 'bar', height: 220, toolbar: { show: false }, fontFamily: 'inherit', parentHeightOffset: 0 },
            series: [{ name: 'Paid (NGN)', data: byMonth.map(function (m) { return Math.round(m.ngn * 100) / 100; }) }],
            xaxis: { categories: MONTHS, labels: { style: { colors: 'var(--tblr-secondary)' } } },
            yaxis: { labels: { formatter: ngnShort, style: { colors: 'var(--tblr-secondary)' } } },
            dataLabels: { enabled: false },
            plotOptions: { bar: { borderRadius: 3, columnWidth: '55%' } },
            colors: ['#C9A872'],
            grid: { strokeDashArray: 4 },
            tooltip: { y: { formatter: function (v) { return ngn(v); } } },
        };
        if (_chart) { _chart.updateOptions(options); return; }
        _chart = new ApexCharts(el, options);
        _chart.render();
    }

    // ── Services list ───────────────────────────────────────────────────────

    async function loadServices() {
        try {
            _services = await SoftwareCosts.listServices({});
            renderServices();
            fillServicePickers();
        } catch (e) {
            $('services-tbody').innerHTML = '<tr><td colspan="7" class="text-center text-danger py-4">' + esc(e.message || 'Failed to load.') + '</td></tr>';
        }
    }

    function fillServicePickers() {
        var current = $('p-service').value;
        var sorted = _services.slice().sort(function (a, b) { return a.name.localeCompare(b.name); });
        $('p-service').innerHTML = '<option value="">All services</option>' + sorted.map(function (s) {
            return '<option value="' + s.id + '">' + esc(s.name) + (s.status !== 'ACTIVE' ? ' (' + s.status.toLowerCase() + ')' : '') + '</option>';
        }).join('');
        $('p-service').value = current;
    }

    function filteredServices() {
        var status = $('f-status').value;
        var category = $('f-category').value;
        var q = $('f-search').value.trim().toLowerCase();
        return _services.filter(function (s) {
            if (status && s.status !== status) return false;
            if (category && s.category !== category) return false;
            if (q && (s.name + ' ' + (s.provider || '') + ' ' + (s.description || '')).toLowerCase().indexOf(q) === -1) return false;
            return true;
        });
    }

    function amountCell(s) {
        if (s.expectedAmount === null) return '<span class="text-secondary">Varies</span>';
        var main = (s.amountType === 'VARIABLE' ? '<span class="text-secondary small">about </span>' : '') + esc(money(s.expectedAmount, s.currency));
        var monthly = s.billingCycle !== 'MONTHLY' && s.monthlyEquivalent !== null && s.billingCycle !== 'ONE_TIME'
            ? '<div class="text-secondary small">' + esc(money(s.monthlyEquivalent, s.currency)) + ' / month</div>' : '';
        return '<div class="fw-semibold">' + main + '</div>' + monthly;
    }

    function actionsMenu(s) {
        var items = ['<a href="#" class="dropdown-item" data-act="view" data-id="' + s.id + '">View details & payments</a>'];
        if (can(P.pay)) items.push('<a href="#" class="dropdown-item" data-act="pay" data-id="' + s.id + '">Record payment</a>');
        if (can(P.manage)) {
            items.push('<a href="#" class="dropdown-item" data-act="edit" data-id="' + s.id + '">Edit</a>');
            if (s.reminderEnabled && s.status === 'ACTIVE') items.push('<a href="#" class="dropdown-item" data-act="test" data-id="' + s.id + '">Send test reminder</a>');
            items.push('<div class="dropdown-divider"></div>');
            if (s.status === 'ACTIVE') items.push('<a href="#" class="dropdown-item" data-act="pause" data-id="' + s.id + '">Pause</a>');
            if (s.status !== 'ACTIVE') items.push('<a href="#" class="dropdown-item" data-act="activate" data-id="' + s.id + '">Reactivate</a>');
            if (s.status !== 'CANCELLED') items.push('<a href="#" class="dropdown-item" data-act="cancel" data-id="' + s.id + '">Cancel service</a>');
        }
        if (can(P.del)) items.push('<a href="#" class="dropdown-item text-danger" data-act="delete-service" data-id="' + s.id + '">Delete</a>');
        return '<div class="dropdown">' +
            '<button class="btn btn-sm btn-outline-secondary dropdown-toggle" data-bs-toggle="dropdown" data-bs-popper-config=\'{"strategy":"fixed"}\'>Actions</button>' +
            '<div class="dropdown-menu dropdown-menu-end">' + items.join('') + '</div></div>';
    }

    function renderServices() {
        var tbody = $('services-tbody');
        if (!_opts) return;
        var rows = filteredServices();
        if (!rows.length) {
            tbody.innerHTML = '<tr><td colspan="7" class="text-center text-secondary py-5">' +
                (_services.length ? 'No services match these filters.' : 'No services yet. Add the first one, e.g. your Railway servers or domain.') + '</td></tr>';
            return;
        }
        tbody.innerHTML = rows.map(function (s) {
            var due = s.nextDueDate
                ? '<div>' + fmtDate(s.nextDueDate) + '</div>' + dueBadge(s)
                : '<span class="text-secondary">' + (s.billingCycle === 'ONE_TIME' ? 'Settled' : 'Not set') + '</span>';
            var last = s.lastPayment
                ? '<div>' + esc(money(s.lastPayment.amount, s.lastPayment.currency)) + '</div><div class="text-secondary small">' + fmtDate(s.lastPayment.paidAt) + '</div>'
                : '<span class="text-secondary small">None yet</span>';
            var reminders = s.reminderEnabled
                ? '<span class="badge bg-blue-lt">On</span><div class="text-secondary small">' + esc(daysLabel(s.reminderDaysBefore)) +
                  '<br>' + s.recipients.length + ' staff + Super Admins</div>'
                : '<span class="text-secondary small">Off</span>';
            return '<tr>' +
                '<td><a href="#" class="fw-semibold text-reset" data-act="view" data-id="' + s.id + '">' + esc(s.name) + '</a>' +
                (s.status !== 'ACTIVE' ? ' ' + statusBadge(s.status) : '') +
                '<div class="text-secondary small">' + esc([s.provider, s.categoryLabel].filter(Boolean).join(' · ')) + '</div></td>' +
                '<td>' + esc(s.billingCycleLabel) + '<div class="text-secondary small">' + (s.amountType === 'VARIABLE' ? 'Varies with usage' : 'Fixed') + (s.autoRenew ? ', auto-renews' : '') + '</div></td>' +
                '<td class="text-end">' + amountCell(s) + '</td>' +
                '<td>' + due + '</td>' +
                '<td>' + last + '</td>' +
                '<td>' + reminders + '</td>' +
                '<td class="text-nowrap">' + actionsMenu(s) + '</td>' +
                '</tr>';
        }).join('');
    }

    function exportServices() {
        CsvExport.download('software-services-' + today() + '.csv', [
            { label: 'Service', get: function (s) { return s.name; } },
            { label: 'Provider', get: function (s) { return s.provider || ''; } },
            { label: 'Category', get: function (s) { return s.categoryLabel; } },
            { label: 'Status', get: function (s) { return s.status; } },
            { label: 'Billing cycle', get: function (s) { return s.billingCycleLabel; } },
            { label: 'Amount type', get: function (s) { return s.amountType === 'VARIABLE' ? 'Varies' : 'Fixed'; } },
            { label: 'Currency', get: function (s) { return s.currency; } },
            { label: 'Amount per cycle', get: function (s) { return s.expectedAmount === null ? '' : s.expectedAmount; } },
            { label: 'Per month', get: function (s) { return s.monthlyEquivalent === null ? '' : s.monthlyEquivalent; } },
            { label: 'Next due', get: function (s) { return s.nextDueDate || ''; } },
            { label: 'Auto-renews', get: function (s) { return s.autoRenew ? 'Yes' : 'No'; } },
            { label: 'Paid with', get: function (s) { return s.paymentMethod || ''; } },
            { label: 'Paid this year (NGN)', get: function (s) { return s.paidThisYearNgn; } },
            { label: 'Reminders', get: function (s) { return s.reminderEnabled ? 'On' : 'Off'; } },
            { label: 'Reminder staff', get: function (s) { return s.recipients.map(function (r) { return r.name; }).join('; '); } },
        ], filteredServices());
    }

    // ── Service form ────────────────────────────────────────────────────────

    async function ensureRecipientOptions() {
        if (_recipientOpts) return;
        _recipientOpts = await SoftwareCosts.recipientOptions();
        $('s-recipients').innerHTML = _recipientOpts.staff.map(function (s) {
            return '<option value="' + s.id + '"' + (s.email ? '' : ' disabled') + '>' + esc(s.name) + (s.staffCode ? ' (' + esc(s.staffCode) + ')' : '') + (s.email ? '' : ' - no email') + '</option>';
        }).join('');
        MultiSelectDropdown.attach('s-recipients', { placeholder: 'Select staff...' });
        var names = _recipientOpts.superAdmins.map(function (a) { return a.name; });
        $('super-admin-hint').textContent = 'Super Admins always receive reminders' + (names.length ? ': ' + names.join(', ') + '.' : '.');
    }

    function setDays(days) {
        var set = {};
        (days || []).forEach(function (d) { set[d] = true; });
        Array.prototype.forEach.call($('s-days').querySelectorAll('input'), function (cb) { cb.checked = !!set[cb.value]; });
    }

    function getDays() {
        return Array.prototype.filter.call($('s-days').querySelectorAll('input'), function (cb) { return cb.checked; })
            .map(function (cb) { return Number(cb.value); });
    }

    function syncServiceForm() {
        var oneTime = $('s-cycle').value === 'ONE_TIME';
        var variable = $('s-amount-type').value === 'VARIABLE';
        $('s-amount-label').textContent = variable ? 'Estimate per cycle' : (oneTime ? 'Amount' : 'Price per cycle');
        $('s-due-label').textContent = oneTime ? 'Payment due date' : 'Next due date';
        $('reminder-settings').classList.toggle('d-none', !$('s-reminder').checked);
    }

    async function openServiceForm(id) {
        formError('service-error', null);
        _editingServiceId = id;
        try { await ensureRecipientOptions(); } catch (e) { showAlert('danger', e.message || 'Could not load staff.'); return; }
        var s = id ? serviceById(id) : null;
        $('modal-service-title').textContent = s ? 'Edit ' + s.name : 'Add service';
        $('s-name').value = s ? s.name : '';
        $('s-provider').value = s ? (s.provider || '') : '';
        $('s-category').value = s ? s.category : 'HOSTING';
        $('s-description').value = s ? (s.description || '') : '';
        $('s-cycle').value = s ? s.billingCycle : 'MONTHLY';
        $('s-amount-type').value = s ? s.amountType : 'FIXED';
        $('s-currency').value = s ? s.currency : 'NGN';
        $('s-amount').value = s && s.expectedAmount !== null ? s.expectedAmount : '';
        $('s-start').value = s ? (s.startDate || '') : '';
        $('s-due').value = s ? (s.nextDueDate || '') : '';
        $('s-autorenew').checked = s ? s.autoRenew : false;
        $('s-method').value = s ? (s.paymentMethod || '') : '';
        $('s-url').value = s ? (s.billingUrl || '') : '';
        $('s-account-email').value = s ? (s.accountEmail || '') : '';
        $('s-notes').value = s ? (s.notes || '') : '';
        $('s-reminder').checked = s ? s.reminderEnabled : false;
        setDays(s ? s.reminderDaysBefore : [7, 1]);
        $('s-overdue').checked = s ? s.remindWhenOverdue : true;
        var picked = {};
        (s ? s.recipients : []).forEach(function (r) { picked[r.staffId] = true; });
        Array.prototype.forEach.call($('s-recipients').options, function (o) { o.selected = !!picked[o.value]; });
        MultiSelectDropdown.refresh('s-recipients');
        syncServiceForm();
        modal('modal-service').show();
    }

    async function saveService() {
        formError('service-error', null);
        var name = $('s-name').value.trim();
        var amountRaw = $('s-amount').value.trim();
        var amountType = $('s-amount-type').value;
        var reminder = $('s-reminder').checked;
        var due = $('s-due').value;
        var days = getDays();
        if (!name) return formError('service-error', 'Enter the service name.');
        if (amountType === 'FIXED' && amountRaw === '') return formError('service-error', 'Enter the price for a fixed-price service.');
        if (reminder && !due) return formError('service-error', 'Set the next due date to turn on reminders.');
        if (reminder && !days.length) return formError('service-error', 'Choose at least one day to send the reminder.');

        var payload = {
            name: name,
            provider: $('s-provider').value.trim(),
            category: $('s-category').value,
            description: $('s-description').value.trim(),
            billingCycle: $('s-cycle').value,
            amountType: amountType,
            expectedAmount: amountRaw === '' ? null : Number(amountRaw),
            currency: $('s-currency').value,
            startDate: $('s-start').value || null,
            nextDueDate: due || null,
            autoRenew: $('s-autorenew').checked,
            paymentMethod: $('s-method').value.trim(),
            billingUrl: $('s-url').value.trim() || null,
            accountEmail: $('s-account-email').value.trim() || null,
            notes: $('s-notes').value.trim(),
            reminderEnabled: reminder,
            reminderDaysBefore: days.length ? days : [7, 1],
            remindWhenOverdue: $('s-overdue').checked,
            recipientStaffIds: Array.from($('s-recipients').selectedOptions).map(function (o) { return o.value; }),
        };
        var btn = $('btn-save-service');
        btn.disabled = true;
        try {
            if (_editingServiceId) await SoftwareCosts.updateService(_editingServiceId, payload);
            else await SoftwareCosts.createService(payload);
            modal('modal-service').hide();
            showAlert('success', _editingServiceId ? 'Service updated.' : 'Service added.');
            await refreshAll();
        } catch (e) {
            formError('service-error', e.message || 'Could not save the service.');
        } finally {
            btn.disabled = false;
        }
    }

    // ── Status, delete, test ────────────────────────────────────────────────

    async function changeStatus(id, status) {
        var s = serviceById(id) || _detail;
        if (!s) return;
        var cancelledAt;
        if (status === 'CANCELLED') {
            cancelledAt = prompt('Cancel ' + s.name + '? Reminders stop and the payment history is kept.\n\nCancellation date (YYYY-MM-DD):', today());
            if (cancelledAt === null) return;
            cancelledAt = cancelledAt.trim();
            if (!/^\d{4}-\d{2}-\d{2}$/.test(cancelledAt)) { showAlert('danger', 'Enter the date as YYYY-MM-DD.'); return; }
        } else if (status === 'PAUSED') {
            if (!confirm('Pause ' + s.name + '? No reminders are sent while it is paused.')) return;
        }
        try {
            await SoftwareCosts.setStatus(id, status, cancelledAt);
            showAlert('success', s.name + (status === 'ACTIVE' ? ' is active again.' : status === 'PAUSED' ? ' is paused.' : ' is cancelled.'));
            await refreshAll();
        } catch (e) { showAlert('danger', e.message || 'Could not change the status.'); }
    }

    async function deleteService(id) {
        var s = serviceById(id) || _detail;
        if (!s) return;
        if (!confirm('Delete ' + s.name + '?\n\nThis cannot be undone. A service with payments in Finance cannot be deleted: cancel it to keep its history, or delete its payments first.')) return;
        try {
            await SoftwareCosts.deleteService(id);
            if (_detailId === id) modal('modal-detail').hide();
            showAlert('success', s.name + ' was deleted.');
            await refreshAll();
        } catch (e) { showAlert('danger', e.message || 'Could not delete the service.'); }
    }

    async function sendTest(id) {
        var s = serviceById(id) || _detail;
        if (!confirm('Email a test reminder for ' + (s ? s.name : 'this service') + ' to its reminder list and all Super Admins now?')) return;
        try {
            var r = await SoftwareCosts.testReminder(id);
            showAlert('success', 'Test reminder sent to ' + r.recipientCount + ' recipient(s): ' + r.recipients.join(', '));
        } catch (e) { showAlert('danger', e.message || 'Could not send the test reminder.'); }
    }

    // ── Payment form ────────────────────────────────────────────────────────

    function openPaymentForm(serviceId) {
        formError('payment-error', null);
        _payCtx = { mode: 'create', serviceId: serviceId || null, payment: null };
        $('modal-payment-title').textContent = 'Record payment';
        setLedgerLock(false, '');
        $('pay-receipt-wrap').classList.remove('d-none');
        $('pay-receipt').value = '';
        $('pay-date').max = today();
        $('pay-date').value = today();
        ['pay-amount', 'pay-ngn', 'pay-reference', 'pay-notes', 'pay-method', 'pay-period-start', 'pay-period-end'].forEach(function (id) { $(id).value = ''; });

        if (serviceId) {
            $('pay-service-wrap').classList.add('d-none');
            $('pay-service-fixed').classList.remove('d-none');
            $('pay-service-name').textContent = (serviceById(serviceId) || {}).name || '';
        } else {
            $('pay-service-wrap').classList.remove('d-none');
            $('pay-service-fixed').classList.add('d-none');
            var choices = _services.filter(function (s) { return s.status !== 'CANCELLED'; }).sort(function (a, b) { return a.name.localeCompare(b.name); });
            $('pay-service').innerHTML = '<option value="">Select service</option>' + choices.map(function (s) {
                return '<option value="' + s.id + '">' + esc(s.name) + (s.nextDueDate ? ' (due ' + fmtDate(s.nextDueDate) + ')' : '') + '</option>';
            }).join('');
        }
        preparePaymentForService(serviceId);
        modal('modal-payment').show();
    }

    function preparePaymentForService(serviceId) {
        _payCtx.serviceId = serviceId || null;
        var s = serviceId ? serviceById(serviceId) : null;
        $('pay-currency').value = s ? s.currency : 'NGN';
        $('pay-amount').value = s && s.expectedAmount !== null ? s.expectedAmount : '';
        $('pay-method').value = s ? (s.paymentMethod || '') : '';
        $('pay-ngn').value = '';
        if (s && s.nextDueDate && s.billingCycle !== 'ONE_TIME') {
            $('pay-period-start').value = s.nextDueDate;
            $('pay-period-end').value = addDays(addMonths(s.nextDueDate, cycleMonths(s.billingCycle), anchorDayOf(s)), -1);
        } else {
            $('pay-period-start').value = '';
            $('pay-period-end').value = '';
        }
        syncPaymentForm();
    }

    function syncPaymentForm() {
        $('pay-ngn-wrap').classList.toggle('d-none', $('pay-currency').value === 'NGN');
        syncRateHint();
        syncAdvance();
    }

    function syncRateHint() {
        var cur = $('pay-currency').value;
        if (cur === 'NGN') return;
        var amount = Number($('pay-amount').value);
        var naira = Number($('pay-ngn').value);
        var hint = 'Required: Finance records every payment in naira.';
        var last = _summary && _summary.runRate.ratesUsed[cur];
        if (amount > 0 && naira > 0) hint = 'Rate: ' + ngn(naira / amount) + ' per ' + cur + '.';
        else if (last) hint += ' Last rate used: ' + ngn(last.rate) + ' per ' + cur + ' (' + fmtDate(last.asOf) + ').';
        $('pay-rate-hint').textContent = hint;
    }

    /** Mirrors the API default: settle the current due date when paid within a cycle of it. */
    function defaultAdvance(s, paidAt) {
        if (s.status !== 'ACTIVE') return false;
        if (!s.nextDueDate) return s.billingCycle !== 'ONE_TIME';
        var windowStart = addMonths(s.nextDueDate, -(cycleMonths(s.billingCycle) || 1));
        return daysBetween(windowStart, paidAt) > 0;
    }

    function syncAdvance() {
        var wrap = $('pay-advance-wrap');
        var s = _payCtx && _payCtx.mode === 'create' && _payCtx.serviceId ? serviceById(_payCtx.serviceId) : null;
        var paidAt = $('pay-date').value || today();
        if (!s || (s.billingCycle === 'ONE_TIME' && !s.nextDueDate)) { wrap.classList.add('d-none'); return; }
        wrap.classList.remove('d-none');
        $('pay-advance').checked = defaultAdvance(s, paidAt);
        var label, hint;
        if (s.billingCycle === 'ONE_TIME') {
            label = 'This settles the payment due ' + fmtDate(s.nextDueDate);
            hint = 'Nothing further will be due, so reminders stop.';
        } else if (s.nextDueDate) {
            var next = addMonths(s.nextDueDate, cycleMonths(s.billingCycle), anchorDayOf(s));
            label = 'This pays the bill due ' + fmtDate(s.nextDueDate);
            hint = 'The next due date moves to ' + fmtDate(next) + '. Untick it for an older payment you are adding for the record.';
        } else {
            var from = addMonths(paidAt, cycleMonths(s.billingCycle), anchorDayOf(s));
            label = 'Set the next due date from this payment';
            hint = 'The next due date becomes ' + fmtDate(from) + '.';
        }
        $('pay-advance-label').textContent = label;
        $('pay-advance-hint').textContent = hint;
    }

    /** Locks the money fields of a payment that is already in the finance ledger. */
    function setLedgerLock(locked, note) {
        ['pay-currency', 'pay-amount', 'pay-ngn', 'pay-date'].forEach(function (id) { $(id).disabled = locked; });
        // Wrapped in one div: Tabler's .alert is a flex row.
        $('pay-ledger-note').innerHTML = note ? '<div>' + note + '</div>' : '';
        $('pay-ledger-note').classList.toggle('d-none', !note);
    }

    async function openPaymentEdit(paymentId) {
        var p = findPayment(paymentId);
        if (!p) return;
        formError('payment-error', null);
        _payCtx = { mode: 'edit', serviceId: p.subscriptionId, payment: p };
        $('modal-payment-title').textContent = 'Edit payment';
        $('pay-service-wrap').classList.add('d-none');
        $('pay-service-fixed').classList.remove('d-none');
        $('pay-service-name').textContent = p.subscription.name;
        $('pay-receipt-wrap').classList.add('d-none');
        $('pay-advance-wrap').classList.add('d-none');
        $('pay-date').max = today();
        $('pay-currency').value = p.currency;
        $('pay-amount').value = p.amount;
        $('pay-ngn').value = p.currency === 'NGN' || p.amountNgn === null ? '' : p.amountNgn;
        $('pay-date').value = p.paidAt;
        $('pay-period-start').value = p.periodStart || '';
        $('pay-period-end').value = p.periodEnd || '';
        $('pay-method').value = p.paymentMethod || '';
        $('pay-reference').value = p.reference || '';
        $('pay-notes').value = p.notes || '';
        $('pay-ngn-wrap').classList.toggle('d-none', p.currency === 'NGN');
        if (p.ledger) {
            setLedgerLock(true, 'In Finance as <strong>' + esc(p.ledger.reference) + '</strong>. Amount, currency, naira cost and date are locked. ' +
                'To correct them, delete this payment (Finance reverses it on the same date) and record it again.');
        } else {
            setLedgerLock(false, p.currency !== 'NGN' && p.amountNgn === null
                ? 'Not in Finance yet. Add what it cost in naira and save to post it.' : '');
        }
        syncRateHint();
        modal('modal-payment').show();
    }

    async function savePayment() {
        formError('payment-error', null);
        var serviceId = _payCtx.serviceId;
        var amount = Number($('pay-amount').value);
        var paidAt = $('pay-date').value;
        var currency = $('pay-currency').value;
        if (!serviceId) return formError('payment-error', 'Choose the service.');
        if (!(amount > 0)) return formError('payment-error', 'Enter the amount paid.');
        if (!paidAt) return formError('payment-error', 'Enter the date it was paid.');
        if (paidAt > today()) return formError('payment-error', 'The payment date cannot be in the future.');
        var ps = $('pay-period-start').value, pe = $('pay-period-end').value;
        if (ps && pe && pe < ps) return formError('payment-error', 'The period end must be on or after its start.');
        var file = $('pay-receipt').files[0];
        if (file && file.size > 10 * 1024 * 1024) return formError('payment-error', 'The receipt must be 10MB or smaller.');

        var ngnRaw = $('pay-ngn').value.trim();
        if (currency !== 'NGN' && ngnRaw === '' && _payCtx.mode === 'create') {
            return formError('payment-error', 'Enter what this ' + currency + ' payment cost in naira. Finance records every payment in naira.');
        }
        if (currency !== 'NGN' && ngnRaw !== '' && !(Number(ngnRaw) > 0)) return formError('payment-error', 'Enter the naira cost.');
        var payload = {
            amount: amount,
            currency: currency,
            amountNgn: currency === 'NGN' || ngnRaw === '' ? null : Number(ngnRaw),
            paidAt: paidAt,
            periodStart: ps || null,
            periodEnd: pe || null,
            paymentMethod: $('pay-method').value.trim(),
            reference: $('pay-reference').value.trim(),
            notes: $('pay-notes').value.trim(),
        };
        var btn = $('btn-save-payment');
        btn.disabled = true;
        try {
            if (_payCtx.mode === 'edit') {
                await SoftwareCosts.updatePayment(_payCtx.payment.id, payload);
                showAlert('success', 'Payment updated.');
            } else {
                if (!$('pay-advance-wrap').classList.contains('d-none')) payload.advanceDueDate = $('pay-advance').checked;
                var created = await SoftwareCosts.recordPayment(serviceId, payload);
                var msg = 'Payment recorded.';
                if (file) {
                    try { await SoftwareCosts.uploadReceipt(created.id, file); }
                    catch (e) { msg += ' The receipt did not upload (' + (e.message || 'error') + '); add it from the payment list.'; }
                }
                if (created.advancedDueTo) msg += ' Next due date: ' + fmtDate(created.advancedDueTo) + '.';
                showAlert(file && msg.indexOf('did not upload') !== -1 ? 'warning' : 'success', msg);
            }
            modal('modal-payment').hide();
            await refreshAll();
        } catch (e) {
            formError('payment-error', e.message || 'Could not save the payment.');
        } finally {
            btn.disabled = false;
        }
    }

    function findPayment(id) {
        var pools = [];
        if (_detail && _detail.payments) pools = pools.concat(_detail.payments);
        if (_payments && _payments.payments) pools = pools.concat(_payments.payments);
        return pools.find(function (p) { return p.id === id; }) || null;
    }

    async function deletePayment(id) {
        var p = findPayment(id);
        if (!p) return;
        var note = p.advancedDueTo ? '\n\nIf the due date has not moved since, it goes back to ' + fmtDate(p.settledDueDate) + '.' : '';
        if (p.ledger) note += '\n\nIts Finance entry ' + p.ledger.reference + ' is reversed on the same date.';
        if (!confirm('Delete the ' + money(p.amount, p.currency) + ' payment for ' + p.subscription.name + ' on ' + fmtDate(p.paidAt) + '?' + note)) return;
        try {
            var r = await SoftwareCosts.deletePayment(id);
            showAlert('success', 'Payment deleted.' + (r.dueDateRestored ? ' Next due date is back to ' + fmtDate(r.nextDueDate) + '.' : ''));
            await refreshAll();
        } catch (e) { showAlert('danger', e.message || 'Could not delete the payment.'); }
    }

    // ── Receipts ────────────────────────────────────────────────────────────

    async function viewReceipt(paymentId) {
        var win = window.open('', '_blank');
        try {
            var r = await SoftwareCosts.receiptUrl(paymentId);
            if (win) win.location = r.url; else window.location.href = r.url;
        } catch (e) {
            if (win) win.close();
            showAlert('danger', e.message || 'Could not open the receipt.');
        }
    }

    function pickReceipt(paymentId) {
        _receiptTargetId = paymentId;
        $('receipt-picker').value = '';
        $('receipt-picker').click();
    }

    async function onReceiptPicked() {
        var file = $('receipt-picker').files[0];
        if (!file || !_receiptTargetId) return;
        if (file.size > 10 * 1024 * 1024) { showAlert('danger', 'The receipt must be 10MB or smaller.'); return; }
        try {
            await SoftwareCosts.uploadReceipt(_receiptTargetId, file);
            showAlert('success', 'Receipt uploaded.');
            await refreshAll();
        } catch (e) { showAlert('danger', e.message || 'Could not upload the receipt.'); }
    }

    async function removeReceipt(paymentId) {
        if (!confirm('Remove the receipt from this payment?')) return;
        try {
            await SoftwareCosts.removeReceipt(paymentId);
            showAlert('success', 'Receipt removed.');
            await refreshAll();
        } catch (e) { showAlert('danger', e.message || 'Could not remove the receipt.'); }
    }

    function receiptCell(p) {
        var out = [];
        if (p.hasReceipt) {
            out.push('<a href="#" data-act="view-receipt" data-id="' + p.id + '" title="' + esc(p.receiptName || '') + '">View</a>');
            if (can(P.pay)) out.push('<a href="#" class="text-secondary" data-act="upload-receipt" data-id="' + p.id + '">Replace</a>');
            if (can(P.pay)) out.push('<a href="#" class="text-danger" data-act="remove-receipt" data-id="' + p.id + '">Remove</a>');
        } else if (can(P.pay)) {
            out.push('<a href="#" data-act="upload-receipt" data-id="' + p.id + '">Upload</a>');
        } else {
            out.push('<span class="text-secondary">-</span>');
        }
        return '<span class="small">' + out.join(' · ') + '</span>';
    }

    function paymentActions(p) {
        var out = [];
        if (can(P.pay)) out.push('<a href="#" class="btn btn-sm btn-ghost-secondary" data-act="edit-payment" data-id="' + p.id + '">Edit</a>');
        if (can(P.del)) out.push('<a href="#" class="btn btn-sm btn-ghost-danger" data-act="delete-payment" data-id="' + p.id + '">Delete</a>');
        return out.join('');
    }

    /** The payment's finance ledger reference, or a note that it is not posted yet. */
    function ledgerTag(p) {
        if (p.ledger) return '<div class="small"><a href="financial-transactions.html" class="text-secondary" title="Posted to Finance">' + esc(p.ledger.reference) + '</a></div>';
        return '<div class="small text-warning" title="Add the naira cost to post it">Not in Finance</div>';
    }

    function periodText(p) {
        if (!p.periodStart && !p.periodEnd) return '<span class="text-secondary">-</span>';
        return '<span class="small">' + fmtDate(p.periodStart) + ' to ' + fmtDate(p.periodEnd) + '</span>';
    }

    // ── Payments tab ────────────────────────────────────────────────────────

    async function loadPayments() {
        var tbody = $('payments-tbody');
        tbody.innerHTML = '<tr><td colspan="9" class="text-center py-5"><div class="spinner-border text-primary"></div></td></tr>';
        try {
            _payments = await SoftwareCosts.listPayments({
                from: $('p-from').value,
                to: $('p-to').value,
                subscriptionId: $('p-service').value,
                category: $('p-category').value,
            });
            _paymentsLoaded = true;
            renderPayments();
        } catch (e) {
            tbody.innerHTML = '<tr><td colspan="9" class="text-center text-danger py-4">' + esc(e.message || 'Failed to load.') + '</td></tr>';
        }
    }

    function renderPayments() {
        var rows = _payments.payments;
        $('payments-tbody').innerHTML = rows.length ? rows.map(function (p) {
            return '<tr>' +
                '<td class="text-nowrap">' + fmtDate(p.paidAt) + '</td>' +
                '<td><a href="#" class="text-reset fw-semibold" data-act="view" data-id="' + p.subscriptionId + '">' + esc(p.subscription.name) + '</a>' +
                '<div class="text-secondary small">' + esc(p.subscription.categoryLabel) + '</div></td>' +
                '<td class="text-end text-nowrap">' + esc(money(p.amount, p.currency)) + '</td>' +
                '<td class="text-end text-nowrap">' + (p.amountNgn === null ? '<span class="text-secondary small">Not converted</span>' : esc(ngn(p.amountNgn))) + ledgerTag(p) + '</td>' +
                '<td>' + periodText(p) + '</td>' +
                '<td class="small">' + esc(p.paymentMethod || '-') + (p.reference ? '<div class="text-secondary">' + esc(p.reference) + '</div>' : '') + '</td>' +
                '<td>' + receiptCell(p) + '</td>' +
                '<td class="small">' + esc(p.recordedBy || '-') + '</td>' +
                '<td class="text-nowrap">' + paymentActions(p) + '</td>' +
                '</tr>';
        }).join('') : '<tr><td colspan="9" class="text-center text-secondary py-5">No payments in this range.</td></tr>';

        var foreign = {};
        Object.keys(_payments.byCurrency || {}).forEach(function (c) { if (c !== 'NGN') foreign[c] = _payments.byCurrency[c]; });
        var extra = [];
        if (currencyLine(foreign)) extra.push('includes ' + currencyLine(foreign));
        if (currencyLine(_payments.unconverted)) extra.push('not converted: ' + currencyLine(_payments.unconverted));
        $('payments-tfoot').innerHTML = rows.length
            ? '<tr><th colspan="3">' + rows.length + ' payment' + (rows.length === 1 ? '' : 's') + '</th><th class="text-end">' + esc(ngn(_payments.totalNgn)) + '</th>' +
              '<th colspan="5" class="text-secondary small fw-normal">' + esc(extra.join('; ')) + '</th></tr>'
            : '';
    }

    function exportPayments() {
        var go = function () {
            CsvExport.download('software-payments-' + ($('p-from').value || 'all') + '-to-' + ($('p-to').value || today()) + '.csv', [
                { label: 'Date paid', get: function (p) { return p.paidAt; } },
                { label: 'Service', get: function (p) { return p.subscription.name; } },
                { label: 'Provider', get: function (p) { return p.subscription.provider || ''; } },
                { label: 'Category', get: function (p) { return p.subscription.categoryLabel; } },
                { label: 'Currency', get: function (p) { return p.currency; } },
                { label: 'Amount', get: function (p) { return p.amount; } },
                { label: 'In NGN', get: function (p) { return p.amountNgn === null ? '' : p.amountNgn; } },
                { label: 'Period start', get: function (p) { return p.periodStart || ''; } },
                { label: 'Period end', get: function (p) { return p.periodEnd || ''; } },
                { label: 'Paid with', get: function (p) { return p.paymentMethod || ''; } },
                { label: 'Reference', get: function (p) { return p.reference || ''; } },
                { label: 'Notes', get: function (p) { return p.notes || ''; } },
                { label: 'Receipt', get: function (p) { return p.hasReceipt ? 'Yes' : 'No'; } },
                { label: 'Recorded by', get: function (p) { return p.recordedBy || ''; } },
                { label: 'Finance reference', get: function (p) { return p.ledger ? p.ledger.reference : ''; } },
            ], _payments.payments);
        };
        if (_paymentsLoaded) go(); else loadPayments().then(function () { if (_payments) go(); });
    }

    // ── Details ─────────────────────────────────────────────────────────────

    async function openDetail(id) {
        _detailId = id;
        _detail = null;
        var s = serviceById(id);
        $('detail-title').textContent = s ? s.name : 'Service';
        $('detail-body').innerHTML = '<div class="text-center py-5"><div class="spinner-border text-primary"></div></div>';
        $('detail-footer').innerHTML = '';
        modal('modal-detail').show();
        await loadDetail(id);
    }

    function infoRow(label, value) {
        return '<div class="col-sm-6 col-lg-4"><div class="text-secondary small">' + esc(label) + '</div><div class="fw-semibold">' + value + '</div></div>';
    }

    async function loadDetail(id) {
        try {
            var d = await SoftwareCosts.getService(id);
            _detail = d;
            $('detail-title').innerHTML = esc(d.name) + ' ' + statusBadge(d.status);
            var amount = d.expectedAmount === null ? 'Varies' : (d.amountType === 'VARIABLE' ? 'About ' : '') + money(d.expectedAmount, d.currency);
            var link = d.billingUrl ? '<a href="' + esc(d.billingUrl) + '" target="_blank" rel="noopener">Open billing page</a>' : '-';
            var recipients = d.reminderEnabled
                ? (d.recipients.length ? d.recipients.map(function (r) {
                    return esc(r.name) + (r.email ? '' : ' <span class="text-danger small">(no email)</span>') + (r.stillEmployed ? '' : ' <span class="text-warning small">(left)</span>');
                }).join(', ') : 'No staff picked') + ' <span class="text-secondary small">+ all Super Admins</span>'
                : 'Off';
            var due = d.nextDueDate ? fmtDate(d.nextDueDate) + ' ' + dueBadge(d) : (d.billingCycle === 'ONE_TIME' ? 'Settled' : 'Not set');

            var paymentsHtml = d.payments.length ? '<div class="table-responsive"><table class="table table-sm table-vcenter">' +
                '<thead><tr><th>Date paid</th><th class="text-end">Amount</th><th class="text-end">In NGN</th><th>Period</th><th>Method / reference</th><th>Receipt</th><th>Recorded by</th><th></th></tr></thead><tbody>' +
                d.payments.map(function (p) {
                    return '<tr><td class="text-nowrap">' + fmtDate(p.paidAt) + (p.settledDueDate ? '<div class="text-secondary small">for ' + fmtDate(p.settledDueDate) + '</div>' : '') + '</td>' +
                        '<td class="text-end text-nowrap">' + esc(money(p.amount, p.currency)) + '</td>' +
                        '<td class="text-end text-nowrap">' + (p.amountNgn === null ? '<span class="text-secondary small">-</span>' : esc(ngn(p.amountNgn))) + ledgerTag(p) + '</td>' +
                        '<td>' + periodText(p) + '</td>' +
                        '<td class="small">' + esc(p.paymentMethod || '-') + (p.reference ? '<div class="text-secondary">' + esc(p.reference) + '</div>' : '') + (p.notes ? '<div class="text-secondary">' + esc(p.notes) + '</div>' : '') + '</td>' +
                        '<td>' + receiptCell(p) + '</td>' +
                        '<td class="small">' + esc(p.recordedBy || '-') + '</td>' +
                        '<td class="text-nowrap">' + paymentActions(p) + '</td></tr>';
                }).join('') + '</tbody></table></div>'
                : '<div class="text-secondary py-3">No payments recorded yet.</div>';

            var remindersHtml = d.recentReminders.length ? '<ul class="list-unstyled small mb-0">' + d.recentReminders.map(function (r) {
                var kind = r.kind === 'TEST' ? 'Test' : r.kind.indexOf('OVERDUE_') === 0 ? r.kind.slice(8) + ' day(s) overdue' : (r.kind === 'BEFORE_0' ? 'On the due date' : r.kind.slice(7) + ' day(s) before');
                return '<li>' + new Date(r.sentAt).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }) + ': ' + esc(kind) + ' (due ' + fmtDate(r.dueDate) + '), ' + r.recipientCount + ' email(s)</li>';
            }).join('') + '</ul>' : '<div class="text-secondary small">No reminders sent yet.</div>';

            $('detail-body').innerHTML =
                (d.description ? '<p class="text-secondary">' + esc(d.description) + '</p>' : '') +
                '<div class="row g-3 mb-3">' +
                infoRow('Provider', esc(d.provider || '-')) +
                infoRow('Category', esc(d.categoryLabel)) +
                infoRow('Billing', esc(d.billingCycleLabel) + (d.autoRenew ? ' <span class="text-secondary small">auto-renews</span>' : '')) +
                infoRow(d.amountType === 'VARIABLE' ? 'Estimate per cycle' : 'Price per cycle', esc(amount)) +
                infoRow('Next due', due) +
                infoRow('Started', esc(fmtDate(d.startDate))) +
                infoRow('Paid with', esc(d.paymentMethod || '-')) +
                infoRow('Account email', esc(d.accountEmail || '-')) +
                infoRow('Billing page', link) +
                infoRow('Total paid (NGN)', esc(ngn(d.totalPaidNgn)) + ' <span class="text-secondary small">' + d.paymentCount + ' payment(s)</span>') +
                infoRow('Reminders', d.reminderEnabled ? esc(daysLabel(d.reminderDaysBefore)) + (d.remindWhenOverdue ? '; again if overdue' : '') : 'Off') +
                infoRow('Reminder staff', recipients) +
                (d.status === 'CANCELLED' ? infoRow('Cancelled on', esc(fmtDate(d.cancelledAt))) : '') +
                '</div>' +
                (d.notes ? '<div class="mb-3"><div class="text-secondary small">Notes</div><div style="white-space:pre-wrap">' + esc(d.notes) + '</div></div>' : '') +
                '<h4 class="mt-2">Payment history</h4>' + paymentsHtml +
                '<h4 class="mt-3">Recent reminders</h4>' + remindersHtml +
                '<div class="text-secondary small mt-3">Added by ' + esc(d.createdBy || 'unknown') + ' on ' + new Date(d.createdAt).toLocaleDateString('en-GB') +
                (d.updatedBy ? '. Last changed by ' + esc(d.updatedBy) + ' on ' + new Date(d.updatedAt).toLocaleDateString('en-GB') : '') + '.</div>';

            var f = [];
            if (can(P.del)) f.push('<button class="btn btn-outline-danger me-auto" data-act="delete-service" data-id="' + d.id + '">Delete</button>');
            if (can(P.manage)) {
                if (d.status === 'ACTIVE') f.push('<button class="btn btn-outline-secondary" data-act="pause" data-id="' + d.id + '">Pause</button>');
                if (d.status !== 'ACTIVE') f.push('<button class="btn btn-outline-success" data-act="activate" data-id="' + d.id + '">Reactivate</button>');
                if (d.status !== 'CANCELLED') f.push('<button class="btn btn-outline-secondary" data-act="cancel" data-id="' + d.id + '">Cancel service</button>');
                if (d.reminderEnabled && d.status === 'ACTIVE') f.push('<button class="btn btn-outline-secondary" data-act="test" data-id="' + d.id + '">Send test reminder</button>');
                f.push('<button class="btn btn-outline-primary" data-act="edit" data-id="' + d.id + '">Edit</button>');
            }
            if (can(P.pay)) f.push('<button class="btn btn-primary" data-act="pay" data-id="' + d.id + '">Record payment</button>');
            $('detail-footer').innerHTML = f.join('');
        } catch (e) {
            $('detail-body').innerHTML = '<div class="alert alert-danger">' + esc(e.message || 'Failed to load the service.') + '</div>';
        }
    }

    // A form opened from the details window replaces it, and the details
    // window comes back (refreshed) when the form closes.
    var _returnToDetail = null;
    document.addEventListener('DOMContentLoaded', function () {
        ['modal-service', 'modal-payment'].forEach(function (id) {
            $(id).addEventListener('show.bs.modal', function () {
                var detail = $('modal-detail');
                if (detail.classList.contains('show')) {
                    _returnToDetail = _detailId;
                    bootstrap.Modal.getInstance(detail).hide();
                }
            });
            $(id).addEventListener('hidden.bs.modal', function () {
                if (!_returnToDetail) return;
                var back = _returnToDetail;
                _returnToDetail = null;
                if (serviceById(back)) openDetail(back);
            });
        });
    });
})();
