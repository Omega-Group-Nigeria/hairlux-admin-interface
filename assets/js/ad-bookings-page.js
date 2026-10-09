/**
 * Ad Bookings page (ad-bookings.html).
 * Funnel and money for bookings from the ad landing page (book-now.html):
 * checkouts started vs paid, what was collected online and at the branch,
 * results by campaign / channel / branch / service, and the list of
 * checkouts (unpaid ones are leads to follow up). Settings (deposit %,
 * minimum deposit, full payment, Meta Pixel, booking window) for those
 * with ad_bookings:manage_settings, and a UTM link builder for ads.
 */
(function () {
    'use strict';

    var P = { read: 'ad_bookings:read', manage: 'ad_bookings:manage_settings' };
    var LIMIT = 25;
    var _summary = null;
    var _group = 'byCampaign';
    var _page = 1;
    var _totalPages = 1;
    var _chart = null;
    var _landing = null;
    var _settings = null;
    var _searchTimer = null;

    var GROUP_HEAD = { byCampaign: 'Campaign', byChannel: 'Channel', byBranch: 'Branch', byService: 'Service' };
    var STATUS_BADGE = {
        BOOKED: ['bg-green-lt', 'Booked'],
        PENDING: ['bg-yellow-lt', 'Pending payment'],
        EXPIRED: ['bg-secondary-lt', 'Unpaid (expired)'],
        FAILED: ['bg-red-lt', 'Failed'],
    };
    var BOOKING_STATUS = {
        CONFIRMED: 'Upcoming',
        COMPLETED: 'Checked in',
        CANCELLED: 'Cancelled',
    };

    // ── Helpers ─────────────────────────────────────────────────────────────

    function $(id) { return document.getElementById(id); }

    function esc(s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    }

    function can(p) { return RBAC.can(p); }

    // Bootstrap comes bundled in tabler.min.js.
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

    function fmtDate(str) {
        if (!str) return '-';
        return new Date(String(str).slice(0, 10) + 'T00:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
    }

    function fmtDateTime(iso) {
        if (!iso) return '-';
        return new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'Africa/Lagos' });
    }

    function time12(hhmm) {
        var p = String(hhmm || '').split(':');
        var h = Number(p[0]);
        return (h % 12 || 12) + ':' + (p[1] || '00') + ' ' + (h >= 12 ? 'PM' : 'AM');
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
            branchId: $('f-branch').value || undefined,
            campaign: $('f-campaign').value || undefined,
        };
    }

    /** The public landing page on the customer site (editable in the link builder). */
    function landingUrl() { return 'https://www.hairlux.com.ng/book-now.html'; }

    // ── Summary ─────────────────────────────────────────────────────────────

    async function loadSummary() {
        try {
            _summary = await AdBookings.summary(filters());
        } catch (e) {
            showAlert('danger', e.message || 'Could not load the summary.');
            return;
        }
        var t = _summary.totals;
        $('kpi-started').textContent = t.started.toLocaleString();
        $('kpi-started-sub').textContent = fmtDate(_summary.from) + ' to ' + fmtDate(_summary.to);
        $('kpi-booked').textContent = t.booked.toLocaleString();
        $('kpi-booked-sub').textContent = pct(t.conversionRate) + ' of checkouts paid · ' + ngn(t.bookedValue) + ' booked';
        // Net of deposits refunded to wallets on cancellation.
        $('kpi-collected').textContent = ngn(t.onlineCollected + t.balanceCollected - t.refundedToWallet);
        $('kpi-collected-sub').textContent = ngn(t.onlineCollected) + ' online + ' + ngn(t.balanceCollected) + ' at branches' +
            (t.refundedToWallet ? ', less ' + ngn(t.refundedToWallet) + ' refunded' : '');
        $('kpi-outstanding').textContent = ngn(t.balanceOutstanding);
        $('kpi-outstanding-sub').textContent = t.upcoming + ' upcoming · ' + t.noShows + ' not checked in';

        $('o-upcoming').textContent = t.upcoming;
        $('o-completed').textContent = t.completed;
        $('o-noshow').textContent = t.noShows;
        $('o-cancelled').textContent = t.cancelled;
        $('o-split').textContent = t.depositPayments + ' / ' + t.fullPayments;
        $('o-accounts').textContent = t.newAccounts;
        $('o-refunded').textContent = ngn(t.refundedToWallet);
        $('o-unpaid').textContent = (t.pending + t.expired) + (t.failed ? ' (+' + t.failed + ' failed)' : '');

        // Campaign filter options come from what has actually been seen.
        var sel = $('f-campaign');
        var current = sel.value;
        var names = _summary.byCampaign.map(function (r) { return r.key; });
        if (current && names.indexOf(current) === -1) names.push(current);
        sel.innerHTML = '<option value="">All campaigns</option>' + names.sort().map(function (n) {
            return '<option value="' + esc(n) + '"' + (n === current ? ' selected' : '') + '>' + esc(n) + '</option>';
        }).join('');

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
                '<td class="text-end">' + r.booked + '</td>' +
                '<td class="text-end">' + pct(r.conversionRate) + '</td>' +
                '<td class="text-end">' + ngn(r.bookedValue) + '</td>' +
                '<td class="text-end">' + ngn(r.collected) + '</td>' +
                '</tr>';
        }).join('') : '<tr><td colspan="6" class="text-secondary text-center py-4">No ad bookings in this period.</td></tr>';
    }

    function renderTrend() {
        var trend = _summary.trend || [];
        var opts = {
            chart: { type: 'bar', height: 260, toolbar: { show: false }, fontFamily: 'inherit', parentHeightOffset: 0 },
            series: [
                { name: 'Checkouts started', data: trend.map(function (d) { return d.started; }) },
                { name: 'Booked (paid)', data: trend.map(function (d) { return d.booked; }) },
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

    function intentParams(extra) {
        return Object.assign({}, filters(), {
            status: $('i-status').value || undefined,
            search: $('i-search').value.trim() || undefined,
            page: _page,
            limit: LIMIT,
        }, extra || {});
    }

    function sourceCell(it) {
        var main = it.acquisitionChannel || 'Unknown';
        var sub = [it.utmCampaign, it.utmContent].filter(Boolean).join(' · ');
        return esc(main) + (sub ? '<div class="text-secondary small">' + esc(sub) + '</div>' : '');
    }

    function statusCell(it) {
        var b = STATUS_BADGE[it.status] || ['bg-secondary-lt', it.status];
        var html = '<span class="badge ' + b[0] + '">' + b[1] + '</span>';
        if (it.booking) {
            html += '<div class="small mt-1"><span class="font-monospace">' + esc(it.booking.reservationCode) + '</span> · ' +
                esc(BOOKING_STATUS[it.booking.status] || it.booking.status.replace(/_/g, ' ').toLowerCase()) + '</div>';
        }
        if (it.failureReason && it.status !== 'BOOKED') {
            html += '<div class="text-danger small mt-1">' + esc(it.failureReason) + '</div>';
        }
        return html;
    }

    function balanceCell(it) {
        if (!it.booking) return '<span class="text-secondary">' + ngn(it.totalAmount) + ' total</span>';
        if (it.booking.balancePaidAmount) {
            return ngn(0) + '<div class="text-secondary small">' + ngn(it.booking.balancePaidAmount) + ' paid by ' +
                esc(String(it.booking.balancePaymentMethod || '').replace(/_/g, ' ').toLowerCase()) + '</div>';
        }
        return it.booking.balanceDue > 0 ? '<strong class="text-danger">' + ngn(it.booking.balanceDue) + '</strong>' : ngn(0);
    }

    async function loadIntents() {
        var body = $('intents-body');
        body.innerHTML = '<tr><td colspan="7" class="text-secondary text-center py-4">Loading&hellip;</td></tr>';
        var data;
        try {
            data = await AdBookings.intents(intentParams());
        } catch (e) {
            body.innerHTML = '<tr><td colspan="7" class="text-danger text-center py-4">' + esc(e.message) + '</td></tr>';
            return;
        }
        _totalPages = data.pagination.totalPages;
        body.innerHTML = data.items.length ? data.items.map(function (it) {
            return '<tr>' +
                '<td class="text-nowrap">' + fmtDateTime(it.createdAt) + '</td>' +
                '<td><div>' + esc(it.fullName) + (it.accountCreated ? ' <span class="badge bg-blue-lt" title="Account created by this booking">New</span>' : '') + '</div>' +
                '<div class="text-secondary small"><a href="tel:' + esc(it.phone) + '" class="text-reset">' + esc(it.phone) + '</a> · ' +
                '<a href="mailto:' + esc(it.email) + '" class="text-reset">' + esc(it.email) + '</a></div></td>' +
                '<td><div>' + esc(it.serviceName) + '</div><div class="text-secondary small">' + esc(it.branch ? it.branch.name : '-') + ' · ' +
                fmtDate(it.bookingDate) + ', ' + time12(it.bookingTime) + '</div></td>' +
                '<td>' + sourceCell(it) + '</td>' +
                '<td class="text-end">' + (it.status === 'BOOKED' ? ngn(it.amountToPay) : '<span class="text-secondary">' + ngn(0) + '</span>') +
                '<div class="text-secondary small">' + (it.paymentOption === 'FULL' ? 'Full price' : 'Deposit') + '</div></td>' +
                '<td class="text-end">' + balanceCell(it) + '</td>' +
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
                var data = await AdBookings.intents(intentParams({ page: page, limit: 500 }));
                rows = rows.concat(data.items);
                if (page >= data.pagination.totalPages) break;
            }
            if (!rows.length) { showAlert('warning', 'Nothing to export for these filters.'); return; }
            CsvExport.download('ad-bookings-' + ($('f-from').value || 'all') + '-to-' + ($('f-to').value || lagosToday()) + '.csv', [
                { label: 'Started', get: function (r) { return fmtDateTime(r.createdAt); } },
                { label: 'Status', get: function (r) { return (STATUS_BADGE[r.status] || [0, r.status])[1]; } },
                { label: 'Reference', get: function (r) { return r.reference; } },
                { label: 'Reservation code', get: function (r) { return r.booking ? r.booking.reservationCode : ''; } },
                { label: 'Name', get: function (r) { return r.fullName; } },
                { label: 'Phone', get: function (r) { return r.phone; } },
                { label: 'Email', get: function (r) { return r.email; } },
                { label: 'Service', get: function (r) { return r.serviceName; } },
                { label: 'Branch', get: function (r) { return r.branch ? r.branch.name : ''; } },
                { label: 'Date', get: function (r) { return r.bookingDate; } },
                { label: 'Time', get: function (r) { return r.bookingTime; } },
                { label: 'Payment option', get: function (r) { return r.paymentOption === 'FULL' ? 'Full' : 'Deposit'; } },
                { label: 'Service price', get: function (r) { return r.totalAmount; } },
                { label: 'Paid online', get: function (r) { return r.status === 'BOOKED' ? r.amountToPay : 0; } },
                { label: 'Balance due', get: function (r) { return r.booking ? r.booking.balanceDue : ''; } },
                { label: 'Balance paid', get: function (r) { return r.booking && r.booking.balancePaidAmount ? r.booking.balancePaidAmount : ''; } },
                { label: 'Booking status', get: function (r) { return r.booking ? (BOOKING_STATUS[r.booking.status] || r.booking.status) : ''; } },
                { label: 'Channel', get: function (r) { return r.acquisitionChannel || ''; } },
                { label: 'utm_source', get: function (r) { return r.utmSource || ''; } },
                { label: 'utm_medium', get: function (r) { return r.utmMedium || ''; } },
                { label: 'utm_campaign', get: function (r) { return r.utmCampaign || ''; } },
                { label: 'utm_content', get: function (r) { return r.utmContent || ''; } },
                { label: 'New account', get: function (r) { return r.accountCreated ? 'Yes' : 'No'; } },
            ], rows);
        } catch (e) {
            showAlert('danger', e.message || 'Export failed.');
        } finally {
            btn.disabled = false;
        }
    }

    // ── Settings ────────────────────────────────────────────────────────────

    function depositExample() {
        var pctV = Number($('s-percent').value) || 0;
        var min = Number($('s-min').value) || 0;
        var ex = [8000, 25000, 60000].map(function (price) {
            var dep = Math.min(price, Math.max(Math.ceil(price * pctV / 100), Math.round(min)));
            return ngn(price) + ' service: ' + ngn(dep) + ' deposit';
        });
        $('s-example').textContent = 'For example, ' + ex.join('; ') + '.';
    }

    async function openSettings() {
        $('settings-error').classList.add('d-none');
        try {
            _settings = await AdBookings.getSettings();
        } catch (e) {
            showAlert('danger', e.message);
            return;
        }
        var s = _settings;
        $('s-enabled').checked = s.enabled;
        $('s-percent').value = s.depositPercent;
        $('s-min').value = s.minDepositAmount;
        $('s-full').checked = s.allowFullPayment;
        $('s-pixel').value = s.metaPixelId || '';
        $('s-days').value = s.maxDaysAhead;
        var lead = $('s-lead');
        if (!Array.prototype.some.call(lead.options, function (o) { return Number(o.value) === s.minLeadMinutes; })) {
            lead.insertAdjacentHTML('beforeend', '<option value="' + s.minLeadMinutes + '">' + s.minLeadMinutes + ' minutes</option>');
        }
        lead.value = String(s.minLeadMinutes);
        $('s-updated').textContent = s.updatedAt ? 'Last changed ' + fmtDateTime(s.updatedAt) : '';
        depositExample();
        modal('modal-settings').show();
    }

    async function saveSettings() {
        var err = $('settings-error');
        err.classList.add('d-none');
        var payload = {
            enabled: $('s-enabled').checked,
            depositPercent: Number($('s-percent').value),
            minDepositAmount: Number($('s-min').value),
            allowFullPayment: $('s-full').checked,
            metaPixelId: $('s-pixel').value.trim(),
            minLeadMinutes: Number($('s-lead').value),
            maxDaysAhead: Number($('s-days').value),
        };
        if (!(payload.depositPercent >= 0 && payload.depositPercent <= 100)) {
            err.textContent = 'The deposit must be between 0% and 100%.';
            err.classList.remove('d-none');
            return;
        }
        if (payload.depositPercent === 0 && payload.minDepositAmount <= 0) {
            err.textContent = 'Set a deposit % or a smallest deposit, otherwise customers pay nothing to hold a slot.';
            err.classList.remove('d-none');
            return;
        }
        var btn = $('btn-save-settings');
        btn.disabled = true;
        try {
            _settings = await AdBookings.saveSettings(payload);
            modal('modal-settings').hide();
            showAlert('success', 'Settings saved. The landing page uses them within 2 minutes.');
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
        var base = $('l-base').value.trim() || landingUrl();
        var q = new URLSearchParams();
        q.set('utm_source', $('l-source').value);
        q.set('utm_medium', $('l-medium').value);
        if (slug($('l-campaign').value)) q.set('utm_campaign', slug($('l-campaign').value));
        if (slug($('l-content').value)) q.set('utm_content', slug($('l-content').value));
        if ($('l-service').value) q.set('service', $('l-service').value);
        if ($('l-branch').value) q.set('branch', $('l-branch').value);
        $('l-output').value = base + (base.indexOf('?') === -1 ? '?' : '&') + q.toString();
    }

    async function openLinks() {
        if (!$('l-base').value) $('l-base').value = landingUrl();
        if (_landing) {
            $('l-service').innerHTML = '<option value="">None</option>' + _landing.services.map(function (s) {
                return '<option value="' + esc(s.id) + '">' + esc(s.name) + '</option>';
            }).join('');
            $('l-branch').innerHTML = '<option value="">None</option>' + _landing.branches.map(function (b) {
                return '<option value="' + esc(b.id) + '">' + esc(b.name) + '</option>';
            }).join('');
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
        _page = 1;
        loadSummary();
        loadIntents();
    }

    function wireEvents() {
        $('btn-apply').addEventListener('click', reloadAll);
        $('f-branch').addEventListener('change', reloadAll);
        $('f-campaign').addEventListener('change', reloadAll);
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
        $('i-status').addEventListener('change', function () { _page = 1; loadIntents(); });
        $('i-search').addEventListener('input', function () {
            clearTimeout(_searchTimer);
            _searchTimer = setTimeout(function () { _page = 1; loadIntents(); }, 350);
        });
        $('i-prev').addEventListener('click', function () { if (_page > 1) { _page--; loadIntents(); } });
        $('i-next').addEventListener('click', function () { if (_page < _totalPages) { _page++; loadIntents(); } });
        $('btn-export').addEventListener('click', exportCsv);
        $('btn-settings').addEventListener('click', openSettings);
        $('btn-save-settings').addEventListener('click', saveSettings);
        ['s-percent', 's-min'].forEach(function (id) { $(id).addEventListener('input', depositExample); });
        $('btn-link-builder').addEventListener('click', openLinks);
        ['l-base', 'l-source', 'l-medium', 'l-campaign', 'l-content', 'l-service', 'l-branch'].forEach(function (id) {
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

        $('landing-link').href = landingUrl();
        setRange(30);

        try {
            _landing = await AdBookings.landingConfig();
            var managed = (RBAC.isManagerScoped && RBAC.isManagerScoped()) ? RBAC.getManagedBranchIds() : null;
            $('f-branch').innerHTML = (managed ? '' : '<option value="">All branches</option>') + _landing.branches
                .filter(function (b) { return !managed || managed.indexOf(b.id) !== -1; })
                .map(function (b) { return '<option value="' + esc(b.id) + '">' + esc(b.name) + '</option>'; }).join('');
        } catch (e) { /* filters still work without branch names */ }

        reloadAll();
    });
})();
